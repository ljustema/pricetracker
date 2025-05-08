/**
 * Enhanced Crawlee Template with Placeholders for PriceTracker
 *
 * This template provides a robust structure for creating TypeScript-based scrapers
 * with Crawlee that integrate with the PriceTracker worker system.
 *
 * It supports both API-based and traditional web scraping approaches,
 * with clear placeholders that will be filled by the AI during the
 * multi-phase scraper generation process.
 */

// --- Dependencies ---
import { PlaywrightCrawler, RequestQueue, Dataset, log, CheerioCrawler } from 'crawlee';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';

// --- Types/Interfaces ---
interface ScriptContext {
  activeBrandNames?: string[];
  filterByActiveBrands?: boolean;
  ownProductEans?: string[];
  ownProductSkuBrands?: { sku: string; brand: string }[];
  scrapeOnlyOwnProducts?: boolean;
  isTestRun?: boolean;
  isValidation?: boolean;
  run_id?: string;
  log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) => void;
}

interface ScrapedProductData {
  url: string;
  name: string;
  price: number | null;
  currency: string | null;
  sku?: string | null;
  brand?: string | null;
  ean?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_available: boolean;
  raw_price?: string | null;
}

interface ScriptMetadata {
  name: string;
  version: string;
  description: string;
  target_url: string;
  required_libraries: string[];
  batch_size?: number;
  max_concurrency?: number;
  collection_strategy: 'api' | 'scraping';
}

// --- Logging Helpers ---
function logProgress(message: string): void {
  console.error(`PROGRESS: ${message}`);
}

function logError(message: string, error?: unknown): void {
  console.error(`ERROR: ${message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  } else if (error) {
    console.error(String(error));
  }
}

// --- Collection Strategy Selection ---
// PLACEHOLDER: COLLECTION_STRATEGY_TYPE
// This will be replaced with either 'api' or 'scraping' based on the analysis
const COLLECTION_STRATEGY = 'scraping';

// --- API-Based Collection (used if API endpoints are available) ---
// PLACEHOLDER: API_ENDPOINTS_CONFIG
// This will be replaced with the AI-generated API configuration
const API_ENDPOINTS = {
  // Example structure (will be replaced by AI):
  productList: {
    url: 'https://example.com/api/products',
    method: 'GET',
    params: {
      page: '1',
      limit: '50',
      category: ''
    },
    headers: {
      'Accept': 'application/json'
    }
  },
  productDetail: {
    url: 'https://example.com/api/products/{id}',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  }
};

// --- API Data Mapping ---
// PLACEHOLDER: API_DATA_MAPPING
// This will be replaced with the AI-generated code to map API responses to product data
async function mapApiResponseToProductData(apiResponse: any): Promise<ScrapedProductData | null> {
  try {
    // Example mapping (will be replaced by AI):
    return {
      name: apiResponse.name || 'Unknown Product',
      price: parseFloat(apiResponse.price) || null,
      currency: apiResponse.currency || 'SEK',
      url: apiResponse.url || '',
      sku: apiResponse.sku || null,
      brand: apiResponse.brand || null,
      ean: apiResponse.ean || null,
      image_url: apiResponse.image || null,
      is_available: apiResponse.in_stock || false
    };
  } catch (error) {
    logError('Error mapping API response to product data', error);
    return null;
  }
}

// --- Web Scraping Collection (used if no suitable API is available) ---
// PLACEHOLDER: URL_COLLECTION_STRATEGY
// This will be replaced with the AI-generated URL collection code
async function collectProductUrls(page: any, baseUrl: string): Promise<string[]> {
  try {
    // Example implementation (will be replaced by AI):
    logProgress('Collecting product URLs from listing pages');

    // Wait for product elements to load
    await page.waitForSelector('.product-item', { timeout: 30000 });

    // Extract product URLs
    const productUrls = await page.$$eval('.product-item a', (links: any[]) =>
      links.map(link => link.href)
    );

    logProgress(`Found ${productUrls.length} product URLs`);
    return productUrls;
  } catch (error) {
    logError('Error collecting product URLs', error);
    return [];
  }
}

// --- Pagination Handling ---
// PLACEHOLDER: PAGINATION_HANDLING
// This will be replaced with the AI-generated pagination code
async function handlePagination(page: any, baseUrl: string): Promise<string[]> {
  try {
    // Example implementation (will be replaced by AI):
    logProgress('Handling pagination');

    // Check if there's a next page button
    const hasNextPage = await page.$('.pagination .next');
    if (!hasNextPage) {
      logProgress('No more pages to process');
      return [];
    }

    // Get the next page URL
    const nextPageUrl = await page.$eval('.pagination .next a', (a: any) => a.href);
    logProgress(`Found next page: ${nextPageUrl}`);

    return [nextPageUrl];
  } catch (error) {
    logError('Error handling pagination', error);
    return [];
  }
}

// --- Product Data Extraction ---
// PLACEHOLDER: PRODUCT_DATA_EXTRACTION
// This will be replaced with the AI-generated product data extraction code
async function extractProductData(page: any, url: string): Promise<ScrapedProductData | null> {
  try {
    // Example implementation (will be replaced by AI):
    logProgress(`Extracting data from product page: ${url}`);

    // Wait for critical elements
    await page.waitForSelector('.product-name', { timeout: 30000 });

    // Extract product data
    const name = await page.$eval('.product-name', (el: any) => el.textContent?.trim() || '');
    const priceText = await page.$eval('.product-price', (el: any) => el.textContent?.trim() || '');
    const price = parseFloat(priceText.replace(/[^0-9,.]/g, '').replace(',', '.'));

    // Extract optional fields (with fallbacks)
    let brand = '';
    try {
      brand = await page.$eval('.product-brand', (el: any) => el.textContent?.trim() || '');
    } catch (e) {
      logProgress('Brand not found');
    }

    let sku = '';
    try {
      sku = await page.$eval('.product-sku', (el: any) => el.textContent?.trim() || '');
    } catch (e) {
      logProgress('SKU not found');
    }

    let ean = '';
    try {
      ean = await page.$eval('.product-ean', (el: any) => el.textContent?.trim() || '');
    } catch (e) {
      logProgress('EAN not found');
    }

    let imageUrl = '';
    try {
      imageUrl = await page.$eval('.product-image img', (el: any) => el.getAttribute('src') || '');
      // Ensure absolute URL
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = new URL(imageUrl, url).toString();
      }
    } catch (e) {
      logProgress('Image URL not found');
    }

    return {
      name,
      price,
      currency: 'SEK',
      url,
      image_url: imageUrl,
      sku,
      brand,
      ean,
      is_available: true // Default to available
    };
  } catch (error) {
    logError(`Error extracting product data from ${url}`, error);
    return null;
  }
}

// --- Main Functions ---
/**
 * Returns metadata about the scraper.
 */
function getMetadata(): ScriptMetadata {
  const metadata: ScriptMetadata = {
    name: "Enhanced Crawlee Template",
    version: "1.0.0",
    description: "Multi-phase AI-generated scraper with placeholders",
    target_url: "https://example.com",
    required_libraries: ["crawlee", "playwright", "node-fetch", "yargs"],
    batch_size: 100,
    max_concurrency: 2,
    collection_strategy: COLLECTION_STRATEGY as 'api' | 'scraping'
  };
  return metadata;
}

/**
 * Main scraping function implementing either API-based or web scraping approach.
 */
async function scrape(context: ScriptContext): Promise<void> {
  logProgress("Scrape function started");

  // Extract context variables
  const isTestRun = context.isTestRun ?? false;
  const isValidation = context.isValidation ?? false;
  const filterByActiveBrands = context.filterByActiveBrands ?? false;
  const activeBrandNames = filterByActiveBrands ? new Set(context.activeBrandNames || []) : null;
  const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;
  const ownProductEans = scrapeOnlyOwnProducts ? new Set(context.ownProductEans || []) : null;
  const ownProductSkuBrands = scrapeOnlyOwnProducts ? context.ownProductSkuBrands || [] : [];

  logProgress(`Context: isTestRun=${isTestRun}, isValidation=${isValidation}, filterByActiveBrands=${filterByActiveBrands}`);

  // Base configuration
  const BASE_URL = getMetadata().target_url;

  // Choose collection strategy based on configuration
  if (COLLECTION_STRATEGY === 'api') {
    await scrapeWithApi(context, BASE_URL);
  } else {
    await scrapeWithCrawler(context, BASE_URL);
  }

  logProgress("Scrape function completed");
}

/**
 * API-based scraping approach
 */
async function scrapeWithApi(context: ScriptContext, baseUrl: string): Promise<void> {
  const isTestRun = context.isTestRun ?? false;
  const isValidation = context.isValidation ?? false;

  try {
    logProgress("Starting API-based scraping");

    // Prepare API request for product list
    const endpoint = API_ENDPOINTS.productList;
    const url = new URL(endpoint.url);

    // Add query parameters
    Object.entries(endpoint.params || {}).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    logProgress(`Fetching product list from API: ${url.toString()}`);

    // Make the API request
    const response = await fetch(url.toString(), {
      method: endpoint.method,
      headers: endpoint.headers
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    logProgress(`Received data for ${data.products?.length || 0} products`);

    // Limit the number of products for test/validation runs
    let products = data.products || [];
    if (isValidation) {
      products = products.slice(0, 5);
    } else if (isTestRun) {
      products = products.slice(0, 20);
    }

    // Process each product
    let processedCount = 0;
    for (const product of products) {
      try {
        // For detailed product data, we might need to make another API call
        let productData: ScrapedProductData | null;

        if (API_ENDPOINTS.productDetail) {
          // Replace placeholders in the URL
          const detailUrl = API_ENDPOINTS.productDetail.url.replace('{id}', product.id);

          logProgress(`Fetching detailed product data from API: ${detailUrl}`);

          const detailResponse = await fetch(detailUrl, {
            method: API_ENDPOINTS.productDetail.method,
            headers: API_ENDPOINTS.productDetail.headers
          });

          if (!detailResponse.ok) {
            throw new Error(`API detail request failed with status ${detailResponse.status}`);
          }

          const detailData = await detailResponse.json();
          productData = await mapApiResponseToProductData(detailData);
        } else {
          // Use the list data directly
          productData = await mapApiResponseToProductData(product);
        }

        if (productData) {
          // Apply filtering if needed
          let passesFilter = true;

          if (context.filterByActiveBrands && context.activeBrandNames?.length && productData.brand) {
            const brandMatches = context.activeBrandNames.some(
              activeBrand => productData.brand?.toLowerCase().includes(activeBrand.toLowerCase())
            );
            if (!brandMatches) {
              logProgress(`Skipping product with brand "${productData.brand}" - not in active brands list`);
              passesFilter = false;
            }
          }

          if (passesFilter && context.scrapeOnlyOwnProducts) {
            // Check if product matches by EAN
            const eanMatch = productData.ean && context.ownProductEans?.includes(productData.ean);

            // Check if product matches by SKU+Brand
            const skuBrandMatch = productData.sku && productData.brand && context.ownProductSkuBrands?.some(
              item => item.sku === productData.sku && item.brand.toLowerCase() === productData.brand?.toLowerCase()
            );

            if (!eanMatch && !skuBrandMatch) {
              logProgress('Skipping product - not in own products list');
              passesFilter = false;
            }
          }

          // Output product data if it passes filters
          if (passesFilter) {
            console.log(JSON.stringify(productData));
            processedCount++;
          }
        }
      } catch (error) {
        logError(`Error processing product ${product.id || 'unknown'}`, error);
      }
    }

    logProgress(`API scraping completed. Processed ${processedCount} products.`);

  } catch (error) {
    logError("Error in API-based scraping", error);
    throw error;
  }
}

/**
 * Web scraping approach using Crawlee
 */
async function scrapeWithCrawler(context: ScriptContext, baseUrl: string): Promise<void> {
  const isTestRun = context.isTestRun ?? false;
  const isValidation = context.isValidation ?? false;

  try {
    logProgress("Starting web scraping with Crawlee");

    // Configure request queue (not used in validation mode)
    let requestQueue;
    if (!isValidation) {
      requestQueue = await RequestQueue.open();
      await requestQueue.addRequest({ url: baseUrl, userData: { label: 'LIST' } });
    }

    // Configure crawler
    const crawler = new PlaywrightCrawler({
      requestQueue,
      maxRequestsPerCrawl: isValidation ? 10 : (isTestRun ? 30 : undefined),
      maxConcurrency: getMetadata().max_concurrency || 2,

      // Playwright browser options
      browserPoolOptions: {
        useFingerprints: false,
      },

      // Default navigation options
      navigationTimeoutSecs: 60,
      requestHandlerTimeoutSecs: 90,

      // Handle different page types
      async requestHandler({ request, page, enqueueLinks, log }) {
        const { url, userData } = request;
        const { label } = userData;

        log.info(`Processing ${label} page: ${url}`);

        // PHASE 1: URL Collection (LIST pages)
        if (label === 'LIST') {
          log.info('Collecting product URLs from listing page');

          // Collect product URLs using the placeholder function
          const productUrls = await collectProductUrls(page, baseUrl);

          if (!isValidation) {
            // Enqueue product URLs for processing
            for (const productUrl of productUrls) {
              await requestQueue?.addRequest({
                url: productUrl,
                userData: { label: 'PRODUCT' }
              });
            }

            // Handle pagination using the placeholder function
            const nextPageUrls = await handlePagination(page, baseUrl);
            for (const nextPageUrl of nextPageUrls) {
              await requestQueue?.addRequest({
                url: nextPageUrl,
                userData: { label: 'LIST' }
              });
            }
          } else {
            // In validation mode, directly process a few products from the listing page
            const limitedUrls = productUrls.slice(0, 5);

            for (const productUrl of limitedUrls) {
              // Navigate to the product page
              log.info(`Navigating to product page: ${productUrl}`);
              await page.goto(productUrl, { waitUntil: 'networkidle' });

              // Extract product data using the placeholder function
              const productData = await extractProductData(page, productUrl);

              if (productData) {
                // Output product data
                console.log(JSON.stringify(productData));
              }
            }
          }
        }

        // PHASE 2: Data Extraction (PRODUCT pages)
        else if (label === 'PRODUCT') {
          log.info('Extracting data from product page');

          // Extract product data using the placeholder function
          const productData = await extractProductData(page, url);

          if (productData) {
            // Apply filtering if needed
            let passesFilter = true;

            if (context.filterByActiveBrands && context.activeBrandNames?.length && productData.brand) {
              const brandMatches = context.activeBrandNames.some(
                activeBrand => productData.brand?.toLowerCase().includes(activeBrand.toLowerCase())
              );
              if (!brandMatches) {
                log.info(`Skipping product with brand "${productData.brand}" - not in active brands list`);
                passesFilter = false;
              }
            }

            if (passesFilter && context.scrapeOnlyOwnProducts) {
              // Check if product matches by EAN
              const eanMatch = productData.ean && context.ownProductEans?.includes(productData.ean);

              // Check if product matches by SKU+Brand
              const skuBrandMatch = productData.sku && productData.brand && context.ownProductSkuBrands?.some(
                item => item.sku === productData.sku && item.brand.toLowerCase() === productData.brand?.toLowerCase()
              );

              if (!eanMatch && !skuBrandMatch) {
                log.info('Skipping product - not in own products list');
                passesFilter = false;
              }
            }

            // Output product data if it passes filters
            if (passesFilter) {
              console.log(JSON.stringify(productData));
            }
          }
        }
      },

      // Handle errors
      failedRequestHandler({ request, error }) {
        logError(`Request ${request.url} failed: ${error.message}`);
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
  } catch (error) {
    logError("Error in web scraping", error);
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
      let contextData: ScriptContext;
      const contextString = argv.context as string;

      // First try to decode as Base64 (for TypeScript worker)
      try {
        const jsonContext = Buffer.from(contextString, 'base64').toString('utf-8');
        contextData = JSON.parse(jsonContext) as ScriptContext;
      } catch (_decodeError) {
        // If Base64 decoding fails, try parsing directly as JSON (for validation)
        try {
          contextData = JSON.parse(contextString) as ScriptContext;
        } catch (_parseError) {
          throw new Error(`Failed to parse context: tried Base64 decoding and direct JSON parsing, both failed. Context starts with: ${contextString.substring(0, 20)}...`);
        }
      }

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
})().catch(e => {
  logError('Unhandled top-level error', e);
  process.exit(1);
});
