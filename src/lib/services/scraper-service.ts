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
  
  // Removed validatePythonScraper - Static validation can be done in API route if needed.
  // Dynamic validation is handled by the new /validate-script endpoint.
  
  /**
   * Generate a scraper configuration using AI analysis
   */
  static async generateScraperWithAI(url: string, userId: string, competitorId: string) {
    return ScraperAIService.generateScraperWithAI(url, userId, competitorId);
  }
  
  // Scraper Execution
  
  // Removed deprecated testScraper method. Testing is now handled via the Test Run flow.
  
  // Removed startScraperTestRun method. Use runScraper with isTestRun=true instead.
  
  /**
   * Initiate a scraper run (full or test) by creating a job record.
   * @param scraperId The ID of the scraper.
   * @param isTestRun Set to true for a test run (processes first batch only).
   */
  static async runScraper(scraperId: string, isTestRun: boolean = false) {
    // Pass the isTestRun flag to the underlying service method
    return ScraperExecutionService.runScraper(scraperId, undefined, isTestRun);
  }
  
  // Scraper Management
  
  /**
   * Check if a scraper exists and is eligible for approval.
   * The actual approval update is handled by the API route.
   */
  static async checkScraperExistsForApproval(scraperId: string) {
    // Since approval logic was removed from ScraperManagementService,
    // we'll just check if the scraper exists using the CRUD service
    const scraper = await ScraperCrudService.getScraper(scraperId);
    return scraper !== null;
  }
  
  /**
   * Activate a scraper (deactivating others for the same competitor)
   */
  static async activateScraper(scraperId: string, userId: string) {
    return ScraperManagementService.activateScraper(scraperId, userId);
  }
}
