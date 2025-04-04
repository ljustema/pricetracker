import { ScrapedProductData, ScraperConfig, ScraperMetadata } from "@/lib/services/scraper-types"; // Added ScraperMetadata
import { SupabaseClient } from '@supabase/supabase-js';
// Removed unused imports: fs, path, os
import { randomUUID } from 'crypto';
// Removed child_process imports as execution is delegated

// Progress cache to store run status information
interface ProgressData {
  status: 'initializing' | 'running' | 'success' | 'failed';
  productCount: number;
  currentBatch: number;
  totalBatches: number | null; // null if unknown
  startTime: number;
  endTime: number | null;
  executionTime: number | null;
  errorMessage: string | null;
  progressMessages: string[];
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
   * Start a test run for a scraper that will only process the first batch
   * Returns a runId that can be used to track progress
   * @param scraperId The ID of the scraper to test
   * @returns { runId: string } The ID for tracking the test run progress
   */
  static async startScraperTestRun(scraperId: string): Promise<{ runId: string }> {
    // Generate a run ID
    const runId = randomUUID();
    console.log(`Generated runId ${runId} for test run of scraper ${scraperId}`);
    
    // Initialize progress data in memory cache
    this.progressCache.set(runId, {
      status: 'initializing',
      productCount: 0,
      currentBatch: 0,
      totalBatches: null,
      startTime: Date.now(),
      endTime: null,
      executionTime: null,
      errorMessage: null,
      progressMessages: []
    });
    
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();
    
    // Create a record in the database for this run
    try {
      // Get the scraper to get the user_id
      const { data: scraper } = await supabaseAdmin
        .from('scrapers')
        .select('user_id')
        .eq('id', scraperId)
        .single();
      
      if (!scraper) {
        throw new Error('Scraper not found');
      }
      
      // Create a record in the scraper_runs table
      const { error: insertError } = await supabaseAdmin
        .from('scraper_runs')
        .insert({
          id: runId,
          scraper_id: scraperId,
          user_id: scraper.user_id,
          status: 'initializing',
          started_at: new Date().toISOString(),
          is_test_run: true
        });
        
      if (insertError) {
        console.error(`Error inserting run record in database: ${insertError.message}`);
        throw new Error(`Failed to create run record: ${insertError.message}`);
      }
      
      console.log(`Created database record for test run ${runId}`);
    } catch (error) {
      console.error(`Error creating run record in database: ${error}`);
      // We'll continue anyway since we have the in-memory cache
    }
    
    // Run the test asynchronously
    this.runScraperTestInternal(scraperId, runId).catch(async (error) => {
      console.error(`Unhandled error in runScraperTestInternal for ${scraperId}:`, error);
      // Update progress cache with error
      const progress = this.progressCache.get(runId);
      if (progress) {
        this.progressCache.set(runId, {
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
        const { error: updateError } = await supabaseAdmin
          .from('scraper_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : String(error)
          })
          .eq('id', runId);
          
        if (updateError) {
          console.error(`Error updating run record in database: ${updateError.message}`);
        } else {
          console.log(`Updated database record for failed test run ${runId}`);
        }
      } catch (dbError) {
        console.error(`Error updating run record in database: ${dbError}`);
      }
    });
    
    // Return the run ID immediately
    return { runId };
  }
  
  /**
   * Internal implementation of test run that handles the actual execution
   * This runs asynchronously and updates the progress cache
   * Only processes the first batch of products
   */
  private static async runScraperTestInternal(scraperId: string, runId: string): Promise<void> {
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();

    // Update progress status to running
    const initialProgress = this.progressCache.get(runId);
    if (initialProgress) {
      this.progressCache.set(runId, {
        ...initialProgress,
        status: 'running',
        progressMessages: [...initialProgress.progressMessages, 'Starting test run...']
      });
    }

    // Update scraper status to running
    await supabaseAdmin
      .from('scrapers')
      .update({
        status: 'running',
        last_run: new Date().toISOString(),
      })
      .eq('id', scraperId);

    let hasErrors = false;
    let finalErrorMessage: string | null = null;
    let totalProducts = 0;
    const startTime = Date.now();

    try {
      // Get the scraper configuration using admin client to bypass RLS
      const { data: scraper } = await supabaseAdmin
        .from('scrapers')
        .select('*')
        .eq('id', scraperId)
        .single();

      if (!scraper) {
        throw new Error('Scraper not found');
      }

      // Only support Python and AI scrapers
      if (scraper.scraper_type !== 'python' && scraper.scraper_type !== 'ai') {
        throw new Error(`Unsupported scraper type: ${scraper.scraper_type}`);
      }

      if (!scraper.python_script) {
        throw new Error('Scraper script content is missing.');
      }

      // Get required libraries from metadata
      const requiredLibraries = (scraper.script_metadata as ScraperMetadata | undefined)?.required_libraries || [];

      // Determine the absolute URL for the Python execution endpoint
      // Use VERCEL_URL in production/preview, fallback to localhost for development
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const executionUrl = `${baseUrl}/api/execute_scraper`;

      console.log(`Run ${runId} (Test): Calling Python execution endpoint: ${executionUrl}`);

      // Update progress
      const progress = this.progressCache.get(runId);
      if (progress) {
        this.progressCache.set(runId, { ...progress, progressMessages: [...progress.progressMessages, `Calling Python execution endpoint...`] });
      }

      // Call the Python execution endpoint
      const response = await fetch(executionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          run_id: runId,
          script_content: scraper.python_script,
          requirements: requiredLibraries,
          // Add is_test_run: true if the Python endpoint needs it
        }),
        // Set a reasonable timeout for the API call itself (e.g., 10 minutes)
        // The Python function has its own internal timeout for the script execution
        signal: AbortSignal.timeout(10 * 60 * 1000)
      });

      const result = await response.json();

      if (!response.ok) {
        hasErrors = true;
        finalErrorMessage = result.error || `Python execution endpoint failed with status ${response.status}`;
        console.error(`Run ${runId} (Test): Python execution failed: ${finalErrorMessage}`);
      } else {
        console.log(`Run ${runId} (Test): Python execution successful.`);
        totalProducts = result.product_count || 0; // Get product count from response
        // Note: Test runs in the Python script might be designed to return 0 products
        // We only care about successful execution here.
      }

    } catch (error) {
      console.error(`Error in runScraperTestInternal calling Python endpoint for ${scraperId}:`, error);
      hasErrors = true;
      finalErrorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      // Calculate execution time
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Update scraper status based on results
      const scraperStatus = hasErrors ? 'failed' : 'success'; // Test run succeeds if execution is ok
      const scraperErrorMessage = hasErrors ? `Test run failed: ${finalErrorMessage}` : null;

      await supabaseAdmin
        .from('scrapers')
        .update({
          status: scraperStatus, // Update main scraper status based on test success/fail
          error_message: scraperErrorMessage,
          execution_time: executionTime // Store execution time for the test
        })
        .eq('id', scraperId);

      // Update run record with final status
      await supabaseAdmin
        .from('scraper_runs')
        .update({
          status: scraperStatus,
          completed_at: new Date(endTime).toISOString(),
          product_count: totalProducts, // Store products found during test
          error_message: scraperErrorMessage,
          execution_time_ms: executionTime
        })
        .eq('id', runId);

      // Update progress cache with final status
      const finalProgress = this.progressCache.get(runId);
      if (finalProgress) {
        this.progressCache.set(runId, {
          ...finalProgress,
          status: scraperStatus,
          endTime: endTime,
          executionTime: executionTime,
          productCount: totalProducts,
          errorMessage: scraperErrorMessage,
          progressMessages: [...(finalProgress.progressMessages || []), `Test run finished with status: ${scraperStatus}`]
        });
      } else {
         // If cache expired, log final status
         console.warn(`Run ${runId} (Test): Progress cache entry expired before final update. Final status: ${scraperStatus}`);
      }
    }
  }

  /**
   * Run a scraper and store the results in batches with real-time progress tracking
   * @param scraperId The ID of the scraper to run
   * @param runId Optional run ID for tracking progress (generated if not provided)
   */
  static async runScraper(scraperId: string, runId?: string): Promise<{ runId: string }> {
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
      progressMessages: []
    });
    
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();
    
    // Create a record in the database for this run
    try {
      // Get the scraper to get the user_id
      const { data: scraper } = await supabaseAdmin
        .from('scrapers')
        .select('user_id')
        .eq('id', scraperId)
        .single();
      
      if (!scraper) {
        throw new Error('Scraper not found');
      }
      
      // Create a record in the scraper_runs table
      await supabaseAdmin
        .from('scraper_runs')
        .insert({
          id: actualRunId,
          scraper_id: scraperId,
          user_id: scraper.user_id,
          status: 'initializing',
          started_at: new Date().toISOString(),
          is_test_run: false
        });
    } catch (error) {
      console.error(`Error creating run record in database: ${error}`);
      // We'll continue anyway since we have the in-memory cache
    }
    
    // Run the scraper asynchronously - use Promise.resolve() to ensure a full Promise is returned
    Promise.resolve().then(() => this.runScraperInternal(scraperId, actualRunId))
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
  private static async runScraperInternal(scraperId: string, runId: string): Promise<void> {
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();

    // Update progress status to running
    const initialProgress = this.progressCache.get(runId);
    if (initialProgress) {
      this.progressCache.set(runId, {
        ...initialProgress,
        status: 'running',
        progressMessages: [...initialProgress.progressMessages, 'Starting scraper run...']
      });
    }

    // Update scraper status to running
    await supabaseAdmin
      .from('scrapers')
      .update({
        status: 'running',
        last_run: new Date().toISOString(),
      })
      .eq('id', scraperId);

    let hasErrors = false;
    let finalErrorMessage: string | null = null;
    let totalProducts = 0;
    const startTime = Date.now();

    try {
      // Get the scraper configuration using admin client to bypass RLS
      const { data: scraper } = await supabaseAdmin
        .from('scrapers')
        .select('*')
        .eq('id', scraperId)
        .single();

      if (!scraper) {
        throw new Error('Scraper not found');
      }

      // Only support Python and AI scrapers
      if (scraper.scraper_type !== 'python' && scraper.scraper_type !== 'ai') {
        throw new Error(`Unsupported scraper type: ${scraper.scraper_type}`);
      }

      if (!scraper.python_script) {
        throw new Error('Scraper script content is missing.');
      }

      // Get required libraries from metadata
      const requiredLibraries = (scraper.script_metadata as ScraperMetadata | undefined)?.required_libraries || [];

      // Determine the absolute URL for the Python execution endpoint
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const executionUrl = `${baseUrl}/api/execute_scraper`;

      console.log(`Run ${runId}: Calling Python execution endpoint: ${executionUrl}`);

      // Update progress
      const progress = this.progressCache.get(runId);
      if (progress) {
        this.progressCache.set(runId, { ...progress, progressMessages: [...progress.progressMessages, `Calling Python execution endpoint...`] });
      }

      // Call the Python execution endpoint
      const response = await fetch(executionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          run_id: runId,
          script_content: scraper.python_script,
          requirements: requiredLibraries,
        }),
         // Set a reasonable timeout for the API call itself (e.g., 10 minutes)
        // The Python function has its own internal timeout for the script execution
        signal: AbortSignal.timeout(10 * 60 * 1000)
      });

      const result = await response.json();

      if (!response.ok) {
        hasErrors = true;
        finalErrorMessage = result.error || `Python execution endpoint failed with status ${response.status}`;
        console.error(`Run ${runId}: Python execution failed: ${finalErrorMessage}`);
      } else {
        console.log(`Run ${runId}: Python execution successful.`);
        totalProducts = result.product_count || 0; // Get product count from response
        // Process the products returned/counted by the Python function
        // NOTE: The current Python script only *counts* products.
        // If we need to process the actual product data here, the Python script
        // would need to return the data, and this Node.js code would need
        // to call `this.processBatch` with that data.
        // For now, we just record the count reported by the Python function.
        if (totalProducts > 0) {
           const progress = this.progressCache.get(runId);
           if (progress) {
             this.progressCache.set(runId, {
               ...progress,
               productCount: totalProducts,
               // Assuming Python script processes all in one go for now
               currentBatch: 1,
               totalBatches: 1,
               progressMessages: [...progress.progressMessages, `Python function reported ${totalProducts} products.`]
             });
           }
           // Update DB record for product count immediately
           await supabaseAdmin
             .from('scraper_runs')
             .update({ product_count: totalProducts, current_batch: 1, total_batches: 1 })
             .eq('id', runId);
        }
      }

    } catch (error) {
      console.error(`Error in runScraperInternal calling Python endpoint for ${scraperId}:`, error);
      hasErrors = true;
      finalErrorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      // Calculate execution time
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      const finalProgress = this.progressCache.get(runId); // Get latest cache state

      // Calculate products per second
      let products_per_second: number | null = null;
      const executionTimeSeconds = executionTime / 1000.0;
      if (executionTimeSeconds > 0 && totalProducts > 0) {
        products_per_second = parseFloat((totalProducts / executionTimeSeconds).toFixed(2));
      }

      // Prepare scraper update data
      const scraperStatus = hasErrors ? 'failed' : 'success';
      const scraperErrorMessage = hasErrors ? finalErrorMessage : null;
      const scraperUpdateData: {
        status: string;
        error_message: string | null;
        execution_time: number;
        last_products_per_second?: number | null;
      } = {
        status: scraperStatus,
        error_message: scraperErrorMessage,
        execution_time: executionTime,
      };
      if (!hasErrors) {
        scraperUpdateData.last_products_per_second = products_per_second;
      }

      // Update scraper status based on results
      await supabaseAdmin
        .from('scrapers')
        .update(scraperUpdateData)
        .eq('id', scraperId);

      // Update run record in the database
      await supabaseAdmin
        .from('scraper_runs')
        .update({
          status: scraperStatus,
          completed_at: new Date(endTime).toISOString(),
          product_count: totalProducts,
          current_batch: finalProgress?.currentBatch || 1, // Use cache value or assume 1
          total_batches: finalProgress?.totalBatches || 1, // Use cache value or assume 1
          error_message: scraperErrorMessage,
          execution_time_ms: executionTime,
          products_per_second: products_per_second
        })
        .eq('id', runId);

      // Update progress cache with final status
      if (finalProgress) {
        this.progressCache.set(runId, {
          ...finalProgress,
          status: scraperStatus,
          endTime: endTime,
          executionTime: executionTime,
          productCount: totalProducts, // Ensure final count is set
          errorMessage: scraperErrorMessage,
          progressMessages: [...(finalProgress.progressMessages || []), `Run finished with status: ${scraperStatus}`]
        });
      } else {
         console.warn(`Run ${runId}: Progress cache entry expired before final update. Final status: ${scraperStatus}`);
      }
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
    
    // Store the results
    const { error: insertError } = await supabaseAdmin
      .from('scraped_products')
      .insert(processedProducts);
    
    if (insertError) {
      throw new Error(`Failed to store scraped products: ${insertError.message}`);
    }
    
    return processedProducts.length;
  }
}