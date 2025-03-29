import { ScraperConfig } from "@/lib/services/scraper-types";
import { ScraperCrudService } from "@/lib/services/scraper-crud-service";

/**
 * Service for creating and validating scrapers (non-AI)
 */
export class ScraperCreationService {
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
    // Validate the Python script
    const validationResult = await this.validatePythonScraper(config.python_script);
    
    if (!validationResult.valid) {
      throw new Error(`Invalid Python script: ${validationResult.error}`);
    }
    
    // Extract metadata from the script
    const scriptMetadata = validationResult.metadata;
    
    // Use target_url from metadata if available, otherwise use the provided URL
    // This ensures synchronization between metadata and the database URL
    const targetUrl = scriptMetadata?.target_url || config.url;
    
    // Get competitor name for the naming convention
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseAdminClient();
    
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('name')
      .eq('id', config.competitor_id)
      .single();
    
    if (competitorError) {
      throw new Error(`Failed to get competitor: ${competitorError.message}`);
    }
    
    // Check if a scraper with a similar name already exists
    const baseScraperName = `${competitor.name} Python Scraper`;
    const { data: existingScrapers, error: existingScrapersError } = await supabase
      .from('scrapers')
      .select('name')
      .eq('competitor_id', config.competitor_id)
      .ilike('name', `${baseScraperName}%`)
      .order('name', { ascending: true });
    
    if (existingScrapersError) {
      throw new Error(`Failed to check existing scrapers: ${existingScrapersError.message}`);
    }
    
    // Find the highest number used in existing scraper names
    let highestNumber = 0;
    for (const scraper of existingScrapers) {
      const match = scraper.name.match(new RegExp(`${baseScraperName} (\\d+)`));
      if (match && match[1]) {
        const number = parseInt(match[1], 10);
        if (number > highestNumber) {
          highestNumber = number;
        }
      }
    }
    
    // Generate scraper name with the next available number
    const scraperName = `${baseScraperName} ${highestNumber + 1}`;
    
    // Create the scraper configuration
    const scraperConfig: Omit<ScraperConfig, 'id' | 'created_at' | 'updated_at'> = {
      user_id: config.user_id,
      competitor_id: config.competitor_id,
      name: scraperName, // Use the generated name following the convention
      url: targetUrl, // Use the synchronized URL
      scraper_type: 'python',
      python_script: config.python_script,
      script_metadata: scriptMetadata,
      schedule: config.schedule,
      is_active: false, // Default to inactive until tested and approved
      is_approved: false, // Default to not approved until tested
    };
    
    // Create the scraper
    return ScraperCrudService.createScraper(scraperConfig);
  }
  
  /**
   * Validate a Python scraper script structure
   * Note: The actual execution and metadata extraction happens in the validation endpoint
   */
  static async validatePythonScraper(script: string) {
    // Check if the script contains the required functions
    const hasGetMetadata = script.includes('def get_metadata');
    const hasScrape = script.includes('def scrape');
    const hasYieldKeyword = script.includes('yield');
    const hasGeneratorType = script.includes('Generator[List[Dict[str, Any]]');
    
    if (!hasGetMetadata || !hasScrape) {
      return {
        valid: false,
        error: 'Script must contain get_metadata and scrape functions',
      };
    }
    
    // Check if the scrape function appears to be a generator (batch-based)
    if (!hasYieldKeyword || !hasGeneratorType) {
      return {
        valid: false,
        error: 'The scrape function must be a generator that yields batches of products. It should use the yield keyword and have a Generator return type annotation.',
      };
    }
    
    // For structure validation only, we'll use a default metadata object
    // The actual metadata will be extracted in the validation endpoint
    const metadata = {
      name: 'Python Batch Scraper',
      description: 'A Python scraper that processes products in batches',
      version: '1.1.0',
      author: 'User',
      target_url: '',
      required_libraries: [],
    };
    
    return {
      valid: true,
      metadata,
    };
  }
}