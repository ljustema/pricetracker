import { ScraperConfig, ScraperMetadata } from "@/lib/services/scraper-types"; // Added ScraperMetadata
import { ScraperCrudService } from "@/lib/services/scraper-crud-service";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { exec } from 'child_process'; // Use exec for simpler output capture
import util from 'util';

const execPromise = util.promisify(exec);

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
   * Validate a Python scraper script by executing its get_metadata function.
   */
  static async validatePythonScraper(script: string): Promise<{ valid: boolean; metadata?: ScraperMetadata; error?: string }> {
    // --- Basic Static Checks ---
    const hasGetMetadataFunc = script.includes('def get_metadata');
    const hasScrapeFunc = script.includes('def scrape');
    const hasYieldKeyword = script.includes('yield');
    const hasGeneratorType = script.includes('Generator[List[Dict[str, Any]]'); // Basic check

    if (!hasGetMetadataFunc || !hasScrapeFunc) {
      return {
        valid: false,
        error: 'Script must contain both `def get_metadata()` and `def scrape()` functions.',
      };
    }
    if (!hasYieldKeyword || !hasGeneratorType) {
        return {
          valid: false,
          error: 'The scrape function must be a generator yielding batches (use `yield` and `Generator` type hint).',
        };
    }

    // --- Dynamic Metadata Extraction ---
    const tempDir = path.join(os.tmpdir(), `pricetracker-validation-${randomUUID()}`);
    const scriptPath = path.join(tempDir, "script.py");
    let pythonCommand = '';
    let metadata: ScraperMetadata | undefined;

    try {
      // Create temp dir and write script
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(scriptPath, script, { encoding: 'utf-8' });

      // Find Python command
      const pythonCommands = ['python3', 'python', 'py']; // Prioritize python3
      for (const cmd of pythonCommands) {
        try {
          await execPromise(`${cmd} -c "import sys; print(sys.version)"`);
          pythonCommand = cmd;
          break;
        } catch { /* Command not found, try next */ }
      }

      if (!pythonCommand) {
        throw new Error('Python interpreter not found. Please ensure Python 3 is installed and in PATH.');
      }

      // Escape paths for the command string
      const escapedTempDir = tempDir.replace(/\\/g, '\\\\');
      const command = `${pythonCommand} -c "import sys; sys.path.insert(0, '${escapedTempDir}'); import script; import json; sys.stdout.reconfigure(encoding='utf-8'); print(json.dumps(script.get_metadata()))"`;

      // Execute get_metadata
      const { stdout, stderr } = await execPromise(command, { encoding: 'utf-8', timeout: 10000 }); // 10 second timeout

      if (stderr) {
          console.warn("Stderr during metadata extraction:", stderr);
          // Allow stderr for warnings, but fail on actual errors later if JSON parsing fails
      }

      // Parse the JSON output
      try {
        metadata = JSON.parse(stdout) as ScraperMetadata;
      } catch (parseError) {
        throw new Error(`Failed to parse JSON output from get_metadata: ${parseError instanceof Error ? parseError.message : parseError}\nOutput: ${stdout}`);
      }

      // Validate metadata structure (basic check)
      if (!metadata || typeof metadata !== 'object' || !metadata.name || !Array.isArray(metadata.required_libraries)) {
          throw new Error('Invalid metadata structure returned by get_metadata. Expected keys like "name", "required_libraries" (array), etc.');
      }

      // Validation successful
      return {
        valid: true,
        metadata: metadata,
      };

    } catch (error) {
      console.error("Error validating Python script:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Clean up temporary directory
      if (fs.existsSync(tempDir)) {
        fs.rm(tempDir, { recursive: true, force: true }, (err) => {
          if (err) console.error(`Error cleaning up temp validation directory ${tempDir}:`, err);
        });
      }
    }
  }
}