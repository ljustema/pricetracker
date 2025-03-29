import { NextRequest, NextResponse } from "next/server";
import { ScraperService } from "@/lib/services/scraper-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import os from "os";

// Define expected product structure (adjust fields as needed)
interface Product {
  name: string;
  price: number;
  currency?: string;
  url?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
}

// Define the metadata structure
interface ScraperMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  target_url: string;
  required_libraries: string[];
  [key: string]: unknown; // Allow for additional properties
}

// Maximum time to wait for validation (in milliseconds)
const VALIDATION_TIMEOUT = 30000; // 30 seconds

// Maximum number of batches to process for validation
const MAX_BATCHES_TO_VALIDATE = 3;

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    // Validate required fields
    if (!data.python_script) {
      return NextResponse.json(
        { error: "Missing python_script field" },
        { status: 400 }
      );
    }

    // Validate the Python script structure
    const validationResult = await ScraperService.validatePythonScraper(data.python_script);
    
    // Ensure metadata exists and has the correct shape
    const metadata: ScraperMetadata = validationResult.metadata || {
      name: 'Python Batch Scraper',
      description: 'A Python scraper that processes products in batches',
      version: '1.0.0',
      author: 'User',
      target_url: '',
      required_libraries: []
    };
    
    if (!validationResult.valid) {
      // Return structure validation errors immediately, ensuring output fields exist
      return NextResponse.json({
        ...validationResult,
        metadata,
        rawStdout: '',
        rawStderr: '',
      });
    }
    
    // If validation passed, execute the script to get real products
    let scriptPath = '';
    let tempDir = '';
    try {
      // Create a temporary directory for the script
      tempDir = path.join(os.tmpdir(), "pricetracker-" + randomUUID());
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Write the script to a temporary file
      scriptPath = path.join(tempDir, "script.py");
      fs.writeFileSync(scriptPath, data.python_script);
      
      // --- Script Execution with Streaming ---
      const validationResults = await validateScriptExecution(scriptPath, metadata);
      
      // Return the comprehensive result
      return NextResponse.json({
        ...validationResult,
        ...validationResults
      });
    } catch (setupError) {
      console.error("Error setting up for Python script execution:", setupError);
      return NextResponse.json({
        ...validationResult,
        executionError: `Setup error before script execution: ${setupError instanceof Error ? setupError.message : "Unknown error"}`,
        rawStdout: '',
        rawStderr: '',
      });
    } finally {
      // Clean up the temporary files
      if (scriptPath && fs.existsSync(scriptPath)) {
        try {
          fs.unlinkSync(scriptPath);
        } catch (unlinkError) {
          console.error("Error unlinking temporary script file:", unlinkError);
        }
      }
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmdirSync(tempDir, { recursive: true });
        } catch (rmdirError) {
          console.error("Error removing temporary directory:", rmdirError);
        }
      }
    }
  } catch (error) {
    console.error("Error in validate API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Validates script execution by running it and processing streamed output
 */
async function validateScriptExecution(scriptPath: string, initialMetadata: ScraperMetadata) {
  return new Promise<{
    products: Product[];
    totalProductsFound: number;
    executionError: string | null;
    rawStdout: string;
    rawStderr: string;
    batchesProcessed: number;
    progressMessages: string[];
    metadata: ScraperMetadata;
  }>(async (resolve) => {
    let pythonCommand = '';
    const pythonCommands = ['python', 'python3', 'py'];
    
    // Find a working Python command
    for (const cmd of pythonCommands) {
      try {
        const testProcess = spawn(cmd, ['-c', 'print("test")']);
        await new Promise<void>((resolveTest, rejectTest) => {
          testProcess.on('close', (code) => {
            if (code === 0) resolveTest();
            else rejectTest(new Error(`Test command exited with code ${code}`));
          });
          testProcess.on('error', rejectTest);
        });
        pythonCommand = cmd;
        break;
      } catch (error) {
        console.warn(`Python command ${cmd} not available:`, error);
      }
    }
    
    if (!pythonCommand) {
      resolve({
        products: [],
        totalProductsFound: 0,
        executionError: "No Python interpreter found. Please ensure Python is installed and available in PATH.",
        rawStdout: '',
        rawStderr: '',
        batchesProcessed: 0,
        progressMessages: [],
        metadata: initialMetadata
      });
      return;
    }
    
    // First, get metadata
    let metadata = initialMetadata;
    try {
      const metadataProcess = spawn(pythonCommand, [
        '-c', 
        `import sys; sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8'); exec(open('${scriptPath.replace(/\\/g, '\\\\')}', encoding='utf-8').read())`,
        'metadata'
      ]);
      
      let metadataOutput = '';
      metadataProcess.stdout.on('data', (data) => {
        metadataOutput += data.toString();
      });
      
      await new Promise<void>((resolveMetadata, rejectMetadata) => {
        metadataProcess.on('close', (code) => {
          if (code === 0) resolveMetadata();
          else rejectMetadata(new Error(`Metadata command exited with code ${code}`));
        });
        metadataProcess.on('error', rejectMetadata);
      });
      
      try {
        const parsedMetadata = JSON.parse(metadataOutput.trim());
        // Update metadata with the parsed values
        metadata = { ...metadata, ...parsedMetadata };
      } catch (error) {
        console.error("Error parsing metadata:", error);
        // Keep using the initial metadata if parsing fails
      }
    } catch (error) {
      console.error("Error getting metadata:", error);
      // Continue with initial metadata
    }
    
    // Now run the scrape command to test batch processing
    const process = spawn(pythonCommand, [
      '-c', 
      `import sys; sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8'); exec(open('${scriptPath.replace(/\\/g, '\\\\')}', encoding='utf-8').read())`,
      'scrape'
    ]);
    
    let stdoutBuffer = '';
    let stderrBuffer = '';
    const progressMessages: string[] = [];
    const allProducts: Product[] = [];
    let batchesProcessed = 0;
    let executionError: string | null = null;
    
    // Set up a timeout to kill the process if it runs too long
    const timeoutId = setTimeout(() => {
      console.warn("Validation timeout reached, killing process");
      process.kill();
      executionError = "Validation timeout reached. The script took too long to execute.";
    }, VALIDATION_TIMEOUT);
    
    // Process stdout (JSON batches)
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      
      // Process complete lines
      const lines = stdoutBuffer.split('\n');
      // Keep the last line in the buffer if it's incomplete
      stdoutBuffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const batch = JSON.parse(line);
          if (Array.isArray(batch)) {
            // Add products from this batch
            allProducts.push(...batch);
            batchesProcessed++;
            
            // Stop after processing MAX_BATCHES_TO_VALIDATE
            if (batchesProcessed >= MAX_BATCHES_TO_VALIDATE) {
              console.log(`Reached maximum batches (${MAX_BATCHES_TO_VALIDATE}) for validation, stopping process`);
              process.kill();
              break;
            }
          } else {
            console.warn("Received non-array batch:", line);
          }
        } catch (error) {
          console.error("Error parsing batch JSON:", error, "Line:", line);
          executionError = `Error parsing batch JSON: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    });
    
    // Process stderr (progress messages)
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;
      
      // Process complete lines
      const lines = stderrBuffer.split('\n');
      // Keep the last line in the buffer if it's incomplete
      stderrBuffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Check for progress messages
        if (line.includes('PROGRESS:')) {
          progressMessages.push(line);
        } else {
          // Non-progress messages might indicate errors
          console.warn("Non-progress stderr message:", line);
        }
      }
    });
    
    // Handle process completion
    process.on('close', (code) => {
      clearTimeout(timeoutId);
      
      // Process any remaining data in buffers
      if (stdoutBuffer.trim()) {
        try {
          const batch = JSON.parse(stdoutBuffer.trim());
          if (Array.isArray(batch)) {
            allProducts.push(...batch);
            batchesProcessed++;
          }
        } catch (error) {
          console.error("Error parsing final batch JSON:", error);
          if (!executionError) {
            executionError = `Error parsing final batch JSON: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }
      
      // Check for non-zero exit code
      if (code !== 0 && code !== null) {
        if (!executionError) {
          executionError = `Script exited with non-zero code: ${code}`;
        }
      }
      
      // Check if we got any batches
      if (batchesProcessed === 0) {
        executionError = executionError || "Script executed but did not yield any product batches.";
      }
      
      // Check if we got any progress messages
      if (progressMessages.length === 0) {
        console.warn("No progress messages detected in stderr");
        // This is a warning but not necessarily an error
      }
      
      // Limit products to the first 10 for validation response
      const limitedProducts = allProducts.slice(0, 10);
      
      resolve({
        products: limitedProducts,
        totalProductsFound: allProducts.length,
        executionError,
        rawStdout: stdoutBuffer,
        rawStderr: stderrBuffer,
        batchesProcessed,
        progressMessages,
        metadata // Include the metadata in the return value
      });
    });
    
    // Handle process errors
    process.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error("Process error:", error);
      resolve({
        products: [],
        totalProductsFound: 0,
        executionError: `Error spawning process: ${error.message}`,
        rawStdout: stdoutBuffer,
        rawStderr: stderrBuffer,
        batchesProcessed: 0,
        progressMessages,
        metadata
      });
    });
  });
}