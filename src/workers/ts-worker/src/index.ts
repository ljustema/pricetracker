import 'dotenv/config'; // Load environment variables
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { spawn } from 'child_process'; // Added for subprocess execution
import fsPromises from 'fs/promises'; // Use fs/promises for async file operations
import fsSync from 'fs'; // Use fs for synchronous operations like existsSync/mkdirSync
import path from 'path'; // Added for path manipulation
import os from 'os'; // Added for temp directory
import util from 'util'; // Added for promisify (if needed later)
// import ivm from 'isolated-vm'; // Removed isolated-vm

// Import Database type for type safety
import type { Database } from './database.types';

// Define types for context and results (align with scraper template)
interface ScriptContext {
  activeBrandNames?: string[];
  activeBrandIds?: string[];
  filterByActiveBrands?: boolean;
  ownProductEans?: string[];
  ownProductSkuBrands?: { sku: string; brand: string; brand_id?: string }[];
  scrapeOnlyOwnProducts?: boolean;
  isTestRun?: boolean;
  log: (level: string, message: string, data?: any) => void; // Add log function
  // TODO: Add safe fetch wrapper if needed
}

interface ScrapedProductData {
  name: string;
  price: number;
  currency?: string;
  url?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
  // Add other fields as needed
}

interface ScriptMetadata {
  required_libraries?: string[];
  target_url?: string;
  batch_size?: number;
  // Add other metadata fields
}

// Placeholder for database client initialization
// TODO: Initialize Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key environment variables.');
  process.exit(1);
}

// Use Database type for type safety
const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

const WORKER_TYPE = 'typescript'; // Define the type of scraper this worker handles
const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds (adjust as needed)
const SCRIPT_TIMEOUT_SECONDS = 900; // Timeout for script execution (15 minutes)
const DB_BATCH_SIZE = 100; // How many products to buffer before saving to DB

console.log(`Starting TypeScript Worker (Polling interval: ${POLLING_INTERVAL_MS}ms)`);

async function fetchAndProcessJob() {
  let job: any = null; // Define job variable in the outer scope for the catch block

  try {
    console.log('Polling for pending jobs...');
    // 1. Fetch a pending job for this worker type
    // TODO: Implement atomic claim (e.g., using RPC or careful UPDATE ... RETURNING)
    const { data: fetchedJob, error: fetchError } = await supabase
      .from('scraper_runs')
      .select('*')
      .eq('status', 'pending')
      .eq('scraper_type', WORKER_TYPE)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching job:', fetchError);
      return; // Wait for the next poll interval
    }

    if (!fetchedJob) {
      // console.log('No pending jobs found.'); // Can be noisy, uncomment if needed
      return; // No job found, wait for the next poll interval
    }
    job = fetchedJob; // Assign to the outer scope variable

    console.log(`Found job: ${job.id}, Scraper ID: ${job.scraper_id}`);

    // 2. Claim the job (Update status to 'running')
    // This needs to be atomic to prevent multiple workers picking up the same job.
    // A database function (RPC) is often the best way.
    // For now, a simple update (less safe):
    const { error: claimError } = await supabase
      .from('scraper_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending'); // Ensure it's still pending

    if (claimError) {
      console.error(`Error claiming job ${job.id}:`, claimError);
      job = null; // Reset job if claim failed
      return; // Failed to claim, maybe another worker got it. Wait.
    }

    // Check if the update actually happened (if another worker claimed it between fetch and update)
    // This check is imperfect without atomicity. A better approach is needed.
    // For now, assume claim was successful if no error.

    console.log(`Job ${job.id} claimed successfully.`);

    // 3. Fetch the scraper script
    const { data: scraper, error: scraperError } = await supabase
      .from('scrapers')
      .select('typescript_script, filter_by_active_brands, scrape_only_own_products') // Add other needed fields
      .eq('id', job.scraper_id)
      .single();

    if (scraperError || !scraper || !scraper.typescript_script) {
      console.error(`Error fetching scraper script for job ${job.id}:`, scraperError || 'Script not found');
      // Update job status to 'failed'
      await supabase
        .from('scraper_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Failed to fetch scraper script',
        })
        .eq('id', job.id);
      return; // Stop processing this job
    }

    console.log(`Script fetched for job ${job.id}. Starting execution...`);

    // 4. Fetch filter data if needed
    let activeBrandNames: string[] = [];
    let activeBrandIds: string[] = [];
    let ownProductEans: string[] = [];
    let ownProductSkuBrands: { sku: string; brand: string; brand_id?: string }[] = [];

    if (scraper.filter_by_active_brands) {
        logStructured(job.id, 'info', 'SETUP', 'Fetching active brands for filtering...');
        const { data: brands, error: brandError } = await supabase
            .from('brands')
            .select('id, name')
            .eq('user_id', job.user_id)
            .eq('is_active', true);

        if (brandError) {
            logStructured(job.id, 'warn', 'SETUP', `Failed to fetch active brands: ${brandError.message}. Proceeding without brand filter.`);
        } else if (brands) {
            activeBrandNames = brands.map(b => b.name);
            activeBrandIds = brands.map(b => b.id);
            logStructured(job.id, 'info', 'SETUP', `Fetched ${activeBrandNames.length} active brands.`);
        }
    }

    if (scraper.scrape_only_own_products) {
        logStructured(job.id, 'info', 'SETUP', 'Fetching own product identifiers for filtering...');
        const { data: products, error: productError } = await supabase
            .from('products')
            .select('ean, sku, brand, brand_id')
            .eq('user_id', job.user_id)
            .eq('is_active', true); // Only consider active products in the user's catalog

        if (productError) {
            logStructured(job.id, 'warn', 'SETUP', `Failed to fetch own products: ${productError.message}. Proceeding without own product filter.`);
        } else if (products) {
            ownProductEans = products.map(p => p.ean).filter((ean): ean is string => !!ean);
            ownProductSkuBrands = products
                .filter(p => p.sku && (p.brand || p.brand_id))
                .map(p => ({
                    sku: p.sku as string,
                    brand: p.brand as string,
                    brand_id: p.brand_id as string
                }));
            logStructured(job.id, 'info', 'SETUP', `Fetched ${ownProductEans.length} EANs and ${ownProductSkuBrands.length} SKU/Brand pairs.`);
        }
    }

    // 5. Execute script as subprocess
    let finalStatus: 'completed' | 'failed' = 'failed'; // Default to failed
    let errorMessage: string | null = null;
    let errorDetails: string | null = null;
    let productCount = 0;
    const productsBuffer: ScrapedProductData[] = [];
    let tmpScriptPath: string | null = null;
    const startTime = Date.now();

    try {
        // Prepare context
        const context = {
            run_id: job.id,
            scraper_id: job.scraper_id,
            user_id: job.user_id,
            competitor_id: job.competitor_id, // Assuming competitor_id is available on the job object
            is_test_run: job.is_test_run ?? false,
            filter_by_active_brands: scraper.filter_by_active_brands ?? false,
            active_brand_names: activeBrandNames,
            active_brand_ids: activeBrandIds,
            scrape_only_own_products: scraper.scrape_only_own_products ?? false,
            own_product_eans: ownProductEans,
            own_product_sku_brands: ownProductSkuBrands,
        };
        const contextJson = JSON.stringify(context);
        logStructured(job.id, 'debug', 'SETUP', 'Prepared script context');

        // Create temporary file
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'pricetracker-ts-'));
        tmpScriptPath = path.join(tmpDir, 'scraper.js'); // Assume script is JS or will be transpiled
        await fsPromises.writeFile(tmpScriptPath, scraper.typescript_script, 'utf-8');
        logStructured(job.id, 'info', 'SUBPROCESS_EXEC', `Executing script: ${tmpScriptPath}`);

        // Spawn subprocess
        const command = 'node';
        const args = [tmpScriptPath, 'scrape', `--context=${contextJson}`];
        const process = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
        });

        let stdoutData = '';
        let stderrData = '';
        const scriptErrors: string[] = [];

        // Handle stdout
        process.stdout?.on('data', (data) => {
            stdoutData += data.toString();
            // Process line by line
            let newlineIndex;
            while ((newlineIndex = stdoutData.indexOf('\n')) >= 0) {
                const line = stdoutData.substring(0, newlineIndex).trim();
                stdoutData = stdoutData.substring(newlineIndex + 1);
                if (line) {
                    try {
                        const product = JSON.parse(line);
                        if (typeof product === 'object' && product !== null && product.name && product.price !== undefined) {
                            productsBuffer.push(product as ScrapedProductData);
                            productCount++;
                            if (productsBuffer.length >= DB_BATCH_SIZE) {
                                const batchToSave = [...productsBuffer]; // Copy buffer
                                productsBuffer.length = 0; // Clear buffer
                                logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Saving batch of ${batchToSave.length} products...`);
                                saveScrapedProducts(job.id, job.user_id, job.competitor_id, batchToSave)
                                    .then(() => logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Successfully inserted batch.`))
                                    .catch(err => logStructured(job.id, 'error', 'DB_BATCH_SAVE', `Failed to save product batch: ${err.message}`));
                            }
                        } else {
                            logStructured(job.id, 'warn', 'SCRIPT_STDOUT', `Skipping invalid product JSON structure: ${line.substring(0, 100)}...`);
                        }
                    } catch (e) {
                        logStructured(job.id, 'warn', 'SCRIPT_STDOUT', `Failed to decode JSON from stdout: ${line.substring(0, 100)}...`);
                    }
                }
            }
        });

        // Handle stderr
        process.stderr?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                line = line.trim();
                if (!line) return;
                stderrData += line + '\n'; // Store for potential error details
                if (line.startsWith("PROGRESS:")) {
                    logStructured(job.id, 'info', 'SCRIPT_LOG', line.substring(9).trim());
                } else if (line.startsWith("ERROR:")) {
                    const errorLine = line.substring(6).trim();
                    logStructured(job.id, 'error', 'SCRIPT_LOG', errorLine);
                    scriptErrors.push(errorLine);
                } else {
                    logStructured(job.id, 'debug', 'SCRIPT_STDERR', line);
                }
            });
        });

        // Handle process exit and timeout
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                logStructured(job.id, 'error', 'JOB_TIMEOUT', `Script execution timed out after ${SCRIPT_TIMEOUT_SECONDS} seconds.`);
                process.kill('SIGTERM'); // Attempt graceful shutdown first
                // Give it a moment to terminate before force killing
                setTimeout(() => {
                     if (!process.killed) {
                        process.kill('SIGKILL');
                     }
                }, 2000);
                reject(new Error(`Script execution timed out after ${SCRIPT_TIMEOUT_SECONDS} seconds.`));
            }, SCRIPT_TIMEOUT_SECONDS * 1000);

            process.on('error', (err) => {
                clearTimeout(timeout);
                logStructured(job.id, 'error', 'SUBPROCESS_ERROR', `Failed to start subprocess: ${err.message}`);
                reject(err);
            });

            process.on('close', (code) => {
                clearTimeout(timeout);
                logStructured(job.id, 'info', 'SUBPROCESS_EXEC', `Script finished with exit code: ${code}`);

                // Save any remaining products
                if (productsBuffer.length > 0) {
                    const batchToSave = [...productsBuffer];
                    productsBuffer.length = 0;
                    logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Saving final batch of ${batchToSave.length} products...`);
                    saveScrapedProducts(job.id, job.user_id, job.competitor_id, batchToSave)
                         .then(() => logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Successfully inserted final batch.`))
                         .catch(err => logStructured(job.id, 'error', 'DB_BATCH_SAVE', `Failed to save final product batch: ${err.message}`));
                }

                if (code === 0) {
                    if (scriptErrors.length > 0) {
                        finalStatus = 'failed';
                        errorMessage = `Script finished successfully (exit code 0) but reported errors via stderr.`;
                        errorDetails = scriptErrors.join('\n');
                        logStructured(job.id, 'error', 'JOB_COMPLETION', errorMessage);
                    } else {
                        finalStatus = 'completed';
                        logStructured(job.id, 'info', 'JOB_COMPLETION', `Job completed successfully. Total products processed: ${productCount}`);
                    }
                } else {
                    finalStatus = 'failed';
                    errorMessage = `Script execution failed with non-zero exit code ${code}.`;
                    // Combine script errors and other stderr lines
                    const stderrLines = stderrData.trim().split('\n').filter(l => !l.startsWith("PROGRESS:") && !l.startsWith("ERROR:"));
                    errorDetails = [...scriptErrors, ...stderrLines].join('\n').trim();
                    logStructured(job.id, 'error', 'JOB_COMPLETION', errorMessage);
                    if (errorDetails) {
                        logStructured(job.id, 'error', 'JOB_COMPLETION', `Stderr Output:\n${errorDetails}`);
                    }
                }
                resolve();
            });
        });

    } catch (err: any) {
        finalStatus = 'failed';
        errorMessage = `Worker error during job processing: ${err.message}`;
        errorDetails = err.stack || null;
        logStructured(job.id, 'error', 'JOB_PROCESSING', errorMessage, { stack: err.stack });
    } finally {
        // Cleanup temporary file
        if (tmpScriptPath) {
            try {
                await fsPromises.unlink(tmpScriptPath);
                await fsPromises.rmdir(path.dirname(tmpScriptPath)); // Remove the temp directory
                logStructured(job.id, 'debug', 'CLEANUP', `Removed temporary script and directory: ${tmpScriptPath}`);
            } catch (cleanupError: any) {
                logStructured(job.id, 'warn', 'CLEANUP', `Error removing temporary script ${tmpScriptPath}: ${cleanupError.message}`);
            }
        }
    }

    // 6. Final status update
    const executionTimeMs = Date.now() - startTime;
    const productsPerSecond = executionTimeMs > 0 ? (productCount / (executionTimeMs / 1000.0)) : 0;

    try {
        await supabase
            .from('scraper_runs')
            .update({
                status: finalStatus, // Use the status determined by subprocess logic
                completed_at: new Date().toISOString(),
                product_count: productCount,
                execution_time_ms: executionTimeMs,
                error_message: errorMessage ? errorMessage.substring(0, 1000) : null, // Truncate error message
                // error_details column might not exist, add if needed or store in progress_messages
                // error_details: errorDetails ? errorDetails.substring(0, 4000) : null, // Truncate error details
                products_per_second: productsPerSecond,
            })
            .eq('id', job.id);
        logStructured(job.id, 'info', 'COMPLETION', `Job final status updated to: ${finalStatus}.`);
    } catch (updateError: any) {
         logStructured(job.id, 'error', 'JOB_STATUS_UPDATE', `Critical error updating final job status: ${updateError.message}`);
    }

  } catch (error) {
    console.error('Unhandled error during job processing:', error);
    // Attempt to mark the job as failed if an error occurred after it was claimed
    if (job && job.id) { // Check if job was successfully fetched and potentially claimed
        try {
            await supabase
                .from('scraper_runs')
                .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: error instanceof Error ? error.message : 'Unhandled worker error',
                })
                .eq('id', job.id);
             logStructured(job.id, 'error', 'ERROR', 'Job marked as failed due to unhandled worker error.');
        } catch (updateError) {
            console.error(`Failed to update job ${job.id} status after unhandled error:`, updateError);
        }
    }
  }
}

// --- Helper Function for Structured Logging ---
// Note: fsSync and path are already imported at the top

// Ensure logs directory exists at startup
const logsDir = path.join(process.cwd(), 'logs');
try {
    if (!fsSync.existsSync(logsDir)) {
        fsSync.mkdirSync(logsDir, { recursive: true });
        console.log(`Created logs directory: ${logsDir}`);
    }
} catch (err) {
    console.error(`Failed to create logs directory ${logsDir}:`, err);
    // Decide if worker should exit if logging to file is critical
}


function logStructured(jobId: string | null, level: string, phase: string, message: string, data?: any) { // Allow null jobId for worker-level logs
  const timestamp = new Date();
  const logEntry = {
    ts: timestamp.toISOString(),
    lvl: level.toUpperCase(),
    phase,
    msg: message,
    data: data ?? null,
  };

  // Log to console
  const logPrefix = jobId ? `[Job ${jobId}]` : '[Worker]';
  console.log(`${logPrefix} [${level.toUpperCase()}] [${phase}] ${message}`, data ? JSON.stringify(data) : '');

  // Log to file asynchronously
  const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logsDir, `ts-worker-${dateStr}.log`);
  const logLine = JSON.stringify(logEntry) + '\n';

  fsPromises.appendFile(logFile, logLine).catch(err => {
      // Log failure to write file only to console to avoid loops
      console.error(`${logPrefix} Failed to write to log file ${logFile}: ${err}`);
  });


  // Append logEntry to scraper_runs.progress_messages array in DB (only if jobId is present)
  // Use a separate async function to avoid blocking the log call itself
  // Fire-and-forget approach for logging updates
  if (jobId) {
      (async () => {
          try {
              // Use the logEntry object directly, Supabase client handles JSON conversion for RPC
              const { error } = await supabase
                  .rpc('append_log_to_scraper_run', { p_run_id: jobId, p_log_entry: logEntry });
              // Note: Using an RPC function 'append_log_to_scraper_run' is recommended for atomicity.
              // See comment below for the function definition.

              if (error) {
                  // Avoid logging failure to append logs, as it could cause infinite loops
                  console.error(`${logPrefix} Failed to append log to DB: ${error.message}`);
              }
          } catch (dbError) {
              console.error(`${logPrefix} Exception during log DB update:`, dbError);
          }
      })();
  }
}

/*
-- Recommended RPC function for atomicity (add to DB schema, e.g., 04_public_functions_triggers.sql):
CREATE OR REPLACE FUNCTION append_log_to_scraper_run(p_run_id uuid, p_log_entry jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scraper_runs
  SET progress_messages = coalesce(progress_messages, '[]'::jsonb) || p_log_entry
  WHERE id = p_run_id;
END;
$$;
*/


// --- Function to save scraped products ---
async function saveScrapedProducts(runId: string, userId: string, competitorId: string, products: ScrapedProductData[]) {
    if (!products || products.length === 0) return;
    logStructured(runId, 'debug', 'DB_INSERT', `Attempting to save ${products.length} products...`);

    // Map ScrapedProductData to the structure needed for scraped_products table
    const productsToInsert = products.map(p => ({
        // Let DB generate UUID for id
        user_id: userId,
        scraper_run_id: runId, // Link back to the run
        competitor_id: competitorId,
        // product_id will be handled by DB trigger/matching logic later if implemented
        name: p.name,
        price: p.price,
        currency: p.currency ?? 'USD', // Default currency
        url: p.url,
        image_url: p.image_url,
        sku: p.sku,
        brand: p.brand,
        ean: p.ean,
        scraped_at: new Date().toISOString(),
    }));

    // Insert products in chunks to avoid exceeding Supabase limits
    const BATCH_SIZE = 500; // Adjust as needed
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;
    let insertedCount = 0;

    for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
        const chunk = productsToInsert.slice(i, i + BATCH_SIZE);
        const chunkNumber = i / BATCH_SIZE + 1;
        let attempt = 0;
        let success = false;

        while (attempt < MAX_RETRIES && !success) {
            attempt++;
            try {
                logStructured(runId, 'debug', 'DB_INSERT', `Attempt ${attempt}/${MAX_RETRIES} inserting chunk ${chunkNumber} (${chunk.length} products)...`);
                const { error } = await supabase.from('scraped_products').insert(chunk);

                if (error) {
                    logStructured(runId, 'warn', 'DB_INSERT', `Attempt ${attempt} failed for chunk ${chunkNumber}: ${error.message}`);
                    if (attempt >= MAX_RETRIES) {
                        throw new Error(`Failed to insert chunk ${chunkNumber} after ${MAX_RETRIES} attempts: ${error.message}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS)); // Wait before retry
                } else {
                    insertedCount += chunk.length;
                    logStructured(runId, 'info', 'DB_INSERT', `Successfully inserted chunk ${chunkNumber}. Total inserted so far: ${insertedCount}`);
                    success = true;
                }
            } catch (err) {
                 logStructured(runId, 'error', 'DB_INSERT', `Exception during insert attempt ${attempt} for chunk ${chunkNumber}: ${err instanceof Error ? err.message : String(err)}`);
                 if (attempt >= MAX_RETRIES) {
                     throw new Error(`Failed to insert chunk ${chunkNumber} due to exception after ${MAX_RETRIES} attempts: ${err instanceof Error ? err.message : String(err)}`);
                 }
                 await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS)); // Wait before retry
            }
        }
    }
    logStructured(runId, 'info', 'DB_INSERT', `Finished saving products for run ${runId}. Total successfully inserted: ${insertedCount}/${productsToInsert.length}`);
}



// Main polling loop
function startPolling() {
  // Run once immediately, then set interval
  fetchAndProcessJob().catch(err => console.error("Initial poll failed:", err));

  const intervalId = setInterval(() => {
    fetchAndProcessJob().catch(err => console.error("Polling cycle failed:", err));
  }, POLLING_INTERVAL_MS);

  // Graceful shutdown handling (optional but recommended)
  const shutdown = () => {
    console.log('Shutting down worker...');
    clearInterval(intervalId);
    // Add any other cleanup logic here (e.g., close DB connections if needed)
    process.exit(0);
  };

  process.on('SIGINT', () => {
    console.log('SIGINT received.');
    shutdown();
   });
  process.on('SIGTERM', () => {
     console.log('SIGTERM received.');
     shutdown();
  });
} // End of startPolling function

// --- Initialization ---
startPolling(); // Start the worker polling loop;