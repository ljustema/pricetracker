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
const VALIDATION_TIMEOUT = 120000; // 1 minutes

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
    let tempDir = ''; // Define tempDir here for the main execution + cleanup
    let wrapperPath = ''; 
    try {
      // Create a temporary directory for the main script execution
      tempDir = path.join(os.tmpdir(), "pricetracker-main-" + randomUUID());
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Write the original script to a temporary file
      scriptPath = path.join(tempDir, "script.py");
      fs.writeFileSync(scriptPath, data.python_script);

      // --- Create Wrapper Script ---
      wrapperPath = path.join(tempDir, "wrapper.py"); // Assign path here
      const wrapperScriptContent = `
import sys
import subprocess
import os
import runpy # Use runpy for safer execution
import traceback

def main():
    if len(sys.argv) < 3:
        print("Usage: python wrapper.py <scraper_script_path> <command> [required_lib1, required_lib2, ...]", file=sys.stderr)
        sys.exit(1)

    scraper_script_path = sys.argv[1]
    command = sys.argv[2]
    required_libs = sys.argv[3:]

    # --- Ensure UTF-8 ---
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding.lower() != 'utf-8':
             print(f"Warning: stdout encoding is {sys.stdout.encoding}, attempting to set via environment.", file=sys.stderr)
             os.environ['PYTHONIOENCODING'] = 'utf-8'
        if hasattr(sys.stderr, 'encoding') and sys.stderr.encoding.lower() != 'utf-8':
             print(f"Warning: stderr encoding is {sys.stderr.encoding}, attempting to set via environment.", file=sys.stderr)
             os.environ['PYTHONIOENCODING'] = 'utf-8'
        pass

    # --- Installation Step ---
    if required_libs:
        print(f"Wrapper: Installing required libraries: {', '.join(required_libs)}", file=sys.stderr)
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'pip', 'install', *required_libs],
                capture_output=True, text=True, encoding='utf-8', errors='replace'
            )
            if result.returncode == 0:
                print("Wrapper: Installation successful.", file=sys.stderr)
            else:
                print(f"Wrapper: ERROR - Failed to install libraries (pip exited with code {result.returncode}).", file=sys.stderr)
                if result.stdout: print("\\n--- pip stdout ---\\n", result.stdout, file=sys.stderr)
                if result.stderr: print("\\n--- pip stderr ---\\n", result.stderr, file=sys.stderr)
                sys.exit(1)
        except FileNotFoundError:
             print(f"Wrapper: ERROR - Failed to run pip. Is '{sys.executable} -m pip' command available?", file=sys.stderr)
             sys.exit(1)
        except Exception as e:
            print(f"Wrapper: ERROR - Unexpected error during installation: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            sys.exit(1)
 
    # --- Execution Step ---
    # print(f"Wrapper: Executing {scraper_script_path} with command '{command}'...", file=sys.stderr)
    try:
        original_argv = list(sys.argv)
        sys.argv = [scraper_script_path, command]
        runpy.run_path(scraper_script_path, run_name='__main__')
        # print(f"Wrapper: Execution of '{command}' completed.", file=sys.stderr)
        sys.argv = original_argv
    except SystemExit as e:
        print(f"Wrapper: Script called sys.exit({e.code})", file=sys.stderr)
        sys.exit(e.code if e.code is not None else 0)
    except Exception as e:
        print(f"Wrapper: ERROR - Error during script execution ('{command}'): {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
      fs.writeFileSync(wrapperPath, wrapperScriptContent.trim());


      // --- Script Execution with Streaming (using the wrapper) ---
      // Call the simplified validateScriptExecution function (no scriptContent needed)
      const validationResults = await validateScriptExecution(scriptPath, wrapperPath, metadata); 

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
       // Clean up wrapper script too
      if (wrapperPath && fs.existsSync(wrapperPath)) {
        try {
          fs.unlinkSync(wrapperPath);
        } catch (unlinkError) {
          console.error("Error unlinking temporary wrapper file:", unlinkError);
        }
      }
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          // Use rm instead of rmdir for potentially non-empty dirs if cleanup failed partially
          fs.rmSync(tempDir, { recursive: true, force: true });
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
 * Validates script execution by running it via a wrapper script and processing streamed output.
 * Validates script execution by running metadata, then scrape via a wrapper script.
 */
async function validateScriptExecution(
  scriptPath: string, 
  wrapperPath: string, 
  initialMetadata: ScraperMetadata
  // scriptContent parameter removed as static fallback is no longer needed
) {
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

    // --- Step 1: Execute 'metadata' command ---
    // Assumes Python script imports are delayed, so this runs without needing prior install.
    let metadata = { ...initialMetadata }; // Start with initial, potentially update later
    let metadataExecutionError: string | null = null;
    let metadataRawStderr = '';

    try {
      console.log("Executing metadata command via wrapper...");
      // Execute wrapper with 'metadata' command, NO libraries passed initially
      const metadataArgs = [ wrapperPath, scriptPath, 'metadata' ]; 
      console.log(`Executing: ${pythonCommand} ${metadataArgs.join(' ')}`);
      const metadataProcess = spawn(pythonCommand, metadataArgs);

      let metadataOutput = '';
      metadataProcess.stdout.on('data', (data) => {
        metadataOutput += data.toString();
      });
      // Capture stderr for metadata process
      metadataProcess.stderr.on('data', (data) => {
        metadataRawStderr += data.toString();
      });


      await new Promise<void>((resolveMetadata, rejectMetadata) => {
        metadataProcess.on('close', (code) => {
          if (code === 0) {
             console.log("Metadata execution successful.");
             resolveMetadata();
          } else {
             console.error(`Metadata command exited with code ${code}. Stderr:\n${metadataRawStderr}`);
             // Reject with a detailed error including stderr
             rejectMetadata(new Error(`Metadata command exited with code ${code}. Stderr:\n${metadataRawStderr}`));
          }
        });
        metadataProcess.on('error', (err) => {
           console.error("Error spawning metadata process:", err);
           // Reject on spawn error, include stderr if any was captured before error
           rejectMetadata(new Error(`Failed to start metadata process: ${err.message}. Stderr captured before error:\n${metadataRawStderr}`));
        });
      });

      // If metadata execution succeeded, parse the output
      try {
        const parsedMetadata = JSON.parse(metadataOutput.trim());
        // Merge parsed metadata, prioritizing dynamically executed values
        metadata = { ...initialMetadata, ...parsedMetadata }; 
        console.log("Successfully parsed metadata from script execution.");
      } catch (parseError) {
         console.warn("Metadata command executed but failed to parse JSON output:", parseError, "Output:", metadataOutput);
         // Store the parsing error as the primary metadata error
         metadataExecutionError = `Metadata command executed but failed to parse JSON output. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Output:\n${metadataOutput}`;
         if (metadataRawStderr && !metadataExecutionError.includes(metadataRawStderr)) {
            metadataExecutionError += `\n--- Metadata Stderr ---\n${metadataRawStderr}`;
         }
      }
    } catch (error) {
       console.error("Error during metadata command execution:", error);
       metadataExecutionError = error instanceof Error ? error.message : String(error);
       // Ensure stderr is included if the error object doesn't already contain it well
       if (metadataRawStderr && !metadataExecutionError.includes(metadataRawStderr)) {
          metadataExecutionError += `\n--- Metadata Stderr ---\n${metadataRawStderr}`;
       }
       // If metadata failed, we cannot proceed to scrape reliably
       // Resolve early with the metadata error
       resolve({
         products: [],
         totalProductsFound: 0,
         executionError: metadataExecutionError,
         rawStdout: '', // No scrape stdout
         rawStderr: metadataRawStderr.trim(), // Only metadata stderr
         batchesProcessed: 0,
         progressMessages: [],
         metadata: initialMetadata // Return the initial metadata before failure
       });
       return; // Stop execution here
    }


    // --- Step 2: Install Libraries Directly ---
    let installError: string | null = null;
    if (metadata.required_libraries && metadata.required_libraries.length > 0) {
        console.log("Attempting to install libraries directly:", metadata.required_libraries);
        const installArgs = ['-m', 'pip', 'install', ...metadata.required_libraries];
        try {
            const installProcess = spawn(pythonCommand, installArgs);
            let installStderr = '';
            installProcess.stderr.on('data', (data) => { installStderr += data.toString(); });
            await new Promise<void>((resolveInstall, rejectInstall) => {
                installProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log("Direct library installation successful.");
                        resolveInstall();
                    } else {
                        console.error(`Direct library installation failed with code ${code}. Stderr:\n${installStderr}`);
                        rejectInstall(new Error(`Direct pip install failed with code ${code}. Stderr:\n${installStderr}`));
                    }
                });
                installProcess.on('error', (err) => {
                     console.error("Error spawning direct pip install process:", err);
                     rejectInstall(new Error(`Failed to start pip install process: ${err.message}. Stderr captured before error:\n${installStderr}`));
                });
            });
        } catch (error) {
            console.error("Error during direct library installation:", error);
            installError = error instanceof Error ? error.message : String(error);
            // If install failed, resolve early
            resolve({
                products: [], totalProductsFound: 0,
                executionError: `Failed to install required libraries directly: ${installError}`,
                rawStdout: '', rawStderr: metadataRawStderr + (installError ? `\n--- Install Stderr ---\n${installError}` : ''), // Combine stdouts/stderrs
                batchesProcessed: 0, progressMessages: [], metadata
            });
            return;
        }
    } else {
         console.log("No required libraries specified in metadata, skipping direct installation.");
    }


    // --- Step 3: Execute 'scrape' command DIRECTLY (Bypass Wrapper) ---
    console.log("Executing scrape command directly (bypassing wrapper)...");
    const scrapeArgs = [
        scriptPath, // Execute the original script directly
        'scrape'
     ];
    console.log(`Executing: ${pythonCommand} ${scrapeArgs.join(' ')}`);
    const process = spawn(pythonCommand, scrapeArgs);

    let scrapeStdoutBuffer = '';
    let scrapeStderrBuffer = ''; // Rename to avoid confusion
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
    
    // Process stdout (JSON batches) from scrape process using markers
    // Process stdout (JSON batches) from scrape process using markers
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      // console.log('>>> RAW STDOUT CHUNK:', JSON.stringify(chunk)); // DEBUG: Keep commented for now
      scrapeStdoutBuffer += chunk;

      // --- Process real JSON batches line-by-line ---
      // console.log('>>> CURRENT STDOUT BUFFER:', JSON.stringify(scrapeStdoutBuffer)); // DEBUG: Keep commented for now

      const lines = scrapeStdoutBuffer.split('\n');
      scrapeStdoutBuffer = lines.pop() || ''; // Keep potential partial line

      for (let line of lines) {
          line = line.trim();
          if (!line) continue; // Skip empty lines

          try {
              const batch = JSON.parse(line);
              if (Array.isArray(batch)) {
                  allProducts.push(...batch);
                  batchesProcessed++;
                  console.log(`Successfully parsed batch ${batchesProcessed} from stdout line. Total products so far: ${allProducts.length}`);

                  // Stop after processing MAX_BATCHES_TO_VALIDATE
                  if (batchesProcessed >= MAX_BATCHES_TO_VALIDATE) {
                      console.log(`Reached maximum batches (${MAX_BATCHES_TO_VALIDATE}) for validation, stopping process`);
                      process.kill(); // Sends SIGTERM
                      break; // Stop processing lines in this chunk
                  }
              } else {
                  console.warn("Parsed JSON from stdout line, but it was not an array:", line);
              }
          } catch (error) {
              console.error("Error parsing JSON from stdout line:", error, "Line content:", line);
              // Decide if an error here should count as an executionError
              if (!executionError) { // Only set the first error
                  executionError = `Error parsing batch JSON from stdout line: ${error instanceof Error ? error.message : String(error)}`;
              }
          }
      }
      // --- END Process real JSON batches ---
    }); // End of process.stdout.on('data', ...) handler
    
    // Process stderr (progress messages) from scrape process
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      // console.log('>>> RAW STDERR CHUNK:', JSON.stringify(chunk)); // DEBUG: Keep commented for now
      scrapeStderrBuffer += chunk;

      // Process complete lines
      const lines = scrapeStderrBuffer.split('\n');
      // Keep the last line in the buffer if it's incomplete
      scrapeStderrBuffer = lines.pop() || '';

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

        // Process any remaining data in scrape stdout buffer
        if (scrapeStdoutBuffer.trim()) {
            try {
                const batch = JSON.parse(scrapeStdoutBuffer.trim());
                if (Array.isArray(batch)) {
                    allProducts.push(...batch);
                    batchesProcessed++;
                }
            } catch (error) {
                console.error("Error parsing final batch JSON from scrape stdout:", error);
                if (!executionError) { // Prioritize earlier errors
                    executionError = `Error parsing final batch JSON: ${error instanceof Error ? error.message : String(error)}`;
                }
            }
        }

        // Combine errors: Start with any metadata execution error
        let combinedExecutionError = metadataExecutionError;

        // Check scrape process exit code
        if (code !== 0 && code !== null) {
            // Construct detailed error including scrape stderr
            const scrapeError = `Scrape command exited with code ${code}. Stderr:\n${scrapeStderrBuffer}`;
            console.error(scrapeError);
            // Append scrape error to any existing metadata error
            combinedExecutionError = combinedExecutionError
                ? `${combinedExecutionError}\n\nThen, ${scrapeError}` // Add separation
                : scrapeError;
        } else if (batchesProcessed === 0 && !combinedExecutionError && code === 0) {
             // Only report "no batches" if both metadata and scrape executed successfully (code 0) but produced nothing
             combinedExecutionError = "Script executed successfully but did not yield any product batches.";
             console.warn(combinedExecutionError);
        }


        // Check if we got any progress messages from scrape stderr
        if (progressMessages.length === 0 && scrapeStderrBuffer.length > 0 && !scrapeStderrBuffer.includes('PROGRESS:')) {
            console.warn("No progress messages detected in scrape stderr");
        }

        const limitedProducts = allProducts.slice(0, 10);

        // Combine stderr from both steps for the final output
        const combinedRawStderr = (metadataRawStderr ? `--- Metadata Stderr ---\n${metadataRawStderr}\n` : '') +
                                  (scrapeStderrBuffer ? `--- Scrape Stderr ---\n${scrapeStderrBuffer}` : '');

        resolve({
            products: limitedProducts,
            totalProductsFound: allProducts.length,
            executionError: combinedExecutionError, // Use the combined error message
            rawStdout: scrapeStdoutBuffer, // Only stdout from scrape process is relevant here
            rawStderr: combinedRawStderr.trim(), // Combined stderr from both
            batchesProcessed,
            progressMessages,
            metadata // Include the potentially updated metadata
        });
    });

    // Handle scrape process spawn errors
     process.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error("Scrape process spawn error:", error);
        // Combine with potential metadata error
        const finalError = metadataExecutionError
             ? `${metadataExecutionError}\n\nThen, failed to start scrape process: ${error.message}` // Add separation
             : `Error spawning scrape process: ${error.message}`;

        // Combine stderr from both steps for the final output
        const combinedRawStderr = (metadataRawStderr ? `--- Metadata Stderr ---\n${metadataRawStderr}\n` : '') +
                                  (scrapeStderrBuffer ? `--- Scrape Stderr ---\n${scrapeStderrBuffer}` : ''); // Include any scrape stderr captured before error

        resolve({
            products: [],
            totalProductsFound: 0,
            executionError: finalError,
            rawStdout: scrapeStdoutBuffer,
            rawStderr: combinedRawStderr.trim(),
            batchesProcessed: 0,
            progressMessages,
            metadata
        });
    });
  });
}

