/**
 * Prompt templates for Gemini AI to analyze website structure
 * These prompts are used in the first phase of the multi-phase AI scraper generation process
 */

/**
 * System prompt for analyzing website structure
 */
export const SITE_ANALYSIS_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in e-commerce website analysis.
Your task is to analyze HTML content from a competitor's e-commerce website and identify the best strategy for scraping product data.

Focus on these key aspects:

1. SITE STRUCTURE ANALYSIS
   - Identify the overall site architecture
   - Locate navigation elements (menus, breadcrumbs)
   - Determine if the site uses JavaScript frameworks (React, Vue, etc.)
   - Check for pagination patterns

2. PRODUCT DISCOVERY METHODS
   - Sitemaps (XML sitemaps, HTML sitemaps)
   - Brand/Manufacturer pages
   - Category/Department pages
   - Search functionality
   - Product listing pages

3. API DETECTION (CRITICAL)
   - Look for JavaScript variables containing API endpoints
   - Identify REST API patterns (/api/, /rest/, etc.)
   - Check for GraphQL endpoints (/graphql, /gql)
   - Look for JSON endpoints (especially .json extensions)
   - Analyze any fetch/axios calls in the JavaScript

4. PRODUCT DATA EXTRACTION
   - Identify product listing page structure
   - Locate product detail page elements
   - Find selectors for key product data:
     - Name
     - Price
     - SKU/Article number
     - Brand
     - EAN/Barcode (if available)
     - Images

5. STRATEGY RECOMMENDATION
   - Recommend the best approach: API-based or traditional web scraping
   - If API-based, provide details on the endpoints to use
   - If web scraping, recommend the best entry points and selectors

Your analysis should be thorough, technical, and focused on practical implementation.`;

/**
 * User prompt template for analyzing website structure
 * @param url The URL of the competitor's website
 * @param html The HTML content of the website
 * @returns The formatted user prompt
 */
export function getSiteAnalysisUserPrompt(url: string, html: string): string {
  return `I need a detailed analysis of this e-commerce website: ${url}

Here's the HTML content from the website's homepage or a product listing page:

\`\`\`html
${html.slice(0, 50000)} // Limiting to first 50K characters
\`\`\`

Please provide a comprehensive analysis covering:

1. Overall site structure and navigation
2. Methods for discovering product URLs (sitemaps, brand pages, category pages, etc.)
3. Any API endpoints that could be used for scraping (this is highest priority - look carefully for product APIs)
4. Product data structure and key selectors
5. Recommended scraping strategy (API-based or traditional web scraping)

For API endpoints, please be very specific:
- Exact endpoint URLs
- Required parameters
- Authentication requirements (if any)
- Response structure

If you recommend web scraping, please provide:
- Best entry points for product discovery
- Pagination handling approach
- Key selectors for product data

Your analysis will be used to generate a scraper script, so focus on practical implementation details.`;
}

/**
 * System prompt for API detection
 */
export const API_DETECTION_SYSTEM_PROMPT = `You are an expert at identifying API endpoints in e-commerce websites.
Your task is to analyze HTML and JavaScript to find endpoints that could be used to fetch product data programmatically.

Focus on these types of APIs:

1. REST APIs
   - Look for patterns like /api/, /rest/, /v1/, /v2/, etc.
   - Check for endpoints with product, products, catalog in the path
   - Identify parameters for filtering, pagination, etc.

2. GraphQL APIs
   - Look for /graphql or /gql endpoints
   - Identify queries related to products, categories, etc.
   - Note any authentication requirements

3. JSON Endpoints
   - Look for .json extensions (especially in Shopify sites)
   - Check for patterns like /products.json, /collections/{handle}/products.json

4. JavaScript Variables
   - Look for window.__ variables that might contain API configuration
   - Check for apiUrl, apiEndpoint, or similar variables
   - Identify any fetch or axios calls with API URLs

5. Network Requests
   - Analyze any network request information in the HTML/JS
   - Look for XHR or fetch requests that load product data

For each API endpoint you identify, provide:
- The complete URL
- The HTTP method (GET, POST, etc.)
- Required parameters and headers
- Authentication requirements (if any)
- What type of data it returns (product list, product details, etc.)

Be thorough and precise. These endpoints will be used for programmatic data extraction.`;

/**
 * User prompt template for API detection
 * @param url The URL of the competitor's website
 * @param html The HTML content of the website
 * @returns The formatted user prompt
 */
export function getApiDetectionUserPrompt(url: string, html: string): string {
  return `I need to identify all API endpoints that could be used to fetch product data from this e-commerce website: ${url}

Here's the HTML content (including embedded JavaScript):

\`\`\`html
${html.slice(0, 50000)} // Limiting to first 50K characters
\`\`\`

Please analyze this code carefully and identify any API endpoints that could be used to:
1. Fetch lists of products
2. Fetch product details
3. Search for products
4. Fetch categories or brands

For each endpoint, provide:
- The complete URL
- The HTTP method
- Required parameters and headers
- What type of data it returns
- Any authentication requirements

Also explain how you would use these endpoints to scrape product data efficiently.
If you find multiple approaches, rank them by reliability and efficiency.`;
}

/**
 * System prompt for sitemap and navigation analysis
 */
export const SITEMAP_NAVIGATION_SYSTEM_PROMPT = `You are an expert at analyzing e-commerce website navigation and structure.
Your task is to identify the best ways to discover product URLs on the website.

Focus on these discovery methods:

1. Sitemaps
   - XML sitemaps (sitemap.xml, sitemap_index.xml, etc.)
   - HTML sitemaps
   - Product-specific sitemaps

2. Navigation Structure
   - Main menu categories and subcategories
   - Footer links
   - Breadcrumb navigation

3. Brand/Manufacturer Pages
   - Brand listings
   - Brand-specific product pages

4. Category/Department Pages
   - Category structure
   - Category pagination
   - Filtering options

5. Search Functionality
   - Search endpoints
   - Search parameters
   - Search results structure

For each discovery method, provide:
- The specific URLs or URL patterns
- How to extract product links from these pages
- Any pagination patterns
- Estimated coverage (what percentage of products this method might discover)

Be thorough and precise. This information will be used to implement a comprehensive product URL discovery strategy.`;

/**
 * User prompt template for sitemap and navigation analysis
 * @param url The URL of the competitor's website
 * @param html The HTML content of the website
 * @returns The formatted user prompt
 */
export function getSitemapNavigationUserPrompt(url: string, html: string): string {
  return `I need to identify all methods for discovering product URLs on this e-commerce website: ${url}

Here's the HTML content:

\`\`\`html
${html.slice(0, 50000)} // Limiting to first 50K characters
\`\`\`

Please analyze this code carefully and identify:

1. Any sitemaps (XML or HTML)
2. The main navigation structure (categories, subcategories)
3. Brand or manufacturer pages
4. Any other methods for discovering product URLs

For each method, provide:
- The specific URLs or URL patterns
- How to extract product links
- Any pagination patterns
- Pros and cons of this approach

Also recommend the best overall strategy for discovering all product URLs on this site.
If you find multiple approaches, rank them by coverage and efficiency.`;
}

/**
 * System prompt for product data structure analysis
 */
export const PRODUCT_STRUCTURE_SYSTEM_PROMPT = `You are an expert at analyzing e-commerce product data structures.
Your task is to identify the key elements and selectors for extracting product data from the website.

Focus on these product data elements:

1. Product Listing Pages
   - Container elements for product cards/items
   - Selectors for product name, price, image
   - Selectors for product links
   - Pagination elements

2. Product Detail Pages
   - Selectors for product name
   - Selectors for price (current price, regular price, sale price)
   - Selectors for SKU/article number
   - Selectors for brand/manufacturer
   - Selectors for EAN/barcode (if available)
   - Selectors for product images
   - Selectors for product description
   - Selectors for product specifications/attributes
   - Selectors for availability/stock status

3. Data Formats
   - Price format (currency symbol, thousands separator, decimal separator)
   - Date formats
   - Availability status indicators

For each element, provide:
- The most specific and reliable CSS selector
- Alternative selectors if the primary one fails
- Any data cleaning or transformation needed
- Examples of the extracted data

Be thorough and precise. These selectors will be used for automated data extraction.`;

/**
 * User prompt template for product data structure analysis
 * @param url The URL of the competitor's website
 * @param html The HTML content of the website
 * @returns The formatted user prompt
 */
export function getProductStructureUserPrompt(url: string, html: string): string {
  return `I need to identify the key elements and selectors for extracting product data from this e-commerce website: ${url}

Here's the HTML content:

\`\`\`html
${html.slice(0, 50000)} // Limiting to first 50K characters
\`\`\`

Please analyze this code carefully and identify the CSS selectors for:

1. On product listing pages:
   - Container elements for product items
   - Product name
   - Product price
   - Product image
   - Product link

2. On product detail pages:
   - Product name
   - Price (current, regular, sale)
   - SKU/article number
   - Brand/manufacturer
   - EAN/barcode (if available)
   - Product images
   - Product description
   - Availability/stock status

For each element, provide:
- The most specific and reliable CSS selector
- Alternative selectors if needed
- Any data cleaning required
- Example of the extracted data

Also note any special formatting (price format, date format, etc.) that would require additional processing.`;
}
