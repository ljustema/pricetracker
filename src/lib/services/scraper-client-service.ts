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
   * Create a script-based scraper (Python or Crawlee)
   */
  static async createScriptScraper(config: {
    competitor_id: string;
    url: string;
    scraper_type: 'python' | 'crawlee'; // Add type
    scriptContent: string; // Use generic name
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time?: string;
      day?: number;
    };
  }) {
    const response = await fetch('/api/scrapers/python', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Construct payload with correct script key
      body: JSON.stringify({
        competitor_id: config.competitor_id,
        url: config.url,
        scraper_type: config.scraper_type,
        schedule: config.schedule,
        [config.scraper_type === 'python' ? 'python_script' : 'typescript_script']: config.scriptContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to create ${config.scraper_type} scraper`);
    }

    return response.json();
  }

  /**
   * Validate a Python scraper script by running its 'scrape' command via the backend.
   * The backend will perform structure validation and a limited execution run.
   */
  static async validateScraper(scriptContent: string, scraperType: 'python' | 'crawlee') {
    // Call the single validation endpoint which now handles execution too
    const response = await fetch('/api/scrapers/python/validate', { // Endpoint name might need changing later if we fully separate python/crawlee
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Send the script content and the type
      body: JSON.stringify({
        scraper_type: scraperType,
        // Use the correct key based on the type
        [scraperType === 'python' ? 'python_script' : 'typescript_script']: scriptContent
      }),
    });

    // Always parse the response, whether ok or not, to get potential error details
    const result = await response.json();

    if (!response.ok) {
      // Throw an error using the message from the backend if available
      throw new Error(result.error || result.executionError || 'Failed to validate Python scraper via API');
    }
    
    // Return the full result from the /validate endpoint,
    // which includes structure validation, execution results, and raw output.
    return result;
  }

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
  static async startTestRun(scraperId: string): Promise<{ runId: string }> {
    try {
      // Call the API endpoint to start the test run asynchronously using the /run endpoint with the flag
      const response = await fetch(`/api/scrapers/${scraperId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isTestRun: true }), // Add the flag here
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start test run');
      }
      
      // The response contains a runId for tracking progress
      const result = await response.json();
      
      if (!result.runId) {
        throw new Error('No runId returned from server');
      }
      
      return { runId: result.runId };
    } catch (error) {
      console.error('Error starting test run:', error);
      throw error;
    }
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
   */
  static async runScraper(scraperId: string): Promise<{ runId: string }> {
    try {
      // Call the API endpoint to start the scraper asynchronously
      const response = await fetch(`/api/scrapers/${scraperId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start scraper run');
      }
      
      // The response contains a runId for tracking progress
      const result = await response.json();
      
      if (!result.runId) {
        throw new Error('No runId returned from server');
      }
      
      return { runId: result.runId };
    } catch (error) {
      console.error('Error starting scraper run:', error);
      throw error;
    }
  }
  
  /**
   * Get the status of a running scraper
   */
  static async getScraperRunStatus(scraperId: string, runId: string) {
    try {
      // Use the same status endpoint for both regular runs and test runs
      // This ensures we can retrieve status for both types of runs
      const response = await fetch(`/api/scrapers/${scraperId}/run/${runId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache: 'no-store' to prevent caching issues
        cache: 'no-store'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get scraper run status');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error getting scraper run status:', error);
      throw error;
    }
  }
}