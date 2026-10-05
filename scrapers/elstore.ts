/**
 * PriceTracker - Elstore.se Product Scraper (Crawlee + API Hybrid)
 *
 * This scraper uses a hybrid approach:
 * 1. Crawlee for fast parallel URL discovery and product_id/variant_id extraction
 * 2. Elstore's API for exact product data and stock information
 *
 * Performance optimized for 10+ products per second.
 */

import { CheerioCrawler, RequestQueue, Configuration } from 'crawlee';
import { XMLParser } from 'fast-xml-parser';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
// import * as os from 'os'; // Not needed anymore

// ------------------------------------ //
// ------- CONFIGURATION SECTION ------ //
// ------------------------------------ //

const CONFIG = {
  SITE: {
    NAME: "Elstore.se",
    BASE_URL: "https://elstore.se",
    API_BASE: "https://elstore.se/frontend-api",
  },

  PERFORMANCE: {
    MAX_CONCURRENCY: 4, // Conservative parallel HTML requests
    BATCH_SIZE: 50, // Keep batch size
    REQUEST_TIMEOUT: 30, // Longer timeout for stability
    MAX_RETRIES: 3,
    REQUEST_DELAY: 400, // Reduced delay for faster processing
    MAX_REQUESTS_PER_MINUTE: 400, // Avoid throttling during full catalog runs
    API_BATCH_CONCURRENCY: 5, // Conservative API concurrency to avoid Elstore 403 rate limiting
  },

  SITEMAP: {
    INDEX_URL: "https://elstore.se/sitemap.xml",
    PRODUCT_FILTER: "/sv/products/",
  }
};

// ------------------------------------ //
// --------- TYPE DEFINITIONS ---------- //
// ------------------------------------ //

interface ScriptMetadata {
  name: string;
  version: string;
  description: string;
  target_url: string;
  required_libraries: string[];
  batch_size: number;
  max_concurrency: number;
  collection_strategy: 'api' | 'scraping';
}

interface ScriptContext {
  activeBrandNames?: string[];
  filterByActiveBrands?: boolean;
  ownProductEans?: string[];
  ownProductSkuBrands?: { sku: string; brand: string }[];
  scrapeOnlyOwnProducts?: boolean;
  isTestRun?: boolean;
  isValidation?: boolean;
  run_id?: string;
  limit_products?: number;
}

interface ProductVariant {
  product_id: string;
  variant_id: string;
  url: string;
  fallback_brand?: string | null;
  fallback_ean?: string | null;
  fallback_sku?: string | null;
}

interface StockData {
  quantity: number | null;
  status: string | null;
  availability_date: Date | null;
  total_stock: number | null;
  combinations_stock: Array<{
    article_number: string;
    stock: number;
    price: number;
    campaign_price?: number;
    stock_type: number;
    empty_stock_text?: string;
  }> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_data: Record<string, any> | null;
}

interface ScrapedProductData {
  name: string;
  competitor_price: number | null;
  currency_code: string | null;
  competitor_url: string;
  sku: string | null;
  brand: string | null;
  ean: string | null;
  image_url: string | null;
  is_available: boolean;
  description?: string | null;
  raw_price?: string | null;
  stock_quantity?: number | null;
  stock_status?: string | null;
  availability_date?: Date | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_stock_data?: Record<string, any> | null;
  stock_data?: StockData | null;
  raw_data?: Record<string, string | number | boolean | null> | null;
}

// ------------------------------------ //
// -------- UTILITY FUNCTIONS --------- //
// ------------------------------------ //

function logProgress(message: string, phase?: number): void {
  if (phase !== undefined) {
    console.error(`PROGRESS: Phase ${phase}: ${message}`);
  } else {
    console.error(`PROGRESS: ${message}`);
  }
}

function logError(message: string, error?: unknown): void {
  console.error(`ERROR: ${message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  } else if (error) {
    console.error(String(error));
  }
}

// ------------------------------------ //
// ------ METADATA FUNCTION ----------- //
// ------------------------------------ //

function getMetadata(): ScriptMetadata {
  return {
    name: `${CONFIG.SITE.NAME} Product Scraper (Crawlee + API)`,
    version: "2.0.0",
    description: `High-performance hybrid scraper for ${CONFIG.SITE.NAME} using Crawlee + API`,
    target_url: CONFIG.SITE.BASE_URL,
    required_libraries: ["crawlee", "fast-xml-parser", "node-fetch", "yargs"],
    batch_size: CONFIG.PERFORMANCE.BATCH_SIZE,
    max_concurrency: CONFIG.PERFORMANCE.MAX_CONCURRENCY,
    collection_strategy: 'api'
  };
}

// ------------------------------------ //
// ----- CONFIGURATION FUNCTION ------- //
// ------------------------------------ //

function configureCrawleeStorage(): Configuration {
  try {
    const memoryConfig = new Configuration({
      persistStorage: false,
    });

    Configuration.getGlobalConfig().set('persistStorage', false);
    logProgress(`Configured Crawlee for memory-only storage.`);
    return memoryConfig;
  } catch (error) {
    logError("Failed to configure Crawlee storage settings", error);
    throw error;
  }
}

// ------------------------------------ //
// ----- SITEMAP DISCOVERY ------------ //
// ------------------------------------ //

async function fetchSitemapUrls(): Promise<string[]> {
  try {
    logProgress('Fetching product URLs from sitemap', 1);

    // Get main sitemap index
    const response = await fetch(CONFIG.SITEMAP.INDEX_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }

    const xmlContent = await response.text();
    const parser = new XMLParser();
    const result = parser.parse(xmlContent);

    // Find all product sitemap URLs
    const productSitemaps: string[] = [];
    const sitemaps = result.sitemapindex?.sitemap || [];
    
    for (const sitemap of Array.isArray(sitemaps) ? sitemaps : [sitemaps]) {
      if (sitemap.loc && sitemap.loc.includes('/products/')) {
        productSitemaps.push(sitemap.loc);
      }
    }

    logProgress(`Found ${productSitemaps.length} product sitemaps`, 1);

    // Fetch URLs from all product sitemaps
    const allUrls: string[] = [];
    
    for (let i = 0; i < productSitemaps.length; i++) {
      const sitemapUrl = productSitemaps[i];
      logProgress(`Processing sitemap ${i + 1}/${productSitemaps.length}`, 1);
      
      try {
        const sitemapResponse = await fetch(sitemapUrl);
        if (sitemapResponse.ok) {
          const sitemapXml = await sitemapResponse.text();
          const sitemapResult = parser.parse(sitemapXml);
          const urls = sitemapResult.urlset?.url || [];
          
          for (const urlEntry of Array.isArray(urls) ? urls : [urls]) {
            if (urlEntry.loc && urlEntry.loc.includes(CONFIG.SITEMAP.PRODUCT_FILTER)) {
              allUrls.push(urlEntry.loc);
            }
          }
        }
      } catch (error) {
        logError(`Error fetching sitemap ${sitemapUrl}`, error);
      }
    }

    logProgress(`Total product URLs discovered: ${allUrls.length}`, 1);
    return allUrls;

  } catch (error) {
    logError('Error discovering product URLs from sitemap', error);
    return [];
  }
}

// ------------------------------------ //
// ---- PRODUCT ID EXTRACTION --------- //
// ------------------------------------ //

async function extractProductVariants(productUrls: string[], _context: ScriptContext): Promise<ProductVariant[]> {
  logProgress(`Extracting product/variant IDs from ${productUrls.length} URLs`, 1);

  const variants: ProductVariant[] = [];
  let failedRequestCount = 0;
  const requestQueue = await RequestQueue.open();

  // Add URLs to queue
  for (const url of productUrls) {
    await requestQueue.addRequest({
      url,
      userData: { label: 'EXTRACT_IDS' }
    });
  }

  const optimalConcurrency = CONFIG.PERFORMANCE.MAX_CONCURRENCY;

  logProgress(`Using ${optimalConcurrency} concurrent requests for ID extraction`, 1);

  const crawler = new CheerioCrawler({
    requestQueue,
    maxConcurrency: optimalConcurrency,
    requestHandlerTimeoutSecs: CONFIG.PERFORMANCE.REQUEST_TIMEOUT,
    maxRequestRetries: CONFIG.PERFORMANCE.MAX_RETRIES,
    maxRequestsPerMinute: CONFIG.PERFORMANCE.MAX_REQUESTS_PER_MINUTE,

    // Better headers to avoid bot detection
    useSessionPool: true,
    sessionPoolOptions: {
      maxPoolSize: 5,
      sessionOptions: {
        maxUsageCount: 10,
      },
    },

    // Add delays between requests
    minConcurrency: 1,

    // Custom headers for each request
    preNavigationHooks: [
      async ({ request }) => {
        // Add realistic headers
        request.headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        };
      }
    ],

    requestHandler: async ({ request, $ }) => {
      try {
        // Extract product_id and variant_id from HTML attributes
        const productIdMatch = $('[product-id]').attr('product-id');
        const variantIdMatch = $('[variant-id]').attr('variant-id');

        if (productIdMatch && variantIdMatch) {
          let fallbackBrand: string | null = null;
          let fallbackEan: string | null = null;
          let fallbackSku: string | null = null;

          $('script[type="application/ld+json"]').each((_, element) => {
            if (fallbackBrand && fallbackEan) return;

            try {
              const rawJson = $(element).contents().text().trim();
              if (!rawJson) return;

              const parsedJson = JSON.parse(rawJson);
              const entries = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
              const productJson = entries.find((entry: any) => entry?.['@type'] === 'Product');
              if (!productJson) return;

              const brandValue = productJson.brand;
              if (!fallbackBrand) {
                fallbackBrand = typeof brandValue === 'string' ? brandValue : brandValue?.name || null;
              }
              if (!fallbackEan) {
                // Structured data describes one SKU, not every variant on the page.
                fallbackEan = productJson.gtin || productJson.gtin13 || null;
                fallbackSku = productJson.sku ? String(productJson.sku).trim() : null;
              }
            } catch (_jsonError) {
              // Ignore malformed structured data and continue with API data.
            }
          });

          variants.push({
            product_id: productIdMatch,
            variant_id: variantIdMatch,
            url: request.url,
            fallback_brand: fallbackBrand,
            fallback_ean: fallbackEan,
            fallback_sku: fallbackSku
          });

          if (variants.length % 100 === 0) {
            logProgress(`Extracted ${variants.length} product variants so far`, 1);
          }
        }
      } catch (error) {
        logError(`Error extracting IDs from ${request.url}`, error);
      }
    },

    failedRequestHandler: async ({ request, error }) => {
      failedRequestCount++;
      logError(`Failed to extract IDs from ${request.url}`, error);
    }
  });

  await crawler.run();

  if (failedRequestCount > 0) {
    throw new Error(`Failed to extract IDs from ${failedRequestCount} product pages. Aborting run to prevent incomplete data.`);
  }

  logProgress(`Extracted ${variants.length} unique product variants`, 1);
  return variants;
}

// ------------------------------------ //
// -------- API FUNCTIONS ------------- //
// ------------------------------------ //

interface ApiSession {
  cookies: Map<string, string>;
  csrfToken: string;
  xsrfToken: string;
  fetch: (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string>; headers: { raw: () => Record<string, string[]> } }>;
}

async function establishApiSession(): Promise<ApiSession | null> {
  try {
    // Import fetch dynamically to avoid TypeScript issues
    const { default: fetch } = await import('node-fetch');

    const session = {
      cookies: new Map<string, string>(),
      csrfToken: '',
      xsrfToken: '',
      fetch: fetch
    };

    // Get main page to establish session and extract tokens
    const response = await fetch(`${CONFIG.SITE.BASE_URL}/sv`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch main page: ${response.status}`);
    }

    // Extract cookies from response
    const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
    for (const cookie of setCookieHeaders) {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        session.cookies.set(name.trim(), value.trim());
      }
    }

    // Extract CSRF token from HTML
    const html = await response.text();
    const csrfMatch = html.match(/name="csrf-token" content="([^"]+)"/);
    if (csrfMatch) {
      session.csrfToken = csrfMatch[1];
    }

    // Get XSRF token from cookies
    session.xsrfToken = session.cookies.get('XSRF-TOKEN') || '';

    logProgress(`API session established - CSRF: ${session.csrfToken ? 'found' : 'missing'}, XSRF: ${session.xsrfToken ? 'found' : 'missing'}, Cookies: ${session.cookies.size}`);
    return session;
  } catch (error) {
    logError('Failed to establish API session', error);
    return null;
  }
}

// New batch API function for multiple products at once
async function fetchProductsBatchFromApi(variants: ProductVariant[], session: ApiSession): Promise<ScrapedProductData[]> {
  const results: ScrapedProductData[] = [];

  if (!session || !session.fetch) {
    logError(`No valid session for batch API call`);
    return results;
  }

  // Build cookie string
  const cookieString = Array.from(session.cookies.entries())
    .map((entry) => `${entry[0]}=${entry[1]}`)
    .join('; ');

  // Prepare headers with all required tokens
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/json',
    'Origin': CONFIG.SITE.BASE_URL,
    'Referer': `${CONFIG.SITE.BASE_URL}/sv`,
    'X-Requested-With': 'XMLHttpRequest',
    'DNT': '1',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };

  // Add cookies and tokens
  if (cookieString) {
    headers['Cookie'] = cookieString;
  }
  if (session.csrfToken) {
    headers['X-CSRF-TOKEN'] = session.csrfToken;
  }
  if (session.xsrfToken) {
    headers['X-XSRF-TOKEN'] = session.xsrfToken;
  }

  // Process variants in parallel with limited concurrency
  const concurrency = Math.min(CONFIG.PERFORMANCE.API_BATCH_CONCURRENCY, variants.length);
  const chunks = [];

  for (let i = 0; i < variants.length; i += concurrency) {
    chunks.push(variants.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (variant, index) => {
      try {
        // Add small delay between requests to avoid rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Fixed 100ms delay
        }

        // Make individual API call for each product (Elstore doesn't support true batch API)
        const response = await session.fetch(`${CONFIG.SITE.API_BASE}/product/state`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            product_id: variant.product_id,
            variant_id: variant.variant_id
          })
        });

        if (!response.ok) {
          const message = `API call failed for product ${variant.product_id}: ${response.status} ${response.statusText}`;
          logError(message);
          if (response.status === 403) {
            throw new Error(`${message}. Aborting run to prevent incomplete data.`);
          }
          return null;
        }

        const apiData = await response.json();
        return await processApiProductData(apiData, variant);
      } catch (error) {
        logError(`Error in API call for product ${variant.product_id}`, error);
        if (error instanceof Error && error.message.includes('403 Forbidden')) {
          throw error;
        }
        return null;
      }
    });

    const chunkResults = await Promise.all(promises);

    for (const result of chunkResults) {
      if (result && Array.isArray(result)) {
        // Each result is now an array of products (variants)
        results.push(...result);
      }
    }

    // Minimal delay between chunks
    if (chunks.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Very short delay
    }
  }

  return results;
}

// Helper function to process single API response and extract all variants
async function processApiProductData(apiData: unknown, variant: ProductVariant): Promise<ScrapedProductData[]> {
  try {
    // Type guard for API data - use any for simplicity since we know the structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = apiData as any;

    const products: ScrapedProductData[] = [];
    const mainProduct = data.product || {};
    const selectedVariant = data.selected_variant || {};

    // Get all variants from the API response
    const allVariants = mainProduct.variants || [selectedVariant];

    // Refuse identifiers reused by different SKUs, even when the API supplies them.
    const eanSkus = new Map<string, Set<string>>();
    for (const item of allVariants) {
      if (!item?.sku) continue;
      const candidate = item.primary_gtin || item.gtin || (
        variant.fallback_sku === String(item.sku).trim() ? variant.fallback_ean : null
      );
      if (candidate) {
        const key = String(candidate).trim();
        const skus = eanSkus.get(key) || new Set<string>();
        skus.add(String(item.sku).trim());
        eanSkus.set(key, skus);
      }
    }

    for (const variantData of allVariants) {
      if (!variantData || !variantData.sku) continue;

      const name = mainProduct.name || '';
      const brandData = mainProduct.denormalized_brand || {};
      const brand = brandData.name?.sv || mainProduct.brand?.name?.sv || mainProduct.brand?.name || variant.fallback_brand || '';

      const sku = variantData.sku || '';
      // Never copy the selected page variant's EAN to sibling sizes/colors.
      // Without a variant EAN, matching must use that variant's SKU + brand.
      const candidateEan = variantData.primary_gtin || variantData.gtin || (
        variant.fallback_sku && String(sku).trim() === variant.fallback_sku
          ? variant.fallback_ean || null
          : null
      );

      const normalizedEan = candidateEan ? String(candidateEan).trim() : null;
      const ean = normalizedEan && eanSkus.get(normalizedEan)?.size === 1 ? normalizedEan : null;

      const priceData = variantData.price || {};
      const formattedPrice = priceData.formatted_price || '0 kr';

      // Handle Swedish price format: "7 495,50 kr" -> 7495.50
      const priceStr = formattedPrice
        .replace(' kr', '')           // Remove " kr"
        .replace(/\s+/g, '')          // Remove all spaces (thousand separators)
        .replace(',', '.');           // Replace comma with dot for decimal

      const competitorPrice = parseFloat(priceStr) || 0;

      // Better stock handling - check available_stock, display_stock, and stock fields
      const availableStock = variantData.available_stock ?? 0;
      const displayStock = variantData.display_stock ?? 0;
      const stockField = parseFloat(variantData.stock || '0');

      // Use the most accurate stock value
      const stockQuantity = availableStock || displayStock || stockField || 0;

      // Determine stock status based on actual stock levels and always_orderable flag
      let stockStatus = "out_of_stock";
      let isAvailable = false;

      if (stockQuantity > 0) {
        stockStatus = "in_stock";
        isAvailable = true;
      } else if (stockQuantity < 0) {
        stockStatus = "back_order"; // Negative stock = backorder (use underscore format)
        isAvailable = false;
      } else {
        // Stock is 0 - check if product is always orderable
        const alwaysOrderable = variantData.always_orderable;

        if (alwaysOrderable) {
          // If always orderable despite 0 stock, it's back_order
          stockStatus = "back_order";
          isAvailable = true;
        } else {
          stockStatus = "out_of_stock";
          isAvailable = false;
        }
      }

      // Get the correct image for this variant
      const images = mainProduct.images || [];
      let imageUrl = null;

      // Try to find the image that matches this variant's image_id
      if (variantData.image_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variantImage = images.find((img: any) => img.id === variantData.image_id);
        if (variantImage) {
          imageUrl = variantImage.thumb_url;
        }
      }

      // Fallback to first image if no variant-specific image found
      if (!imageUrl && images.length > 0) {
        imageUrl = images[0]?.thumb_url || null;
      }

      const productData: ScrapedProductData = {
        name: variantData.name || name, // Use variant name if available
        competitor_price: competitorPrice,
        currency_code: "SEK",
        competitor_url: variant.url,
        image_url: imageUrl,
        sku: sku,
        brand: brand || null,
        ean: ean,
        is_available: isAvailable,
        description: null,
        raw_price: formattedPrice,

        // Individual stock fields for temp_competitors_scraped_data
        stock_quantity: stockQuantity > 0 ? stockQuantity : null,
        stock_status: stockStatus,
        availability_date: null,

        // Raw stock data for debugging (not custom fields)
        raw_stock_data: {
          available_stock: availableStock,
          display_stock: displayStock,
          stock_field: stockField
        },

        // Structured stock data for worker expectations
        stock_data: {
          quantity: stockQuantity > 0 ? stockQuantity : null,
          status: stockStatus,
          availability_date: null,
          total_stock: stockQuantity,
          combinations_stock: null,
          raw_data: null // Don't use raw_data here to avoid custom fields
        },

        // Don't use raw_data to avoid creating custom fields
        raw_data: null
      };

      products.push(productData);
    }

    return products;

  } catch (error) {
    logError(`Error processing API data for product ${variant.product_id}`, error);
    return [];
  }
}

// ------------------------------------ //
// -------- FILTERING FUNCTIONS ------- //
// ------------------------------------ //

function productPassesFilters(product: ScrapedProductData, context: ScriptContext): boolean {
  // Filter by active brands
  if (context.filterByActiveBrands && product.brand) {
    if (!context.activeBrandNames?.includes(product.brand)) {
      return false;
    }
  }

  // Filter by own products
  if (context.scrapeOnlyOwnProducts) {
    let isOwnProduct = false;

    // Check EAN match
    if (product.ean && context.ownProductEans?.includes(product.ean)) {
      isOwnProduct = true;
    }

    // Check SKU/Brand match
    if (!isOwnProduct && product.sku && product.brand) {
      for (const ownProduct of context.ownProductSkuBrands || []) {
        if (ownProduct.sku === product.sku && ownProduct.brand === product.brand) {
          isOwnProduct = true;
          break;
        }
      }
    }

    if (!isOwnProduct) {
      return false;
    }
  }

  return true;
}

// ------------------------------------ //
// --------- MAIN SCRAPE FUNCTION ----- //
// ------------------------------------ //

async function scrape(context: ScriptContext): Promise<void> {
  try {
    logProgress(`Received context: ${JSON.stringify(context)}`);
    configureCrawleeStorage();

    const isTestRun = context.isTestRun;
    const limitProducts = context.limit_products;

    // PHASE 1: URL Collection and ID Extraction
    logProgress("Starting Phase 1: URL Collection and ID Extraction...", 1);

    // Get product URLs from sitemap
    let productUrls = await fetchSitemapUrls();

    if (productUrls.length === 0) {
      logError("No product URLs found in sitemap");
      return;
    }

    // Limit URLs for testing
    if (isTestRun || limitProducts) {
      const limit = limitProducts || 20;
      productUrls = productUrls.slice(0, limit);
      logProgress(`Test mode: limiting to ${productUrls.length} URLs`, 1);
    }

    // Extract product/variant IDs using Crawlee
    const productVariants = await extractProductVariants(productUrls, context);

    if (productVariants.length === 0) {
      logError("No product variants found");
      return;
    }

    logProgress(`Found ${productVariants.length} product variants`, 1);

    // PHASE 2: API Data Collection and Processing
    logProgress("Starting Phase 2: API Data Collection...", 2);

    // Establish API session
    const session = await establishApiSession();
    if (!session) {
      logError("Failed to establish API session");
      return;
    }

    let processedCount = 0;
    let outputCount = 0;
    const batchSize = CONFIG.PERFORMANCE.BATCH_SIZE;
    // Removed unused processedProducts array

    // Process products using batch API for maximum speed
    for (let i = 0; i < productVariants.length; i += batchSize) {
      const batch = productVariants.slice(i, i + batchSize);

      logProgress(`Processing batch ${Math.floor(i / batchSize) + 1}: products ${i + 1}-${Math.min(i + batchSize, productVariants.length)}`, 2);

      try {
        // Use batch API function for parallel processing
        const batchResults = await fetchProductsBatchFromApi(batch, session);
        processedCount += batch.length;

        // Filter and output valid products
        for (const product of batchResults) {
          if (product && productPassesFilters(product, context)) {
            console.log(JSON.stringify(product));
            outputCount++;

            if (outputCount % 10 === 0) {
              logProgress(`✓ Output ${outputCount} products so far`, 2);
            }
          }
        }

        // Progress update
        logProgress(`Processed ${processedCount}/${productVariants.length} products, output ${outputCount} valid products`, 2);

      } catch (error) {
        logError(`Error processing batch ${Math.floor(i / batchSize) + 1}`, error);
        if (error instanceof Error && error.message.includes('403 Forbidden')) {
          throw error;
        }
        processedCount += batch.length;
      }
    }

    logProgress(`Scraping completed. Processed ${processedCount} products, output ${outputCount} valid products.`, 2);

  } catch (error) {
    logError("Error in scrape function", error);
    throw error;
  }
}

// ------------------------------------ //
// --------- MAIN EXECUTION ----------- //
// ------------------------------------ //

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
      console.log(JSON.stringify(getMetadata()));
    } catch (e) {
      logError('Error generating metadata', e);
      throw e;
    }
  } else if (argv._[0] === 'scrape') {
    if (!argv.context) {
      throw new Error('Missing --context argument for scrape command');
    }

    try {
      let contextData: ScriptContext;
      const contextString = argv.context as string;

      try {
        const jsonContext = Buffer.from(contextString, 'base64').toString('utf-8');
        contextData = JSON.parse(jsonContext) as ScriptContext;
      } catch (_decodeError) {
        try {
          contextData = JSON.parse(contextString) as ScriptContext;
        } catch (_parseError) {
          throw new Error(`Failed to parse context: tried Base64 decoding and direct JSON parsing, both failed.`);
        }
      }

      await scrape(contextData);
    } catch (e) {
      if (e instanceof SyntaxError) {
        logError('Failed to parse context JSON', e);
      } else {
        logError('Unhandled error during scrape execution', e);
      }
      throw e;
    }
  }
})().catch(e => {
  logError('Unhandled top-level error', e);
  throw e;
});
