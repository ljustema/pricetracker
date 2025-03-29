import { ScrapedProductData, ScraperConfig } from "@/lib/services/scraper-types";
import { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { spawn, exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

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
    const progress = this.progressCache.get(runId);
    if (progress) {
      this.progressCache.set(runId, {
        ...progress,
        status: 'running'
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
      
      // Create a temporary directory for the script
      const tempDir = path.join(os.tmpdir(), "pricetracker-" + randomUUID());
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Write the script to a temporary file
      const scriptPath = path.join(tempDir, "script.py");
      fs.writeFileSync(scriptPath, scraper.python_script || '');
      
      // Find a working Python command
      const pythonCommands = ['python', 'python3', 'py'];
      let pythonCommand = '';
      
      for (const cmd of pythonCommands) {
        try {
          await execPromise(`${cmd} -c "print('test')"`, { encoding: 'utf-8' });
          pythonCommand = cmd;
          break;
        } catch (error) {
          console.warn(`Python command ${cmd} not available:`, error);
        }
      }
      
      if (!pythonCommand) {
        throw new Error('No Python interpreter found. Please ensure Python is installed and available in PATH.');
      }
      
      // Execute the scrape function with streaming output
      const process = spawn(pythonCommand, [
        '-c',
        `import sys; sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8'); exec(open('${scriptPath.replace(/\\/g, '\\\\')}', encoding='utf-8').read())`,
        'scrape'
      ]);
      
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let totalProducts = 0;
      let batchCount = 0;
      let hasErrors = false;
      let firstBatchProcessed = false;
      
      // Process stdout (JSON batches)
      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdoutBuffer += chunk;
        
        // Process complete lines
        const lines = stdoutBuffer.split('\n');
        // Keep the last line in the buffer if it's incomplete
        stdoutBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim() || firstBatchProcessed) continue;
          
          try {
            const batch = JSON.parse(line);
            if (Array.isArray(batch)) {
              batchCount++;
              
              // Process only the first batch
              this.processBatch(batch, scraper, scraperId, supabaseAdmin).then(insertedCount => {
                totalProducts += insertedCount;
                firstBatchProcessed = true;
                
                // Update progress cache
                const progress = this.progressCache.get(runId);
                if (progress) {
                  this.progressCache.set(runId, {
                    ...progress,
                    productCount: totalProducts,
                    currentBatch: batchCount,
                    progressMessages: [...progress.progressMessages, `Processed first batch with ${insertedCount} products`]
                  });
                }
                
                // Kill the process after processing the first batch
                process.kill();
              }).catch(error => {
                console.error(`Error processing batch ${batchCount}:`, error);
                hasErrors = true;
                
                // Update progress cache with error
                const progress = this.progressCache.get(runId);
                if (progress) {
                  this.progressCache.set(runId, {
                    ...progress,
                    errorMessage: `Error processing batch ${batchCount}: ${error instanceof Error ? error.message : String(error)}`
                  });
                }
                
                // Kill the process on error
                process.kill();
              });
              
              break; // Only process the first batch
            } else {
              console.warn("Received non-array batch:", line);
            }
          } catch (error) {
            console.error("Error parsing batch JSON:", error, "Line:", line);
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
            // Update progress cache with the message
            const progress = this.progressCache.get(runId);
            if (progress) {
              const progressMessages = [...progress.progressMessages, line];
              
              // Try to extract total batches if available
              let totalBatches = progress.totalBatches;
              const batchMatch = line.match(/Batch (\d+)\/(\d+)/);
              if (batchMatch && batchMatch[2]) {
                totalBatches = parseInt(batchMatch[2], 10);
              }
              
              this.progressCache.set(runId, {
                ...progress,
                progressMessages,
                totalBatches
              });
            }
          } else {
            // Non-progress messages might indicate errors
            console.warn("Non-progress stderr message:", line);
          }
        }
      });
      
      // Handle process completion
      await new Promise<void>((resolve, reject) => {
        process.on('close', (_code) => {
          // Process any remaining data in buffers
          if (stdoutBuffer.trim() && !firstBatchProcessed) {
            try {
              const batch = JSON.parse(stdoutBuffer.trim());
              if (Array.isArray(batch)) {
                batchCount++;
                
                // Process the final batch if it's the first one
                this.processBatch(batch, scraper, scraperId, supabaseAdmin).then(insertedCount => {
                  totalProducts += insertedCount;
                  firstBatchProcessed = true;
                  
                  // Update progress cache
                  const progress = this.progressCache.get(runId);
                  if (progress) {
                    this.progressCache.set(runId, {
                      ...progress,
                      productCount: totalProducts,
                      currentBatch: batchCount,
                      progressMessages: [...progress.progressMessages, `Processed first batch with ${insertedCount} products`]
                    });
                  }
                  
                  resolve();
                }).catch(error => {
                  console.error(`Error processing final batch:`, error);
                  hasErrors = true;
                  reject(error);
                });
              } else {
                resolve();
              }
            } catch (error) {
              console.error("Error parsing final batch JSON:", error);
              hasErrors = true;
              reject(error);
            }
          } else {
            // No data in buffer, just resolve
            resolve();
          }
        });
        
        // Set a maximum execution time for the entire scraper (4 hours)
        const maxExecutionTimeout = setTimeout(() => {
          console.log(`Scraper ${scraperId} run ${runId} exceeded maximum execution time, terminating...`);
          process.kill();
          resolve(); // Resolve to allow completion handling
        }, 4 * 60 * 60 * 1000); // 4 hours
        
        // Check if all batches are processed based on progress messages
        const completionCheckInterval = setInterval(() => {
          const currentProgress = this.progressCache.get(runId);
          if (currentProgress && 
              currentProgress.totalBatches !== null && 
              currentProgress.currentBatch >= currentProgress.totalBatches) {
            
            // All batches processed according to progress messages
            console.log(`All ${currentProgress.totalBatches} batches processed for run ${runId}, completing...`);
            clearInterval(completionCheckInterval);
            clearTimeout(maxExecutionTimeout);
            
            // Give it a moment to finish any pending processing
            setTimeout(() => {
              process.kill();
              resolve();
            }, 10000); // 10 seconds grace period
          }
        }, 30000); // Check every 30 seconds
        
        process.on('error', (error) => {
          console.error("Process error:", error);
          hasErrors = true;
          clearTimeout(maxExecutionTimeout);
          clearInterval(completionCheckInterval);
          reject(error);
        });
      });
      
      // Clean up the temporary files
      try {
        fs.unlinkSync(scriptPath);
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temporary files:", cleanupError);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - (progress?.startTime || Date.now());
      
      // Update scraper status based on results
      const { error: scraperUpdateError } = await supabaseAdmin
        .from('scrapers')
        .update({
          status: hasErrors ? 'failed' : 'success',
          error_message: hasErrors ? 'Errors occurred during batch processing. Check logs for details.' : null,
          execution_time: executionTime
        })
        .eq('id', scraperId);
        
      if (scraperUpdateError) {
        console.error(`Error updating scraper status: ${scraperUpdateError.message}`);
      }
      
      // Update run record with final status
      const { error: runUpdateError } = await supabaseAdmin
        .from('scraper_runs')
        .update({
          status: hasErrors ? 'failed' : 'success',
          completed_at: new Date().toISOString(),
          product_count: totalProducts,
          current_batch: batchCount,
          error_message: hasErrors ? 'Errors occurred during batch processing. Check logs for details.' : null
        })
        .eq('id', runId);
        
      if (runUpdateError) {
        console.error(`Error updating run record: ${runUpdateError.message}`);
      } else {
        console.log(`Updated database record for completed test run ${runId}`);
      }
      
      // Update progress cache with final status
      const finalProgress = this.progressCache.get(runId);
      if (finalProgress) {
        this.progressCache.set(runId, {
          ...finalProgress,
          status: hasErrors ? 'failed' : 'success',
          endTime: Date.now(),
          executionTime,
          productCount: totalProducts,
          currentBatch: batchCount,
          errorMessage: hasErrors ? 'Errors occurred during batch processing. Check logs for details.' : null
        });
      }
    } catch (error) {
      console.error(`Error in runScraperTestInternal for ${scraperId}:`, error);
      
      // Update scraper status to failed
      const { error: scraperUpdateError } = await supabaseAdmin
        .from('scrapers')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', scraperId);
        
      if (scraperUpdateError) {
        console.error(`Error updating scraper status: ${scraperUpdateError.message}`);
      }
      
      // Update run record with error
      const { error: runUpdateError } = await supabaseAdmin
        .from('scraper_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('id', runId);
        
      if (runUpdateError) {
        console.error(`Error updating run record: ${runUpdateError.message}`);
      } else {
        console.log(`Updated database record for failed test run ${runId}`);
      }
      
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
      
      throw error;
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
    const progress = this.progressCache.get(runId);
    if (progress) {
      this.progressCache.set(runId, {
        ...progress,
        status: 'running'
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
      
      // Create a temporary directory for the script
      const tempDir = path.join(os.tmpdir(), "pricetracker-" + randomUUID());
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Write the script to a temporary file
      const scriptPath = path.join(tempDir, "script.py");
      fs.writeFileSync(scriptPath, scraper.python_script || '');
      
      // Find a working Python command
      const pythonCommands = ['python', 'python3', 'py'];
      let pythonCommand = '';
      
      for (const cmd of pythonCommands) {
        try {
          await execPromise(`${cmd} -c "print('test')"`, { encoding: 'utf-8' });
          pythonCommand = cmd;
          break;
        } catch (error) {
          console.warn(`Python command ${cmd} not available:`, error);
        }
      }
      
      if (!pythonCommand) {
        throw new Error('No Python interpreter found. Please ensure Python is installed and available in PATH.');
      }
      
      // Execute the scrape function with streaming output
      const process = spawn(pythonCommand, [
        '-c', 
        `import sys; sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8'); exec(open('${scriptPath.replace(/\\/g, '\\\\')}', encoding='utf-8').read())`,
        'scrape'
      ]);
      
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let totalProducts = 0;
      let batchCount = 0;
      let hasErrors = false;
      
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
              batchCount++;
              
              // Process the batch of products
              this.processBatch(batch, scraper, scraperId, supabaseAdmin).then(insertedCount => {
                totalProducts += insertedCount;
                
                // Update progress cache
                const progress = this.progressCache.get(runId);
                if (progress) {
                  this.progressCache.set(runId, {
                    ...progress,
                    productCount: totalProducts,
                    currentBatch: batchCount
                  });

                  // Also update the database record
                  supabaseAdmin
                    .from('scraper_runs')
                    .update({
                      product_count: totalProducts,
                      current_batch: batchCount,
                      status: 'running' // Ensure status stays running
                    })
                    .eq('id', runId)
                    .then(({ error: dbUpdateError }) => {
                      if (dbUpdateError) {
                        console.error(`Error updating run record in DB after batch ${batchCount}: ${dbUpdateError.message}`);
                      }
                    });

                }
              }).catch(error => {
                console.error(`Error processing batch ${batchCount}:`, error);
                hasErrors = true;
                
                // Update progress cache with error
                const progress = this.progressCache.get(runId);
                if (progress) {
                  this.progressCache.set(runId, {
                    ...progress,
                    errorMessage: `Error processing batch ${batchCount}: ${error instanceof Error ? error.message : String(error)}`
                  });
                  // Also update the database record with error info
                  supabaseAdmin
                    .from('scraper_runs')
                    .update({
                      error_message: `Error processing batch ${batchCount}: ${error instanceof Error ? error.message : String(error)}`
                    })
                    .eq('id', runId)
                    .then(({ error: dbUpdateError }) => {
                      if (dbUpdateError) {
                        console.error(`Error updating run record in DB with batch error: ${dbUpdateError.message}`);
                      }
                    });
                }
              });
            } else {
              console.warn("Received non-array batch:", line);
            }
          } catch (error) {
            console.error("Error parsing batch JSON:", error, "Line:", line);
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
            // Update progress cache with the message
            const progress = this.progressCache.get(runId);
            if (progress) {
              const progressMessages = [...progress.progressMessages, line];
              
              // Try to extract total batches if available
              let totalBatches = progress.totalBatches;
              const batchMatch = line.match(/Batch (\d+)\/(\d+)/);
              if (batchMatch && batchMatch[2]) {
                totalBatches = parseInt(batchMatch[2], 10);
              }
              
              this.progressCache.set(runId, {
                ...progress,
                progressMessages,
                totalBatches
              });

              // Also update the database record with progress message info
              supabaseAdmin
                .from('scraper_runs')
                .update({
                  progress_messages: progressMessages.slice(-10), // Store last 10 messages
                  total_batches: totalBatches // Update total batches if found
                })
                .eq('id', runId)
                .then(({ error: dbUpdateError }) => {
                  if (dbUpdateError) {
                    console.error(`Error updating run record in DB with progress message: ${dbUpdateError.message}`);
                  }
                });
            }
          } else {
            // Non-progress messages might indicate errors
            console.warn("Non-progress stderr message:", line);
          }
        }
      });
      
      // Handle process completion
      await new Promise<void>((resolve, reject) => {
        process.on('close', (_code) => {
          // Process any remaining data in buffers
          if (stdoutBuffer.trim()) {
            try {
              const batch = JSON.parse(stdoutBuffer.trim());
              if (Array.isArray(batch)) {
                batchCount++;
                
                // Process the final batch
                this.processBatch(batch, scraper, scraperId, supabaseAdmin).then(insertedCount => {
                  totalProducts += insertedCount;
                  
                  // Update progress cache
                  const progress = this.progressCache.get(runId);
                  if (progress) {
                    this.progressCache.set(runId, {
                      ...progress,
                      productCount: totalProducts,
                      currentBatch: batchCount
                    });
                  }
                  
                  // Update database record
                  supabaseAdmin
                    .from('scraper_runs')
                    .update({
                      product_count: totalProducts,
                      current_batch: batchCount
                    })
                    .eq('id', runId)
                    .then(() => resolve());
                }).catch(error => {
                  console.error(`Error processing final batch:`, error);
                  hasErrors = true;
                  // Update database record with error
                  supabaseAdmin
                    .from('scraper_runs')
                    .update({
                      error_message: `Final batch error: ${error instanceof Error ? error.message : String(error)}`
                    })
                    .eq('id', runId)
                    .then((res) => {
                      if (res.error) {
                        console.error("Error updating run record:", res.error);
                      }
                      reject(error);
                    });
                });
              } else {
                resolve();
              }
            } catch (error) {
              console.error("Error parsing final batch JSON:", error);
              hasErrors = true;
              reject(error);
            }
          } else {
            // No data in buffer, just resolve
            resolve();
          }
        });
        
        // Set a maximum execution time for the entire scraper (4 hours)
        const maxExecutionTimeout = setTimeout(() => {
          console.log(`Scraper ${scraperId} run ${runId} exceeded maximum execution time, terminating...`);
          process.kill();
          resolve(); // Resolve to allow completion handling
        }, 4 * 60 * 60 * 1000); // 4 hours
        
        // Check if all batches are processed based on progress messages
        const completionCheckInterval = setInterval(() => {
          const currentProgress = this.progressCache.get(runId);
          if (currentProgress && 
              currentProgress.totalBatches !== null && 
              currentProgress.currentBatch >= currentProgress.totalBatches) {
            
            // All batches processed according to progress messages
            console.log(`All ${currentProgress.totalBatches} batches processed for run ${runId}, completing...`);
            clearInterval(completionCheckInterval);
            clearTimeout(maxExecutionTimeout);
            
            // Give it a moment to finish any pending processing
            setTimeout(() => {
              process.kill();
              resolve();
            }, 10000); // 10 seconds grace period
          }
        }, 30000); // Check every 30 seconds
        
        process.on('error', (error) => {
          console.error("Process error:", error);
          hasErrors = true;
          clearTimeout(maxExecutionTimeout);
          clearInterval(completionCheckInterval);
          reject(error);
        });
      });
      
      // Clean up the temporary files
      try {
        fs.unlinkSync(scriptPath);
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temporary files:", cleanupError);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - (progress?.startTime || Date.now());
      const finalProgress = this.progressCache.get(runId);
      
      // Update scraper status based on results
      await supabaseAdmin
        .from('scrapers')
        .update({
          status: hasErrors ? 'failed' : 'success',
          error_message: hasErrors ? 'Errors occurred during batch processing. Check logs for details.' : null,
          execution_time: executionTime
        })
        .eq('id', scraperId);
      
      // Update run record in the database
      await supabaseAdmin
        .from('scraper_runs')
        .update({
          status: hasErrors ? 'failed' : 'success',
          completed_at: new Date().toISOString(),
          product_count: totalProducts,
          current_batch: batchCount,
          total_batches: finalProgress?.totalBatches || null,
          error_message: hasErrors ? 'Errors occurred during batch processing. Check logs for details.' : null,
          execution_time: executionTime
        })
        .eq('id', runId);
      
      // Update progress cache with final status
      if (finalProgress) {
        this.progressCache.set(runId, {
          ...finalProgress,
          status: hasErrors ? 'failed' : 'success',
          endTime: Date.now(),
          executionTime,
          errorMessage: hasErrors ? 'Errors occurred during batch processing. Check logs for details.' : null
        });
      }
    } catch (error) {
      // Update scraper status to failed
      await supabaseAdmin
        .from('scrapers')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', scraperId);
      
      // Update run record in the database with error
      await supabaseAdmin
        .from('scraper_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('id', runId);
      
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