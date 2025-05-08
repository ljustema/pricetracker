/**
 * Prompt templates for Gemini AI to handle user feedback
 * These prompts are used across all phases of the multi-phase AI scraper generation process
 * to incorporate user feedback and improve the generated code
 */

import { SiteAnalysisResult } from "@/lib/services/scraper-analysis-service";
import { UrlCollectionResult } from "@/lib/services/scraper-url-collection-service";
import { DataExtractionResult } from "@/lib/services/scraper-data-extraction-service";
import { ScriptAssemblyResult } from "@/lib/services/scraper-assembly-service";

/**
 * System prompt for handling general feedback across all phases
 */
export const GENERAL_FEEDBACK_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to analyze user feedback and provide specific recommendations for improving scraper code.

Focus on these key aspects when analyzing feedback:

1. TECHNICAL ISSUES
   - Identify specific code problems mentioned in the feedback
   - Determine if selectors need to be updated
   - Check for logic errors or edge cases that need handling
   - Look for performance issues that need optimization

2. DATA QUALITY ISSUES
   - Identify missing or incorrect data fields
   - Determine if data cleaning or formatting needs improvement
   - Check for inconsistencies in extracted data

3. COVERAGE ISSUES
   - Identify product types or categories that are being missed
   - Determine if pagination or navigation needs improvement
   - Check if certain site sections need different handling

4. ACTIONABLE RECOMMENDATIONS
   - Provide specific code changes to address each issue
   - Suggest alternative approaches when appropriate
   - Prioritize recommendations by importance

Your response should be detailed, technical, and focused on practical implementation.
Provide code snippets where appropriate to illustrate your recommendations.`;

/**
 * User prompt template for handling general feedback
 * @param phase The current phase of the scraper generation process
 * @param generatedCode The code generated in the current phase
 * @param userFeedback The user's feedback
 * @returns The formatted user prompt
 */
export function getGeneralFeedbackUserPrompt(
  phase: string,
  generatedCode: string,
  userFeedback: string
): string {
  return `I need help improving the ${phase} code for my web scraper based on user feedback.

CURRENT CODE:
\`\`\`typescript
${generatedCode}
\`\`\`

USER FEEDBACK:
${userFeedback}

Please analyze this feedback and provide:
1. A clear breakdown of the issues identified in the feedback
2. Specific code changes to address each issue
3. Any additional recommendations for improving the code

Focus on practical, implementable solutions that will make the scraper more robust, accurate, and efficient.
If the feedback is unclear or lacks specific details, suggest what additional information would be helpful.`;
}

/**
 * System prompt for incorporating feedback into site analysis
 */
export const SITE_ANALYSIS_FEEDBACK_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in e-commerce website analysis.
Your task is to refine a site analysis based on user feedback.

Focus on these key aspects when incorporating feedback:

1. STRATEGY REFINEMENT
   - Update the proposed scraping strategy based on user insights
   - Adjust the balance between API-based and web scraping approaches
   - Incorporate user knowledge about the site structure

2. DISCOVERY IMPROVEMENT
   - Add or remove sitemaps, brand pages, or category pages
   - Refine the approach to finding product URLs
   - Update navigation patterns based on user experience

3. API ENHANCEMENT
   - Add missing API endpoints identified by the user
   - Update API parameters or authentication requirements
   - Refine API usage strategy based on user knowledge

4. SELECTOR UPDATES
   - Improve selectors based on user feedback
   - Add alternative selectors for important elements
   - Update selector strategy based on site structure insights

Your response should provide a comprehensive updated analysis that incorporates all valid user feedback
while maintaining technical accuracy and practical implementation focus.`;

/**
 * User prompt template for incorporating feedback into site analysis
 * @param analysisResult The original site analysis result
 * @param userFeedback The user's feedback
 * @returns The formatted user prompt
 */
export function getSiteAnalysisFeedbackUserPrompt(
  analysisResult: SiteAnalysisResult,
  userFeedback: string
): string {
  return `I need to refine the site analysis for ${analysisResult.url} based on user feedback.

ORIGINAL ANALYSIS:
- Proposed strategy: ${analysisResult.proposedStrategy}
- Strategy description: ${analysisResult.strategyDescription}
- Sitemaps: ${analysisResult.sitemapUrls.length > 0 ? analysisResult.sitemapUrls.join(', ') : 'None found'}
- Brand pages: ${analysisResult.brandPages.length > 0 ? analysisResult.brandPages.slice(0, 5).join(', ') + (analysisResult.brandPages.length > 5 ? '...' : '') : 'None found'}
- Category pages: ${analysisResult.categoryPages.length > 0 ? analysisResult.categoryPages.slice(0, 5).join(', ') + (analysisResult.categoryPages.length > 5 ? '...' : '') : 'None found'}
- Product listing pages: ${analysisResult.productListingPages.length > 0 ? analysisResult.productListingPages.slice(0, 5).join(', ') + (analysisResult.productListingPages.length > 5 ? '...' : '') : 'None found'}
${analysisResult.apiEndpoints.length > 0 ?
  `- API endpoints: ${analysisResult.apiEndpoints.map(endpoint => `${endpoint.url} (${endpoint.method})`).join(', ')}`
  : '- No API endpoints identified.'}

USER FEEDBACK:
${userFeedback}

Please provide an updated analysis that incorporates this feedback. Include:
1. A revised scraping strategy recommendation
2. Updated lists of sitemaps, brand pages, category pages, and product listing pages
3. Refined API endpoint information (if applicable)
4. Updated product selectors (if applicable)
5. Any other changes needed based on the feedback

Focus on practical implementation details that will improve the scraper's effectiveness.`;
}

/**
 * System prompt for incorporating feedback into URL collection code
 */
export const URL_COLLECTION_FEEDBACK_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to refine URL collection code based on user feedback.

Focus on these key aspects when incorporating feedback:

1. COLLECTION STRATEGY UPDATES
   - Modify the URL collection approach based on user insights
   - Adjust the priority of different collection methods
   - Incorporate user knowledge about the site structure

2. PAGINATION IMPROVEMENTS
   - Fix pagination issues identified by the user
   - Update selectors for pagination elements
   - Implement alternative pagination strategies if needed

3. SELECTOR REFINEMENTS
   - Update selectors based on user feedback
   - Add fallback selectors for important elements
   - Make selectors more robust against site changes

4. ERROR HANDLING ENHANCEMENTS
   - Add error handling for issues identified by the user
   - Implement retries for unreliable operations
   - Add logging for better debugging

5. PERFORMANCE OPTIMIZATIONS
   - Implement user suggestions for improving efficiency
   - Reduce unnecessary requests or operations
   - Add caching or batching where appropriate

Your response should be a complete, updated implementation of the collectProductUrls function
that incorporates all valid user feedback while maintaining good coding practices.`;

/**
 * User prompt template for incorporating feedback into URL collection code
 * @param urlCollectionResult The original URL collection result
 * @param userFeedback The user's feedback
 * @returns The formatted user prompt
 */
export function getUrlCollectionFeedbackUserPrompt(
  urlCollectionResult: UrlCollectionResult,
  userFeedback: string
): string {
  return `I need to refine the URL collection code based on user feedback.

ORIGINAL CODE:
\`\`\`typescript
${urlCollectionResult.generatedCode}
\`\`\`

EXECUTION RESULTS:
- Total URLs collected: ${urlCollectionResult.totalCount}
- Sample URLs: ${urlCollectionResult.sampleUrls.slice(0, 5).join('\n')}
${urlCollectionResult.error ? `- Error: ${urlCollectionResult.error}` : ''}

USER FEEDBACK:
${userFeedback}

Please provide an updated implementation of the collectProductUrls function that addresses this feedback.
The function should:
1. Incorporate all valid suggestions from the user
2. Fix any issues identified in the feedback
3. Maintain the same function signature
4. Include clear comments explaining the changes

Focus on making the code more robust, efficient, and complete in collecting product URLs.`;
}

/**
 * System prompt for incorporating feedback into data extraction code
 */
export const DATA_EXTRACTION_FEEDBACK_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to refine data extraction code based on user feedback.

Focus on these key aspects when incorporating feedback:

1. DATA FIELD IMPROVEMENTS
   - Fix extraction of specific fields mentioned in the feedback
   - Add missing fields identified by the user
   - Improve data cleaning and formatting

2. SELECTOR REFINEMENTS
   - Update selectors based on user feedback
   - Add fallback selectors for unreliable elements
   - Make selectors more robust against site changes

3. ERROR HANDLING ENHANCEMENTS
   - Add error handling for issues identified by the user
   - Implement retries for unreliable operations
   - Add validation for extracted data

4. LAYOUT HANDLING IMPROVEMENTS
   - Update code to handle different page layouts mentioned by the user
   - Add support for variations in data presentation
   - Implement conditional logic for different product types

5. PERFORMANCE OPTIMIZATIONS
   - Implement user suggestions for improving efficiency
   - Reduce unnecessary operations
   - Add caching where appropriate

Your response should be a complete, updated implementation of the extractProductData function
that incorporates all valid user feedback while maintaining good coding practices.`;

/**
 * User prompt template for incorporating feedback into data extraction code
 * @param dataExtractionResult The original data extraction result
 * @param userFeedback The user's feedback
 * @returns The formatted user prompt
 */
export function getDataExtractionFeedbackUserPrompt(
  dataExtractionResult: DataExtractionResult,
  userFeedback: string
): string {
  return `I need to refine the data extraction code based on user feedback.

ORIGINAL CODE:
\`\`\`typescript
${dataExtractionResult.generatedCode}
\`\`\`

EXECUTION RESULTS:
- Successfully extracted data for ${dataExtractionResult.products.length} products
${dataExtractionResult.error ? `- Error: ${dataExtractionResult.error}` : ''}

SAMPLE EXTRACTED DATA:
${JSON.stringify(dataExtractionResult.products.slice(0, 2), null, 2)}

USER FEEDBACK:
${userFeedback}

Please provide an updated implementation of the extractProductData function that addresses this feedback.
The function should:
1. Incorporate all valid suggestions from the user
2. Fix any issues identified in the feedback
3. Maintain the same function signature
4. Include clear comments explaining the changes

Focus on making the code more robust, accurate, and complete in extracting all required product data fields.`;
}

/**
 * System prompt for incorporating feedback into script assembly
 */
export const SCRIPT_ASSEMBLY_FEEDBACK_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Playwright.
Your task is to refine an assembled scraper script based on user feedback.

Focus on these key aspects when incorporating feedback:

1. INTEGRATION IMPROVEMENTS
   - Fix issues with how different components work together
   - Ensure consistent variable naming and data structures
   - Improve the flow between different functions

2. CONFIGURATION UPDATES
   - Adjust scraper configuration based on user feedback
   - Update metadata, batch sizes, or concurrency settings
   - Modify logging or output formatting

3. ERROR HANDLING ENHANCEMENTS
   - Add global error handling based on user feedback
   - Implement retries or fallback strategies
   - Improve error reporting and logging

4. PERFORMANCE OPTIMIZATIONS
   - Implement user suggestions for improving efficiency
   - Reduce unnecessary operations or requests
   - Add caching or batching where appropriate

5. VALIDATION FIXES
   - Address any validation errors identified by the user
   - Fix TypeScript type issues or syntax errors
   - Ensure the script meets all requirements

Your response should be a complete, updated scraper script that incorporates all valid user feedback
while maintaining good coding practices and ensuring the script passes validation.`;

/**
 * User prompt template for incorporating feedback into script assembly
 * @param scriptAssemblyResult The original script assembly result
 * @param userFeedback The user's feedback
 * @returns The formatted user prompt
 */
export function getScriptAssemblyFeedbackUserPrompt(
  scriptAssemblyResult: ScriptAssemblyResult,
  userFeedback: string
): string {
  return `I need to refine this assembled scraper script based on user feedback.

VALIDATION RESULT:
${scriptAssemblyResult.validationResult.valid
  ? '- Script passed validation successfully'
  : `- Validation failed: ${scriptAssemblyResult.validationResult.error || 'Unknown error'}`}

USER FEEDBACK:
${userFeedback}

Here's the relevant part of the script that needs to be updated:

\`\`\`typescript
${scriptAssemblyResult.assembledScript.length > 5000
  ? scriptAssemblyResult.assembledScript.substring(0, 5000) + '\n... (script truncated for brevity)'
  : scriptAssemblyResult.assembledScript}
\`\`\`

Please provide specific changes to address the user's feedback. Include:
1. The exact code sections that need to be modified
2. The updated code for each section
3. An explanation of how each change addresses the feedback

If the feedback requires changes to multiple parts of the script, please organize your response by section.
Focus on making the script more robust, efficient, and effective while ensuring it passes validation.`;
}

/**
 * Get the appropriate feedback prompt based on the current phase
 * @param phase The current phase of the scraper generation process
 * @param result The result from the current phase
 * @param userFeedback The user's feedback
 * @returns The formatted user prompt
 */
export function getFeedbackPromptForPhase(
  phase: string,
  result: SiteAnalysisResult | UrlCollectionResult | DataExtractionResult | ScriptAssemblyResult | { generatedCode?: string },
  userFeedback: string
): string {
  switch (phase) {
    case 'analysis':
      return getSiteAnalysisFeedbackUserPrompt(result as SiteAnalysisResult, userFeedback);
    case 'url-collection':
      return getUrlCollectionFeedbackUserPrompt(result as UrlCollectionResult, userFeedback);
    case 'data-extraction':
      return getDataExtractionFeedbackUserPrompt(result as DataExtractionResult, userFeedback);
    case 'assembly':
      return getScriptAssemblyFeedbackUserPrompt(result as ScriptAssemblyResult, userFeedback);
    default:
      // For the default case, we need to handle the possibility that result might not have generatedCode
      const generatedCode = 'generatedCode' in result ? result.generatedCode || '' : '';
      return getGeneralFeedbackUserPrompt(phase, generatedCode, userFeedback);
  }
}

/**
 * Get the appropriate system prompt based on the current phase
 * @param phase The current phase of the scraper generation process
 * @returns The system prompt
 */
export function getSystemPromptForPhase(phase: string): string {
  switch (phase) {
    case 'analysis':
      return SITE_ANALYSIS_FEEDBACK_SYSTEM_PROMPT;
    case 'url-collection':
      return URL_COLLECTION_FEEDBACK_SYSTEM_PROMPT;
    case 'data-extraction':
      return DATA_EXTRACTION_FEEDBACK_SYSTEM_PROMPT;
    case 'assembly':
      return SCRIPT_ASSEMBLY_FEEDBACK_SYSTEM_PROMPT;
    default:
      return GENERAL_FEEDBACK_SYSTEM_PROMPT;
  }
}
