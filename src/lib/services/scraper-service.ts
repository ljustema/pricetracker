import { ScraperConfig, ScrapedProduct, ScrapedProductData } from "@/lib/services/scraper-types";

// Re-export types for use in components
export type { ScraperConfig, ScrapedProduct, ScrapedProductData };
import { ScraperCrudService } from "@/lib/services/scraper-crud-service";
import { ScraperCreationService } from "@/lib/services/scraper-creation-service";
import { ScraperAIService } from "@/lib/services/scraper-ai-service";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";
import { ScraperManagementService } from "@/lib/services/scraper-management-service";

/**
 * Facade service for managing scrapers and scraping operations
 * Delegates to specialized services for different functionality
 */
export class ScraperService {
  // CRUD Operations
  
  /**
   * Create a new scraper configuration
   */
  static async createScraper(config: Omit<ScraperConfig, 'id' | 'created_at' | 'updated_at'>) {
    return ScraperCrudService.createScraper(config);
  }
  
  /**
   * Get a scraper by ID
   */
  static async getScraper(id: string) {
    return ScraperCrudService.getScraper(id);
  }
  
  /**
   * Get all scrapers for a user
   */
  static async getScrapersByUser(userId: string) {
    return ScraperCrudService.getScrapersByUser(userId);
  }
  
  /**
   * Update a scraper configuration
   */
  static async updateScraper(id: string, updates: Partial<ScraperConfig>) {
    return ScraperCrudService.updateScraper(id, updates);
  }
  
  /**
   * Delete a scraper
   */
  static async deleteScraper(id: string) {
    return ScraperCrudService.deleteScraper(id);
  }
  
  // Scraper Creation
  
  /**
   * Create an AI-generated scraper
   */
  static async createAIScraper(url: string, userId: string, competitorId: string, name?: string) {
    return ScraperAIService.createAIScraper(url, userId, competitorId, name);
  }
  
  /**
   * Create a Python scraper
   */
  static async createPythonScraper(
    config: {
      user_id: string;
      competitor_id: string;
      url: string;
      python_script: string;
      schedule: {
        frequency: 'daily' | 'weekly' | 'monthly';
        time?: string;
        day?: number;
      };
    }
  ) {
    return ScraperCreationService.createPythonScraper(config);
  }
  
  /**
   * Validate a Python scraper script structure
   */
  static async validatePythonScraper(script: string) {
    return ScraperCreationService.validatePythonScraper(script);
  }
  
  /**
   * Generate a scraper configuration using AI analysis
   */
  static async generateScraperWithAI(url: string, userId: string, competitorId: string) {
    return ScraperAIService.generateScraperWithAI(url, userId, competitorId);
  }
  
  // Scraper Execution
  
  /**
   * Test a scraper configuration against a URL and store the results
   */
  static async testScraper(scraperId: string, testUrl?: string) {
    // This is a placeholder method that was in the original service
    // It's kept for backward compatibility but should be deprecated
    const supabase = await import('@/lib/supabase/server').then(m => m.createSupabaseServerClient());
    
    // Get the scraper configuration
    const { data: scraper } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (!scraper) {
      throw new Error('Scraper not found');
    }
    
    // Use the provided test URL or the scraper's URL
    const url = testUrl || scraper.url;
    
    // In a real implementation, this would:
    // 1. Use a headless browser or HTTP client to fetch the page
    // 2. Apply the selectors to extract product data based on scraper type
    // 3. Return the results and any errors
    
    // For now, return mock results based on scraper type
    let mockResults: ScrapedProduct[];
    
    if (scraper.scraper_type === 'ai') {
      // AI scraper test
      mockResults = [
        {
          scraper_id: scraperId,
          competitor_id: scraper.competitor_id,
          name: 'Test Product 1',
          price: 99.99,
          currency: 'USD',
          image_url: 'https://example.com/image1.jpg',
          sku: 'SKU123',
          brand: 'Test Brand',
          ean: '1234567890123',
          url: `${url}/product1`,
          scraped_at: new Date().toISOString(),
        },
        {
          scraper_id: scraperId,
          competitor_id: scraper.competitor_id,
          name: 'Test Product 2',
          price: 149.99,
          currency: 'USD',
          image_url: 'https://example.com/image2.jpg',
          sku: 'SKU456',
          brand: 'Test Brand',
          ean: '2345678901234',
          url: `${url}/product2`,
          scraped_at: new Date().toISOString(),
        },
      ];
    } else if (scraper.scraper_type === 'python') {
      // Python scraper test
      // In a real implementation, this would execute the Python script
      mockResults = [
        {
          scraper_id: scraperId,
          competitor_id: scraper.competitor_id,
          name: 'Python Test Product 1',
          price: 89.99,
          currency: 'USD',
          image_url: 'https://example.com/python1.jpg',
          sku: 'PY123',
          brand: 'Python Brand',
          ean: '3456789012345',
          url: `${url}/python1`,
          scraped_at: new Date().toISOString(),
        },
        {
          scraper_id: scraperId,
          competitor_id: scraper.competitor_id,
          name: 'Python Test Product 2',
          price: 129.99,
          currency: 'USD',
          image_url: 'https://example.com/python2.jpg',
          sku: 'PY456',
          brand: 'Python Brand',
          ean: '4567890123456',
          url: `${url}/python2`,
          scraped_at: new Date().toISOString(),
        },
      ];
    } else {
      throw new Error(`Unsupported scraper type: ${scraper.scraper_type}`);
    }
    
    return {
      success: true,
      message: 'Scraper test completed successfully',
      products: mockResults,
    };
  }
  
  /**
   * Start a test run for a scraper that will only process the first batch
   * Returns a runId that can be used to track progress
   */
  static async startScraperTestRun(scraperId: string) {
    return ScraperExecutionService.startScraperTestRun(scraperId);
  }
  
  /**
   * Run a scraper and store the results
   */
  static async runScraper(scraperId: string) {
    return ScraperExecutionService.runScraper(scraperId);
  }
  
  // Scraper Management
  
  /**
   * Approve a scraper after testing
   */
  static async approveScraper(scraperId: string) {
    return ScraperManagementService.approveScraper(scraperId);
  }
  
  /**
   * Activate a scraper (deactivating others for the same competitor)
   */
  static async activateScraper(scraperId: string) {
    return ScraperManagementService.activateScraper(scraperId);
  }
}
