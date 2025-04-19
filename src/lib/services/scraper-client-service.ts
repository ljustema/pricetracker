"use client";

import { createClient } from "@/lib/supabase/client";
import { ScraperConfig } from "@/lib/services/scraper-types";

/**
 * Client-side service for managing scrapers and scraping operations
 */
export class ScraperClientService {
  /**
   * Create a new scraper configuration
   */
  static async createScraper(config: Omit<ScraperConfig, 'id' | 'created_at' | 'updated_at'>) {
    const supabase = createClient();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('scrapers')
      .insert({
        ...config,
        created_at: now,
        updated_at: now,
        status: 'idle',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create scraper: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a scraper by ID
   */
  static async getScraper(id: string) {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get scraper: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all scrapers for a user
   */
  static async getScrapersByUser(userId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('scrapers')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get scrapers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update a scraper configuration
   */
  static async updateScraper(id: string, updates: Partial<ScraperConfig>) {
    try {
      // Use the API endpoint instead of direct Supabase client
      const response = await fetch(`/api/scrapers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update scraper');
      }

      return response.json();
    } catch (error) {
      console.error("Error updating scraper:", error);
      throw error;
    }
  }

  /**
   * Delete a scraper
   */
  static async deleteScraper(id: string) {
    const supabase = createClient();

    const { error } = await supabase
      .from('scrapers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete scraper: ${error.message}`);
    }

    return true;
  }

  /**
   * Create an AI-generated scraper
   */
  static async createAIScraper(url: string, competitorId: string, name?: string) {
    const response = await fetch('/api/scrapers/python', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        competitor_id: competitorId,
        name: name || `AI Generated Scraper for ${new URL(url).hostname}`,
        url,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create AI scraper');
    }

    return response.json();
  }

  /**
   * Create a script-based scraper (Python or TypeScript)
   */
  static async createScriptScraper(config: {
    competitor_id: string;
    url: string;
    scraper_type: 'python' | 'typescript'; // Updated type
    scriptContent: string;
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time?: string;
      day?: number;
    };
    filter_by_active_brands?: boolean; // Added flag
    scrape_only_own_products?: boolean; // Added flag
  }) {
    // Call the consolidated API endpoint
    const response = await fetch('/api/scrapers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        competitor_id: config.competitor_id,
        url: config.url,
        scraper_type: config.scraper_type, // Use updated type 'typescript'
        schedule: config.schedule,
        [config.scraper_type === 'python' ? 'python_script' : 'typescript_script']: config.scriptContent,
        filter_by_active_brands: config.filter_by_active_brands ?? false, // Pass new flag
        scrape_only_own_products: config.scrape_only_own_products ?? false, // Pass new flag
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to create ${config.scraper_type} scraper`);
    }

    return response.json();
  }

  // Removed validateScraper method.
  // UI components should now call the '/api/scrapers/validate-script' endpoint directly.

  // CSV scraper functionality has been moved to products

  /**
   * Generate a scraper configuration using AI analysis
   * This is a placeholder for the actual AI implementation
   */
  static async generateScraperWithAI(url: string, userId: string, competitorId: string) {
    // In a real implementation, this would:
    // 1. Use an AI service to analyze the website structure
    // 2. Identify product listing patterns
    // 3. Generate CSS selectors for products, names, prices, etc.
    // 4. Test the selectors against the actual page

    // For now, return a mock configuration
    const mockConfig: Omit<ScraperConfig, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      competitor_id: competitorId,
      name: `AI Generated Scraper for ${new URL(url).hostname}`,
      url,
      scraper_type: 'ai',
      selectors: {
        product: '.product-item',
        name: '.product-name',
        price: '.product-price',
        image: '.product-image img',
        sku: '.product-sku',
        brand: '.product-brand',
        ean: '.product-ean',
      },
      schedule: {
        frequency: 'daily',
        time: '02:00', // Run at 2 AM
      },
      is_active: false, // Default to inactive until tested
      is_approved: false, // Default to not approved until tested
    };

    return mockConfig;
  }

  /**
   * Start a test run for a scraper that will only process the first batch
   * Returns a runId that can be used to track progress
   */
  static async startTestRun(scraperId: string, maxRetries = 3): Promise<{ runId: string }> {
    console.log(`[ScraperClientService] Starting test run for scraper ${scraperId}`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Using the new run-test endpoint
        console.log(`[ScraperClientService] Sending request to /api/scrapers/${scraperId}/run-test (attempt ${attempt}/${maxRetries})`);
        const response = await fetch(`/api/scrapers/${scraperId}/run-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // Empty JSON object to prevent parsing errors
        });

        console.log(`[ScraperClientService] Received response with status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          let errorMessage = 'Failed to start test run';
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
            console.error(`[ScraperClientService] Error response JSON:`, error);
          } catch (_) {
            // If response.json() fails, use the status text
            errorMessage = `${errorMessage}: ${response.statusText}`;
            console.error(`[ScraperClientService] Failed to parse error response. Status: ${response.status} ${response.statusText}`);
          }
          throw new Error(errorMessage);
        }

        console.log(`[ScraperClientService] Parsing response JSON`);
        const data = await response.json();
        console.log(`[ScraperClientService] Received runId: ${data.runId}`);
        return { runId: data.runId };
      } catch (error) {
        console.error(`[ScraperClientService] Error starting test run (attempt ${attempt}/${maxRetries}):`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delayMs = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s, etc.
          console.log(`[ScraperClientService] Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we get here, all retries failed
    console.error(`[ScraperClientService] All ${maxRetries} attempts to start test run failed`);
    throw lastError || new Error('Failed to start test run after multiple attempts');
  }

  /**
   * Approve a scraper after testing
   */
  static async approveScraper(scraperId: string) {
    const response = await fetch(`/api/scrapers/${scraperId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve scraper');
    }

    return response.json();
  }

  /**
   * Activate a scraper (deactivating others for the same competitor)
   */
  static async activateScraper(scraperId: string) {
    const response = await fetch(`/api/scrapers/${scraperId}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to activate scraper');
    }

    return response.json();
  }


  /**
   * Run a scraper with real-time progress tracking
   * Returns a runId that can be used to poll for status updates
   * Includes automatic retry logic for common network issues
   */
  static async runScraper(scraperId: string, signal?: AbortSignal, maxRetries = 5): Promise<{ runId: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ScraperClientService] Starting scraper run for ${scraperId} (attempt ${attempt}/${maxRetries})`);

        // Call the API endpoint to start the scraper asynchronously
        const response = await fetch(`/api/scrapers/${scraperId}/run-full`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // Empty JSON object to prevent parsing errors
          signal, // Pass the abort signal if provided
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start scraper run');
        }

        // The response contains a runId for tracking progress
        const result = await response.json();

        if (!result.runId) {
          throw new Error('No runId returned from server');
        }

        const runId = result.runId;
        console.log(`[ScraperClientService] Successfully started scraper run with ID: ${runId}`);

        // Wait a moment and check if the run immediately failed
        // This helps catch the "Network error" issue before returning to the UI
        if (attempt === 1) { // Only do this check on the first successful attempt
          console.log(`[ScraperClientService] Waiting to verify run ${runId} started successfully...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

          try {
            const statusResponse = await fetch(`/api/scrapers/${scraperId}/run/${runId}/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              cache: 'no-store'
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();

              // If the run immediately failed with a network error, retry
              if (statusData.isComplete && statusData.status === 'failed' &&
                  statusData.errorMessage && statusData.errorMessage.includes('Network error')) {
                console.log(`[ScraperClientService] Run ${runId} failed immediately with network error. Retrying...`);

                // Wait a bit longer before retrying to give the worker more time to initialize
                const delayMs = 3000; // 3 seconds
                console.log(`[ScraperClientService] Waiting ${delayMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Continue to the next retry attempt
                continue;
              }
            }
          } catch (statusError) {
            // If we can't check the status, just proceed with the current runId
            console.warn(`[ScraperClientService] Could not verify run status: ${statusError}`);
          }
        }

        // If we get here, either the run is still pending/running, or it failed for a reason
        // other than the common network error, so we'll return the runId
        return { runId: result.runId };
      } catch (error) {
        console.error(`[ScraperClientService] Error starting scraper run (attempt ${attempt}/${maxRetries}):`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delayMs = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s, etc.
          console.log(`[ScraperClientService] Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we get here, all retries failed
    console.error(`[ScraperClientService] All ${maxRetries} attempts to start scraper run failed`);
    throw lastError || new Error('Failed to start scraper run after multiple attempts');
  }

  /**
   * Stop a running scraper
   */
  static async stopScraperRun(scraperId: string, runId: string): Promise<{ message: string }> {
    try {
      // Call the API endpoint to stop the scraper
      const response = await fetch(`/api/scrapers/${scraperId}/run/${runId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop scraper run');
      }

      return response.json();
    } catch (error) {
      console.error('Error stopping scraper run:', error);
      throw error;
    }
  }

  /**
   * Get the status of a running scraper
   */
  static async getScraperRunStatus(scraperId: string, runId: string, maxRetries = 3) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create an AbortController with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        // Use the same status endpoint for both regular runs and test runs
        // This ensures we can retrieve status for both types of runs
        const response = await fetch(`/api/scrapers/${scraperId}/run/${runId}/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Add cache: 'no-store' to prevent caching issues
          cache: 'no-store',
          // Add signal for timeout
          signal: controller.signal
        });

        // Clear the timeout
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = 'Failed to get scraper run status';
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } catch (error) {
            // If response.json() fails, use the status text
            errorMessage = `${errorMessage}: ${response.statusText}`;
          }

          // For 500 errors, we'll retry instead of throwing immediately
          if (response.status === 500) {
            console.warn(`Server error (500) when fetching scraper status (attempt ${attempt}/${maxRetries}). Will retry.`);
            throw new Error(errorMessage); // This will be caught by the outer catch block and retried
          }

          // For other error codes, throw immediately
          throw new Error(errorMessage);
        }

        return response.json();
      } catch (error) {
        // Handle AbortError (timeout) specifically
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`Scraper status request timed out after 8 seconds (attempt ${attempt}/${maxRetries})`);
          lastError = new Error('Connection timed out while fetching scraper status. The scraper is still running in the background.');
        } else {
          // Handle other errors
          console.error(`Error getting scraper run status (attempt ${attempt}/${maxRetries}):`, error);

          // Provide a more helpful error message
          if (error instanceof Error) {
            lastError = new Error(`Connection issue: ${error.message}. The scraper is still running in the background.`);
          } else {
            lastError = new Error('Unknown error while fetching scraper status. The scraper is still running in the background.');
          }
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delayMs = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s, etc.
          console.log(`[ScraperClientService] Retrying status request in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we get here, all retries failed
    console.error(`[ScraperClientService] All ${maxRetries} attempts to get scraper status failed`);
    throw lastError || new Error('Failed to get scraper status after multiple attempts');
  }
}