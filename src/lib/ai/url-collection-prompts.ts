/**
 * Prompt templates for Gemini AI to generate URL collection code
 * These prompts are used in the second phase of the multi-phase AI scraper generation process
 */

import { SiteAnalysisResult, ApiEndpointInfo } from "@/lib/services/scraper-analysis-service";
import { UrlCollectionResult } from "@/lib/services/scraper-url-collection-service";

/**
 * System prompt for generating URL collection code
 */
export const URL_COLLECTION_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Node.js.
Your task is to generate code that efficiently collects product URLs from e-commerce websites using only built-in Node.js modules like http, https, and url.

Focus on implementing the most appropriate URL collection strategy based on the site analysis:

1. SITEMAP-BASED COLLECTION
   If sitemaps are available, implement code to:
   - Parse XML sitemaps (including sitemap indexes)
   - Filter for product URLs
   - Handle large sitemaps efficiently

2. API-BASED COLLECTION
   If product APIs are available, implement code to:
   - Make API requests with proper parameters
   - Extract product URLs from the response
   - Handle pagination in the API
   - Implement error handling and retries

3. NAVIGATION-BASED COLLECTION
   If using category/brand pages, implement code to:
   - Navigate through the site structure
   - Extract product URLs from listing pages
   - Handle pagination
   - Avoid duplicate URLs

Your code should be:
- Efficient (minimize unnecessary requests)
- Robust (handle errors and edge cases)
- Well-commented (explain the strategy and key steps)
- Focused only on URL collection (not data extraction)

The function signature must be:
\`\`\`typescript
async function collectProductUrls(page: import('playwright').Page, baseUrl: string): Promise<string[]> {
  // Implementation
}
\`\`\`

The function should return an array of unique product URLs.`;

/**
 * User prompt template for generating URL collection code
 * @param analysisResult The site analysis result
 * @param userFeedback Optional user feedback to incorporate
 * @returns The formatted user prompt
 */
export function getUrlCollectionUserPrompt(
  analysisResult: SiteAnalysisResult,
  userFeedback?: string
): string {
  return `Generate TypeScript code to collect product URLs from this e-commerce website: ${analysisResult.url}

Based on the site analysis, the recommended approach is: ${analysisResult.strategyDescription}

Site structure information:
- Sitemaps: ${analysisResult.sitemapUrls.length > 0 ? analysisResult.sitemapUrls.join(', ') : 'None found'}
- Brand pages: ${analysisResult.brandPages.length > 0 ? analysisResult.brandPages.slice(0, 5).join(', ') + (analysisResult.brandPages.length > 5 ? '...' : '') : 'None found'}
- Category pages: ${analysisResult.categoryPages.length > 0 ? analysisResult.categoryPages.slice(0, 5).join(', ') + (analysisResult.categoryPages.length > 5 ? '...' : '') : 'None found'}
- Product listing pages: ${analysisResult.productListingPages.length > 0 ? analysisResult.productListingPages.slice(0, 5).join(', ') + (analysisResult.productListingPages.length > 5 ? '...' : '') : 'None found'}

${analysisResult.productSelectors && Object.keys(analysisResult.productSelectors).length > 0 ?
  `Product selectors:
- List item: ${analysisResult.productSelectors.listItem || 'Not identified'}
- Name: ${analysisResult.productSelectors.name || 'Not identified'}
- Price: ${analysisResult.productSelectors.price || 'Not identified'}
- Image: ${analysisResult.productSelectors.image || 'Not identified'}
- Link: ${analysisResult.productSelectors.link || 'Not identified'}`
  : 'No product selectors identified.'}

${analysisResult.apiEndpoints.length > 0 ?
  `API endpoints:
${analysisResult.apiEndpoints.map((endpoint: ApiEndpointInfo) => `- ${endpoint.url} (${endpoint.method}): ${endpoint.description}`).join('\n')}`
  : 'No API endpoints identified.'}

${userFeedback ? `User feedback to incorporate: ${userFeedback}` : ''}

Generate a TypeScript function called 'collectProductUrls' that takes a base URL as a parameter and returns a Promise resolving to an array of product URLs. The function should use only built-in Node.js modules like http, https, and url. You can use the provided 'fetchUrl' helper function to make HTTP requests.

The function should:
1. Implement the most efficient strategy for collecting product URLs based on the site analysis
2. Handle pagination if present
3. Include error handling and logging
4. Return an array of unique product URLs
5. Be optimized for performance and reliability

Here's the function signature and an example of using the fetchUrl helper:

\`\`\`typescript
async function collectProductUrls(baseUrl: string): Promise<string[]> {
  // Example of using the fetchUrl helper function
  const response = await fetchUrl(baseUrl);
  if (response.statusCode !== 200) {
    throw new Error(\`Failed to fetch \${baseUrl}: Status code \${response.statusCode}\`);
  }

  // Parse the HTML content
  const htmlContent = response.data;

  // Extract product URLs from the HTML
  // ...

  return productUrls;
}
\`\`\`

If using an API-based approach, you can also use the fetchUrl function to make API requests.`;
}

/**
 * System prompt for refining URL collection code based on feedback
 */
export const URL_COLLECTION_REFINEMENT_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to refine URL collection code based on user feedback and testing results.

Focus on addressing these common issues:

1. PAGINATION PROBLEMS
   - Ensure pagination is correctly handled
   - Fix selectors for "next page" buttons
   - Implement alternative pagination strategies if needed

2. SELECTOR ISSUES
   - Update selectors that failed to match elements
   - Make selectors more robust and specific
   - Add fallback selectors for important elements

3. PERFORMANCE OPTIMIZATION
   - Reduce unnecessary requests
   - Implement more efficient URL collection strategies
   - Add caching where appropriate

4. ERROR HANDLING
   - Add better error handling for network issues
   - Implement retries for failed requests
   - Add logging for debugging

5. COVERAGE IMPROVEMENTS
   - Ensure all product types are discovered
   - Add additional entry points if some products were missed
   - Combine multiple strategies for better coverage

Your refined code should maintain the same function signature:
\`\`\`typescript
async function collectProductUrls(page: import('playwright').Page, baseUrl: string): Promise<string[]> {
  // Implementation
}
\`\`\`

The function should return an array of unique product URLs.`;

/**
 * User prompt template for refining URL collection code
 * @param originalCode The original URL collection code
 * @param executionResult The result of executing the code
 * @param userFeedback User feedback on the execution result
 * @returns The formatted user prompt
 */
export function getUrlCollectionRefinementUserPrompt(
  originalCode: string,
  executionResult: UrlCollectionResult,
  userFeedback: string
): string {
  return `Please refine this URL collection code based on the execution results and user feedback:

ORIGINAL CODE:
\`\`\`typescript
${originalCode}
\`\`\`

EXECUTION RESULTS:
- Total URLs collected: ${executionResult.totalCount}
- Sample URLs: ${executionResult.sampleUrls.slice(0, 5).join(', ')}
${executionResult.error ? `- Error: ${executionResult.error}` : ''}

EXECUTION LOGS:
${executionResult.executionLog.slice(0, 20).join('\n')}
${executionResult.executionLog.length > 20 ? '...(truncated)' : ''}

USER FEEDBACK:
${userFeedback}

Please update the code to address the issues mentioned in the user feedback and fix any errors that occurred during execution.
The refined code should maintain the same function signature:

\`\`\`typescript
async function collectProductUrls(page: import('playwright').Page, baseUrl: string): Promise<string[]> {
  // Your improved implementation here
}
\`\`\`

Focus on making the code more robust, efficient, and complete in collecting product URLs.`;
}
