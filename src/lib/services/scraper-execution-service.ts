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
        const MAX_WAIT_MS = 120000; // Increased to 120 seconds max (2 minutes)
        const POLL_INTERVAL_MS = 10000; // Increased poll interval to 10 seconds
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
          if (run && run.status) {
            // Check for claimed_by_worker_at timestamp to determine if worker has claimed the job
            const { data: runDetails, error: runDetailsError } = await supabaseAdmin
              .from('scraper_runs')
              .select('claimed_by_worker_at')
              .eq('id', actualRunId)
              .single();

            if (runDetailsError) {
              console.warn(`Run ${actualRunId}: Error fetching claimed_by_worker_at: ${runDetailsError.message}`);
            } else if (runDetails && runDetails.claimed_by_worker_at) {
              // If the worker has claimed the job, consider it running regardless of status
              console.log(`Run ${actualRunId}: Worker claimed job at ${runDetails.claimed_by_worker_at}, current status is '${run.status}' after waiting ${waited}ms.`);
              runStatus = 'running'; // Override status to running since worker has claimed it
              break;
            } else if (run.status !== 'pending') {
              // If status has changed but no claim timestamp, check if it's a premature failure
              if (run.status === 'failed' && run.error_message === 'Script execution failed with non-zero exit code 1') {
                // This is likely a premature failure, log it but don't break the loop
                console.log(`Run ${actualRunId}: Status changed to 'failed' with error 'Script execution failed with non-zero exit code 1' after waiting ${waited}ms, but no worker claim timestamp found. Continuing to wait...`);
                // Don't break the loop, continue waiting
              } else {
                // For other status changes, use the status as reported
                runStatus = run.status;
                console.log(`Run ${actualRunId}: Status changed to '${runStatus}' after waiting ${waited}ms, but no worker claim timestamp found.`);
                break;
              }
            }
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

    // --- TypeScript Validation using Node.js execSync ---
    if (scraperType === 'typescript') {
      addLog('INFO', 'TYPESCRIPT_VALIDATION', 'Starting TypeScript script validation via Node.js execSync.');

      // --- Static validation: check for required patterns ---
      const missingPatterns: string[] = [];

      // Check for required function definitions and patterns
      if (!scriptContent.includes('function getMetadata()')) {
        missingPatterns.push('getMetadata() function');
      }
      if (!scriptContent.includes('async function scrape(')) {
        missingPatterns.push('scrape() async function');
      }
      if (!scriptContent.includes('yargs(hideBin(process.argv))')) {
        missingPatterns.push('command-line argument parsing with yargs');
      }

      if (missingPatterns.length > 0) {
        addLog('ERROR', 'TYPESCRIPT_VALIDATION', `Script is missing required patterns: ${missingPatterns.join(', ')}`);
        return {
          valid: false,
          error: `Invalid TypeScript script structure: Script must contain the following: ${missingPatterns.join(', ')}`,
          logs,
          products: []
        };
      }

      const uuid = randomUUID();
      const tempDir = path.join(tmpdir(), `validate-ts-${uuid}`);
      const tempTsFilePath = path.join(tempDir, 'scraper.ts');
      const tempJsFilePath = path.join(tempDir, 'scraper.js');

      // Initialize variables that need to be accessible in the finally block
      let extractedTargetUrl: string | undefined = undefined;
      let scriptMetadata: Record<string, unknown> | undefined = undefined;

      try {
        // Create temporary directory
        await fsPromises.mkdir(tempDir, { recursive: true });

        // Write script content to a temporary TypeScript file
        await fsPromises.writeFile(tempTsFilePath, scriptContent, 'utf-8');
        addLog('DEBUG', 'TYPESCRIPT_VALIDATION', `Temporary TypeScript script written to ${tempTsFilePath}`);

        // First, create package.json and install dependencies
        try {
          // Create a package.json file for dependencies
          const packageJson = {
            name: "temp-scraper-validation",
            version: "1.0.0",
            private: true,
            dependencies: {
              "crawlee": "^3.13.3",
              "playwright": "^1.30.0",
              "node-fetch": "^2.6.7",
              "yargs": "^17.6.2",
              "typescript": "^4.9.5",
              "@types/node": "^18.15.0",
              "@babel/cli": "^7.21.0",
              "@babel/core": "^7.21.0",
              "@babel/preset-typescript": "^7.21.0",
              "@babel/preset-env": "^7.21.0",
              "fast-xml-parser": "^5.2.0"
            }
          };

          const packageJsonPath = path.join(tempDir, 'package.json');
          await fsPromises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
          addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `Created package.json at ${packageJsonPath}`);

          // Install dependencies first
          addLog('INFO', 'TYPESCRIPT_COMPILATION', 'Installing dependencies (this may take a moment)...');
          try {
            execSync('npm install --no-package-lock --no-save', {
              encoding: 'utf-8',
              timeout: TIMEOUT_MS / 2,
              cwd: tempDir,
              stdio: ['pipe', 'pipe', 'pipe']
            });
            addLog('INFO', 'TYPESCRIPT_COMPILATION', 'Dependencies installed successfully');
          } catch (npmError) {
            const error = npmError as ExecSyncError;
            addLog('WARN', 'TYPESCRIPT_COMPILATION', `npm install warning: ${error.message}`);

            if (error.stderr) {
              const stderr = error.stderr.toString();
              addLog('WARN', 'TYPESCRIPT_COMPILATION', `npm install stderr: ${stderr.trim()}`);
            }

            // Continue even if npm install has warnings
          }

          // Create a tsconfig.json file with very permissive settings
          const tsConfigContent = {
            compilerOptions: {
              target: "ES2020",
              module: "CommonJS",
              moduleResolution: "Node",
              esModuleInterop: true,
              skipLibCheck: true,
              resolveJsonModule: true,
              outDir: ".",
              allowSyntheticDefaultImports: true,
              noImplicitAny: false,
              strictNullChecks: false,
              allowJs: true,
              noEmitOnError: false,
              isolatedModules: true,
              suppressImplicitAnyIndexErrors: true,
              ignoreDeprecations: "5.0",
              downlevelIteration: true
            },
            include: ["scraper.ts"],
            exclude: ["node_modules"]
          };

          const tsConfigPath = path.join(tempDir, 'tsconfig.json');
          await fsPromises.writeFile(tsConfigPath, JSON.stringify(tsConfigContent, null, 2), 'utf-8');
          addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `Created tsconfig.json at ${tsConfigPath}`);

          // Now compile using tsc from node_modules
          addLog('INFO', 'TYPESCRIPT_COMPILATION', 'Compiling TypeScript using local tsc');

          try {
            // Try to find the tsc executable
            let tscPath = path.join(tempDir, 'node_modules', '.bin', 'tsc');
            let tscCommand = process.platform === 'win32' ? `"${tscPath}"` : tscPath;

            // Check if the tsc executable exists
            try {
              await fsPromises.access(tscPath);
              addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `Found tsc at ${tscPath}`);
            } catch (_accessError) {
              // If not found in .bin, try the typescript/bin directory
              addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `tsc not found at ${tscPath}, trying alternative location`);
              tscPath = path.join(tempDir, 'node_modules', 'typescript', 'bin', 'tsc');
              tscCommand = process.platform === 'win32' ? `"${tscPath}"` : tscPath;

              try {
                await fsPromises.access(tscPath);
                addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `Found tsc at ${tscPath}`);
              } catch (_accessError2) {
                // If still not found, try using npx
                addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `tsc not found at ${tscPath}, falling back to npx`);
                tscCommand = 'npx tsc';
              }
            }

            // Execute the TypeScript compiler
            addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `Executing: ${tscCommand}`);

            // We need to specify the input file explicitly
            const fullCommand = `${tscCommand} scraper.ts`;
            addLog('DEBUG', 'TYPESCRIPT_COMPILATION', `Full command: ${fullCommand}`);

            execSync(fullCommand, {
              encoding: 'utf-8',
              timeout: TIMEOUT_MS / 2,
              cwd: tempDir,
              stdio: ['pipe', 'pipe', 'pipe']
            });

            addLog('INFO', 'TYPESCRIPT_COMPILATION', 'TypeScript compilation successful');
          } catch (tscError) {
            const error = tscError as ExecSyncError;
            let errorMessage = error.message;
            let stderrOutput = '';

            // Try to extract the stderr output
            if (error.stderr) {
              stderrOutput = error.stderr.toString().trim();
              addLog('ERROR', 'TYPESCRIPT_STDERR', `Compilation errors:\n${stderrOutput}`);
              errorMessage = stderrOutput || errorMessage;
            }

            // If stderr is empty, just use the error message directly
            if (!stderrOutput && error.message) {
              errorMessage = error.message;
              addLog('ERROR', 'TYPESCRIPT_STDERR', `Error message: ${errorMessage}`);
            }

            // No need to list directory contents - removed for cleaner output

            // Try using Babel as a fallback
            addLog('WARN', 'TYPESCRIPT_COMPILATION', `TypeScript compilation failed, trying Babel as fallback`);

            try {
              // Create a babel.config.json file
              const babelConfig = {
                presets: [
                  "@babel/preset-env",
                  "@babel/preset-typescript"
                ]
              };

              const babelConfigPath = path.join(tempDir, 'babel.config.json');
              await fsPromises.writeFile(babelConfigPath, JSON.stringify(babelConfig, null, 2), 'utf-8');
              addLog('DEBUG', 'BABEL_COMPILATION', `Created babel.config.json at ${babelConfigPath}`);

              // Try to find babel executable
              const babelPath = path.join(tempDir, 'node_modules', '.bin', 'babel');
              const babelCommand = process.platform === 'win32' ? `"${babelPath}"` : babelPath;

              // Execute babel
              const babelFullCommand = `${babelCommand} scraper.ts --out-file scraper.js --extensions ".ts"`;
              addLog('DEBUG', 'BABEL_COMPILATION', `Executing: ${babelFullCommand}`);

              execSync(babelFullCommand, {
                encoding: 'utf-8',
                timeout: TIMEOUT_MS / 2,
                cwd: tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
              });

              addLog('INFO', 'BABEL_COMPILATION', 'Babel compilation successful');
              // Continue with the compiled file - no need to return
            } catch (babelError) {
              const error = babelError as ExecSyncError;
              // Log the Babel error
              if (error.stderr) {
                const stderr = error.stderr.toString().trim();
                addLog('ERROR', 'BABEL_STDERR', `Babel compilation errors:\n${stderr}`);
              } else {
                addLog('ERROR', 'BABEL_STDERR', `Babel compilation error: ${error.message}`);
              }

              // If both TypeScript and Babel fail, throw the original TypeScript error
              addLog('ERROR', 'TYPESCRIPT_COMPILATION', `Both TypeScript and Babel compilation failed: ${errorMessage}`);
              throw new Error(`TypeScript compilation failed: ${errorMessage}`);
            }
          }
        } catch (compileError) {
          const error = compileError as ExecSyncError;
          addLog('ERROR', 'TYPESCRIPT_COMPILATION', `TypeScript compilation failed: ${error.message}`);

          // Log stderr if available
          if (error.stderr) {
            const stderr = error.stderr.toString();
            addLog('ERROR', 'TYPESCRIPT_STDERR', `Compilation stderr:\n${stderr.trim()}`);

            // Include the stderr in the error message for better visibility
            return {
              valid: false,
              error: `TypeScript compilation failed: ${stderr.trim()}`,
              logs,
              products: []
            };
          }

          return {
            valid: false,
            error: `TypeScript compilation failed: ${error.message}`,
            logs,
            products: []
          };
        }

        // --- First, run the metadata command to extract target_url ---

        try {
          const metadataCommand = `node "${tempJsFilePath}" metadata`;
          addLog('INFO', 'TYPESCRIPT_METADATA', `Executing metadata command: ${metadataCommand}`);

          const metadataOutput = execSync(metadataCommand, {
            encoding: 'utf-8',
            timeout: TIMEOUT_MS / 2,
            cwd: tempDir, // Run in the temp directory where dependencies are installed
            stdio: ['pipe', 'pipe', 'pipe']
          });

          try {
            scriptMetadata = JSON.parse(metadataOutput);
            if (scriptMetadata && typeof scriptMetadata === 'object' && scriptMetadata.target_url) {
              extractedTargetUrl = String(scriptMetadata.target_url);
              addLog('INFO', 'TYPESCRIPT_METADATA', `Extracted target_url from metadata: ${extractedTargetUrl}`);
            } else {
              addLog('WARN', 'TYPESCRIPT_METADATA', 'No target_url found in metadata output.');
            }
          } catch (parseErr) {
            addLog('ERROR', 'TYPESCRIPT_METADATA', `Failed to parse metadata JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
          }
        } catch (metadataErr) {
          addLog('WARN', 'TYPESCRIPT_METADATA', `Failed to execute metadata command: ${metadataErr instanceof Error ? metadataErr.message : String(metadataErr)}`);
        }

        // --- Now run the scrape command with validation context ---
        // Create a validation context with isValidation flag set to true
        const validationContext = {
          isValidation: true,
          isTestRun: true,
          filterByActiveBrands: false,
          scrapeOnlyOwnProducts: false,
          log: (level: string, message: string, data?: unknown) => {
            addLog(level.toUpperCase() as ValidationLog['lvl'], 'SCRIPT_LOG', message, data as Record<string, unknown>);
          }
        };

        // Properly escape the JSON string for command line
        const contextJson = JSON.stringify(validationContext);

        // On Windows, use double quotes outside and escaped double quotes for the JSON
        // On other platforms, use single quotes outside and double quotes for the JSON
        const escapedJson = process.platform === 'win32'
          ? `"${contextJson.replace(/"/g, '\\"')}"`
          : `'${contextJson}'`;

        const scrapeCommand = `node "${tempJsFilePath}" scrape --context=${escapedJson}`;

        addLog('INFO', 'TYPESCRIPT_VALIDATION', `Executing scrape command with validation context: ${scrapeCommand}`);

        let scriptOutput: string;
        try {
          scriptOutput = execSync(scrapeCommand, {
            encoding: 'utf-8',
            timeout: TIMEOUT_MS,
            cwd: tempDir, // Run in the temp directory where dependencies are installed
            stdio: ['pipe', 'pipe', 'pipe']
          });
        } catch (execError) {
          const error = execError as ExecSyncError;
          addLog('ERROR', 'TYPESCRIPT_VALIDATION', `Failed to execute TypeScript script: ${error.message}`);

          // Check if it was a timeout
          if (error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT' || /timed out/i.test(error.message)) {
            return { valid: false, error: `Validation timed out (${TIMEOUT_MS}ms)`, logs, products: [] };
          }

          // Log stderr if available
          if (error.stderr) {
            const stderr = error.stderr.toString();
            addLog('ERROR', 'TYPESCRIPT_STDERR', `Script stderr:\n${stderr.trim()}`);
          }

          return {
            valid: false,
            error: `Validation script execution failed: ${error.message}`,
            logs,
            products: [],
            metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
          };
        }

        // Filter out progress and error messages from the output
        const outputLines = scriptOutput.split('\n');
        const productLines: string[] = [];
        const progressLines: string[] = [];
        const errorLines: string[] = [];

        // Categorize output lines
        for (const line of outputLines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Handle known log message formats
          if (trimmedLine.startsWith('PROGRESS:')) {
            progressLines.push(trimmedLine);
            addLog('INFO', 'SCRIPT_PROGRESS', trimmedLine);
          } else if (trimmedLine.startsWith('ERROR:')) {
            errorLines.push(trimmedLine);
            addLog('ERROR', 'SCRIPT_ERROR', trimmedLine);
          } else if (trimmedLine.startsWith('INFO ') || trimmedLine.startsWith('WARN ') || trimmedLine.startsWith('DEBUG ')) {
            // Handle Crawlee log messages
            progressLines.push(trimmedLine);

            // Only log warnings at INFO level, everything else at DEBUG level
            if (trimmedLine.startsWith('WARN ')) {
              addLog('INFO', 'SCRIPT_WARNING', trimmedLine);
            } else {
              addLog('DEBUG', 'SCRIPT_LOG', trimmedLine);
            }
          } else {
            // Try to determine if it's a valid JSON line
            try {
              // Just check if it parses as JSON without storing the result yet
              JSON.parse(trimmedLine);
              // If it parses successfully, add it to product lines
              productLines.push(trimmedLine);
            } catch (_e) {
              // If it doesn't parse as JSON, treat it as a log message
              progressLines.push(trimmedLine);

              // Only log at DEBUG level to reduce terminal output
              // These messages will still be available in the logs array if needed
              addLog('DEBUG', 'SCRIPT_OUTPUT', trimmedLine);
            }
          }
        }

        // Log summary of output (only show product count at INFO level)
        if (productLines.length > 0) {
          addLog('INFO', 'TYPESCRIPT_VALIDATION', `Script output: ${productLines.length} product lines found`);
        } else {
          addLog('WARN', 'TYPESCRIPT_VALIDATION', 'No product lines found in script output');
        }

        // Log detailed counts at DEBUG level
        addLog('DEBUG', 'TYPESCRIPT_VALIDATION', `Script output details: ${productLines.length} product lines, ${progressLines.length} progress messages, ${errorLines.length} error messages`);

        // Parse the product lines as JSON
        const parsedProducts: ValidationProduct[] = [];
        let parseError = null;

        for (const line of productLines) {
          try {
            const product = JSON.parse(line);
            if (product && typeof product === 'object') {
              parsedProducts.push(product as ValidationProduct);
              addLog('DEBUG', 'PRODUCT_PARSED', `Parsed product: ${product.name || 'unnamed'}`);
            }
          } catch (err) {
            parseError = err;
            addLog('ERROR', 'TYPESCRIPT_VALIDATION', `Failed to parse product JSON line: ${line}`);
          }
        }

        if (parseError) {
          addLog('ERROR', 'TYPESCRIPT_VALIDATION', `At least one product line could not be parsed as JSON.`);
          return {
            valid: false,
            error: 'Failed to parse one or more product lines as JSON.',
            logs,
            products: [],
            metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
          };
        }

        // If no products were found but there were no parse errors, it might be a script issue
        if (parsedProducts.length === 0) {
          addLog('WARN', 'TYPESCRIPT_VALIDATION', 'No product data found in script output.');

          // If there were error messages, include them in the response
          if (errorLines.length > 0) {
            const errorMessage = errorLines.join('\n');
            return {
              valid: false,
              error: `Script execution completed but no products were returned. Errors: ${errorMessage}`,
              logs,
              products: [],
              metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
            };
          } else if (progressLines.length > 0) {
            // If there were progress messages but no products, the script might have run successfully
            // but didn't find any products

            // Always report that no products were found - this is an error condition
            return {
              valid: false,
              error: `Script execution completed successfully but no products were returned. The script may need to be modified to output product data.`,
              logs,
              products: [],
              metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
            };
          } else {
            // No products, no progress messages, no error messages - something is wrong
            return {
              valid: false,
              error: `Script execution completed but produced no output. The script may need to be modified to output product data.`,
              logs,
              products: [],
              metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
            };
          }
        }

        // Final check - if we somehow got here with no products, fail validation
        if (parsedProducts.length === 0) {
          addLog('ERROR', 'TYPESCRIPT_VALIDATION', 'No products found after processing all output.');
          return {
            valid: false,
            error: 'No products were returned by the script.',
            logs,
            products: [],
            metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
          };
        }

        addLog('INFO', 'TYPESCRIPT_VALIDATION', `Parsed ${parsedProducts.length} products from JSONL output.`);

        // Validate that products have required fields
        // (We already checked that parsedProducts.length > 0)
        const invalidProducts = parsedProducts.filter(p => !p.name || p.price === undefined || p.price === null);
        if (invalidProducts.length > 0) {
          addLog('ERROR', 'TYPESCRIPT_VALIDATION', `${invalidProducts.length} products are missing required fields (name, price).`);
          return {
            valid: false,
            error: 'Validation failed: Some products are missing required fields (name, price).',
            logs,
            products: parsedProducts,
            metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
          };
        }

        // Success!
        return {
          valid: true,
          error: null,
          products: parsedProducts,
          logs,
          metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog('ERROR', 'TYPESCRIPT_VALIDATION', `Exception during validation: ${errorMsg}`);
        return {
          valid: false,
          error: errorMsg,
          logs,
          products: [],
          metadata: extractedTargetUrl ? { target_url: extractedTargetUrl } : undefined
        };
      } finally {
        try {
          // Clean up temporary files
          await fsPromises.rm(tempDir, { recursive: true, force: true });
          addLog('DEBUG', 'TYPESCRIPT_VALIDATION', 'Temporary directory and compiled files deleted.');
        } catch (cleanupErr) {
          addLog('WARN', 'TYPESCRIPT_VALIDATION', `Failed to clean up temporary directory: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
        }
      }
    }

    // If we get here, the scraper type is not supported
    return { valid: false, error: `Unsupported scraper type: ${scraperType}`, logs, products };
  }
}