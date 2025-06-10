import { ScraperConfig, ScraperMetadata } from "@/lib/services/scraper-types";
import { ScraperCrudService } from "@/lib/services/scraper-crud-service";
import { generateWithStructuredPrompt } from "@/lib/ai/gemini-client";
import { CRAWLEE_SCRAPER_SYSTEM_PROMPT, getCrawleeScraperUserPrompt } from "@/lib/ai/scraper-prompts";
import { fetchHtml, getBaseUrl } from "@/lib/utils/html-fetcher";
import { validateAndFixScriptStructure } from "@/lib/services/scraper-validation-helper";
import { URL } from "url";

/**
 * Service for AI-related scraper functions
 */
export class ScraperAIService {
  /**
   * Create an AI-generated scraper
   * @param url The URL of the competitor's website
   * @param userId The ID of the user creating the scraper
   * @param competitorId The ID of the competitor
   * @param name Optional custom name for the scraper
   * @returns The created scraper configuration
   */
  static async createAIScraper(url: string, userId: string, competitorId: string, name?: string) {
    try {
      // Generate the scraper configuration using AI
      const { script, metadata } = await this.generateScraperWithAI(url, userId, competitorId);

      // Create the scraper configuration
      const config: Omit<ScraperConfig, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        competitor_id: competitorId,
        name: name || `AI Generated Scraper for ${new URL(url).hostname}`,
        url,
        scraper_type: 'typescript',
        typescript_script: script,
        script_metadata: metadata,
        schedule: {
          frequency: 'daily',
          time: '02:00', // Run at 2 AM
        },
        is_active: false, // Default to inactive until tested
      };

      // Create the scraper
      return ScraperCrudService.createScraper(config);
    } catch (error) {
      console.error('Error creating AI scraper:', error);
      throw new Error(`Failed to create AI scraper: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a scraper script and metadata using AI analysis
   * @param url The URL of the competitor's website
   * @param userId The ID of the user creating the scraper
   * @param competitorId The ID of the competitor
   * @returns An object containing the generated script and metadata
   */
  static async generateScraperWithAI(
    url: string,
    _userId: string,
    _competitorId: string
  ): Promise<{ script: string; metadata: ScraperMetadata }> {
    try {
      console.log(`Generating AI scraper for URL: ${url}`);

      // 1. Fetch HTML content from the URL
      console.log('Fetching HTML content...');
      const html = await fetchHtml(url);
      console.log(`Fetched ${html.length} characters of HTML`);

      // 2. Prepare the prompt for Gemini
      console.log('Preparing Gemini prompt...');
      const userPrompt = getCrawleeScraperUserPrompt(url, html);

      // 3. Call Gemini API to generate the scraper script
      console.log('Calling Gemini API...');
      const generatedScript = await generateWithStructuredPrompt(
        CRAWLEE_SCRAPER_SYSTEM_PROMPT,
        userPrompt
      );

      console.log('Successfully generated script with Gemini');

      // 4. Validate and fix the script structure if needed
      console.log('Validating and fixing script structure...');
      const { fixedScript, appliedFixes, isValid } = validateAndFixScriptStructure(generatedScript);

      if (!isValid) {
        console.log(`Applied ${appliedFixes.length} fixes to the script:`, appliedFixes);
      } else {
        console.log('Script structure is valid, no fixes needed');
      }

      // 5. Extract metadata from the script
      // We'll execute the script with the 'metadata' command to get its metadata
      console.log('Extracting metadata from script...');

      // For now, create basic metadata
      const _baseUrl = getBaseUrl(url);
      const hostname = new URL(url).hostname;

      const metadata: ScraperMetadata = {
        name: `AI Generated Scraper for ${hostname}`,
        description: `Crawlee-based scraper for ${hostname}`,
        version: '1.0.0',
        author: 'PriceTracker AI',
        target_url: url,
        required_libraries: ['crawlee', 'playwright', 'yargs'],
        generation_method: 'gemini-ai',
        generation_timestamp: new Date().toISOString(),
        // Add information about applied fixes
        applied_fixes: appliedFixes.length > 0 ? appliedFixes : undefined,
      };

      return {
        script: fixedScript, // Use the fixed script instead of the original
        metadata,
      };
    } catch (error) {
      console.error('Error generating scraper with AI:', error);
      throw new Error(`Failed to generate scraper with AI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}