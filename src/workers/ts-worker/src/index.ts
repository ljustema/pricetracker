import 'dotenv/config'; // Load environment variables
import { spawn } from 'child_process'; // Added for subprocess execution
import fsPromises from 'fs/promises'; // Use fs/promises for async file operations
import fsSync from 'fs'; // Use fs for synchronous operations like existsSync/mkdirSync
import path from 'path'; // Added for path manipulation
import os from 'os'; // Added for temp directory
import util from 'util'; // Added for promisify (if needed later)
import { debugLog, logToDatabase } from './debug-logger'; // Import our debug logger

// Log that the worker has started with our changes
debugLog('TypeScript worker started with debug logging enabled');

// Import Database type for type safety
import type { Database } from './database.types';

// Lazy loading functions for heavy dependencies
let supabaseClient: any = null;

async function getSupabaseClient() {
  if (!supabaseClient) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase URL or Service Role Key environment variables.');
    }

    supabaseClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);
    debugLog('Supabase client initialized');
  }
  return supabaseClient;
}

// Type for the data returned by the claim_next_scraper_job RPC
interface ClaimedJobData {
  id: string; // UUID
  created_at: string; // TIMESTAMPTZ
  scraper_id: string; // UUID
  user_id: string; // UUID
  status: string;
  scraper_type: string;
  started_at: string | null; // TIMESTAMPTZ
  completed_at: string | null; // TIMESTAMPTZ
  error_message: string | null;
  error_details: any | null; // JSONB
  product_count: number | null;
  is_test_run: boolean | null;
  is_validation_run: boolean | null;
  fetched_competitor_id: string | null; // UUID
}

// Define types for context and results (align with scraper template)
interface ScriptContext {
  activeBrandNames?: string[];
  activeBrandIds?: string[];
  filterByActiveBrands?: boolean;
  ownProductEans?: string[];
  ownProductSkuBrands?: { sku: string; brand: string; brand_id?: string }[];
  scrapeOnlyOwnProducts?: boolean;
  isTestRun?: boolean;
  isValidation?: boolean; // Scraper template expects this
  run_id?: string; // Scraper template expects this
  // The scraper template defines a log function in its context,
  // but it seems to use console.error for PROGRESS/ERROR which this worker already captures.
  // So, we might not need to pass a log function in the context object itself.
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
  competitor_id?: string; // Added competitor_id field
  // Add other fields as needed
}

interface ScriptMetadata {
  required_libraries?: string[];
  target_url?: string;
  batch_size?: number;
  // Add other metadata fields
}

// Supabase client will be initialized lazily when needed

const WORKER_TYPE = 'typescript'; // Define the type of scraper this worker handles
const POLLING_INTERVAL_MS = 30000; // Poll every 30 seconds (reduced from 5 seconds)
const SCRIPT_TIMEOUT_SECONDS = 7200; // Timeout for script execution (2 hours) - Matches Python worker
const DB_BATCH_SIZE = 100; // How many products to buffer before saving to DB
const HEALTH_CHECK_INTERVAL_MS = 300000; // 5 minutes between health check logs

console.log(`Starting TypeScript Worker (Polling interval: ${POLLING_INTERVAL_MS}ms)`);

// Memory monitoring and management
function logMemoryUsage(context: string) {
  const memUsage = process.memoryUsage();
  const memMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
  console.log(`[MEMORY] ${context}: RSS=${memMB.rss}MB, Heap=${memMB.heapUsed}/${memMB.heapTotal}MB, External=${memMB.external}MB`);

  // Log warning if memory usage is high
  if (memMB.rss > 1000) {
    console.warn(`[MEMORY WARNING] High memory usage detected: ${memMB.rss}MB RSS`);
  }
}

// Force garbage collection and memory cleanup
function forceMemoryCleanup(context: string) {
  debugLog(`Forcing memory cleanup: ${context}`);

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    debugLog('Garbage collection triggered');
  }

  // Log memory usage after cleanup
  logMemoryUsage(`After cleanup - ${context}`);
}

// Log initial memory usage
logMemoryUsage('Worker startup');

// Track last successful job time and last health check time
let lastJobTime = Date.now();
let lastHealthCheckTime = Date.now();
let lastPollMessageTime = 0; // To reduce polling message frequency

// Job processing state to prevent race conditions
let isProcessingJob = false;
let currentJobId: string | null = null;

async function fetchAndProcessJob() {
  let job: any = null; // Define job variable in the outer scope for the catch block

  try {
    // RACE CONDITION PROTECTION: Skip if already processing a job
    if (isProcessingJob) {
      console.log(`Skipping poll - already processing job ${currentJobId}`);
      return;
    }

    // Periodically check for long periods of inactivity and log health status
    const currentTime = Date.now();
    if (currentTime - lastHealthCheckTime > HEALTH_CHECK_INTERVAL_MS) {
      const inactivityDuration = (currentTime - lastJobTime) / 1000; // Convert to seconds
      console.log(`Worker health check: ${inactivityDuration.toFixed(1)} seconds since last job processed. Worker is still running.`);
      logMemoryUsage('Health check');

      // Force memory cleanup during health checks to prevent memory leaks
      forceMemoryCleanup('Health check');

      lastHealthCheckTime = currentTime;
    }

    // Only log polling message once every minute to reduce noise
    if (currentTime - lastPollMessageTime > 60000) { // 1 minute
      console.log('Polling for pending jobs...');
      lastPollMessageTime = currentTime;
    }

    // 1. Atomically fetch and claim a pending job using RPC
    const supabase = await getSupabaseClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'claim_next_scraper_job',
      { worker_type_filter: WORKER_TYPE }
    );

    if (rpcError) {
      console.error('Error calling claim_next_scraper_job RPC:', rpcError);
      logStructured(null, 'error', 'RPC_CALL_ERROR', `Error calling claim_next_scraper_job: ${rpcError.message}`, { details: rpcError.details, hint: rpcError.hint });
      return; // Wait for the next poll interval
    }

    // rpcData will be an array of ClaimedJobData.
    // If the array is empty or null, no job was claimed.
    const claimedJobs = rpcData as ClaimedJobData[] | null;

    if (!claimedJobs || claimedJobs.length === 0) {
      // console.log('No pending jobs found or claimed.'); // Can be noisy
      return; // No job claimed, wait for the next poll interval
    }

    job = claimedJobs[0]; // Assign the first (and should be only) claimed job

    // SET JOB PROCESSING STATE - Prevent race conditions
    isProcessingJob = true;
    currentJobId = job.id;

    // The job status is already 'running' and started_at is set by the RPC function.
    console.log(`Job ${job.id} claimed successfully via RPC. Scraper ID: ${job.scraper_id}`);
    logStructured(job.id, 'info', 'JOB_CLAIMED', `Job ${job.id} claimed successfully via RPC.`);
    logMemoryUsage(`Job ${job.id} start`);

    // Update last job time when a job is successfully claimed
    lastJobTime = Date.now();

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
            activeBrandNames = brands.map((b: any) => b.name);
            activeBrandIds = brands.map((b: any) => b.id);
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
            ownProductEans = products.map((p: any) => p.ean).filter((ean: any): ean is string => !!ean);
            ownProductSkuBrands = products
                .filter((p: any) => p.sku && (p.brand || p.brand_id))
                .map((p: any) => ({
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
    let compilationResult: any = null; // Store compilation result for cleanup
    const startTime = Date.now();

    try {
        // Prepare context (simplified, not used in this version)
        logStructured(job.id, 'debug', 'SETUP', 'Prepared script context');

        // Lazy load the TypeScript compiler
        debugLog('Loading TypeScript compiler...');
        const { compileTypeScriptScraper, cleanupCompilation } = await import('./typescript-compiler');
        debugLog('TypeScript compiler loaded');

        // Compile the TypeScript script
        logStructured(job.id, 'info', 'TYPESCRIPT_COMPILATION', 'Compiling TypeScript script...');
        debugLog(`Compiling TypeScript script for job ${job.id}`);

        // Declare the compilationResult variable at a higher scope
        let compilationResult;

        try {
          // Log the first 100 characters of the script for debugging
          const scriptPreview = scraper.typescript_script.substring(0, 100).replace(/\n/g, ' ');
          debugLog(`Script preview: ${scriptPreview}...`);

          compilationResult = await compileTypeScriptScraper(scraper.typescript_script, {
            timeout: 60000 // 60 seconds timeout for compilation
          });

          if (!compilationResult || !compilationResult.success || !compilationResult.outputPath) {
            const errorMessage = compilationResult?.error || 'Unknown compilation error';
            logStructured(job.id, 'error', 'TYPESCRIPT_COMPILATION', `Compilation failed: ${errorMessage}`);
            debugLog(`Compilation failed for job ${job.id}: ${errorMessage}`);

            // Clean up temporary directory if it exists
            if (compilationResult?.tempDir) {
              await cleanupCompilation(compilationResult.tempDir);
            }

            throw new Error(`TypeScript compilation failed: ${errorMessage}`);
          }

          // Log success
          debugLog(`Compilation successful for job ${job.id}`);
          logStructured(job.id, 'info', 'TYPESCRIPT_COMPILATION', 'TypeScript compilation completed successfully');
        } catch (compileError) {
          // Enhanced error handling for compilation errors
          const errorMessage = compileError instanceof Error ? compileError.message : String(compileError);
          const errorStack = compileError instanceof Error ? compileError.stack : null;

          logStructured(job.id, 'error', 'TYPESCRIPT_COMPILATION', `Compilation error: ${errorMessage}`, { stack: errorStack });
          debugLog(`Compilation error for job ${job.id}: ${errorMessage}`);

          if (errorStack) {
            debugLog(`Error stack: ${errorStack}`);
          }

          throw new Error(`TypeScript compilation failed: ${errorMessage}`);
        }

        // Use the compiled JavaScript file
        // Make sure compilationResult is defined and has an outputPath
        if (!compilationResult || !compilationResult.outputPath) {
            throw new Error('Compilation result is missing or invalid. This should not happen as we already checked for success.');
        }

        tmpScriptPath = compilationResult.outputPath;
        logStructured(job.id, 'info', 'SUBPROCESS_EXEC', `Executing compiled script: ${tmpScriptPath}`);
        debugLog(`Executing compiled script for job ${job.id}: ${tmpScriptPath}`);

        // Spawn subprocess - simplified approach
        const command = 'node';

        // Prepare the context object for the scraper script
        // Ensure this matches the ScriptContext interface expected by the scraper scripts
        const scriptContextForScraper = {
          activeBrandNames,
          activeBrandIds, // Though scraper template might not use this directly, good to have if ScriptContext implies it
          filterByActiveBrands: scraper.filter_by_active_brands,
          ownProductEans,
          ownProductSkuBrands,
          scrapeOnlyOwnProducts: scraper.scrape_only_own_products,
          isTestRun: job.is_test_run ?? false, // Default to false if undefined
          isValidation: job.is_validation_run ?? false, // Assuming a field like is_validation_run on the job, or default
          run_id: job.id,
        };
        const scriptContextString = JSON.stringify(scriptContextForScraper);
        const base64ContextString = Buffer.from(scriptContextString).toString('base64');

        const args = [tmpScriptPath, 'scrape', '--context', base64ContextString];
        // Log the command we're about to execute
        debugLog(`Executing command: ${command} ${args.join(' ')}`);
        await logToDatabase(job.id, `Executing command: ${command} ${args.join(' ')}`);

        // Add a small delay before spawning the process to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fix TypeScript type issues with spawn
        const childProcess = spawn(command, args as string[], {
            stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
            shell: true, // Use shell to ensure proper command execution on Windows
            cwd: path.dirname(tmpScriptPath), // Set working directory to the script directory
            detached: false, // Make sure the child process is attached to the parent
            windowsHide: true // Hide the console window on Windows
        });

        let stdoutData = '';
        let stderrData = '';
        const scriptErrors: string[] = [];

        // Log that the process was spawned
        debugLog(`Process spawned with PID: ${childProcess.pid || 'unknown'}`);
        await logToDatabase(job.id, `Process spawned with PID: ${childProcess.pid || 'unknown'}`);

        // Add error handler for the spawn itself
        childProcess.on('error', (err: Error) => {
            debugLog(`Process spawn error: ${err.message}`);
            logToDatabase(job.id, `Process spawn error: ${err.message}`, { error: err.toString(), stack: err.stack });

            // Make sure we update the job status on error
            // Use direct update instead of a separate function
            try {
                supabase
                    .from('scraper_runs')
                    .update({
                        status: 'failed',
                        error_message: `Process spawn error: ${err.message}`,
                        error_details: err.stack || 'No stack trace available',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', job.id)
                    .then(() => {
                        debugLog(`Updated job status to failed after spawn error`);
                    });
            } catch (updateErr) {
                const errorMessage = updateErr instanceof Error ? updateErr.message : String(updateErr);
                debugLog(`Failed to update job status after spawn error: ${errorMessage}`);
            }
        });

        // Handle stdout
        childProcess.stdout?.on('data', async (data: Buffer) => {
            stdoutData += data.toString();
            // Process line by line
            let newlineIndex;
            while ((newlineIndex = stdoutData.indexOf('\n')) >= 0) {
                const line = stdoutData.substring(0, newlineIndex).trim();
                stdoutData = stdoutData.substring(newlineIndex + 1);
                if (line) {
                    // Check if the line looks like a log message (not JSON)
                    if (line.startsWith('INFO') || line.startsWith('DEBUG') || line.startsWith('WARN') ||
                        line.startsWith('ERROR') || line.includes('CheerioCrawler:')) {
                        // This is a log message, not a product - log it and continue
                        logStructured(job.id, 'info', 'SCRIPT_LOG', `STDOUT: ${line}`);
                        continue;
                    }

                    try {
                        const product = JSON.parse(line);
                        if (typeof product === 'object' && product !== null && product.name && product.price !== undefined) {
                            productsBuffer.push(product as ScrapedProductData);
                            productCount++;

                            // Update product count in database every 10 products
                            if (productCount % 10 === 0) {
                                try {
                                    const updateResult = await supabase
                                        .from('scraper_runs')
                                        .update({ product_count: productCount })
                                        .eq('id', job.id);

                                    if (updateResult.error) {
                                        logStructured(job.id, 'error', 'PRODUCT_COUNT_UPDATE', `Failed to update product count: ${updateResult.error.message}`);
                                    } else {
                                        logStructured(job.id, 'info', 'PRODUCT_COUNT_UPDATE', `Updated product count to ${productCount}`);
                                    }
                                } catch (err: any) {
                                    logStructured(job.id, 'error', 'PRODUCT_COUNT_UPDATE', `Error updating product count: ${err.message}`);
                                }
                            }

                            if (productsBuffer.length >= DB_BATCH_SIZE) {
                                const batchToSave = [...productsBuffer]; // Copy buffer
                                productsBuffer.length = 0; // Clear buffer
                                logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Saving batch of ${batchToSave.length} products...`);
                                // Use job.fetched_competitor_id from the RPC response
                                saveScrapedProducts(job.id, job.user_id, job.fetched_competitor_id ?? undefined, batchToSave, supabase)
                                    .then(() => logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Successfully inserted batch.`))
                                    .catch(err => logStructured(job.id, 'error', 'DB_BATCH_SAVE', `Failed to save product batch: ${err.message}`));
                            }
                        } else {
                            logStructured(job.id, 'warn', 'SCRIPT_STDOUT', `Skipping invalid product JSON structure: ${line.substring(0, 100)}...`);
                        }
                    } catch (e) {
                        // Instead of warning about JSON decode failure, treat it as a log message
                        logStructured(job.id, 'info', 'SCRIPT_LOG', `STDOUT: ${line}`);
                    }
                }
            }
        });

        // Handle stderr with improved error capture
        childProcess.stderr?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n');
            lines.forEach(async (line: string) => {
                line = line.trim();
                if (!line) return;
                stderrData += line + '\n'; // Store for potential error details

                // Log all stderr output to the debug log for better debugging
                debugLog(`STDERR: ${line}`);

                // Also log to database for better visibility
                logToDatabase(job.id, `STDERR: ${line}`);

                if (line.startsWith("PROGRESS:")) {
                    const progressMessage = line.substring(9).trim();
                    logStructured(job.id, 'info', 'SCRIPT_LOG', progressMessage);

                    // Extract phase information from progress message
                    const phaseMatch = progressMessage.match(/Phase (\d+):/);
                    if (phaseMatch && phaseMatch[1]) {
                        const phase = parseInt(phaseMatch[1], 10);
                        if (!isNaN(phase) && phase > 0) {
                            // Update the current_phase in the database
                            try {
                                const updateResult = await supabase
                                    .from('scraper_runs')
                                    .update({ current_phase: phase })
                                    .eq('id', job.id);

                                if (updateResult.error) {
                                    logStructured(job.id, 'error', 'PHASE_UPDATE', `Failed to update phase: ${updateResult.error.message}`);
                                } else {
                                    logStructured(job.id, 'info', 'PHASE_UPDATE', `Updated current phase to ${phase}`);
                                }
                            } catch (err: any) {
                                logStructured(job.id, 'error', 'PHASE_UPDATE', `Error updating phase: ${err.message}`);
                            }
                        }
                    }

                    // Extract batch information from progress message
                    const batchMatch = progressMessage.match(/(\d+)\/(\d+)/);
                    if (batchMatch && batchMatch[1] && batchMatch[2]) {
                        const currentBatch = parseInt(batchMatch[1], 10);
                        const totalBatches = parseInt(batchMatch[2], 10);
                        if (!isNaN(currentBatch) && !isNaN(totalBatches)) {
                            // Update the batch information in the database
                            try {
                                const updateResult = await supabase
                                    .from('scraper_runs')
                                    .update({
                                        current_batch: currentBatch,
                                        total_batches: totalBatches
                                    })
                                    .eq('id', job.id);

                                if (updateResult.error) {
                                    logStructured(job.id, 'error', 'BATCH_UPDATE', `Failed to update batch progress: ${updateResult.error.message}`);
                                } else {
                                    logStructured(job.id, 'info', 'BATCH_UPDATE', `Updated batch progress to ${currentBatch}/${totalBatches}`);
                                }
                            } catch (err: any) {
                                logStructured(job.id, 'error', 'BATCH_UPDATE', `Error updating batch progress: ${err.message}`);
                            }
                        }
                    }
                } else if (line.startsWith("ERROR:")) {
                    const errorLine = line.substring(6).trim();
                    logStructured(job.id, 'error', 'SCRIPT_LOG', errorLine);
                    scriptErrors.push(errorLine);
                } else if (
                    line.includes("Error:") ||
                    line.includes("error:") ||
                    line.includes("Exception:") ||
                    line.includes("exception:") ||
                    line.includes("TypeError:") ||
                    line.includes("ReferenceError:") ||
                    line.includes("SyntaxError:") ||
                    line.includes("Cannot find module") ||
                    line.includes("is not defined") ||
                    line.includes("is not a function") ||
                    line.includes("Cannot read property") ||
                    line.includes("Cannot read properties")
                ) {
                    // Capture error-like messages that don't have the ERROR: prefix
                    logStructured(job.id, 'error', 'SCRIPT_ERROR', line);
                    scriptErrors.push(line);
                } else if (line.includes("at ") && (line.includes(".js:") || line.includes(".ts:"))) {
                    // This looks like a stack trace line
                    logStructured(job.id, 'debug', 'SCRIPT_STACKTRACE', line);
                    // Add to errors if we've seen an error recently
                    if (scriptErrors.length > 0) {
                        scriptErrors.push(line);
                    }
                } else {
                    logStructured(job.id, 'debug', 'SCRIPT_STDERR', line);
                }
            });
        });

        // Handle process exit and timeout
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                logStructured(job.id, 'error', 'JOB_TIMEOUT', `Script execution timed out after ${SCRIPT_TIMEOUT_SECONDS} seconds.`);
                childProcess.kill(); // Use kill without signal for TypeScript compatibility
                // Give it a moment to terminate before force killing
                setTimeout(() => {
                     try {
                        // Check if process is still running and force kill if needed
                        if (childProcess.exitCode === null) {
                            childProcess.kill();
                        }
                     } catch (killError) {
                        debugLog(`Error during force kill: ${killError}`);
                     }
                }, 2000);
                reject(new Error(`Script execution timed out after ${SCRIPT_TIMEOUT_SECONDS} seconds.`));
            }, SCRIPT_TIMEOUT_SECONDS * 1000);

            childProcess.on('error', (err: Error) => {
                clearTimeout(timeout);
                logStructured(job.id, 'error', 'SUBPROCESS_ERROR', `Failed to start subprocess: ${err.message}`);
                reject(err);
            });

            childProcess.on('close', async (code: number | null) => {
                clearTimeout(timeout);
                logStructured(job.id, 'info', 'SUBPROCESS_EXEC', `Script finished with exit code: ${code}`);

                // Debug log the exit code
                debugLog(`Process exited with code: ${code}`);
                logToDatabase(job.id, `Process exited with code: ${code}`);

                // If the process failed, log the stderr output
                if (code !== 0) {
                    // Log the full stderr output for debugging
                    debugLog(`Process exited with non-zero code ${code}. Full stderr output:`);
                    debugLog(stderrData);

                    // Log to database for better visibility
                    logToDatabase(job.id, `Process exited with non-zero code ${code}. Full stderr output:`);

                    // Extract a more meaningful error message from script errors or stderr
                    let detailedErrorMessage = '';

                    // First check for script errors (these are more likely to be user-friendly)
                    if (scriptErrors.length > 0) {
                        detailedErrorMessage = scriptErrors[0];
                    } else {
                        // Look for common error patterns in stderr
                        const errorPatterns = [
                            /Error:\s*(.+?)(?:\n|$)/i,
                            /TypeError:\s*(.+?)(?:\n|$)/i,
                            /ReferenceError:\s*(.+?)(?:\n|$)/i,
                            /SyntaxError:\s*(.+?)(?:\n|$)/i,
                            /Cannot find module\s*['"](.*?)['"](?:\n|$)/i,
                            /(.*?)\s*is not defined(?:\n|$)/i,
                            /(.*?)\s*is not a function(?:\n|$)/i,
                            /Cannot read propert(?:y|ies) of\s*(.+?)(?:\n|$)/i
                        ];

                        for (const pattern of errorPatterns) {
                            const match = stderrData.match(pattern);
                            if (match && match[0]) {
                                detailedErrorMessage = match[0].trim();
                                break;
                            }
                        }
                    }

                    // Try to extract the most relevant error message
                    const errorLines = stderrData.split('\n')
                        .filter((line: string) =>
                            line.includes('Error:') ||
                            line.includes('TypeError:') ||
                            line.includes('ReferenceError:') ||
                            line.includes('SyntaxError:') ||
                            line.includes('Cannot find module') ||
                            line.includes('is not defined') ||
                            line.includes('is not a function') ||
                            line.includes('Cannot read property') ||
                            line.includes('Cannot read properties')
                        );

                    if (errorLines.length > 0) {
                        // Log the most relevant error message
                        const primaryError = errorLines[0].trim();
                        debugLog(`Primary error: ${primaryError}`);
                        logToDatabase(job.id, `Primary error: ${primaryError}`);

                        // If we don't have a detailed error message yet, use the primary error
                        if (!detailedErrorMessage) {
                            detailedErrorMessage = primaryError;
                        }
                    }

                    // Use the detailed error message if we found one
                    if (detailedErrorMessage) {
                        errorMessage = detailedErrorMessage;
                    } else {
                        errorMessage = `Script execution failed with non-zero exit code TT ${code}.`;
                    }

                    // Create a structured error details object
                    const errorDetailsObj = {
                        exitCode: code,
                        scriptErrors: scriptErrors,
                        fullStderr: stderrData.trim(),
                        primaryError: detailedErrorMessage || `Script execution failed with non-zero exit code RR ${code}.`,
                        command: `${command} ${args.join(' ')}`,
                        timestamp: new Date().toISOString(),
                        contextInfo: {
                            isTestRun: job.is_test_run,
                            scraperId: job.scraper_id,
                            runId: job.id,
                            scriptPath: tmpScriptPath
                        }
                    };

                    // Convert to string for storage
                    errorDetails = JSON.stringify(errorDetailsObj, null, 2);

                    debugLog(`Using error message: ${errorMessage}`);
                    logToDatabase(job.id, `Using error message: ${errorMessage}`);
                }

                // Save any remaining products
                if (productsBuffer.length > 0) {
                    const batchToSave = [...productsBuffer];
                    productsBuffer.length = 0;
                    logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Saving final batch of ${batchToSave.length} products...`);
                    saveScrapedProducts(job.id, job.user_id, job.fetched_competitor_id ?? undefined, batchToSave, supabase)
                         .then(() => logStructured(job.id, 'info', 'DB_BATCH_SAVE', `Successfully inserted final batch.`))
                         .catch(err => logStructured(job.id, 'error', 'DB_BATCH_SAVE', `Failed to save final product batch: ${err.message}`));
                }

                // Final update of product count in database
                try {
                    const updateResult = await supabase
                        .from('scraper_runs')
                        .update({ product_count: productCount })
                        .eq('id', job.id);

                    if (updateResult.error) {
                        logStructured(job.id, 'error', 'PRODUCT_COUNT_UPDATE', `Failed to update final product count: ${updateResult.error.message}`);
                    } else {
                        logStructured(job.id, 'info', 'PRODUCT_COUNT_UPDATE', `Updated final product count to ${productCount}`);
                    }
                } catch (err: any) {
                    logStructured(job.id, 'error', 'PRODUCT_COUNT_UPDATE', `Error updating final product count: ${err.message}`);
                }

                if (code === 0) {
                    // For test runs, always mark as completed even if there are script errors
                    if (job.is_test_run) {
                        finalStatus = 'completed';
                        logStructured(job.id, 'info', 'JOB_COMPLETION', `Test run completed successfully. Total products processed: ${productCount}`);
                    } else if (scriptErrors.length > 0) {
                        finalStatus = 'failed';
                        errorMessage = `Script finished successfully (exit code 0) but reported errors via stderr.`;
                        errorDetails = scriptErrors.join('\n');
                        logStructured(job.id, 'error', 'JOB_COMPLETION', errorMessage);

                        // Create a more structured error details object
                        const errorDetailsObj = {
                            scriptErrors: scriptErrors,
                            command: `${command} ${args.join(' ')}`,
                            timestamp: new Date().toISOString(),
                            fullStderr: stderrData.trim(),
                            primaryError: scriptErrors.length > 0 ? scriptErrors[0] : 'Unknown error',
                            contextInfo: {
                                isTestRun: job.is_test_run,
                                scraperId: job.scraper_id,
                                runId: job.id,
                                scriptPath: tmpScriptPath
                            }
                        };

                        // Convert to string for storage
                        errorDetails = JSON.stringify(errorDetailsObj, null, 2);
                    } else {
                        // Script exited with code 0 and no errors - mark as completed
                        finalStatus = 'completed';
                        logStructured(job.id, 'info', 'JOB_COMPLETION', `Job completed successfully. Total products processed: ${productCount}`);
                    }

                    // Only log errors if there are any
                    if (finalStatus === 'failed' && errorMessage) {
                        // Log the error
                        logStructured(job.id, 'error', 'JOB_COMPLETION', errorMessage);

                        // Log a summary of the error details
                        if (scriptErrors.length > 0) {
                            logStructured(job.id, 'error', 'JOB_COMPLETION', `Script reported ${scriptErrors.length} errors. First error: ${scriptErrors[0]}`);
                        }
                    }

                    // Only extract and log stderr lines if the job failed
                    if (finalStatus === 'failed') {
                        const stderrLines = stderrData.split('\n').filter(Boolean);
                        if (stderrLines.length > 0) {
                            const relevantLines = stderrLines.filter((line: string) =>
                                line.includes("Error") ||
                                line.includes("error") ||
                                line.includes("Exception") ||
                                line.includes("exception") ||
                                line.includes("SyntaxError") ||
                                line.includes("ReferenceError") ||
                                line.includes("TypeError")
                            );

                            if (relevantLines.length > 0) {
                                logStructured(job.id, 'error', 'JOB_COMPLETION', `Relevant stderr output:\n${relevantLines.slice(0, 5).join('\n')}`);
                            } else {
                                logStructured(job.id, 'error', 'JOB_COMPLETION', `Stderr Output (first 5 lines):\n${stderrLines.slice(0, 5).join('\n')}`);
                            }
                        }
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
        // Cleanup temporary files
        if (tmpScriptPath) {
            try {
                // Check if this is a compiled script (from our TypeScript compiler)
                if (compilationResult?.tempDir) {
                    // Import the cleanupCompilation function if needed
                    const { cleanupCompilation } = await import('./typescript-compiler');

                    // Use the cleanupCompilation function to clean up the entire directory
                    await cleanupCompilation(compilationResult.tempDir);
                    logStructured(job.id, 'debug', 'CLEANUP', `Cleaned up compilation directory: ${compilationResult.tempDir}`);
                } else {
                    // Fall back to the original cleanup logic for non-compiled scripts
                    try {
                        await fsPromises.unlink(tmpScriptPath);
                        // Only try to remove the directory if it exists
                        const dirPath = path.dirname(tmpScriptPath);
                        if (fsSync.existsSync(dirPath)) {
                            // Use recursive removal instead of rmdir
                            await fsPromises.rm(dirPath, { recursive: true, force: true });
                        }
                        logStructured(job.id, 'debug', 'CLEANUP', `Removed temporary script and directory: ${tmpScriptPath}`);
                    } catch (unlinkError) {
                        logStructured(job.id, 'warn', 'CLEANUP', `Error removing temporary script: ${unlinkError instanceof Error ? unlinkError.message : String(unlinkError)}`);
                    }
                }
            } catch (cleanupError: any) {
                const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                logStructured(job.id, 'warn', 'CLEANUP', `Error cleaning up temporary files: ${errorMessage}`);
                debugLog(`Error cleaning up temporary files for job ${job.id}: ${errorMessage}`);
            }
        }
    }

    // 6. Final status update
    const executionTimeMs = Date.now() - startTime;
    const productsPerSecond = executionTimeMs > 0 ? (productCount / (executionTimeMs / 1000.0)) : 0;

    try {
        // Create update object
        const updateData: any = {
            status: finalStatus,
            completed_at: new Date().toISOString(),
            product_count: productCount,
            execution_time_ms: executionTimeMs,
            error_message: errorMessage ? errorMessage.substring(0, 1000) : null, // Truncate error message
            products_per_second: productsPerSecond,
        };

        // Add error_details if we have them
        if (errorDetails) {
            updateData.error_details = errorDetails.substring(0, 10000); // Truncate to avoid DB limits

            // Also log the error details to a special log entry that will be stored in progress_messages
            logStructured(job.id, 'error', 'ERROR_DETAILS', 'Full error details', {
                error_message: errorMessage,
                error_details: errorDetails
            });
        }

        // Update the database
        await supabase
            .from('scraper_runs')
            .update(updateData)
            .eq('id', job.id);

        logStructured(job.id, 'info', 'COMPLETION', `Job final status updated to: ${finalStatus}.`);
    } catch (updateError: any) {
         logStructured(job.id, 'error', 'JOB_STATUS_UPDATE', `Critical error updating final job status: ${updateError.message}`);

         // Try to log the error details separately if the main update failed
         if (errorDetails && job.id) {
             try {
                 // Log error details to progress_messages via RPC
                 const errorLogEntry = {
                     ts: new Date().toISOString(),
                     lvl: 'ERROR',
                     phase: 'ERROR_DETAILS_FALLBACK',
                     msg: 'Error details (fallback storage)',
                     data: {
                         error_message: errorMessage,
                         error_details: errorDetails.substring(0, 5000) // Smaller truncation for fallback
                     }
                 };

                 await supabase.rpc('append_log_to_scraper_run', {
                     p_run_id: job.id,
                     p_log_entry: errorLogEntry
                 });
             } catch (logError) {
                 console.error(`Failed to store error details via fallback method: ${logError}`);
             }
         }
    }

  } catch (error) {
    console.error('Unhandled error during job processing:', error);

    // Attempt to mark the job as failed if an error occurred after it was claimed
    if (job && job.id) { // Check if job was successfully fetched and potentially claimed
        try {
            // Create a detailed error object
            const errorObj = {
                message: error instanceof Error ? error.message : 'Unhandled worker error',
                stack: error instanceof Error ? error.stack : null,
                timestamp: new Date().toISOString(),
                type: error instanceof Error ? error.constructor.name : typeof error
            };

            // Convert to JSON string for storage
            const errorDetails = JSON.stringify(errorObj, null, 2);

            // Update the job status
            const supabaseForError = await getSupabaseClient();
            await supabaseForError
                .from('scraper_runs')
                .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: errorObj.message.substring(0, 1000), // Truncate if needed
                    error_details: errorDetails.substring(0, 10000) // Truncate to avoid DB limits
                })
                .eq('id', job.id);

            // Log the error
            logStructured(job.id, 'error', 'ERROR', 'Job marked as failed due to unhandled worker error.', errorObj);

            // Also log to progress_messages via RPC for redundancy
            const errorLogEntry = {
                ts: new Date().toISOString(),
                lvl: 'ERROR',
                phase: 'UNHANDLED_ERROR',
                msg: 'Unhandled worker error',
                data: errorObj
            };

            await supabaseForError.rpc('append_log_to_scraper_run', {
                p_run_id: job.id,
                p_log_entry: errorLogEntry
            });
        } catch (updateError) {
            console.error(`Failed to update job ${job.id} status after unhandled error:`, updateError);
        }
    }
  } finally {
    // ALWAYS reset job processing state to prevent race conditions
    isProcessingJob = false;
    currentJobId = null;

    // Log memory usage after job completion
    if (job && job.id) {
      logMemoryUsage(`Job ${job.id} complete`);
    }

    // Clean up log batch for this job to prevent memory leaks
    if (job && job.id && LOG_BATCHES[job.id]) {
      // Flush any remaining messages
      try {
        await flushLogBatch(job.id);
      } catch (flushError) {
        console.error(`Error flushing final log batch for job ${job.id}:`, flushError);
      }

      // Clear the timer and delete the batch
      const timer = LOG_BATCHES[job.id].timer;
      if (timer !== null) {
        clearInterval(timer);
        LOG_BATCHES[job.id].timer = null;
      }
      delete LOG_BATCHES[job.id];
    }

    // Force memory cleanup after job completion
    forceMemoryCleanup('Job completion');
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

// Message batching system to reduce database load
interface LogBatch {
    messages: any[];
    lastFlushTime: number;
    timer: NodeJS.Timeout | null;
}

const LOG_BATCHES: Record<string, LogBatch> = {};
const BATCH_FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds (reduced frequency)
const BATCH_SIZE_THRESHOLD = 20; // Or flush when we have 20+ messages (increased threshold)
const MAX_PROGRESS_MESSAGES = 100; // Maximum progress messages to keep (prevent memory leaks)
const IMPORTANT_PHASES = ['ERROR', 'ERROR_DETAILS', 'COMPLETION', 'JOB_CLAIMED', 'PHASE_UPDATE']; // These phases get flushed immediately

// Function to flush a batch of log messages to the database
async function flushLogBatch(jobId: string, supabaseClient?: any) {
    if (!LOG_BATCHES[jobId] || LOG_BATCHES[jobId].messages.length === 0) return;

    const batch = LOG_BATCHES[jobId];
    const messagesToSend = [...batch.messages]; // Copy the messages
    batch.messages = []; // Clear the batch
    batch.lastFlushTime = Date.now();

    const logPrefix = `[Job ${jobId}]`;

    try {
        // Convert JSONB messages to strings for TEXT[] column
        // The progress_messages column is TEXT[], not JSONB
        const stringifiedMessages = messagesToSend.map(msg => JSON.stringify(msg));

        // Get supabase client if not provided
        const supabase = supabaseClient || await getSupabaseClient();

        // First get the current progress_messages
        const { data: currentData, error: fetchError } = await supabase
            .from('scraper_runs')
            .select('progress_messages')
            .eq('id', jobId)
            .single();

        if (fetchError) {
            console.error(`${logPrefix} Failed to fetch current progress_messages: ${fetchError.message}`);
            throw fetchError;
        }

        // Combine existing messages with new ones, but limit total size to prevent memory leaks
        const existingMessages = currentData?.progress_messages || [];
        const combinedMessages = [...existingMessages, ...stringifiedMessages];

        // Keep only the most recent messages to prevent unlimited growth
        const updatedMessages = combinedMessages.length > MAX_PROGRESS_MESSAGES
            ? combinedMessages.slice(-MAX_PROGRESS_MESSAGES)
            : combinedMessages;

        // Update with the combined array
        const { error } = await supabase
            .from('scraper_runs')
            .update({
                progress_messages: updatedMessages
            })
            .eq('id', jobId);

        if (error) {
            console.error(`${logPrefix} Failed to flush log batch: ${error.message}`);

            // Fallback: Try to update the last few important messages to error_details
            try {
                const importantMessages = messagesToSend
                    .filter(msg => msg.lvl === 'ERROR' || msg.phase === 'ERROR_DETAILS')
                    .slice(-3); // Just the last 3 important messages

                if (importantMessages.length > 0) {
                    // Convert to string for storage in TEXT column
                    const errorDetailsString = JSON.stringify({
                        important_logs: importantMessages,
                        timestamp: new Date().toISOString()
                    });

                    await supabase
                        .from('scraper_runs')
                        .update({
                            error_details: errorDetailsString // Store as string in TEXT column
                        })
                        .eq('id', jobId);
                }
            } catch (fallbackError) {
                console.error(`${logPrefix} Fallback log update failed:`, fallbackError);
            }
        }
    } catch (error) {
        console.error(`${logPrefix} Exception during batch flush:`, error);
    }
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

  // Only log to database if we have a job ID
  if (!jobId) return;

  // Add to batch for database logging
  if (!LOG_BATCHES[jobId]) {
      LOG_BATCHES[jobId] = {
          messages: [],
          lastFlushTime: Date.now(),
          timer: null
      };

      // Set up a timer to periodically flush this job's logs
      LOG_BATCHES[jobId].timer = setInterval(() => {
          if (Date.now() - LOG_BATCHES[jobId].lastFlushTime >= BATCH_FLUSH_INTERVAL_MS) {
              flushLogBatch(jobId).catch(err =>
                  console.error(`${logPrefix} Error in scheduled batch flush: ${err}`)
              );

              // If no messages for a while, clear the interval to avoid memory leaks
              if (LOG_BATCHES[jobId].messages.length === 0 &&
                  Date.now() - LOG_BATCHES[jobId].lastFlushTime > BATCH_FLUSH_INTERVAL_MS * 3) {
                  if (LOG_BATCHES[jobId].timer) {
                      clearInterval(LOG_BATCHES[jobId].timer);
                      LOG_BATCHES[jobId].timer = null;
                  }
                  delete LOG_BATCHES[jobId];
              }
          }
      }, BATCH_FLUSH_INTERVAL_MS);
  }

  // Add message to batch
  LOG_BATCHES[jobId].messages.push(logEntry);

  // Flush immediately for important messages or if batch is large enough
  const isImportant = level.toUpperCase() === 'ERROR' || IMPORTANT_PHASES.includes(phase);
  if (isImportant || LOG_BATCHES[jobId].messages.length >= BATCH_SIZE_THRESHOLD) {
      flushLogBatch(jobId).catch(err =>
          console.error(`${logPrefix} Error in immediate batch flush: ${err}`)
      );
  }
}

/*
-- Updated RPC function for TEXT[] type (add to DB schema, e.g., 04_public_functions_triggers.sql):
CREATE OR REPLACE FUNCTION append_log_to_scraper_run(p_run_id uuid, p_log_entry text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scraper_runs
  SET progress_messages = COALESCE(progress_messages, ARRAY[]::text[]) || ARRAY[p_log_entry]
  WHERE id = p_run_id;
END;
$$;
*/


// --- Function to save scraped products ---
async function saveScrapedProducts(runId: string, userId: string, competitorId: string | undefined, products: ScrapedProductData[], supabaseClient?: any) {
    if (!products || products.length === 0) return;

    // Check if competitorId is provided
    if (!competitorId) {
        logStructured(runId, 'error', 'DB_INSERT', `Missing competitor_id for run ${runId}. Cannot save products.`);
        return;
    }

    logStructured(runId, 'debug', 'DB_INSERT', `Attempting to save ${products.length} products with competitor_id: ${competitorId}...`);

    // Map ScrapedProductData to the structure needed for temp_competitors_scraped_data table
    const productsToInsert = products.map(p => ({
        // Let DB generate UUID for id
        user_id: userId,
        scraper_id: null, // Use the scraper_id column instead of scraper_run_id
        competitor_id: p.competitor_id || competitorId, // Use product's competitor_id if available, otherwise use the one passed to the function
        // product_id will be handled by DB trigger/matching logic later if implemented
        name: p.name,
        price: p.price,
        currency: p.currency ?? 'SEK', // Default currency to SEK
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
                const supabase = supabaseClient || await getSupabaseClient();
                const { error } = await supabase.from('temp_competitors_scraped_data').insert(chunk);

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