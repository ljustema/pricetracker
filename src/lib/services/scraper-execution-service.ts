import { ScrapedProductData, ScraperConfig, ScraperMetadata } from "@/lib/services/scraper-types";
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
// Import the new Crawlee scraper function and the callback type
import { runNorrmalmselScraper, ProgressCallback } from '@/lib/scrapers/norrmalmsel-crawler';
import { Configuration } from 'crawlee'; // Added for patching
import { MemoryStorage } from '@crawlee/memory-storage'; // Added for patching

// Progress cache to store run status information
interface ProgressData {
  status: 'initializing' | 'running' | 'success' | 'failed';
  productCount: number;
  currentBatch: number;
  totalBatches: number | null; // null if unknown (Can be estimated during run)
  startTime: number;
  endTime: number | null;
  executionTime: number | null;
  errorMessage: string | null;
  progressMessages: string[];
  productsPerSecond?: number | null; // Add for progress reporting
}

/**
 * Service for executing scrapers
 */
export class ScraperExecutionService {
  // In-memory cache for progress data
  private static progressCache = new Map<string, ProgressData>();
  
  // Cache cleanup interval (30 minutes)
  private static CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000;
  
  // Maximum age for cache entries (2 hours)
  private static MAX_CACHE_AGE = 2 * 60 * 60 * 1000;
  
  // Initialize cache cleanup
  static {
    setInterval(() => {
      this.cleanupProgressCache();
    }, this.CACHE_CLEANUP_INTERVAL);
  }
  
  /**
   * Clean up old entries from the progress cache
   */
  private static cleanupProgressCache() {
    const now = Date.now();
    for (const [runId, data] of this.progressCache.entries()) {
      // Remove entries that are completed and older than MAX_CACHE_AGE
      if (
        (data.status === 'success' || data.status === 'failed') &&
        data.endTime &&
        now - data.endTime > this.MAX_CACHE_AGE
      ) {
        this.progressCache.delete(runId);
      }
    }
  }
  
  /**
   * Get progress data for a run
   */
  static getProgress(runId: string): ProgressData | null {
    return this.progressCache.get(runId) || null;
  }
  
  /**
   * Run a scraper and store the results in batches with real-time progress tracking
   * @param scraperId The ID of the scraper to run.
   * @param runId Optional run ID for tracking progress (generated if not provided).
   * @param isTestRun Optional flag to indicate if this is a limited test run (default: false).
   */
  static async runScraper(scraperId: string, runId?: string, isTestRun: boolean = false): Promise<{ runId: string }> {
    // Generate a run ID if not provided
    const actualRunId = runId || randomUUID();
    
    // Initialize progress data in memory cache
    this.progressCache.set(actualRunId, {
      status: 'initializing',
      productCount: 0,
      currentBatch: 0,
      totalBatches: null,
      startTime: Date.now(),
      endTime: null,
      executionTime: null,
      errorMessage: null,
      progressMessages: [],
      productsPerSecond: null, // Initialize
    });
    
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();
    
    // Create a record in the database for this run
    try {
      // Get the scraper to get the user_id
      const { data: scraper } = await supabaseAdmin
        .from('scrapers')
        .select('user_id') // Fetch user_id needed for run record
        .eq('id', scraperId)
        .single();
      
      if (!scraper) {
        throw new Error('Scraper not found');
      }
      
      // Create a record in the scraper_runs table
      const { error: insertError } = await supabaseAdmin
        .from('scraper_runs')
        .insert({
          id: actualRunId,
          scraper_id: scraperId,
          user_id: scraper.user_id, // Use fetched user_id
          status: 'initializing',
          started_at: new Date().toISOString(),
          is_test_run: isTestRun // Use the parameter here
        });

      if (insertError) {
          console.error(`Error inserting run record in database: ${insertError.message}`);
          // Update cache to reflect failure before throwing
          const progress = this.progressCache.get(actualRunId);
          if (progress) {
              this.progressCache.set(actualRunId, {
                  ...progress,
                  status: 'failed',
                  endTime: Date.now(),
                  executionTime: Date.now() - progress.startTime,
                  errorMessage: `Failed to create initial run record in DB: ${insertError.message}`
              });
          }
          // CRITICAL FIX: Throw error to stop execution if DB record fails
          throw new Error(`Failed to create run record in database: ${insertError.message}`);
      }
      console.log(`Created database record for run ${actualRunId}`);

    } catch (error) {
      console.error(`Error creating run record in database: ${error}`);
       // If the error wasn't the insertError handled above, update cache and re-throw
       if (!(error instanceof Error && error.message.startsWith('Failed to create run record'))) {
           const progress = this.progressCache.get(actualRunId);
           if (progress) {
               this.progressCache.set(actualRunId, {
                   ...progress,
                   status: 'failed',
                   endTime: Date.now(),
                   executionTime: Date.now() - progress.startTime,
                   errorMessage: `Error during run initialization: ${error instanceof Error ? error.message : String(error)}`
               });
           }
       }
       // Re-throw the error to prevent execution
       throw error;
    }
    
    // Run the scraper asynchronously - use Promise.resolve() to ensure a full Promise is returned
    // Pass isTestRun to the internal method
    Promise.resolve().then(() => this.runScraperInternal(scraperId, actualRunId, isTestRun))
      .catch(async error => {
        console.error(`Unhandled error in runScraperInternal for ${scraperId}:`, error);
        // Update progress cache with error
        const progress = this.progressCache.get(actualRunId);
        if (progress) {
          this.progressCache.set(actualRunId, {
            ...progress,
            status: 'failed',
            endTime: Date.now(),
            executionTime: Date.now() - progress.startTime,
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Update the database record
        try {
          const supabaseAdmin = createSupabaseAdminClient();
          await supabaseAdmin
            .from('scraper_runs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error instanceof Error ? error.message : String(error)
            })
            .eq('id', actualRunId);
        } catch (dbError) {
          console.error(`Error updating run record in database: ${dbError}`);
        }
      });
    
    // Return the run ID immediately
    return { runId: actualRunId };
  }
  
  /**
   * Internal implementation of runScraper that handles the actual execution
   * This runs asynchronously and updates the progress cache
   */
  private static async runScraperInternal(scraperId: string, runId: string, isTestRun: boolean): Promise<void> {
    console.log(`Run ${runId}: Entering runScraperInternal. isTestRun: ${isTestRun}`); // <<< ADDED LOG
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();

    // --- Declare variables needed in try/catch/finally ---
    let hasErrors = false;
    let finalErrorMessage: string | null = null;
    let totalProductsFound = 0; // Renamed to reflect products found by scraper
    let totalProductsInserted = 0; // Track products inserted by processBatch
    let lastReportedBatchNumber = 0; // Track the last batch number reported by scraper
    const startTime = Date.now();
    let scraper: ScraperConfig | null = null; // Fetch scraper config early

    // --- Progress Update Callback ---
    const handleProgressUpdate: ProgressCallback = async (progressData) => {
        console.log(`Run ${runId}: Progress Update - Batch ${progressData.batchNumber}, Products Found: ${progressData.processedProductCount}`);
        const currentProgress = ScraperExecutionService.progressCache.get(runId);
        if (!currentProgress || currentProgress.status === 'failed') {
            console.warn(`Run ${runId}: Skipping progress update as run is failed or cache missing.`);
            return; // Don't update if already failed or cache gone
        }

        const now = Date.now();
        const elapsedMs = now - currentProgress.startTime;
        const elapsedSec = elapsedMs / 1000.0;
        const productsPerSecond = elapsedSec > 0 ? parseFloat((progressData.processedProductCount / elapsedSec).toFixed(2)) : 0;

        // Create summary message
        const summary = `Batch ${progressData.batchNumber}: Found ${progressData.processedProductCount} products (${productsPerSecond.toFixed(1)}/sec)`;

        // Update Cache
        ScraperExecutionService.progressCache.set(runId, {
            ...currentProgress,
            productCount: progressData.processedProductCount, // Update with count from scraper
            currentBatch: progressData.batchNumber,
            totalBatches: null, // Keep totalBatches null during run for UI calculation
            executionTime: elapsedMs,
            productsPerSecond: productsPerSecond,
            // Replace previous messages with the latest summary
            progressMessages: [summary]
        });
        lastReportedBatchNumber = progressData.batchNumber; // Keep track of the latest batch number

        // Update Database (async, don't wait for it to avoid blocking scraper)
        supabaseAdmin
            .from('scraper_runs')
            .update({
                product_count: progressData.processedProductCount,
                current_batch: progressData.batchNumber,
                total_batches: null, // Keep null in DB during run
                execution_time_ms: elapsedMs,
                products_per_second: productsPerSecond,
                status: 'running' // Ensure status stays running
            })
            .eq('id', runId)
            .then(({ error }) => {
                if (error) {
                    console.error(`Run ${runId}: Failed to update progress in DB:`, error);
                } else {
                     console.log(`Run ${runId}: DEBUG - Updated progress in DB (Batch ${progressData.batchNumber})`);
                }
            });
    };


    try {
        // --- Initial Setup ---
        // Get the FULL scraper configuration including script content
        const { data: fetchedScraper, error: fetchError } = await supabaseAdmin
            .from('scrapers')
            .select('*') // Select all fields to satisfy ScraperConfig
            .eq('id', scraperId)
            .single();

        if (fetchError || !fetchedScraper) {
            throw new Error(`Scraper not found or fetch error: ${fetchError?.message || 'Not found'}`);
        }
        // Assign to the outer scope variable, ensuring type compatibility
        scraper = fetchedScraper as ScraperConfig;

        // Update progress status to running in cache (using static access)
        const initialProgress = ScraperExecutionService.progressCache.get(runId);
        if (initialProgress) {
            ScraperExecutionService.progressCache.set(runId, {
                ...initialProgress,
                status: 'running',
                progressMessages: [...initialProgress.progressMessages, 'Starting scraper run...']
            });
        } else {
             // Initialize if somehow missing
             ScraperExecutionService.progressCache.set(runId, {
                status: 'running', productCount: 0, currentBatch: 0, totalBatches: null,
                startTime: startTime, endTime: null, executionTime: null, errorMessage: null, progressMessages: ['Starting scraper run...'], productsPerSecond: null
             });
        }

        // Update scraper status to running in DB (for the main scraper record)
        console.log(`Run ${runId}: Updating main scraper record status to 'running'...`); // <<< ADDED LOG
        await supabaseAdmin
            .from('scrapers')
            .update({
                status: 'running',
                last_run: new Date().toISOString(),
            })
            .eq('id', scraperId);
        console.log(`Run ${runId}: Main scraper record status updated.`); // <<< ADDED LOG

        // Update the specific RUN record status to 'running' BEFORE starting the heavy work
        console.log(`Run ${runId}: Updating DB run record status to 'running' before scraper execution...`); // <<< ADDED LOG
        await supabaseAdmin
            .from('scraper_runs')
            .update({ status: 'running' }) // Update status here
            .eq('id', runId);
        console.log(`Run ${runId}: DB run record status updated to 'running'.`); // <<< ADDED LOG

        // --- Scraper Execution Logic ---
        // Scraper object is guaranteed to be non-null here due to check above

        // Check scraper type to determine execution path

        // --- Determine Execution Path ---
        if (scraper.scraper_type === 'crawlee') {
            // --- Execute Crawlee Scraper ---
            const runType = isTestRun ? 'Test Run' : 'Full Run';
            console.log(`Run ${runId} (${runType}): Starting Crawlee scraper: ${scraper.name}`);
            const progress = ScraperExecutionService.progressCache.get(runId); // Use static access
            if (progress) {
                // Add a message indicating Crawlee start
                ScraperExecutionService.progressCache.set(runId, { ...progress, progressMessages: [...progress.progressMessages, `Starting Crawlee execution (${runType})...`] }); // Use static access
            }

            // Prepare options, including the progress callback
            const crawleeOptions: Parameters<typeof runNorrmalmselScraper>[0] = {
                 isValidationRun: isTestRun,
                 maxRequests: isTestRun ? 200 : undefined, // Limit requests for test runs
                 onProgress: handleProgressUpdate // Pass the callback
            };

            // --- CURRENT POC IMPLEMENTATION (Runs from imported file) ---
            // TODO: Refactor this section to dynamically execute scraper.typescript_script
            //       This will likely involve:
            //       1. Fetching scraper.typescript_script (already available in `scraper` variable).
            //       2. Defining a structure for the script content (e.g., exporting specific functions).
            //       3. Using `vm` module or similar to safely execute the script string from the DB,
            //          injecting necessary modules (`crawlee`, `MemoryStorage`, helpers) and the `crawleeOptions`.
            //       4. The executed script should return the scraped products array.
            console.warn(`Run ${runId}: WARNING - Currently executing Crawlee scraper from imported file, NOT from database script.`);
            // --- Monkey-patch Crawlee Configuration for MemoryStorage ---
            console.log(`Run ${runId}: Applying MemoryStorage monkey-patch...`);
            // Imports are already at the top level
            const storageClientPatch = new MemoryStorage({ persistStorage: false });
            const configurationPatch = new Configuration({ storageClient: storageClientPatch });
            // @ts-ignore - Necessary workaround for Crawlee 3
            Configuration.globalConfig = configurationPatch;
            // @ts-ignore - Necessary workaround for Crawlee 3
            Configuration.getGlobal = () => configurationPatch;
            console.log(`Run ${runId}: MemoryStorage monkey-patch applied.`);
            // --- End Patch ---

            const scrapedProducts = await runNorrmalmselScraper(crawleeOptions);
            console.log(`Run ${runId}: runNorrmalmselScraper finished. Found ${scrapedProducts.length} products.`); // <<< ADDED LOG
            // --- END OF CURRENT POC IMPLEMENTATION ---

            totalProductsFound = scrapedProducts.length; // Store the count found by scraper
            console.log(`Run ${runId} (${runType}): Crawlee scraper finished. Found ${totalProductsFound} raw products.`);
  
             // Process the results using processBatch
             if (scrapedProducts.length > 0) {
                 console.log(`Run ${runId}: Processing ${scrapedProducts.length} products with processBatch...`);
                 // Ensure the scraper object passed to processBatch matches ScraperConfig type
                 const fullScraperConfig: ScraperConfig = scraper; // Already fetched with '*'
  
                 // Use static access for processBatch
                 const insertedCount = await ScraperExecutionService.processBatch(scrapedProducts, fullScraperConfig, scraperId, supabaseAdmin);
                 console.log(`Run ${runId}: processBatch finished. Inserted ${insertedCount} products.`); // <<< ADDED LOG
                 totalProductsInserted = insertedCount; // Update totalProductsInserted with the count from processBatch
                 console.log(`Run ${runId}: processBatch finished. Inserted ${insertedCount} products.`);
                 console.log(`Run ${runId}: DEBUG - processBatch returned ${insertedCount}`); // <<< ADDED LOG
  
                 // Update progress cache with FINAL product count (inserted) and batch info - use static access
                 // This might overwrite the last incremental update, which is fine
                 const finalScrapeProgress = ScraperExecutionService.progressCache.get(runId);
                 if (finalScrapeProgress) {
                     ScraperExecutionService.progressCache.set(runId, {
                         ...finalScrapeProgress,
                         productCount: totalProductsInserted, // Reflect inserted count
                         currentBatch: lastReportedBatchNumber, // Use last reported batch
                         totalBatches: lastReportedBatchNumber, // Assume last reported is total for now
                         progressMessages: [...finalScrapeProgress.progressMessages, `Crawlee run complete. Processed & Inserted ${totalProductsInserted} products.`]
                     });
                 }
                  // Update DB record for product count immediately (use inserted count)
                  await supabaseAdmin
                    .from('scraper_runs')
                    .update({ product_count: totalProductsInserted, current_batch: lastReportedBatchNumber, total_batches: lastReportedBatchNumber })
                    .eq('id', runId);
  
             } else {
                  totalProductsInserted = 0; // Ensure this is 0 if no products were scraped
                  console.log(`Run ${runId}: Crawlee scraper returned 0 products. Nothing to process.`);
             }
  
         } else if (scraper.scraper_type === 'python' || scraper.scraper_type === 'ai') {
             // --- Existing Python/AI Execution Logic ---
             // NOTE: This path does not currently support incremental progress reporting
             if (!scraper.python_script) {
                 throw new Error('Scraper script content is missing.');
             }
             const requiredLibraries = (scraper.script_metadata as ScraperMetadata | undefined)?.required_libraries || [];
             const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
             const executionUrl = `${baseUrl}/api/execute_scraper`;
             console.log(`Run ${runId}: Calling Python execution endpoint: ${executionUrl}`);
             // Update progress (using static access)
             const progressPy = ScraperExecutionService.progressCache.get(runId);
             if (progressPy) {
                 ScraperExecutionService.progressCache.set(runId, { ...progressPy, progressMessages: [...progressPy.progressMessages, `Calling Python execution endpoint...`] });
             }
             const response = await fetch(executionUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     run_id: runId,
                     script_content: scraper.python_script,
                     requirements: requiredLibraries,
                 }),
                 signal: AbortSignal.timeout(10 * 60 * 1000)
             });
             const result = await response.json();
             if (!response.ok) {
                 hasErrors = true;
                 finalErrorMessage = result.error || `Python execution endpoint failed with status ${response.status}`;
                 console.error(`Run ${runId}: Python execution failed: ${finalErrorMessage}`);
             } else {
                 console.log(`Run ${runId}: Python execution successful.`);
                 totalProductsInserted = result.product_count || 0; // Assume Python response count is inserted count
                 // Update progress cache and DB based on Python result
                 if (totalProductsInserted > 0) {
                     // Use static access
                     const progressPyUpdate = ScraperExecutionService.progressCache.get(runId);
                     if (progressPyUpdate) {
                         ScraperExecutionService.progressCache.set(runId, {
                             ...progressPyUpdate,
                             productCount: totalProductsInserted,
                             currentBatch: 1, // Assume Python does one batch for now
                             totalBatches: 1,
                             progressMessages: [...progressPyUpdate.progressMessages, `Python function reported ${totalProductsInserted} products.`]
                         });
                     }
                     await supabaseAdmin
                         .from('scraper_runs')
                         .update({ product_count: totalProductsInserted, current_batch: 1, total_batches: 1 })
                         .eq('id', runId);
                 }
             }
         } else {
              // This path should ideally not be reached if type is validated on creation
              console.error(`Run ${runId}: Encountered unsupported scraper type: ${scraper.scraper_type}`);
              throw new Error(`Unsupported scraper type: ${scraper.scraper_type}`);
         }
      // End of main execution logic

    } catch (error: unknown) { // Catch errors from setup or execution
        console.error(`Run ${runId}: ERROR caught in runScraperInternal:`, error); // <<< ADDED LOG
        console.error(`Error during scraper execution for ${scraperId} (Run ID: ${runId}):`, error);
        hasErrors = true;
        finalErrorMessage = error instanceof Error ? error.message : String(error);
        // Ensure progress cache reflects the error immediately (using static access)
        const progress = ScraperExecutionService.progressCache.get(runId);
        if (progress) {
            ScraperExecutionService.progressCache.set(runId, {
                ...progress,
                status: 'failed',
                errorMessage: finalErrorMessage,
                endTime: Date.now(), // Set end time on error
                executionTime: Date.now() - startTime, // Set execution time on error
            });
        }
    } finally {
        // --- Final Updates (Always Run) ---
        console.log(`Run ${runId}: Entering finally block of runScraperInternal.`); // <<< ADDED LOG
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        // Use static access for cache
        const finalProgress = ScraperExecutionService.progressCache.get(runId);

        // Calculate final products per second based on inserted products
        let final_products_per_second: number | null = null;
        const executionTimeSeconds = executionTime / 1000.0;
        // Use totalProductsInserted for final calculation
        if (executionTimeSeconds > 0 && totalProductsInserted > 0) {
            final_products_per_second = parseFloat((totalProductsInserted / executionTimeSeconds).toFixed(2));
        }

        // Determine final status based on hasErrors flag
        const scraperStatus = hasErrors ? 'failed' : 'success';
        // Use finalErrorMessage which is set in the catch block
        const scraperErrorMessage = hasErrors ? finalErrorMessage : null;

        // Prepare scraper update data for the 'scrapers' table
        // Use Partial<ScraperConfig> for update data
        const scraperUpdateData: Partial<ScraperConfig> & { execution_time: number, last_products_per_second?: number | null } = {
            status: scraperStatus,
            error_message: scraperErrorMessage === null ? undefined : scraperErrorMessage, // Convert null to undefined
            execution_time: executionTime,
        };
        // Update last_products_per_second only on success
        if (!hasErrors) {
            scraperUpdateData.last_products_per_second = final_products_per_second;
        }

        // Update main scraper status in 'scrapers' table
        // Ensure supabaseAdmin is accessible here (it should be from the outer scope)
        try {
             console.log(`Run ${runId}: DEBUG - Updating 'scrapers' table in finally block...`); // <<< ADDED LOG
             await supabaseAdmin
                .from('scrapers')
                .update(scraperUpdateData)
                .eq('id', scraperId);
        } catch (dbError) {
             console.error(`Run ${runId}: Failed to update main scraper status in DB:`, dbError);
        }

        // Prepare final run record update data for the 'scraper_runs' table
        const runUpdateData = {
            status: scraperStatus,
            completed_at: new Date(endTime).toISOString(),
            // Use totalProductsInserted for the final count
            product_count: totalProductsInserted,
            // Use last reported batch number for current and total
            current_batch: lastReportedBatchNumber,
            total_batches: lastReportedBatchNumber, // Set final total batches
            error_message: scraperErrorMessage,
            execution_time_ms: executionTime,
            products_per_second: final_products_per_second // Use final calculated value
        };

        // Update run record in the 'scraper_runs' table
        try {
            console.log(`Run ${runId}: DEBUG - Updating 'scraper_runs' table in finally block...`); // <<< ADDED LOG
            await supabaseAdmin
                .from('scraper_runs')
                .update(runUpdateData)
                .eq('id', runId);
            console.log(`Run ${runId}: DEBUG - Successfully updated 'scraper_runs' table.`); // <<< ADDED LOG
        } catch (dbError) {
             console.error(`Run ${runId}: Failed to update scraper run status in DB:`, dbError);
        }

        // Update progress cache with final status (using static access)
        // Ensure cache reflects the final state even if errors occurred
        if (finalProgress) {
            console.log(`Run ${runId}: DEBUG - Updating progress cache in finally block...`); // <<< ADDED LOG
            // Construct final summary message
            const finalSummary = scraperStatus === 'success'
                ? `Run finished: Inserted ${totalProductsInserted} products in ${lastReportedBatchNumber} batches (${(executionTime / 1000).toFixed(1)}s, ${final_products_per_second?.toFixed(1) ?? '0.0'}/sec)`
                : `Run failed: ${scraperErrorMessage || 'Unknown error'}`;

            ScraperExecutionService.progressCache.set(runId, { // Use static access
                ...finalProgress,
                status: scraperStatus,
                endTime: endTime,
                executionTime: executionTime,
                productCount: totalProductsInserted, // Ensure final inserted count is set
                currentBatch: lastReportedBatchNumber, // Reflect final batch state
                totalBatches: lastReportedBatchNumber, // Reflect final batch state
                productsPerSecond: final_products_per_second, // Set final rate
                errorMessage: scraperErrorMessage,
                // Replace intermediate messages with the final summary
                progressMessages: [finalSummary]
            });
        } else {
            // Log if cache expired, but still try to update DB above
            console.warn(`Run ${runId}: Progress cache entry expired before final update. Final status: ${scraperStatus}`);
        }
        console.log(`Run ${runId}: Exiting finally block of runScraperInternal.`); // <<< ADDED LOG
    } // End finally
    console.log(`Run ${runId}: Exiting runScraperInternal function.`); // <<< ADDED LOG
  } // End runScraperInternal method

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
    const processedProducts = await Promise.all(scrapedProducts.map(async (product) => {
      // Try to match with existing products
      let matchedProductId = null;

      // Try to match by EAN if available
      if (product.ean) {
        const { data: matchedProducts } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('user_id', scraper.user_id)
          .eq('ean', product.ean)
          .limit(1);

        if (matchedProducts && matchedProducts.length > 0) {
          matchedProductId = matchedProducts[0].id;
        }
      }

      // If no match by EAN, try by brand and SKU
      if (!matchedProductId && product.brand && product.sku) {
        const { data: matchedProducts } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('user_id', scraper.user_id)
          .eq('brand', product.brand)
          .eq('sku', product.sku)
          .limit(1);

        if (matchedProducts && matchedProducts.length > 0) {
          matchedProductId = matchedProducts[0].id;
        }
      }

      // If a match was found, link the product
      if (matchedProductId) {
        return {
          ...product,
          product_id: matchedProductId,
        };
      }

      // No match found, the database trigger will handle creating a new product
      return product;
    }));

    // --- Batch Insert Logic ---
    const BATCH_SIZE = 500; // Define the size of each insert chunk
    let insertedCount = 0;
    console.log(`processBatch: Starting insert of ${processedProducts.length} products in chunks of ${BATCH_SIZE}...`);

    for (let i = 0; i < processedProducts.length; i += BATCH_SIZE) {
        const chunk = processedProducts.slice(i, i + BATCH_SIZE);
        console.log(`processBatch: Inserting chunk ${i / BATCH_SIZE + 1} (${chunk.length} products)...`);

        const { error: insertError } = await supabaseAdmin
            .from('scraped_products')
            .insert(chunk);

        if (insertError) {
            // Log the error and the chunk number for easier debugging
            console.error(`processBatch: Error inserting chunk ${i / BATCH_SIZE + 1}: ${insertError.message}`);
            // Throw the error to stop processing and let the calling function handle it
            throw new Error(`Failed to store scraped products chunk ${i / BATCH_SIZE + 1}: ${insertError.message}`);
        } else {
            insertedCount += chunk.length;
            console.log(`processBatch: Successfully inserted chunk ${i / BATCH_SIZE + 1}. Total inserted so far: ${insertedCount}`);
        }
    }

    console.log(`processBatch: Finished inserting all chunks. Total inserted: ${insertedCount}`);
    return insertedCount; // Return the total count of successfully inserted products
  }
}