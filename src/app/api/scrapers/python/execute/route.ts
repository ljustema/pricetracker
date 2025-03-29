import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto"; // Use Node.js built-in crypto instead of uuid
import os from "os";
import util from "util";
import { ScrapedProductData } from "@/lib/services/scraper-types";

const execPromise = util.promisify(exec);

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

    // Create a temporary directory for the script
    const tempDir = path.join(os.tmpdir(), "pricetracker-" + randomUUID());
    fs.mkdirSync(tempDir, { recursive: true });

    // Write the script to a temporary file
    const scriptPath = path.join(tempDir, "script.py");
    fs.writeFileSync(scriptPath, data.python_script);

    try {
      // Execute the script with the scrape command
      // Try different Python commands (python, python3, py) to handle different environments
      let stdout = '';
      let stderr = '';
      const pythonCommands = ['python', 'python3', 'py'];
      let success = false;
      
      for (const cmd of pythonCommands) {
        try {
          // Use the scrape command instead of test
          const result = await execPromise(`${cmd} -c "import sys; sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8'); exec(open('${scriptPath.replace(/\\/g, '\\\\')}', encoding='utf-8').read())" scrape`);
          stdout = result.stdout;
          stderr = result.stderr;
          
          if (stdout.trim()) {
            success = true;
            break;
          }
        } catch (error) {
          console.error(`Failed to execute with ${cmd}:`, error);
          // Continue to the next command
        }
      }
      
      if (!success) {
        console.error("Python script execution error:", stderr);
        return NextResponse.json(
          {
            error: `Error executing Python script. Please ensure Python is installed and the script is valid.`,
            details: stderr
          },
          { status: 500 }
        );
      }

      // Parse the JSON output from the script
      // In the batch scraping approach, each line of stdout is a JSON array of products
      let products: ScrapedProductData[] = [];
      try {
        const lines = stdout.trim().split('\n');
        
        if (lines.length === 0) {
          throw new Error("Script produced no output.");
        }
        
        // Combine all product batches into a single array
        for (const line of lines) {
          if (!line.trim()) continue;
          
          const batchProducts = JSON.parse(line.trim());
          if (!Array.isArray(batchProducts)) {
            throw new Error(`Expected a JSON array for batch, got: ${typeof batchProducts}`);
          }
          products = [...products, ...batchProducts];
          
          // For validation purposes, we only need a few products
          if (products.length >= 10) {
            break;
          }
        }
        
        if (products.length === 0) {
          throw new Error("No valid products found in any batch.");
        }

      } catch (error) {
        const parseError = error as Error;
        console.error("Failed to parse Python script output:", { stdout, error: parseError.message });
        return NextResponse.json(
          { error: `Failed to parse script output: ${parseError.message}`, stdout },
          { status: 500 }
        );
      }

      // Execute the script with the metadata command
      let metadataStdout = '';
      let metadataStderr = '';
      let metadataSuccess = false;
      
      for (const cmd of pythonCommands) {
        try {
          const result = await execPromise(`${cmd} "${scriptPath}" metadata`);
          metadataStdout = result.stdout;
          metadataStderr = result.stderr;
          
          if (!metadataStderr) {
            metadataSuccess = true;
            break;
          }
        } catch (error) {
          console.error(`Failed to execute metadata with ${cmd}:`, error);
          // Continue to the next command
        }
      }
      
      if (!metadataSuccess) {
        console.error("Python script metadata error:", metadataStderr);
        return NextResponse.json(
          {
            error: `Error getting script metadata. Please ensure Python is installed and the script is valid.`,
            details: metadataStderr
          },
          { status: 500 }
        );
      }

      // Parse the JSON metadata output
      let metadata;
      try {
        metadata = JSON.parse(metadataStdout);
      } catch (error) {
        const parseError = error as Error;
        return NextResponse.json(
          { error: `Failed to parse metadata output: ${parseError.message}`, stdout: metadataStdout },
          { status: 500 }
        );
      }

      return NextResponse.json({
        valid: true,
        metadata,
        products,
      });
    } finally {
      // Clean up the temporary files
      try {
        fs.unlinkSync(scriptPath);
        fs.rmdirSync(tempDir);
      } catch (cleanupError) {
        console.error("Error cleaning up temporary files:", cleanupError);
      }
    }
  } catch (error) {
    console.error("Error executing Python scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}