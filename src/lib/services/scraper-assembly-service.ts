/**
 * Service for assembling the final scraper script
 * This service is used in the fourth phase of the multi-phase AI scraper generation process
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SiteAnalysisResult } from "@/lib/services/scraper-analysis-service";
import { UrlCollectionResult } from "@/lib/services/scraper-url-collection-service";
import { DataExtractionResult } from "@/lib/services/scraper-data-extraction-service";
import { TemplatePlaceholders, CollectionStrategyType } from "@/lib/services/scraper-template-types";
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';

// Using ApiEndpointsConfig from scraper-template-types.ts

const execAsync = promisify(exec);

/**
 * Result of script assembly
 */
export interface ScriptAssemblyResult {
  assembledScript: string;
  validationResult: {
    valid: boolean;
    error?: string;
  };
  scraperId?: string;
}

/**
 * Service for assembling the final scraper script
 */
export class ScraperAssemblyService {
  /**
   * Assemble the final scraper script by combining the template with the generated code
   * @param analysisResult The site analysis result
   * @param urlCollectionResult The URL collection result
   * @param dataExtractionResult The data extraction result
   * @param competitorId The ID of the competitor
   * @param userId The ID of the user
   * @returns The assembled script result including validation and scraper ID
   */
  static async assembleScript(
    analysisResult: SiteAnalysisResult,
    urlCollectionResult: UrlCollectionResult,
    dataExtractionResult: DataExtractionResult,
    competitorId: string,
    userId: string
  ): Promise<ScriptAssemblyResult> {
    console.log(`Assembling script for ${analysisResult.url}`);

    try {
      // 1. Read the template file
      const templatePath = path.join(process.cwd(), 'src', 'scraper_templates', 'crawlee_template_with_placeholders.ts');
      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      // 2. Prepare the placeholders
      const placeholders: TemplatePlaceholders = {
        COLLECTION_STRATEGY_TYPE: analysisResult?.proposedStrategy as CollectionStrategyType || 'scraping',
        API_ENDPOINTS_CONFIG: null,
        API_DATA_MAPPING: '',
        URL_COLLECTION_STRATEGY: urlCollectionResult?.generatedCode || '',
        PAGINATION_HANDLING: '', // This is typically included in the URL collection code
        PRODUCT_DATA_EXTRACTION: dataExtractionResult?.generatedCode || ''
      };

      // 3. If using API-based collection, prepare the API endpoints config
      if (analysisResult?.proposedStrategy === 'api' && analysisResult?.apiEndpoints?.length > 0) {
        const productListEndpoints = analysisResult.apiEndpoints.filter(endpoint =>
          endpoint.isProductList || endpoint.url.includes('product') || endpoint.url.includes('products')
        );

        const productDetailEndpoints = analysisResult.apiEndpoints.filter(endpoint =>
          endpoint.isProductDetail || endpoint.url.includes('product/') || endpoint.url.includes('products/')
        );

        if (productListEndpoints.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const apiEndpointsConfig: any = {
            productList: {
              url: productListEndpoints[0].url,
              method: productListEndpoints[0].method,
              headers: productListEndpoints[0].headers || { 'Accept': 'application/json' },
              params: productListEndpoints[0].parameters || {}
            }
          };

          if (productDetailEndpoints.length > 0) {
            apiEndpointsConfig.productDetail = {
              url: productDetailEndpoints[0].url,
              method: productDetailEndpoints[0].method,
              headers: productDetailEndpoints[0].headers || { 'Accept': 'application/json' }
            };
          }

          placeholders.API_ENDPOINTS_CONFIG = apiEndpointsConfig;
        }
      }

      // 4. Replace the placeholders in the template
      let assembledScript = templateContent;

      // Replace collection strategy type
      assembledScript = assembledScript.replace(
        "const COLLECTION_STRATEGY = 'scraping';",
        `const COLLECTION_STRATEGY = '${placeholders.COLLECTION_STRATEGY_TYPE}';`
      );

      // Replace API endpoints config if available
      if (placeholders.API_ENDPOINTS_CONFIG) {
        assembledScript = assembledScript.replace(
          "const API_ENDPOINTS = {",
          `const API_ENDPOINTS = ${JSON.stringify(placeholders.API_ENDPOINTS_CONFIG, null, 2)};

// Original placeholder:
/*
const API_ENDPOINTS = {`
        );

        // Find the end of the API_ENDPOINTS object and add a closing comment
        const endOfApiEndpoints = assembledScript.indexOf("};", assembledScript.indexOf("const API_ENDPOINTS = ")) + 2;
        assembledScript = assembledScript.substring(0, endOfApiEndpoints) +
          "\n*/\n" +
          assembledScript.substring(endOfApiEndpoints);
      }

      // Replace URL collection strategy
      if (placeholders.URL_COLLECTION_STRATEGY) {
        const collectFunctionPattern = "async function collectProductUrls(page, baseUrl) {";
        if (assembledScript.includes(collectFunctionPattern)) {
          assembledScript = assembledScript.replace(
            collectFunctionPattern,
            placeholders.URL_COLLECTION_STRATEGY
          );
        }
      }

      // Replace product data extraction
      if (placeholders.PRODUCT_DATA_EXTRACTION) {
        const extractFunctionPattern = "async function extractProductData(page, url) {";
        if (assembledScript.includes(extractFunctionPattern)) {
          assembledScript = assembledScript.replace(
            extractFunctionPattern,
            placeholders.PRODUCT_DATA_EXTRACTION
          );
        }
      }

      // 5. Update the metadata
      assembledScript = assembledScript.replace(
        "name: \"Enhanced Crawlee Template\",",
        `name: "AI Generated Scraper for ${analysisResult?.hostname || 'example.com'}",`
      );

      assembledScript = assembledScript.replace(
        "description: \"Multi-phase AI-generated scraper with placeholders\",",
        `description: "Multi-phase AI-generated scraper for ${analysisResult?.hostname || 'example.com'}",`
      );

      assembledScript = assembledScript.replace(
        "target_url: \"https://example.com\",",
        `target_url: "${analysisResult?.url || 'https://example.com'}",`
      );

      // 6. Validate the assembled script
      const validationResult = await this.validateScript(assembledScript);

      // 7. If valid, store the script in the database
      let scraperId: string | undefined;

      if (validationResult.valid) {
        scraperId = await this.storeAssembledScript(assembledScript, analysisResult, userId, competitorId);
      }

      // 8. Return the result
      return {
        assembledScript,
        validationResult,
        scraperId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error assembling script: ${errorMessage}`);
      return {
        assembledScript: '',
        validationResult: {
          valid: false,
          error: `Error assembling script: ${errorMessage}`
        }
      };
    }
  }

  /**
   * Validate the assembled script
   * @param script The assembled script
   * @returns The validation result
   */
  static async validateScript(script: string): Promise<{ valid: boolean; error?: string }> {
    console.log('Validating assembled script');

    // Skip actual validation in test environment
    if (process.env.NODE_ENV === 'test') {
      return { valid: true };
    }

    // Create a temporary directory for the validation
    const tempDir = path.join(os.tmpdir(), `script-validation-${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create a temporary script file
    const scriptPath = path.join(tempDir, 'assembled-script.ts');
    fs.writeFileSync(scriptPath, script);

    try {
      // 1. Check for TypeScript compilation errors
      console.log('Checking for TypeScript compilation errors');
      await execAsync(`npx tsc --noEmit ${scriptPath}`, {
        timeout: 30000 // 30 second timeout
      });

      // 2. Check if the script can be executed with the metadata command
      console.log('Checking if the script can be executed with the metadata command');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stdout } = await execAsync(`npx ts-node ${scriptPath} metadata`, {
        timeout: 30000 // 30 second timeout
      });

      // Parse the metadata output
      try {
        const metadata = JSON.parse(stdout);
        if (!metadata.name || !metadata.version || !metadata.target_url) {
          return {
            valid: false,
            error: 'Invalid metadata: missing required fields'
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          valid: false,
          error: `Invalid metadata JSON: ${errorMessage}`
        };
      }

      // 3. Check for required functions
      if (!script.includes('async function collectProductUrls')) {
        return {
          valid: false,
          error: 'Missing collectProductUrls function'
        };
      }

      if (!script.includes('async function extractProductData')) {
        return {
          valid: false,
          error: 'Missing extractProductData function'
        };
      }

      // 4. Check for required yargs command-line argument parsing
      if (!script.includes('yargs(hideBin(process.argv))')) {
        return {
          valid: false,
          error: 'Missing yargs command-line argument parsing'
        };
      }

      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Validation error: ${errorMessage}`);
      return {
        valid: false,
        error: errorMessage
      };
    } finally {
      // Clean up the temporary directory
      try {
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (error) {
        console.error(`Error cleaning up temporary directory: ${error}`);
      }
    }
  }

  /**
   * Store the assembled script in the database as a new scraper
   * @param script The assembled script
   * @param analysisResult The site analysis result
   * @param userId The ID of the user
   * @param competitorId The ID of the competitor
   * @returns The ID of the created scraper
   */
  static async storeAssembledScript(
    script: string,
    analysisResult: SiteAnalysisResult,
    userId: string,
    competitorId: string
  ): Promise<string> {
    console.log(`Storing assembled script for ${analysisResult?.url || 'unknown'}`);

    // Skip database operations in test environment
    if (process.env.NODE_ENV === 'test') {
      return 'mock-scraper-id';
    }

    const supabase = createSupabaseAdminClient();

    // 1. Get the competitor name
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('name')
      .eq('id', competitorId)
      .single();

    if (competitorError) {
      console.error(`Error getting competitor: ${competitorError.message}`);
      throw new Error(`Failed to get competitor: ${competitorError.message}`);
    }

    // 2. Generate a unique scraper name
    const baseScraperName = `${competitor.name} TypeScript Scraper`;
    const { data: existingScrapers, error: existingScrapersError } = await supabase
      .from('scrapers')
      .select('name')
      .eq('competitor_id', competitorId)
      .ilike('name', `${baseScraperName}%`)
      .order('name', { ascending: true });

    if (existingScrapersError) {
      console.error(`Error getting existing scrapers: ${existingScrapersError.message}`);
      throw new Error(`Failed to get existing scrapers: ${existingScrapersError.message}`);
    }

    // Find the next available number for the scraper name
    let nextNumber = 1;
    if (existingScrapers && existingScrapers.length > 0) {
      for (const existingScraper of existingScrapers) {
        const match = existingScraper.name.match(new RegExp(`${baseScraperName}\\s*(\\d+)`));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }
    }

    // Generate the final scraper name
    const scraperName = `${baseScraperName} ${nextNumber}`;

    // 3. Extract metadata from the script
    const scriptMetadata = {
      name: `AI Generated Scraper for ${analysisResult.hostname}`,
      description: `Multi-phase AI-generated scraper for ${analysisResult.hostname}`,
      version: '1.0.0',
      author: 'PriceTracker AI',
      target_url: analysisResult.url,
      required_libraries: ['crawlee', 'playwright', 'node-fetch', 'yargs'],
      generation_method: 'multi-phase-ai',
      generation_timestamp: new Date().toISOString(),
      collection_strategy: analysisResult.proposedStrategy
    };

    // 4. Create the scraper record
    const now = new Date().toISOString();
    const { data: scraper, error: scraperError } = await supabase
      .from('scrapers')
      .insert({
        user_id: userId,
        competitor_id: competitorId,
        name: scraperName,
        url: analysisResult.url,
        scraper_type: 'typescript',
        typescript_script: script,
        script_metadata: scriptMetadata,
        schedule: {
          frequency: 'daily',
          time: '02:00', // Run at 2 AM
        },
        is_active: false, // Default to inactive until tested
        is_approved: false, // Default to not approved until tested
        filter_by_active_brands: true, // Default to filtering by active brands
        scrape_only_own_products: false, // Default to not filtering by own products
        created_at: now,
        updated_at: now,
        status: 'idle'
      })
      .select('id')
      .single();

    if (scraperError) {
      console.error(`Error creating scraper: ${scraperError.message}`);
      throw new Error(`Failed to create scraper: ${scraperError.message}`);
    }

    return scraper.id;
  }

  /**
   * Store the script assembly result in the database
   * @param result The script assembly result
   * @param dataExtractionId The ID of the data extraction
   * @param userId The ID of the user
   * @param competitorId The ID of the competitor
   * @returns The ID of the stored script assembly
   */
  static async storeScriptAssemblyResult(
    result: ScriptAssemblyResult,
    dataExtractionId: string,
    userId: string,
    competitorId: string
  ): Promise<string> {
    // Skip database operations in test environment
    if (process.env.NODE_ENV === 'test') {
      return 'mock-assembly-id';
    }

    const supabase = createSupabaseAdminClient();

    // Create a record in the scraper_script_assembly table
    const { data, error } = await supabase
      .from('scraper_script_assembly')
      .insert({
        user_id: userId,
        competitor_id: competitorId,
        data_extraction_id: dataExtractionId,
        assembled_script: result.assembledScript,
        validation_result: result.validationResult,
        scraper_id: result.scraperId
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error storing script assembly result: ${error.message}`);
      throw new Error(`Failed to store script assembly result: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get a stored script assembly result by ID
   * @param assemblyId The ID of the script assembly
   * @returns The script assembly result
   */
  static async getScriptAssemblyResult(assemblyId: string): Promise<ScriptAssemblyResult> {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('scraper_script_assembly')
      .select('*')
      .eq('id', assemblyId)
      .single();

    if (error) {
      console.error(`Error getting script assembly result: ${error.message}`);
      throw new Error(`Failed to get script assembly result: ${error.message}`);
    }

    // Convert the database record to a ScriptAssemblyResult
    return {
      assembledScript: data.assembled_script,
      validationResult: data.validation_result,
      scraperId: data.scraper_id
    };
  }
}
