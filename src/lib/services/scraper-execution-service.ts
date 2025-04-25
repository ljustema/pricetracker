import { ScrapedProductData, ScraperConfig, ValidationLog, ValidationProduct, ValidationResponse } from "@/lib/services/scraper-types"; // Added Validation types
import { promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import path from 'path'; // Remove join import
import { execSync } from 'child_process'; // Remove spawnSync import
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
// Import the new Crawlee scraper function
// import { runNorrmalmselScraper } from '@/lib/scrapers/norrmalmsel-crawler'; // Removed unused ProgressCallback import - Keep commented/remove later
// import { Configuration } from 'crawlee'; // Added for patching - Keep commented/remove later
// import { MemoryStorage } from '@crawlee/memory-storage'; // Added for patching - Keep commented/remove later
// import ivm from 'isolated-vm'; // Import isolated-vm - REMOVED as we're not using it anymore

// Define a type for potential execSync errors
interface ExecSyncError extends Error {
  stderr?: Buffer | string;
  stdout?: Buffer | string;
  signal?: string;
  code?: number | string; // Can be string like 'ETIMEDOUT'
}

// Progress cache logic removed - progress tracked in scraper_runs table

/**
 * Service for executing scrapers
 */
export class ScraperExecutionService {
  // Progress cache logic removed

  // getProgress method removed (was part of progress cache)

  /**
   * Initiates a scraper run by creating a job record in the database.
   * The actual execution is handled by worker services polling the database.
   * @param scraperId The ID of the scraper to run.
   * @param runId Optional run ID for tracking progress (generated if not provided).
   * @param isTestRun Optional flag to indicate if this is a limited test run (default: false).
   * @returns The ID of the created run job.
   */
  static async runScraper(scraperId: string, runId?: string, isTestRun: boolean = false): Promise<{ runId: string }> {
    // Generate a run ID if not provided
    const actualRunId = runId || randomUUID();

    // Progress cache initialization removed

    // Import Supabase client dynamically
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();

    // Create a record in the database for this run
    try {
      // Get the scraper to get the user_id
      console.log(`Run ${actualRunId}: Fetching scraper ${scraperId} details`);
      const { data: scraper, error: scraperError } = await supabaseAdmin
        .from('scrapers')
        .select('user_id, scraper_type') // Fetch user_id and scraper_type needed for run record
        .eq('id', scraperId)
        .single();

      if (scraperError) {
        console.error(`Run ${actualRunId}: Error fetching scraper: ${scraperError.message}`);
        throw new Error(`Failed to fetch scraper: ${scraperError.message}`);
      }

      if (!scraper) {
        console.error(`Run ${actualRunId}: Scraper not found: ${scraperId}`);
        throw new Error('Scraper not found');
      }

      console.log(`Run ${actualRunId}: Found scraper ${scraperId} with user_id ${scraper.user_id} and type ${scraper.scraper_type || 'unknown'}`);

      // Create a record in the scraper_runs table
      console.log(`Run ${actualRunId}: Creating run record in database...`);
      const { error: insertError } = await supabaseAdmin
        .from('scraper_runs')
        .insert({
          id: actualRunId,
          scraper_id: scraperId,
          user_id: scraper.user_id, // Use fetched user_id
          status: 'pending', // Set initial status to 'pending'
          started_at: new Date().toISOString(),
          is_test_run: isTestRun, // Use the parameter here
          scraper_type: scraper.scraper_type // Set the scraper_type from the scraper record
        });

      if (insertError) {
          console.error(`Run ${actualRunId}: Error inserting run record in database: ${insertError.message}`);
          // Progress cache update removed
          throw new Error(`Failed to create run record in database: ${insertError.message}`);
      }
      console.log(`Run ${actualRunId}: Created database record.`);

      // For test runs, we don't want to block the API response for the full timeout period
      // Instead, we'll wait a short period to let the worker pick up the job before returning
      if (isTestRun) {
        console.log(`Run ${actualRunId}: Test run - setting 1-minute timeout`);
        // Set a 1-minute timeout for the test run
        const timeoutAt = new Date();
        timeoutAt.setMinutes(timeoutAt.getMinutes() + 1); // 1 minute from now

        try {
          // Check if the scraper_run_timeouts table exists
          const { error: tableCheckError } = await supabaseAdmin
            .from('scraper_run_timeouts')
            .select('run_id')
            .limit(1);

          if (tableCheckError) {
            console.warn(`Run ${actualRunId}: scraper_run_timeouts table may not exist: ${tableCheckError.message}`);
            console.log(`Run ${actualRunId}: Skipping timeout setting, continuing with job execution`);
          } else {
            // Store the timeout in the database
            const { error: timeoutError } = await supabaseAdmin
              .from('scraper_run_timeouts')
              .insert({
                run_id: actualRunId,
                timeout_at: timeoutAt.toISOString(),
                processed: false
              });

            if (timeoutError) {
              console.error(`Run ${actualRunId}: Error setting timeout: ${timeoutError.message}`);
              console.log(`Run ${actualRunId}: Continuing despite timeout error`);
            } else {
              console.log(`Run ${actualRunId}: Timeout set successfully for ${timeoutAt.toISOString()}`);
            }
          }
        } catch (error) {
          console.error(`Run ${actualRunId}: Exception during timeout setting: ${error instanceof Error ? error.message : String(error)}`);
          console.log(`Run ${actualRunId}: Continuing despite timeout error`);
        }

        // --- Race condition mitigation: Wait for worker to pick up the job ---
        const MAX_WAIT_MS = 45000; // Increased to 45 seconds max
        const POLL_INTERVAL_MS = 2000; // Increased poll interval to 2 seconds
        let waited = 0;
        let runStatus = 'pending';
        for (; waited < MAX_WAIT_MS; waited += POLL_INTERVAL_MS) {
          // Poll the run status from the DB
          const { data: run, error: runError } = await supabaseAdmin
            .from('scraper_runs')
            .select('status, error_message')
            .eq('id', actualRunId)
            .single();
          if (runError) {
            console.warn(`Run ${actualRunId}: Error polling run status: ${runError.message}`);
            break;
          }
          if (run && run.status && run.status !== 'pending') {
            runStatus = run.status;
            console.log(`Run ${actualRunId}: Worker picked up job, status is now '${runStatus}' after waiting ${waited}ms.`);
            break;
          }
          // Log the status read on this poll attempt
          console.log(`Run ${actualRunId}: Polled status after ${waited + POLL_INTERVAL_MS}ms: ${run?.status ?? 'N/A'}`);
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
        if (runStatus === 'pending') {
          console.warn(`Run ${actualRunId}: Worker did not pick up job within ${MAX_WAIT_MS}ms. Updating error message and returning runId.`);

          // Update the error message to indicate the worker didn't pick up the job
          const { error: updateError } = await supabaseAdmin
            .from('scraper_runs')
            .update({
              error_message: 'Worker did not pick up the job. The Python worker may not be running or may be busy with other tasks.'
            })
            .eq('id', actualRunId);

          if (updateError) {
            console.error(`Run ${actualRunId}: Error updating error message: ${updateError.message}`);
          } else {
            console.log(`Run ${actualRunId}: Updated error message to indicate worker didn't pick up job.`);
          }
        }
      } else {
        // For regular runs, set a 24-hour timeout
        console.log(`Run ${actualRunId}: Regular run - setting 24-hour timeout`);
        const timeoutAt = new Date();
        timeoutAt.setHours(timeoutAt.getHours() + 24); // 24 hours from now

        const { error: timeoutError } = await supabaseAdmin
          .from('scraper_run_timeouts')
          .insert({
            run_id: actualRunId,
            timeout_at: timeoutAt.toISOString(),
            processed: false
          });

        if (timeoutError) {
          console.error(`Run ${actualRunId}: Error setting timeout: ${timeoutError.message}`);
        }

        // For regular runs, add a short wait to see if the worker picks up the job
        // This helps prevent the "Network error" issue when the worker hasn't started yet
        const INITIAL_WAIT_MS = 5000; // 5 seconds
        console.log(`Run ${actualRunId}: Waiting ${INITIAL_WAIT_MS}ms for worker to initialize...`);
        await new Promise(resolve => setTimeout(resolve, INITIAL_WAIT_MS));

        // Check if the job was picked up
        const { data: runCheck, error: runCheckError } = await supabaseAdmin
          .from('scraper_runs')
          .select('status')
          .eq('id', actualRunId)
          .single();

        if (runCheckError) {
          console.warn(`Run ${actualRunId}: Error checking run status: ${runCheckError.message}`);
        } else if (runCheck && runCheck.status === 'pending') {
          // If still pending, update to 'initializing' to give the worker more time
          console.log(`Run ${actualRunId}: Job still pending, updating status to 'initializing'...`);
          const { error: updateError } = await supabaseAdmin
            .from('scraper_runs')
            .update({
              status: 'initializing',
              error_message: 'Waiting for Python worker to pick up the job. If this persists, check that the worker is running.'
            })
            .eq('id', actualRunId);

          if (updateError) {
            console.error(`Run ${actualRunId}: Error updating status: ${updateError.message}`);
          }
        } else {
          console.log(`Run ${actualRunId}: Job status is now '${runCheck?.status || 'unknown'}'`);
        }
      }

      console.log(`Run ${actualRunId}: Returning run ID.`);
      return { runId: actualRunId };

    } catch (error) {
      console.error(`Run ${actualRunId}: Error creating run record in database: ${error}`);
       // Progress cache update removed
       // Re-throw the error
       throw error;
    }
  }

  /**
   * Process a batch of products
   * Maps products to the correct format and inserts them into the database
   * Returns the number of products inserted
   */
  private static async processBatch(
    batch: ScrapedProductData[],
    scraper: ScraperConfig,
    scraperId: string,
    supabaseAdmin: SupabaseClient
  ): Promise<number> {
    if (!Array.isArray(batch) || batch.length === 0) {
      return 0;
    }

    // Map the products to the correct format
    const scrapedProducts = batch.map((product: ScrapedProductData) => ({
      scraper_id: scraperId,
      competitor_id: scraper.competitor_id,
      name: product.name,
      price: product.price,
      currency: product.currency || 'USD',
      image_url: product.image_url,
      sku: product.sku,
      brand: product.brand,
      ean: product.ean,
      url: product.url,
      scraped_at: new Date().toISOString(),
      user_id: scraper.user_id,
    }));

    // Process each scraped product to match with existing products
    const processedProductsPromises = scrapedProducts.map(async (product) => {
       // Try to match with existing products
       let matchedProductId = null;
       let matchError: Error | null = null;

       try {
           // Try to match by EAN if available
           if (product.ean) {
               const { data: matchedProducts, error: eanError } = await supabaseAdmin
                   .from('products')
                   .select('id')
                   .eq('user_id', scraper.user_id)
                   .eq('ean', product.ean)
                   .limit(1);

               if (eanError) {
                   console.warn(`processBatch: Error matching product by EAN ${product.ean} for user ${scraper.user_id}: ${eanError.message}`);
                   matchError = new Error(eanError.message); // Store first error encountered
               } else if (matchedProducts && matchedProducts.length > 0) {
                   matchedProductId = matchedProducts[0].id;
               }
           }

           // If no match by EAN, try by brand and SKU
           if (!matchedProductId && product.brand && product.sku) {
               const { data: matchedProducts, error: skuError } = await supabaseAdmin
                   .from('products')
                   .select('id')
                   .eq('user_id', scraper.user_id)
                   .eq('brand', product.brand)
                   .eq('sku', product.sku)
                   .limit(1);

               if (skuError) {
                   console.warn(`processBatch: Error matching product by Brand/SKU ${product.brand}/${product.sku} for user ${scraper.user_id}: ${skuError.message}`);
                   if (!matchError) matchError = new Error(skuError.message); // Store if no previous error
               } else if (matchedProducts && matchedProducts.length > 0) {
                   matchedProductId = matchedProducts[0].id;
               }
           }
       } catch (err) {
           // Catch unexpected errors during matching logic
           console.error(`processBatch: Unexpected error during product matching for product URL ${product.url}: ${err instanceof Error ? err.message : String(err)}`);
           matchError = err instanceof Error ? err : new Error(String(err));
       }

       // If a critical error occurred during matching, you might decide to skip the product or throw
       // For now, we log the error and proceed, potentially without a product_id
       // if (matchError) { /* Handle critical match error if needed */ }

       // If a match was found, link the product
       if (matchedProductId) {
         return {
           ...product,
           product_id: matchedProductId,
         };
       }

       // No match found, the database trigger will handle creating a new product
       return product;
    });
    // Wait for all matching attempts to complete
    // Note: If a matching promise rejects, Promise.all will reject immediately.
    const processedProducts = await Promise.all(processedProductsPromises);

    // --- Batch Insert Logic ---
    const BATCH_SIZE = 500; // Define the size of each insert chunk
    let insertedCount = 0;
    console.log(`processBatch: Starting insert of ${processedProducts.length} products in chunks of ${BATCH_SIZE}...`);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000; // 1 second delay

    for (let i = 0; i < processedProducts.length; i += BATCH_SIZE) {
        const chunk = processedProducts.slice(i, i + BATCH_SIZE);
        const chunkNumber = i / BATCH_SIZE + 1;
        console.log(`processBatch: Preparing to insert chunk ${chunkNumber} (${chunk.length} products)...`);

        let attempt = 0;
        let insertError: Error | null = null;
        let success = false;

        while (attempt < MAX_RETRIES && !success) {
            attempt++;
            insertError = null; // Reset error for this attempt
            try {
                console.log(`processBatch: Attempt ${attempt}/${MAX_RETRIES} inserting chunk ${chunkNumber}...`);
                const { error } = await supabaseAdmin
                    .from('scraped_products')
                    .insert(chunk);

                if (error) {
                    insertError = new Error(error.message); // Store error object
                    console.warn(`processBatch: Attempt ${attempt} failed for chunk ${chunkNumber}: ${error.message}`);
                } else {
                    insertedCount += chunk.length;
                    console.log(`processBatch: Successfully inserted chunk ${chunkNumber}. Total inserted so far: ${insertedCount}`);
                    success = true; // Mark as successful
                }
            } catch (err) {
                // Catch potential fetch errors directly
                insertError = err instanceof Error ? err : new Error(String(err));
                console.warn(`processBatch: Attempt ${attempt} failed for chunk ${chunkNumber} with fetch error: ${insertError.message}`);
            }

            // If failed and more retries left, wait before retrying
            if (!success && attempt < MAX_RETRIES) {
                console.log(`processBatch: Waiting ${RETRY_DELAY_MS}ms before retrying chunk ${chunkNumber}...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }

        // If all retries failed, throw the last error
        if (!success) {
            console.error(`processBatch: Error inserting chunk ${chunkNumber} after ${MAX_RETRIES} attempts: ${insertError?.message}`);
            throw new Error(`Failed to store scraped products chunk ${chunkNumber} after ${MAX_RETRIES} attempts: ${insertError?.message}`);
        }
    }

    console.log(`processBatch: Finished inserting all chunks. Total inserted: ${insertedCount}`);
    return insertedCount; // Return the total count of successfully inserted products
  }

  /**
   * Synchronously validates a scraper script by executing it in a sandboxed environment.
   * For TypeScript, uses isolated-vm. Python validation is currently not implemented.
   * Executes URL collection (limited) and the first batch scrape. Does NOT save to DB.
   *
   * @param scraperType The type of the scraper ('python' or 'typescript').
   * @param scriptContent The raw script code to validate.
   * @returns A promise resolving to a ValidationResponse object.
   */
  static async validateScriptSynchronously(
    scraperType: 'python' | 'typescript',
    scriptContent: string
    // TODO: Add context flags (userId, filter flags) if needed for validation context
  ): Promise<ValidationResponse> {
    const logs: ValidationLog[] = [];
    const products: ValidationProduct[] = [];
    const MAX_PRODUCTS = 10;
    const MAX_URLS = 5; // Limit URL collection for validation speed
    const TIMEOUT_MS = 120000; // 120 seconds (2 minutes) timeout for the entire validation
    const MEMORY_LIMIT_MB = 128; // Memory limit for the isolate

    const addLog = (lvl: ValidationLog['lvl'], phase: string, msg: string, data?: Record<string, unknown>) => {
      logs.push({ ts: new Date().toISOString(), lvl, phase, msg, data });
      console.log(`[ValidateScript][${phase}][${lvl}] ${msg}`, data ?? '');
    };

    addLog('INFO', 'SETUP', `Starting validation for ${scraperType} script.`);

    if (scraperType === 'python') {
      addLog('INFO', 'SETUP', 'Starting Python script validation via direct execution.');

      // --- Static validation: require get_metadata and scrape functions ---
      const missingFunctions: string[] = [];
      // Use regex to check for required function definitions
      if (!/^\s*def\s+get_metadata\s*\(/m.test(scriptContent)) {
        missingFunctions.push('get_metadata');
      }
      if (!/^\s*def\s+scrape\s*\(/m.test(scriptContent)) {
        missingFunctions.push('scrape');
      }
      if (missingFunctions.length > 0) {
        addLog('ERROR', 'PYTHON_VALIDATION', `Script is missing required function(s): ${missingFunctions.join(', ')}`);
        return {
          valid: false,
          error: `Invalid Python script structure: Script must contain the following function(s): ${missingFunctions.join(', ')}`,
          logs,
          products: []
        };
      }

      const projectRoot = process.cwd(); // Get the actual CWD of the Node process
      const uuid = randomUUID();
      const tempFilePath = path.join(tmpdir(), `validate-${uuid}.py`); // Absolute path for temp file
      // No longer using wrapper script

      try {
        // Write user script content to a temporary file
        await fsPromises.writeFile(tempFilePath, scriptContent, 'utf-8');
        addLog('INFO', 'PYTHON_VALIDATION', `Temporary user script written to ${tempFilePath}`);
        // Execute the Python wrapper script using spawnSync
        // Removed log line referencing wrapperScriptPath
        // Determine Python executable path (logic remains the same)
        let pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH;
        let pathSource = 'environment variable (PYTHON_EXECUTABLE_PATH)';
        if (!pythonExecutable) {
          if (process.platform === 'win32') {
            pythonExecutable = 'C:\\Python311\\python.exe'; // Local Windows fallback
            pathSource = 'local Windows fallback (C:\\Python311\\python.exe)';
          } else {
            pythonExecutable = 'python'; // Default for Linux/Railway
            pathSource = 'default "python"';
          }
        }
        addLog('INFO', 'PYTHON_VALIDATION', `Using Python executable: ${pythonExecutable} (Source: ${pathSource})`);

        // --- PATCH: Run metadata command first to extract target_url ---
        let extractedTargetUrl: string | undefined = undefined;
        try {
          const metadataCommand = `"${pythonExecutable}" "${tempFilePath}" metadata`;
          addLog('INFO', 'PYTHON_METADATA', `Executing metadata command: ${metadataCommand}`);
          const metadataOutput = execSync(metadataCommand, {
            encoding: 'utf-8',
            timeout: TIMEOUT_MS / 2,
            cwd: projectRoot,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          const metadata = JSON.parse(metadataOutput);
          if (metadata && typeof metadata === 'object' && metadata.target_url && typeof metadata.target_url === 'string') {
            extractedTargetUrl = metadata.target_url;
            addLog('INFO', 'PYTHON_METADATA', `Extracted target_url from metadata: ${extractedTargetUrl}`);
          } else {
            addLog('WARN', 'PYTHON_METADATA', 'No target_url found in metadata output.');
          }
        } catch (err) {
          addLog('WARN', 'PYTHON_METADATA', `Failed to extract metadata: ${err instanceof Error ? err.message : String(err)}`);
        }

        // --- Continue with scrape --validate as before ---
        const validationArgs = [
            'scrape', // <-- Insert the required positional command!
            `--validate`,
            `--limit-urls`, MAX_URLS.toString(), // Use constants defined earlier
            `--limit-products`, MAX_PRODUCTS.toString()
        ];
        const command = `"${pythonExecutable}" "${tempFilePath}" ${validationArgs.join(' ')}`;
        addLog('INFO', 'PYTHON_VALIDATION', `Executing direct validation command: ${command} in CWD: ${projectRoot}`);

        let pythonOutput: string | Buffer;
        let pythonStderr = '';

        try {
          // Execute using execSync
          // Ensure the subprocess environment forces UTF-8 I/O for validation too
          const execEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };

          pythonOutput = execSync(command, {
            encoding: 'utf-8', // How Node decodes the output
            timeout: TIMEOUT_MS,
            cwd: projectRoot,
            stdio: ['pipe', 'pipe', 'pipe'], // Explicitly capture stdout and stderr
            env: execEnv // Pass the modified environment
          });
          // execSync throws on non-zero exit code, so stderr might be in the error object
        } catch (error: unknown) { // Catch as unknown first
          // Type assertion after checking it's an object
          const execError = error as ExecSyncError;

          // Handle errors from execSync (timeout, non-zero exit code, etc.)
          addLog('ERROR', 'PYTHON_VALIDATION', `Failed to execute Python script via execSync: ${execError.message}`);
          // Capture stderr from the error object if available
          pythonStderr = execError.stderr ? execError.stderr.toString() : ''; // Keep stderr capture
          if (pythonStderr) {
             addLog('WARN', 'PYTHON_STDERR', `Script stderr (from execSync error):\n${pythonStderr.trim()}`);
          }
          // Check if it was specifically a timeout using the typed error
          if (execError.signal === 'SIGTERM' || execError.code === 'ETIMEDOUT' || /timed out/i.test(execError.message)) {
             return { valid: false, error: `Validation timed out (${TIMEOUT_MS}ms)`, logs, products: [] };
          }
          return { valid: false, error: `Validation script execution failed: ${execError.message}`, logs, products: [] };
        }

        // If execSync succeeded (exit code 0), pythonOutput contains stdout
        const pythonStdout = pythonOutput.toString();

        // Note: With execSync successful execution, stderr is usually empty or contains warnings.
        // We primarily logged it in the catch block for errors. We could potentially
        // log pythonProcess.stderr here too if needed, but it's less common for successful runs.

        // --- Continue parsing direct script JSONL output ---
        addLog('DEBUG', 'PYTHON_STDOUT', 'Raw stdout suppressed for privacy.'); // Do not log full script output

        // Parse the JSONL output (one JSON object per line)
        const productLines = pythonStdout.split('\n').filter(line => line.trim());
        const parsedProducts = [];
        let parseError = null;
        for (const line of productLines) {
          try {
            const obj = JSON.parse(line);
            // Log the parsed object name immediately after parsing to check encoding in Node.js
            if (obj && typeof obj === 'object' && obj.name) {
              addLog('DEBUG', 'PYTHON_PARSE_CHECK', `Parsed product name in Node.js: ${obj.name}`);
            }
            // If this line is metadata from get_metadata (Python), extract target_url if present
            if (
              obj &&
              typeof obj === 'object' &&
              obj.target_url &&
              typeof obj.target_url === 'string' &&
              (!extractedTargetUrl || extractedTargetUrl === '')
            ) {
              extractedTargetUrl = obj.target_url;
            }
            parsedProducts.push(obj);
          } catch (err) {
            parseError = err;
            addLog('ERROR', 'PYTHON_VALIDATION', `Failed to parse product JSON line: ${line}`);
          }
        }
        if (parseError) {
          addLog('ERROR', 'PYTHON_VALIDATION', `At least one product line could not be parsed as JSON.`);
          return { valid: false, error: 'Failed to parse one or more product lines as JSON.', logs, products: [] };
        }
        addLog('INFO', 'PYTHON_VALIDATION', `Parsed ${parsedProducts.length} products from JSONL output.`);
        // Return target_url as metadata if found
        return {
          valid: true,
          error: null,
          products: parsedProducts,
          logs,
          metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined,
        };

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog('ERROR', 'PYTHON_VALIDATION', `Exception during validation: ${errorMsg}`);
        return { valid: false, error: errorMsg, logs, products: [] };
      } finally {
        try {
          await fsPromises.unlink(tempFilePath);
          addLog('INFO', 'PYTHON_VALIDATION', 'Temporary file deleted.');
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // --- TypeScript Validation using isolated-vm ---
    // TypeScript validation has been removed as we're no longer using isolated-vm
    // If you need to validate TypeScript scrapers in the future, implement a new validation method
    addLog('INFO', 'TYPESCRIPT_VALIDATION', 'TypeScript validation is not implemented in this version.');
    return { valid: false, error: 'TypeScript validation is not supported in this version.', logs, products };
  }
}