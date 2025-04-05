import { NextRequest, NextResponse } from 'next/server';
// Import the specific Crawlee scraper function
import { runNorrmalmselScraper } from '@/lib/scrapers/norrmalmsel-crawler';
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

// Use the imported ScraperMetadata type directly if possible, or ensure local matches
// Assuming the imported one is correct:
import { ScraperMetadata } from "@/lib/services/scraper-types";
// Remove the local interface definition if using the imported one.
// If keeping local, ensure it matches the imported one precisely.
// For this diff, I'll assume we use the imported one and remove the local definition.

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
    const scraperType = data.scraper_type || 'python'; // Default to python if not provided for backward compatibility
    const scriptContent = scraperType === 'python' ? data.python_script : data.typescript_script; // Assuming TS code is in typescript_script

    // Validate required fields
    if (!scriptContent) {
      return NextResponse.json(
        { error: `Missing ${scraperType === 'python' ? 'python_script' : 'typescript_script'} field` },
        { status: 400 }
      );
    }

    // Adjust type to match expected return from validatePythonScraper
    let validationResult: { valid: boolean; error?: string; metadata?: ScraperMetadata | null } = { valid: true };
    let metadata: ScraperMetadata | null = null;

    if (scraperType === 'python') {
        // Validate the Python script structure
        const pyValidationResult = await ScraperService.validatePythonScraper(scriptContent);
        // Adapt the result to the structure used in this route
        validationResult = {
            valid: pyValidationResult.valid,
            error: pyValidationResult.error, // Use optional error string
            // Ensure type compatibility - use nullish coalescing
            metadata: pyValidationResult.metadata ?? null
        };
        metadata = validationResult.metadata || { // Default Python metadata
            name: 'Python Batch Scraper', description: 'A Python scraper', version: '1.0.0',
            author: 'User', target_url: '', required_libraries: []
        };

        if (!validationResult.valid || validationResult.error) {
            // Return structure validation errors immediately for Python
            return NextResponse.json({
                ...validationResult,
                metadata: metadata || undefined, // Ensure metadata is passed, handle null
                products: [], totalProductsFound: 0, executionError: null,
                stdout: '', stderr: validationResult.error || 'Script structure validation failed.', // Use error string
                batchesProcessed: 0, progressMessages: []
            });
        }
        // If Python structure is valid, metadata should be populated from the script
        metadata = validationResult.metadata!; // Assert non-null as validation passed

    } else if (scraperType === 'crawlee') {
        // For Crawlee, skip Python structure validation.
        // TODO: Implement basic TS/JS validation if needed?
        // Correct the type - should not have 'errors' property here
        validationResult = { valid: true }; // Assign only known properties
        // TODO: Define how to get metadata for Crawlee scrapers (e.g., convention)
        metadata = {
             name: 'Crawlee Scraper (TS)', description: 'A Crawlee/TypeScript scraper', version: '1.0.0',
             author: 'User', target_url: '', required_libraries: [] // Crawlee deps managed by npm
        };
        console.log("Skipping Python structure validation for Crawlee scraper.");
    } else {
         return NextResponse.json({ error: "Invalid scraper_type specified" }, { status: 400 });
    }
    
    // If structure validation passed (or skipped for Crawlee), execute for preview

    // --- Declare vars needed in finally block ---
    let scriptPath = '';
    let tempDir = '';
    let wrapperPath = '';
    // This 'try' block should encompass the file operations and execution call
    try {
        // Create a temporary directory for the main script execution
        tempDir = path.join(os.tmpdir(), "pricetracker-main-" + randomUUID());
        fs.mkdirSync(tempDir, { recursive: true });

        // Write the original script to a temporary file
        // Use .py for python, .ts for crawlee (or .js if preferred)
        const scriptExtension = scraperType === 'python' ? '.py' : '.ts';
        scriptPath = path.join(tempDir, `script${scriptExtension}`);
        fs.writeFileSync(scriptPath, scriptContent);

        // --- Script Execution for Preview ---
        if (scraperType === 'python') {
            // --- Create Python Wrapper Script --- (Only needed for Python)
            wrapperPath = path.join(tempDir, "wrapper.py");
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
        # Fallback for older Python or environments where reconfigure isn't available
        if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
             print(f"Warning: stdout encoding is {sys.stdout.encoding}, attempting to set via environment.", file=sys.stderr)
             os.environ['PYTHONIOENCODING'] = 'utf-8'
        if hasattr(sys.stderr, 'encoding') and sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
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
    try:
        original_argv = list(sys.argv)
        sys.argv = [scraper_script_path, command]
        runpy.run_path(scraper_script_path, run_name='__main__')
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

            // Execute Python script using the existing wrapper/validation logic
            console.log("Executing Python script for validation preview...");
            const pythonValidationResults = await validateScriptExecution(scriptPath, wrapperPath, metadata!); // Metadata is non-null here
            // Clean up files *before* returning response
            cleanupTempFiles(scriptPath, wrapperPath, tempDir);
            return NextResponse.json({
                valid: validationResult.valid && !pythonValidationResults.executionError, // Overall validity
                errors: validationResult.error ? [validationResult.error] : [], // Pass error as array if exists
                metadata: pythonValidationResults.metadata, // Metadata from execution
                products: pythonValidationResults.products,
                totalProductsFound: pythonValidationResults.totalProductsFound,
                executionError: pythonValidationResults.executionError,
                stdout: pythonValidationResults.stdout,
                stderr: pythonValidationResults.stderr,
                batchesProcessed: pythonValidationResults.batchesProcessed,
                progressMessages: pythonValidationResults.progressMessages,
            });
        } else if (scraperType === 'crawlee') {
            // Execute Crawlee/TS script for validation preview
            console.log("Executing Crawlee script for validation preview...");
            let crawleeProducts: Product[] = [];
            let crawleeTotalFound = 0;
            let crawleeExecutionError: string | null = null;
            // We won't capture stderr easily here, maybe rely on logs or specific error messages
            const crawleeProgressMessages: string[] = ['Attempting Crawlee validation run...'];

            try {
                // TODO: Ideally, identify the correct scraper function dynamically based on scriptContent or metadata.
                // For POC, we hardcode the call to the NorrmalmsEl scraper if it's the one being validated.
                // We use the placeholder metadata name assigned earlier.
                if (metadata?.name === 'Crawlee Scraper (TS)') { // Check if it's the one we expect
                     console.log("Running NorrmalmsEl scraper in validation mode...");
                     const validationProducts = await runNorrmalmselScraper({
                         isValidationRun: true,
                         maxRequests: 200 // Increased limit for validation
                     });
                     // Adapt the result to the expected Product interface
                     crawleeProducts = validationProducts.slice(0, 10).map(p => ({
                         name: p.name,
                         // Handle potential undefined price - default to 0 or handle as error? Using 0 for now.
                         price: p.price ?? 0,
                         currency: p.currency,
                         url: p.url,
                         image_url: p.image_url,
                         sku: p.sku,
                         brand: p.brand,
                         ean: p.ean,
                     }));
                     crawleeTotalFound = validationProducts.length; // Report total found by limited run
                     crawleeProgressMessages.push(`Crawlee validation run found ${crawleeTotalFound} products.`);
                     console.log(`Crawlee validation run found ${crawleeTotalFound} products.`);
                     if (crawleeTotalFound === 0) {
                         // Don't mark as error, just report 0 found for validation
                         crawleeProgressMessages.push("Validation run completed but found 0 products.");
                         console.warn("Crawlee validation run completed but found 0 products.");
                     }
                } else {
                     // If it's another Crawlee scraper we haven't implemented yet
                     crawleeExecutionError = "Validation execution for this specific Crawlee scraper is not yet implemented.";
                     crawleeProgressMessages.push(crawleeExecutionError);
                }

            } catch (error: unknown) {
                console.error("Error executing Crawlee scraper for validation:", error);
                crawleeExecutionError = `Crawlee execution failed: ${error instanceof Error ? error.message : String(error)}`;
                crawleeProgressMessages.push(crawleeExecutionError);
            }

            // Clean up TS file *before* returning response
            cleanupTempFiles(scriptPath, wrapperPath, tempDir); // wrapperPath will be empty here

            // Return results formatted like the Python validation
             return NextResponse.json({
                  valid: !crawleeExecutionError, // Valid if no execution error occurred
                  errors: [], // No structural errors checked for Crawlee yet
                  metadata: metadata, // Use placeholder/derived metadata
                  products: crawleeProducts,
                  totalProductsFound: crawleeTotalFound,
                  executionError: crawleeExecutionError,
                  stdout: '', // Crawlee logs to console/storage, not easily captured as stdout here
                  stderr: '', // Use executionError field for Crawlee errors for now
                  batchesProcessed: crawleeTotalFound > 0 ? 1 : 0, // Treat as one batch for validation
                  progressMessages: crawleeProgressMessages,
             });
        }
        // This closing brace was misplaced, ending the try block prematurely
        // });
    } catch (setupError: unknown) { // Catch errors during setup or execution call
        console.error("Error during script validation setup/execution:", setupError);
        // Ensure validationResult exists even if error happened before python validation
        const currentErrors = validationResult?.error ? [validationResult.error] : [];
        const response = NextResponse.json({
            valid: false, // Mark as invalid due to setup/execution error
            errors: currentErrors,
            metadata: metadata || undefined, // Use metadata if available
            executionError: `Setup/Execution error: ${setupError instanceof Error ? setupError.message : "Unknown error"}`,
            products: [],
            totalProductsFound: 0,
            stdout: '',
            stderr: '', // Keep stderr empty for setup errors for now
            batchesProcessed: 0,
            progressMessages: [],
        });
        // Attempt cleanup even if setup failed
        cleanupTempFiles(scriptPath, wrapperPath, tempDir);
        return response;
    } // The finally block is removed as cleanup is now handled before returning in try/catch
  } catch (error) {
    console.error("Error in validate API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// --- Helper function for cleanup ---
function cleanupTempFiles(scriptPath: string, wrapperPath: string, tempDir: string) {
    if (scriptPath && fs.existsSync(scriptPath)) {
        try {
            fs.unlinkSync(scriptPath);
        } catch (unlinkError) {
            console.error("Error unlinking temporary script file:", unlinkError);
        }
    }
    if (wrapperPath && fs.existsSync(wrapperPath)) {
        try {
            fs.unlinkSync(wrapperPath);
        } catch (unlinkError) {
            console.error("Error unlinking temporary wrapper file:", unlinkError);
        }
    }
    if (tempDir && fs.existsSync(tempDir)) {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (rmdirError) {
            console.error("Error removing temporary directory:", rmdirError);
        }
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
    stdout: string;
    stderr: string;
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
        stdout: '',
        stderr: '',
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
         stdout: '', // No scrape stdout
         stderr: metadataRawStderr.trim(), // Only metadata stderr
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
                stdout: '', stderr: metadataRawStderr + (installError ? `\n--- Install Stderr ---\n${installError}` : ''), // Combine stdouts/stderrs
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
            stdout: scrapeStdoutBuffer, // Only stdout from scrape process is relevant here
            stderr: combinedRawStderr.trim(), // Combined stderr from both
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
            stdout: scrapeStdoutBuffer,
            stderr: combinedRawStderr.trim(),
            batchesProcessed: 0,
            progressMessages,
            metadata
        });
    });
  });
}

