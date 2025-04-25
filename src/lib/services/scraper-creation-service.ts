import { ScraperConfig } from "@/lib/services/scraper-types"; // Added ScraperSchedule
import { ScraperCrudService } from "@/lib/services/scraper-crud-service";
// Removed unused imports: fs, path, os, randomUUID, exec, util

/**
 * Input configuration for creating a TypeScript scraper.
 */
interface CreateTypeScriptScraperConfig {
  user_id: string;
  competitor_id: string;
  typescript_script: string;
  schedule: ScraperConfig['schedule']; // Use indexed access type
}
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
      schedule: ScraperConfig['schedule']; // Use indexed access type
    }
  ) {
    // Static validation (optional, can be done here or in API route)
    const staticValidationResult = this.validatePythonScriptStructure(config.python_script);
    if (!staticValidationResult.valid) {
      throw new Error(`Invalid Python script structure: ${staticValidationResult.error}`);
    }

    // Metadata is no longer extracted here. It should be handled by the script itself
    // or potentially during the new validation flow. Using provided URL for now.
    const targetUrl = config.url;
    // Placeholder for metadata - should be obtained differently now
    const scriptMetadata = {
        name: 'Python Scraper (Metadata Pending)',
        description: 'Metadata to be extracted during validation/run',
        version: '1.0.0',
        author: 'User',
        target_url: targetUrl,
        required_libraries: [] // Should also be extracted later
    };
    
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
   * Perform basic static validation checks on a Python scraper script structure.
   * Does NOT execute the script.
   */
  static validatePythonScriptStructure(script: string): { valid: boolean; error?: string } {
    const hasGetMetadataFunc = script.includes('def get_metadata');
    // Updated: Only require scrape, not scrape_batch
    const hasScrapeFunc = script.includes('def scrape');

    if (!hasGetMetadataFunc) {
      return {
        valid: false,
        error: 'Script must contain a `def get_metadata()` function.',
      };
    }
    if (!hasScrapeFunc) {
      return {
        valid: false,
        error: 'Script must contain a `def scrape(context)` function.',
      };
    }
    // No longer require scrape_batch or generator/yield checks

    // Add more static checks if needed (e.g., import checks, basic syntax with a parser?)

    return { valid: true };
  }

  // Removed validatePythonScraper method which included dynamic execution.
  // Validation requiring execution is now handled by the /api/scrapers/validate-script endpoint and workers.

  /**
   * Create a TypeScript scraper
   */
  static async createTypeScriptScraper(
    config: CreateTypeScriptScraperConfig
  ) {
    // Static validation
    const staticValidationResult = this.validateTypeScriptScriptStructure(config.typescript_script);
    if (!staticValidationResult.valid) {
      throw new Error(`Invalid TypeScript script structure: ${staticValidationResult.error}`);
    }

    // Placeholder for metadata - should be obtained during validation/run
    // For TypeScript, we might be able to extract this more reliably during validation
    const scriptMetadata = {
        name: 'TypeScript Scraper (Metadata Pending)',
        description: 'Metadata to be extracted during validation/run',
        version: '1.0.0',
        author: 'User',
        target_url: 'N/A - Determined by script', // TS scrapers often define their own targets
        required_libraries: [] // Should also be extracted later
    };

    // Get competitor name for the naming convention
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
    const baseScraperName = `${competitor.name} TypeScript Scraper`;
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
      name: scraperName,
      url: scriptMetadata.target_url, // Use placeholder from metadata
      scraper_type: 'typescript',
      typescript_script: config.typescript_script,
      script_metadata: scriptMetadata,
      schedule: config.schedule,
      is_active: false, // Default to inactive
      is_approved: false, // Default to not approved
    };

    // Create the scraper
    return ScraperCrudService.createScraper(scraperConfig);
  }

  /**
   * Perform basic static validation checks on a TypeScript scraper script structure.
   * Does NOT execute the script. Checks for expected exports.
   */
  static validateTypeScriptScriptStructure(script: string): { valid: boolean; error?: string } {
    // Use regex to check for exports (adjust regex as needed for robustness)
    const hasGetMetadataExport = /export\s+(async\s+)?function\s+getMetadata\s*\(/m.test(script);
    const hasCollectUrlsExport = /export\s+(async\s+)?function\s+collectUrls\s*\(/m.test(script);
    const hasScrapeExport = /export\s+(async\s+)?function\s+scrape\s*\(/m.test(script);

    if (!hasGetMetadataExport) {
      return { valid: false, error: 'Script must export a `getMetadata` function.' };
    }
    if (!hasCollectUrlsExport) {
      return { valid: false, error: 'Script must export a `collectUrls` function.' };
    }
    if (!hasScrapeExport) {
      return { valid: false, error: 'Script must export a `scrape` function.' };
    }

    // Add more static checks if needed (e.g., import checks, basic syntax with a parser?)

    return { valid: true };
  }
}