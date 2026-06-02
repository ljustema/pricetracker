/**
 * Prompt templates for Gemini AI to generate data extraction code
 * These prompts are used in the third phase of the multi-phase AI scraper generation process
 */

import { SiteAnalysisResult, ApiEndpointInfo } from "@/lib/services/scraper-analysis-service";
import { DataExtractionResult } from "@/lib/services/scraper-data-extraction-service";

/**
 * System prompt for generating data extraction code
 */
export const DATA_EXTRACTION_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to generate code that accurately extracts product data from e-commerce websites.

Focus on implementing the most appropriate data extraction strategy based on the site analysis:

1. API-BASED EXTRACTION
   If product APIs are available, implement code to:
   - Make API requests with proper parameters
   - Extract all required product data fields
   - Handle authentication if needed
   - Implement error handling and retries

2. WEB SCRAPING EXTRACTION
   If using traditional web scraping, implement code to:
   - Navigate to product pages
   - Wait for critical elements to load
   - Extract data using reliable selectors
   - Handle different page layouts and variations

Your code must extract these product fields:
- name (string, required): The product name
- competitor_price (number, required): The product price as a number
- currency_code (string): The currency code (default to "SEK" if not found)
- url (string, required): The product URL
- sku (string, optional): The product SKU/article number
- brand (string, optional): The product brand/manufacturer
- ean (string, optional): The product EAN/barcode
- image_url (string, optional): The main product image URL
- is_available (boolean, required): Whether the product is in stock

Your code should be:
- Robust (handle missing data, different layouts, errors)
- Well-commented (explain the extraction strategy)
- Optimized for reliability (include fallback selectors)
- Focused only on data extraction (not URL collection)

The function signature must be:
\`\`\`typescript
async function extractProductData(page: any, url: string): Promise<ScrapedProductData | null> {
  // Implementation
}
\`\`\`

The function should return a properly formatted product data object or null if extraction fails.`;

/**
 * User prompt template for generating data extraction code
 * @param analysisResult The site analysis result
 * @param sampleUrls Sample product URLs to extract data from
 * @param userFeedback Optional user feedback to incorporate
 * @returns The formatted user prompt
 */
export function getDataExtractionUserPrompt(
  analysisResult: SiteAnalysisResult,
  sampleUrls: string[],
  userFeedback?: string
): string {
  return `Generate TypeScript code to extract product data from this e-commerce website: ${analysisResult.url}

Based on the site analysis, the recommended approach is: ${analysisResult.strategyDescription}

Sample product URLs to extract data from:
${sampleUrls.slice(0, 5).join('\n')}

${analysisResult.productSelectors && Object.keys(analysisResult.productSelectors).length > 0 ?
  `Product selectors:
- List item: ${analysisResult.productSelectors.listItem || 'Not identified'}
- Name: ${analysisResult.productSelectors.name || 'Not identified'}
- Price: ${analysisResult.productSelectors.price || 'Not identified'}
- Image: ${analysisResult.productSelectors.imageUrl || 'Not identified'}
- Link: ${analysisResult.productSelectors.link || 'Not identified'}`
  : 'No product selectors identified.'}

${analysisResult.apiEndpoints.length > 0 ?
  `API endpoints:
${analysisResult.apiEndpoints.map((endpoint: ApiEndpointInfo) => `- ${endpoint.url} (${endpoint.method}): ${endpoint.description}`).join('\n')}`
  : 'No API endpoints identified.'}

${userFeedback ? `User feedback to incorporate: ${userFeedback}` : ''}

Generate a TypeScript function called 'extractProductData' that takes a Playwright page object and a URL as parameters and returns a Promise resolving to a product data object.

The function should:
1. Extract all required product data fields (name, competitor_price, currency_code, SKU, brand, EAN, image URL, etc.)
2. Handle different page layouts and variations
3. Include error handling and logging
4. Return a properly formatted product data object
5. Be optimized for reliability and accuracy

Here's the function signature:

\`\`\`typescript
async function extractProductData(page: any, url: string): Promise<ScrapedProductData | null> {
  // Your implementation here
}

// Product data interface
interface ScrapedProductData {
  url: string;
  name: string;
  competitor_price: number | null; // Updated field name to match new pricing structure
  currency_code: string | null; // Updated field name to match new pricing structure
  sku?: string | null;
  brand?: string | null;
  ean?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_available: boolean;
  raw_price?: string | null;
}
\`\`\`

If using an API-based approach, also include a function to make the API request and extract product data from the response.`;
}

/**
 * System prompt for refining data extraction code based on feedback
 */
export const DATA_EXTRACTION_REFINEMENT_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to refine data extraction code based on user feedback and testing results.

Focus on addressing these common issues:

1. SELECTOR PROBLEMS
   - Update selectors that failed to match elements
   - Make selectors more robust and specific
   - Add fallback selectors for important elements

2. DATA CLEANING ISSUES
   - Fix price parsing (handling different formats, currencies)
   - Improve text cleaning (removing unwanted characters, formatting)
   - Handle special cases (sales prices, ranges, etc.)

3. MISSING DATA
   - Add code to extract fields that were missed
   - Implement alternative strategies for hard-to-find data
   - Add fallbacks for optional fields

4. ERROR HANDLING
   - Add better error handling for missing elements
   - Implement retries for failed extractions
   - Add logging for debugging

5. LAYOUT VARIATIONS
   - Handle different product page layouts
   - Account for responsive design differences
   - Support variations in data presentation

Your refined code should maintain the same function signature:
\`\`\`typescript
async function extractProductData(page: any, url: string): Promise<ScrapedProductData | null> {
  // Implementation
}
\`\`\`

The function should return a properly formatted product data object or null if extraction fails.`;

/**
 * User prompt template for refining data extraction code
 * @param originalCode The original data extraction code
 * @param executionResult The result of executing the code
 * @param userFeedback User feedback on the execution result
 * @returns The formatted user prompt
 */
export function getDataExtractionRefinementUserPrompt(
  originalCode: string,
  executionResult: DataExtractionResult,
  userFeedback: string
): string {
  return `Please refine this data extraction code based on the execution results and user feedback:

ORIGINAL CODE:
\`\`\`typescript
${originalCode}
\`\`\`

EXECUTION RESULTS:
- Successfully extracted data for ${executionResult.products.length} products
${executionResult.error ? `- Error: ${executionResult.error}` : ''}

SAMPLE EXTRACTED DATA:
${JSON.stringify(executionResult.products.slice(0, 2), null, 2)}

EXECUTION LOGS:
${executionResult.executionLog.slice(0, 20).join('\n')}
${executionResult.executionLog.length > 20 ? '...(truncated)' : ''}

USER FEEDBACK:
${userFeedback}

Please update the code to address the issues mentioned in the user feedback and fix any errors that occurred during execution.
The refined code should maintain the same function signature:

\`\`\`typescript
async function extractProductData(page: any, url: string): Promise<ScrapedProductData | null> {
  // Your improved implementation here
}
\`\`\`

Focus on making the code more robust, accurate, and complete in extracting all required product data fields.`;
}
