/**
 * Prompt templates for Gemini AI to generate Crawlee-based scrapers
 */

/**
 * System prompt for generating a Crawlee-based scraper
 */
export const CRAWLEE_SCRAPER_SYSTEM_PROMPT = `You are an expert web scraper developer specializing in TypeScript and Crawlee.
Your task is to analyze HTML content from a competitor's e-commerce website and generate a complete, production-ready TypeScript scraper script.

IMPORTANT REQUIREMENTS:
1. The script MUST use Crawlee's PlaywrightCrawler for a two-phase scraping approach:
   - Phase 1: URL Collection - Find and collect product URLs from listing pages
   - Phase 2: Data Extraction - Visit each product URL and extract detailed information

CRITICAL VALIDATION REQUIREMENT:
The script MUST include the exact yargs command-line argument parsing pattern shown below or it will fail validation:

\`\`\`typescript
// --- Main Execution Block ---
const argv = yargs(hideBin(process.argv))
  .command('metadata', 'Output scraper metadata as JSON')
  .command('scrape', 'Run the scraper', (yargs) => {
    return yargs.option('context', {
      type: 'string',
      description: 'JSON string containing execution context',
      demandOption: true,
    });
  })
  .demandCommand(1, 'You must provide a command: metadata or scrape')
  .strict()
  .help()
  .parseSync();

(async () => {
  if (argv._[0] === 'metadata') {
    try {
      const metadata = getMetadata();
      console.log(JSON.stringify(metadata));
    } catch (e) {
      logError('Error generating metadata', e);
      process.exit(1);
    }
  } else if (argv._[0] === 'scrape') {
    if (!argv.context) {
      logError('Missing --context argument for scrape command');
      process.exit(1);
    }

    try {
      const contextData: ScriptContext = JSON.parse(argv.context as string);
      await scrape(contextData);
      process.exit(0);
    } catch (e) {
      if (e instanceof SyntaxError) {
        logError('Failed to parse context JSON', e);
      } else {
        logError('Unhandled error during scrape execution', e);
      }
      process.exit(1);
    }
  }
})();
\`\`\`

Also ensure you include these imports at the top of the file:
\`\`\`typescript
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
\`\`\`

2. The script MUST adhere to the PriceTracker worker I/O contract:
   - It must accept a context object with configuration parameters
   - It must output one JSON object per product to stdout using console.log()
   - It must include a validation mode that limits execution and returns sample data

3. The script MUST extract these product fields:
   - name: string (required)
   - price: number (required)
   - currency: string (default to "SEK" if not found)
   - url: string (the product URL)
   - image_url: string (main product image)
   - sku: string (product SKU/article number if available)
   - brand: string (product brand if available)
   - ean: string (EAN/barcode if available)

4. The script MUST implement these modes:
   - Metadata mode: When called with 'metadata' argument, output script metadata as JSON
   - Validation mode: When context.isValidation=true, limit to 5-10 products and don't use requestQueue
   - Test run mode: When context.isTestRun=true, limit to processing ~20 products
   - Full run mode: Process all products with proper error handling and logging

5. The script MUST follow this structure:
   - Import necessary libraries
   - Define types/interfaces
   - Implement getMetadata() function
   - Implement scrape() function with the two-phase approach
   - Include main execution block with command parsing

6. The script MUST handle common scraping challenges:
   - Pagination for product listings
   - JavaScript-rendered content
   - Rate limiting and retries
   - Error handling with meaningful messages
   - Proper logging for debugging

7. The script MUST be optimized for reliability and performance:
   - Use proper selectors that won't break with minor HTML changes
   - Include appropriate waits and timeouts
   - Implement concurrency controls
   - Handle edge cases (missing data, format variations)

8. The script MUST NOT:
   - Use external APIs not mentioned in the template
   - Include hardcoded credentials
   - Violate website terms of service
   - Use deprecated Crawlee methods

Analyze the provided HTML carefully to identify:
- Product listing page structure
- Pagination patterns
- Product detail page structure
- Data field locations and formats

Your output should be a complete TypeScript file that can be executed directly by the PriceTracker worker system.`;

/**
 * User prompt template for generating a Crawlee-based scraper
 * @param url The URL of the competitor's website
 * @param html The HTML content of the website
 * @returns The formatted user prompt
 */
export function getCrawleeScraperUserPrompt(url: string, html: string): string {
  return `I need a Crawlee-based scraper for the e-commerce website at: ${url}

Here's the HTML content from the website's homepage or a product listing page:

\`\`\`html
${html.slice(0, 50000)} // Limiting to first 50K characters
\`\`\`

Please analyze this HTML and generate a complete TypeScript scraper script using Crawlee's PlaywrightCrawler.

The script should:
1. Implement the two-phase approach (URL collection, then data extraction)
2. Extract all required product fields (name, price, etc.)
3. Handle pagination if present
4. Include all required modes (metadata, validation, test run, full run)
5. Follow the PriceTracker worker I/O contract
6. Include detailed comments explaining the scraping strategy

The script will be executed in a Node.js environment with access to Crawlee, Playwright, and standard libraries.`;
}

/**
 * Template for a Crawlee-based scraper
 * This serves as a reference for the AI to understand the expected structure
 */
export const CRAWLEE_SCRAPER_TEMPLATE = `/**
 * Crawlee-based scraper for [COMPETITOR_NAME]
 * Generated by PriceTracker AI
 *
 * This script implements a two-phase scraping approach:
 * 1. URL Collection: Find and collect product URLs from listing pages
 * 2. Data Extraction: Visit each product URL and extract detailed information
 */

// --- Dependencies ---
import { PlaywrightCrawler, RequestQueue, Dataset, log } from 'crawlee';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// --- Types/Interfaces ---
interface ScriptContext {
  activeBrandNames?: string[];
  filterByActiveBrands?: boolean;
  ownProductEans?: string[];
  ownProductSkuBrands?: { sku: string; brand: string }[];
  scrapeOnlyOwnProducts?: boolean;
  isTestRun?: boolean;
  isValidation?: boolean; // Special flag for validation mode
  log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) => void;
}

interface ScrapedProductData {
  name: string;
  price: number;
  currency?: string;
  url?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
}

interface ScriptMetadata {
  name: string;
  version: string;
  description: string;
  target_url: string;
  required_libraries: string[];
  batch_size?: number;
}

// --- Helper Functions ---
function logProgress(message: string): void {
  console.error(\`[PROGRESS] \${message}\`);
}

function logError(message: string, error?: unknown): void {
  console.error(\`[ERROR] \${message}\`, error);
}

// --- Main Functions ---
/**
 * Returns metadata about the scraper.
 */
function getMetadata(): ScriptMetadata {
  const metadata: ScriptMetadata = {
    name: "[COMPETITOR_NAME] Scraper",
    version: "1.0.0",
    description: "Crawlee-based scraper for [COMPETITOR_NAME]",
    target_url: "[TARGET_URL]",
    required_libraries: ["crawlee", "playwright", "yargs"],
    batch_size: 100,
  };
  return metadata;
}

/**
 * Main scraping function implementing the two-phase approach.
 */
async function scrape(context: ScriptContext): Promise<void> {
  const {
    activeBrandNames = [],
    filterByActiveBrands = false,
    ownProductEans = [],
    ownProductSkuBrands = [],
    scrapeOnlyOwnProducts = false,
    isTestRun = false,
    isValidation = false,
  } = context;

  logProgress("Starting scrape function");
  logProgress(\`Context: isTestRun=\${isTestRun}, isValidation=\${isValidation}\`);

  // Base configuration
  const BASE_URL = "[BASE_URL]";
  const startUrls = ["[START_URL]"];

  // Configure request queue (not used in validation mode)
  let requestQueue;
  if (!isValidation) {
    requestQueue = await RequestQueue.open();
    for (const url of startUrls) {
      await requestQueue.addRequest({ url, userData: { label: 'LIST' } });
    }
  }

  // Configure crawler
  const crawler = new PlaywrightCrawler({
    requestQueue,
    maxRequestsPerCrawl: isValidation ? 10 : (isTestRun ? 30 : undefined),
    maxConcurrency: 2, // Adjust based on site's rate limiting

    // Playwright browser options
    browserPoolOptions: {
      useFingerprints: false, // Disable fingerprinting
    },

    // Default navigation options
    navigationTimeoutSecs: 60,
    requestHandlerTimeoutSecs: 90,

    // Handle different page types
    async requestHandler({ request, page, enqueueLinks, log }) {
      const { url, userData } = request;
      const { label } = userData;

      log.info(\`Processing \${label} page: \${url}\`);

      // PHASE 1: URL Collection (LIST pages)
      if (label === 'LIST') {
        log.info('Collecting product URLs from listing page');

        // Wait for product elements to load
        await page.waitForSelector('[PRODUCT_SELECTOR]', { timeout: 30000 });

        // Extract product URLs and enqueue them
        if (!isValidation) {
          await enqueueLinks({
            selector: '[PRODUCT_LINK_SELECTOR]',
            transformRequestFunction(req) {
              req.userData.label = 'PRODUCT';
              return req;
            },
          });

          // Handle pagination (if not in test mode or already processed enough pages)
          const nextPageButton = await page.$('[NEXT_PAGE_SELECTOR]');
          if (nextPageButton) {
            // Logic to handle pagination
          }
        } else {
          // In validation mode, directly process a few products from the listing page
          const productElements = await page.$$('[PRODUCT_SELECTOR]');
          const limitedProducts = productElements.slice(0, 5);

          for (const productElement of limitedProducts) {
            // Extract basic product data from listing page
            const name = await productElement.$eval('[NAME_SELECTOR]', (el) => el.textContent?.trim() || '');
            const priceText = await productElement.$eval('[PRICE_SELECTOR]', (el) => el.textContent?.trim() || '');
            const price = parseFloat(priceText.replace(/[^0-9,.]/g, '').replace(',', '.'));
            const url = await productElement.$eval('a', (el) => el.href);

            // Output product data in validation mode
            const productData: ScrapedProductData = {
              name,
              price,
              currency: 'SEK',
              url,
            };

            console.log(JSON.stringify(productData));
          }
        }
      }

      // PHASE 2: Data Extraction (PRODUCT pages)
      else if (label === 'PRODUCT') {
        log.info('Extracting data from product page');

        // Wait for critical elements
        await page.waitForSelector('[PRODUCT_NAME_SELECTOR]', { timeout: 30000 });

        // Extract product data
        const name = await page.$eval('[PRODUCT_NAME_SELECTOR]', (el) => el.textContent?.trim() || '');
        const priceText = await page.$eval('[PRODUCT_PRICE_SELECTOR]', (el) => el.textContent?.trim() || '');
        const price = parseFloat(priceText.replace(/[^0-9,.]/g, '').replace(',', '.'));

        // Extract optional fields (with fallbacks)
        let brand = '';
        try {
          brand = await page.$eval('[PRODUCT_BRAND_SELECTOR]', (el) => el.textContent?.trim() || '');
        } catch (e) {
          log.debug('Brand not found', { url });
        }

        let sku = '';
        try {
          sku = await page.$eval('[PRODUCT_SKU_SELECTOR]', (el) => el.textContent?.trim() || '');
        } catch (e) {
          log.debug('SKU not found', { url });
        }

        let ean = '';
        try {
          ean = await page.$eval('[PRODUCT_EAN_SELECTOR]', (el) => el.textContent?.trim() || '');
        } catch (e) {
          log.debug('EAN not found', { url });
        }

        let imageUrl = '';
        try {
          imageUrl = await page.$eval('[PRODUCT_IMAGE_SELECTOR]', (el) => el.getAttribute('src') || '');
          // Ensure absolute URL
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = new URL(imageUrl, BASE_URL).toString();
          }
        } catch (e) {
          log.debug('Image URL not found', { url });
        }

        // Apply filtering if needed
        if (filterByActiveBrands && brand && activeBrandNames.length > 0) {
          const brandMatches = activeBrandNames.some(
            activeBrand => brand.toLowerCase().includes(activeBrand.toLowerCase())
          );
          if (!brandMatches) {
            log.info(\`Skipping product with brand "\${brand}" - not in active brands list\`);
            return;
          }
        }

        if (scrapeOnlyOwnProducts) {
          // Check if product matches by EAN
          const eanMatch = ean && ownProductEans.includes(ean);

          // Check if product matches by SKU+Brand
          const skuBrandMatch = sku && brand && ownProductSkuBrands.some(
            item => item.sku === sku && item.brand.toLowerCase() === brand.toLowerCase()
          );

          if (!eanMatch && !skuBrandMatch) {
            log.info('Skipping product - not in own products list');
            return;
          }
        }

        // Create product data object
        const productData: ScrapedProductData = {
          name,
          price,
          currency: 'SEK', // Default currency
          url: request.url,
          image_url: imageUrl,
          sku,
          brand,
          ean,
        };

        // Output product data as JSON
        console.log(JSON.stringify(productData));
      }
    },

    // Handle errors
    failedRequestHandler({ request, error }) {
      logError(\`Request \${request.url} failed: \${error.message}\`);
    },
  });

  try {
    logProgress('Starting crawler');
    await crawler.run();
    logProgress('Crawler finished successfully');
  } catch (error) {
    logError('Crawler failed', error);
    throw error;
  }
}

// --- Main Execution Block ---
const argv = yargs(hideBin(process.argv))
  .command('metadata', 'Output scraper metadata as JSON')
  .command('scrape', 'Run the scraper', (yargs) => {
    return yargs.option('context', {
      type: 'string',
      description: 'JSON string containing execution context',
      demandOption: true,
    });
  })
  .demandCommand(1, 'You must provide a command: metadata or scrape')
  .strict()
  .help()
  .parseSync();

(async () => {
  if (argv._[0] === 'metadata') {
    try {
      const metadata = getMetadata();
      console.log(JSON.stringify(metadata));
    } catch (e) {
      logError('Error generating metadata', e);
      process.exit(1);
    }
  } else if (argv._[0] === 'scrape') {
    if (!argv.context) {
      logError('Missing --context argument for scrape command');
      process.exit(1);
    }

    try {
      const contextData: ScriptContext = JSON.parse(argv.context as string);
      await scrape(contextData);
      process.exit(0);
    } catch (e) {
      if (e instanceof SyntaxError) {
        logError('Failed to parse context JSON', e);
      } else {
        logError('Unhandled error during scrape execution', e);
      }
      process.exit(1);
    }
  }
})();`;
