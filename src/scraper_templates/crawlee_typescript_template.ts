/**
 * PriceTracker - Flexible Product Scraper Template
 *
 * This template is designed to be a highly configurable starting point for
 * creating product scrapers for the PriceTracker platform. It supports multiple
 * collection strategies including API calls and web scraping with various URL
 * discovery methods (sitemaps, brand pages, category crawling).
 *
 * Configuration options are grouped at the top of the file for easy modification.
 *
 * Version 1.1.0 - Optimized for performance with memory-only storage, improved
 * concurrency handling, and better error management.
 */

// ------------------------------------ //
// ------- CONFIGURATION SECTION ------ //
// ------------------------------------ //

const CONFIG = {
  // Site information
  SITE: {
    NAME: "Example Store", // Store name
    BASE_URL: "https://www.example.com", // Base URL of the target website
    LANGUAGE: "sv", // Site primary language (used for some scraping operations)
  },

  // Collection strategy configuration
  COLLECTION_STRATEGY: {
    TYPE: "scraping", // Options: "api" or "scraping"

    // API settings (used if TYPE is "api")
    API: {
      BASE_URL: "https://api.example.com/v1",
      PRODUCT_ENDPOINT: "/products",
      REQUIRES_AUTH: false,
      AUTH_TOKEN: "", // Leave empty if no auth required
      PAGINATION: {
        ENABLED: true,
        PARAM_NAME: "page",
        PAGE_SIZE_PARAM: "limit",
        PAGE_SIZE: 100,
        MAX_PAGES: 0, // 0 for unlimited
      }
    },

    // Scraping settings (used if TYPE is "scraping")
    SCRAPING: {
      // URL discovery method
      URL_DISCOVERY: {
        METHOD: "sitemap", // Options: "sitemap", "brand-pages", "category", "custom"

        // Sitemap settings
        SITEMAP: {
          INDEX_URL: "https://www.example.com/sitemap.xml",
          PRODUCT_SITEMAP_FILTER: "sitemap-products", // String that appears in product sitemap URLs
          PRODUCT_URL_FILTER: "/product/", // String that identifies a product URL
        },

        // Brand pages settings
        BRAND_PAGES: {
          BRANDS_LIST_URL: "https://www.example.com/brands",
          BRAND_SELECTOR: ".brand-item a", // CSS selector for brand links
          PAGINATION_SELECTOR: ".pagination a", // CSS selector for pagination
          PRODUCT_SELECTOR: ".product-item a", // CSS selector for product links
        },

        // Category crawling settings
        CATEGORY: {
          START_URLS: ["https://www.example.com/category1", "https://www.example.com/category2"],
          SUBCATEGORY_SELECTOR: ".subcategory a",
          PAGINATION_SELECTOR: ".pagination a",
          PRODUCT_SELECTOR: ".product-item a",
          MAX_DEPTH: 3, // How deep to crawl categories
        },

        // Custom discovery method (implement your own logic)
        CUSTOM: {
          // Add custom configuration here
        }
      },
    }
  },

  // Product data extraction settings
  PRODUCT_EXTRACTION: {
    // CSS selectors for extracting product data (when scraping)
    SELECTORS: {
      NAME: ".product-name",
      PRICE: ".product-price .price .amount",
      CURRENCY: ".product-price .currency",
      SKU: ".product-sku",
      BRAND: ".product-manufacturer",
      EAN: ".product-details tr:contains('EAN') td", // jQuery-style contains selector
      IMAGE_URL: ".product-media .figure-content img",
      DESCRIPTION: ".product-description",
      AVAILABILITY: {
        SELECTOR: ".product-stock-status span",
        IN_STOCK_TEXT: ["In Stock", "Available"],
        OUT_OF_STOCK_TEXT: ["Out of Stock", "Sold Out", "Utgången produkt", "Slut i lager"],
      }
    },

    // JSON-LD schema.org extraction settings
    SCHEMA_ORG: {
      ENABLED: true, // Whether to attempt extraction from schema.org JSON-LD
      SCRIPT_SELECTOR: "script[type='application/ld+json']"
    },

    // Microdata extraction settings
    MICRODATA: {
      ENABLED: false, // Whether to attempt extraction from microdata
    }
  },

  // Performance settings
  PERFORMANCE: {
    MAX_CONCURRENCY: 10, // Maximum number of concurrent requests
    BATCH_SIZE: 500, // Number of products to process before writing a batch
    REQUEST_TIMEOUT: 60, // Timeout in seconds for each request
    MAX_RETRIES: 3, // Maximum number of retries for failed requests
    REQUEST_DELAY: 100, // Delay between requests in milliseconds (0 for no delay)
    MAX_REQUESTS_PER_MINUTE: 1000, // Rate limiting
  },

  // Filtering settings
  FILTERING: {
    ENABLED: false, // Whether to filter products
    BY_BRAND: {
      ENABLED: false,
      BRANDS: [] as string[] // Array of brand names to include
    },
    BY_OWN_PRODUCTS: {
      ENABLED: false,
      EANS: [] as string[], // Will be populated from context
      SKU_BRANDS: [] as { sku: string; brand: string }[] // Will be populated from context
    }
  },

  // Testing/validation settings
  TEST_SETTINGS: {
    TEST_MODE_LIMIT: 20, // Number of products to process in test mode
    VALIDATION_MODE_LIMIT: 20 // Number of products to process in validation mode
  }
};

// ------------------------------------ //
// ------- DEPENDENCIES SECTION ------- //
// ------------------------------------ //

import { CheerioCrawler, RequestQueue, Configuration } from 'crawlee';
import { XMLParser } from 'fast-xml-parser';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
import * as os from 'os';
// We'll use the global Buffer and process objects
// TypeScript will recognize these in a Node.js environment

// ------------------------------------ //
// ------- INTERFACES SECTION --------- //
// ------------------------------------ //

interface ScriptContext {
  activeBrandNames?: string[];
  filterByActiveBrands?: boolean;
  ownProductEans?: string[];
  ownProductSkuBrands?: { sku: string; brand: string }[];
  scrapeOnlyOwnProducts?: boolean;
  isTestRun?: boolean;
  isValidation?: boolean;
  run_id?: string;
}

interface ScrapedProductData {
  name: string;
  price: number | null;
  currency: string;
  url: string;
  sku: string | null;
  brand: string | null;
  ean: string | null;
  image_url: string | null;
  is_available: boolean;
  description?: string | null;
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

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface ApiProduct {
  // Define the structure of a product from your API
  // This will vary depending on the API you're working with
  // Below is a generic example that you should modify
  id: string | number;
  name: string;
  price: number;
  currency_code: string;
  sku: string;
  brand: string;
  ean: string;
  image_url: string;
  in_stock: boolean;
  description: string;
  // ... any other properties from your API
}

// ------------------------------------ //
// --------- LOGGING SECTION ---------- //
// ------------------------------------ //

function logProgress(message: string, phase?: number): void {
  // If phase is provided, include it in the message
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
  const metadata: ScriptMetadata = {
    name: `${CONFIG.SITE.NAME} Product Scraper`,
    version: "1.0.0",
    description: `Flexible product data collector for ${CONFIG.SITE.NAME} using ${CONFIG.COLLECTION_STRATEGY.TYPE === 'api' ? 'API integration' : 'web scraping'} approach`,
    target_url: CONFIG.SITE.BASE_URL,
    required_libraries: ["crawlee", "fast-xml-parser", "node-fetch", "yargs"],
    batch_size: CONFIG.PERFORMANCE.BATCH_SIZE,
    max_concurrency: CONFIG.PERFORMANCE.MAX_CONCURRENCY,
    collection_strategy: CONFIG.COLLECTION_STRATEGY.TYPE as 'api' | 'scraping'
  };
  return metadata;
}

// ------------------------------------ //
// ----- CONFIGURATION FUNCTION ------- //
// ------------------------------------ //

function configureCrawleeStorage(): Configuration {
  try {
    // Create a new Configuration instance explicitly for memory storage
    const memoryConfig = new Configuration({
      persistStorage: false, // Use memory-only storage to avoid permission issues
    });

    // Set global configuration to use memory storage
    Configuration.getGlobalConfig().set('persistStorage', false);

    logProgress(`Created minimal Crawlee Configuration for memory-only storage.`);
    return memoryConfig;
  } catch (error) {
    console.error("ERROR: Failed to configure Crawlee storage settings. Details:", error);
    throw error;
  }
}

// ------------------------------------ //
// ----- URL DISCOVERY METHODS -------- //
// ------------------------------------ //

/**
 * Fetches product URLs from a sitemap
 */
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    logProgress(`Fetching sitemap: ${sitemapUrl}`);

    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xmlContent = await response.text();

    // Parse XML with fast-xml-parser
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
    });

    const result = parser.parse(xmlContent);
    const urlElements = result.urlset?.url || [];

    // Extract URLs from the sitemap
    const urls = Array.isArray(urlElements)
      ? urlElements.map((item: SitemapUrl | { loc: string }) => {
          return typeof item === 'object' ? item.loc : '';
        }).filter(url => url.includes(CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_URL_FILTER))
      : [];

    logProgress(`Found ${urls.length} product URLs in sitemap`);
    return urls;
  } catch (error) {
    logError(`Error fetching sitemap ${sitemapUrl}`, error);
    return [];
  }
}

/**
 * Discovers product URLs from a sitemap index
 */
async function discoverProductUrlsFromSitemap(isTestRun: boolean): Promise<string[]> {
  logProgress('Fetching sitemap index to discover product sitemaps', 1);

  try {
    // Fetch the sitemap index
    const response = await fetch(CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.INDEX_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap index: ${response.status} ${response.statusText}`);
    }

    const xmlContent = await response.text();

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
    });

    const result = parser.parse(xmlContent);
    const sitemapElements = result.sitemapindex?.sitemap || [];

    // Extract product sitemap URLs
    const productSitemapFilter = CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_SITEMAP_FILTER;

    const productSitemapUrls = Array.isArray(sitemapElements)
      ? sitemapElements
          .map((item: { loc: string }) => typeof item === 'object' ? item.loc : '')
          .filter(url => url.includes(productSitemapFilter))
      : [];

    logProgress(`Found ${productSitemapUrls.length} product sitemaps in the sitemap index`, 1);

    // For test runs, we still want to process all sitemaps to get a diverse set of products
    // but we'll limit the number of sitemaps to process for efficiency
    const sitemapsToProcess = isTestRun && productSitemapUrls.length > 1
      ? productSitemapUrls.slice(0, 2) // Process at most 2 sitemaps for test runs
      : productSitemapUrls;

    if (sitemapsToProcess.length === 0) {
      throw new Error(`No product sitemaps found in the sitemap index. Check your PRODUCT_SITEMAP_FILTER setting.`);
    }

    // Process sitemaps in parallel for better performance
    logProgress(`Processing ${sitemapsToProcess.length} sitemaps in parallel for maximum performance`, 1);
    const urlPromises = sitemapsToProcess.map(url => fetchSitemapUrls(url));
    const urlResults = await Promise.all(urlPromises);
    const allUrls = urlResults.flat();
    logProgress(`Parallel processing complete. Found ${allUrls.length} total product URLs across all sitemaps`, 1);
    return allUrls;
  } catch (error) {
    logError(`Error discovering product URLs from sitemap`, error);
    return [];
  }
}

/**
 * Placeholder for discovering product URLs from brand pages
 * This is a sample implementation - needs customization for specific sites
 */
async function discoverProductUrlsFromBrandPages(): Promise<string[]> {
  logProgress('Starting product URL discovery from brand pages', 1);
  // This implementation would need to be customized for each website
  // Here's a pseudocode outline:

  /*
  1. Fetch the brands list page
  2. Extract all brand page URLs
  3. For each brand page:
     a. Fetch the brand page
     b. Extract product links
     c. Check for pagination and follow if needed
  4. Return all discovered product URLs
  */

  // Placeholder implementation
  return [];
}

/**
 * Placeholder for discovering product URLs from category pages
 * This is a sample implementation - needs customization for specific sites
 */
async function discoverProductUrlsFromCategories(): Promise<string[]> {
  logProgress('Starting product URL discovery from category pages', 1);
  // This implementation would need to be customized for each website
  // Here's a pseudocode outline:

  /*
  1. For each start URL in CONFIG.COLLECTION_STRATEGY.SCRAPING.CATEGORY.START_URLS:
     a. Fetch the category page
     b. Extract product links
     c. Extract subcategory links (if depth < MAX_DEPTH)
     d. Check for pagination and follow if needed
  2. Return all discovered product URLs
  */

  // Placeholder implementation
  return [];
}

/**
 * Discovers product URLs based on the configured discovery method
 */
async function discoverProductUrls(isTestRun: boolean): Promise<string[]> {
  const method = CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.METHOD;
  let productUrls: string[] = [];

  switch (method) {
    case 'sitemap':
      productUrls = await discoverProductUrlsFromSitemap(isTestRun);
      break;
    case 'brand-pages':
      productUrls = await discoverProductUrlsFromBrandPages();
      break;
    case 'category':
      productUrls = await discoverProductUrlsFromCategories();
      break;
    case 'custom':
      // Implement your custom URL discovery logic here
      logError('Custom URL discovery method not implemented');
      break;
    default:
      logError(`Unknown URL discovery method: ${method}`);
      break;
  }

  if (isTestRun && productUrls.length > 0) {
    const testLimit = CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT;
    logProgress(`Test mode: selecting ${testLimit} random URLs`, 1);

    // Shuffle the array and take the first testLimit items
    // This is more efficient than creating a new array with random selections
    const shuffledUrls = [...productUrls].sort(() => Math.random() - 0.5);
    return shuffledUrls.slice(0, testLimit);
  }

  return productUrls;
}

// ------------------------------------ //
// ---- API COLLECTION METHODS -------- //
// ------------------------------------ //

/**
 * Fetches product data from an API
 */
async function fetchProductsFromApi(isTestRun: boolean, isValidation: boolean): Promise<ScrapedProductData[]> {
  logProgress('Starting API-based product data collection', 1);

  const { API } = CONFIG.COLLECTION_STRATEGY;
  const products: ApiProduct[] = [];

  try {
    // Determine how many pages to fetch
    let currentPage = 1;
    let hasMorePages = true;
    const testLimit = isTestRun || isValidation ? CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT : 0;

    // Set up headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PriceTracker/1.0'
    };

    if (API.REQUIRES_AUTH && API.AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${API.AUTH_TOKEN}`;
    }

    // Fetch products in pages
    while (hasMorePages) {
      // Construct the API URL with pagination
      let apiUrl = `${API.BASE_URL}${API.PRODUCT_ENDPOINT}`;

      if (API.PAGINATION.ENABLED) {
        const pageSeparator = apiUrl.includes('?') ? '&' : '?';
        apiUrl += `${pageSeparator}${API.PAGINATION.PARAM_NAME}=${currentPage}`;

        if (API.PAGINATION.PAGE_SIZE_PARAM) {
          apiUrl += `&${API.PAGINATION.PAGE_SIZE_PARAM}=${API.PAGINATION.PAGE_SIZE}`;
        }
      }

      logProgress(`Fetching page ${currentPage} from API: ${apiUrl}`);

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract products from response
      // This needs to be customized based on the API's response format
      const pageProducts: ApiProduct[] = Array.isArray(data)
        ? data as ApiProduct[]
        : ((data as any)?.products || (data as any)?.items || []);

      if (pageProducts.length > 0) {
        products.push(...pageProducts);
        logProgress(`Fetched ${pageProducts.length} products from page ${currentPage}. Total: ${products.length}`);

        // Check if we should stop due to test limits
        if (testLimit > 0 && products.length >= testLimit) {
          logProgress(`Reached test limit of ${testLimit} products. Stopping API fetching.`);
          hasMorePages = false;
          break;
        }

        // Check if we should continue to the next page
        if (API.PAGINATION.ENABLED) {
          const hasNextPage = pageProducts.length === API.PAGINATION.PAGE_SIZE;
          const withinPageLimit = API.PAGINATION.MAX_PAGES === 0 || currentPage < API.PAGINATION.MAX_PAGES;

          if (hasNextPage && withinPageLimit) {
            currentPage++;
          } else {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
      } else {
        // No products returned, so we stop
        hasMorePages = false;
      }
    }

    logProgress(`Completed API fetching with ${products.length} products collected.`);

    // Convert API products to the common ScrapedProductData format
    const convertedProducts: ScrapedProductData[] = products.map(apiProduct => {
      // This conversion needs to be customized based on the specific API response format
      return {
        name: apiProduct.name,
        price: typeof apiProduct.price === 'number' ? apiProduct.price : parseFloat(String(apiProduct.price)),
        currency: apiProduct.currency_code || 'SEK', // Default to SEK if not specified
        url: `${CONFIG.SITE.BASE_URL}/product/${apiProduct.id}`, // Construct URL based on product ID
        sku: apiProduct.sku || null,
        brand: apiProduct.brand || null,
        ean: apiProduct.ean || null,
        image_url: apiProduct.image_url || null,
        is_available: apiProduct.in_stock || false,
        description: apiProduct.description || null,
        raw_price: apiProduct.price.toString()
      };
    });

    return convertedProducts;
  } catch (error) {
    logError('Error fetching products from API', error);
    return [];
  }
}

// ------------------------------------ //
// ---- PRODUCT DATA EXTRACTION ------- //
// ------------------------------------ //

/**
 * Helper function to extract product data using various methods
 * This function should be customized for each specific site
 */
async function extractProductData($: any, url: string): Promise<ScrapedProductData | null> {
  try {
    // Initialize product data with defaults
    const productData: ScrapedProductData = {
      name: '',
      price: null,
      currency: 'SEK', // Default currency
      url,
      sku: null,
      brand: null,
      ean: null,
      image_url: null,
      is_available: true, // Default to true unless found otherwise
      description: null,
      raw_price: null
    };

    // --- 1. Try extracting from schema.org JSON-LD first ---
    if (CONFIG.PRODUCT_EXTRACTION.SCHEMA_ORG.ENABLED) {
      const schemaScripts = $(CONFIG.PRODUCT_EXTRACTION.SCHEMA_ORG.SCRIPT_SELECTOR);
      if (schemaScripts.length > 0) {
        schemaScripts.each((_i: number, elem: any) => {
          try {
            const scriptContent = $(elem).html();
            if (scriptContent && scriptContent.includes('Product')) {
              const schemaData = JSON.parse(scriptContent);
              const products = Array.isArray(schemaData) ? schemaData : [schemaData];

              for (const product of products) {
                if (product['@type'] === 'Product') {
                  // Extract Name
                  if (!productData.name && product.name) {
                    productData.name = product.name.toString();
                  }

                  // Extract Price & Currency
                  if (productData.price === null && product.offers && product.offers.price) {
                    const priceStr = String(product.offers.price);
                    productData.raw_price = priceStr;
                    productData.price = parseFloat(priceStr);
                    if (product.offers.priceCurrency) {
                      productData.currency = product.offers.priceCurrency;
                    }
                  }

                  // Extract SKU
                  if (productData.sku === null && product.sku) {
                    productData.sku = product.sku.toString();
                  }

                  // Extract Brand
                  if (productData.brand === null && product.brand && product.brand.name) {
                    productData.brand = product.brand.name.toString();
                  }

                  // Extract Image URL
                  if (productData.image_url === null && product.image) {
                    if (Array.isArray(product.image) && product.image.length > 0) {
                      productData.image_url = product.image[0].toString();
                    } else if (typeof product.image === 'string') {
                      productData.image_url = product.image;
                    }
                  }

                  // Extract EAN
                  if (productData.ean === null && product.gtin) {
                    const cleanEan = product.gtin.toString().replace(/[^0-9]/g, '');
                    if (cleanEan.length === 13) {
                      productData.ean = cleanEan;
                    }
                  }

                  // Extract Description
                  if (productData.description === null && product.description) {
                    productData.description = product.description;
                  }

                  // Extract Availability
                  if (product.offers && product.offers.availability) {
                    const availability = product.offers.availability.toString();
                    productData.is_available = availability.includes('InStock');
                  }
                }
              }
            }
          } catch (_e) {
            // Error parsing schema.org data - continue to next method
          }
        });
      }
    }

    // --- 2. Extract using CSS selectors for any missing data ---
    const selectors = CONFIG.PRODUCT_EXTRACTION.SELECTORS;

    // Extract Name
    if (!productData.name) {
      const nameEl = $(selectors.NAME);
      if (nameEl.length > 0) {
        productData.name = nameEl.text().trim();
      }
    }

    // Extract Price
    if (productData.price === null) {
      const priceEl = $(selectors.PRICE);
      if (priceEl.length > 0) {
        productData.raw_price = priceEl.text().trim();
        if (productData.raw_price) {
          // Improved price parsing with better handling of Swedish price formats
          const cleanedPrice = productData.raw_price
            .replace(/[^\d,\.]/g, '') // Remove all non-numeric characters except decimal separators
            .replace(',', '.'); // Convert comma to dot for parseFloat

          const price = parseFloat(cleanedPrice);

          if (!isNaN(price)) {
            // Sanity check for large numbers (possible formatting issues)
            if (price > 100000) {
              productData.price = price / 1000;
            } else {
              // Convert to integer if it's a whole number
              productData.price = price % 1 === 0 ? Math.floor(price) : price;
            }
          }
        }
      }
    }

    // Extract Currency
    if (productData.currency === 'SEK' && selectors.CURRENCY) {
      const currencyEl = $(selectors.CURRENCY);
      if (currencyEl.length > 0) {
        productData.currency = currencyEl.text().trim();
      }
    }

    // Extract SKU
    if (productData.sku === null) {
      const skuEl = $(selectors.SKU);
      if (skuEl.length > 0) {
        productData.sku = skuEl.text().trim();
      }
    }

    // Extract Brand
    if (productData.brand === null) {
      const brandEl = $(selectors.BRAND);
      if (brandEl.length > 0) {
        productData.brand = brandEl.text().trim();
      }
    }

    // Extract EAN
    if (productData.ean === null) {
      try {
        const eanEl = $(selectors.EAN);
        if (eanEl.length > 0) {
          const eanText = eanEl.text().trim();
          const cleanEan = eanText.replace(/[^0-9]/g, '');
          if (cleanEan.length === 13) {
            productData.ean = cleanEan;
          }
        }
      } catch (_e) {
        // Continue if EAN extraction fails
      }
    }

    // Extract Image URL
    if (productData.image_url === null) {
      const imgEl = $(selectors.IMAGE_URL);
      if (imgEl.length > 0) {
        productData.image_url = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-large-size') || null;
      }
    }

    // Extract Description
    if (productData.description === null) {
      const descEl = $(selectors.DESCRIPTION);
      if (descEl.length > 0) {
        productData.description = descEl.text().trim();
      }
    }

    // Extract Availability
    const availabilityEl = $(selectors.AVAILABILITY.SELECTOR);
    if (availabilityEl.length > 0) {
      const availabilityText = availabilityEl.text().trim().toLowerCase();

      // Check against out-of-stock text patterns
      const isOutOfStock = selectors.AVAILABILITY.OUT_OF_STOCK_TEXT.some(
        text => availabilityText.includes(text.toLowerCase())
      );

      if (isOutOfStock) {
        productData.is_available = false;
      } else {
        // Check against in-stock text patterns
        const isInStock = selectors.AVAILABILITY.IN_STOCK_TEXT.some(
          text => availabilityText.includes(text.toLowerCase())
        );

        productData.is_available = isInStock;
      }
    }

    // --- 3. Validate the extracted data ---
    // Required field - if no name, the extraction failed
    if (!productData.name) {
      return null;
    }

    return productData;
  } catch (error) {
    logError(`Error extracting product data from ${url}`, error);
    return null;
  }
}

// ------------------------------------ //
// ------- FILTERING METHODS ---------- //
// ------------------------------------ //

/**
 * Checks if a product passes all active filters
 */
function productPassesFilters(product: ScrapedProductData, context: ScriptContext): boolean {
  // Skip filtering if not enabled
  if (!CONFIG.FILTERING.ENABLED) {
    return true;
  }

  // Filter by brand
  if (CONFIG.FILTERING.BY_BRAND.ENABLED &&
      context.filterByActiveBrands &&
      context.activeBrandNames &&
      context.activeBrandNames.length > 0 &&
      product.brand) {

    const brandMatches = context.activeBrandNames.some(
      activeBrand => product.brand?.toLowerCase().includes(activeBrand.toLowerCase()) || false
    );

    if (!brandMatches) {
      return false;
    }
  }

  // Filter by own products
  if (CONFIG.FILTERING.BY_OWN_PRODUCTS.ENABLED && context.scrapeOnlyOwnProducts) {
    // Check if product matches by EAN
    const eanMatch = product.ean &&
                     context.ownProductEans &&
                     context.ownProductEans.includes(product.ean);

    // Check if product matches by SKU+Brand
    const skuBrandMatch = product.sku &&
                          product.brand &&
                          context.ownProductSkuBrands &&
                          context.ownProductSkuBrands.some(item =>
                            item.sku === product.sku &&
                            item.brand.toLowerCase() === (product.brand?.toLowerCase() || '')
                          );

    if (!eanMatch && !skuBrandMatch) {
      return false;
    }
  }

  // All filters passed
  return true;
}

// ------------------------------------ //
// ------- MAIN SCRAPE FUNCTION ------- //
// ------------------------------------ //

/**
 * Main scraping function that runs the complete process
 */
async function scrape(context: ScriptContext): Promise<void> {
  // Configure Crawlee storage first
  try {
    configureCrawleeStorage();
    // We don't need to pass this to the crawler anymore in newer Crawlee versions
  } catch (_configError) {
    console.error("CRITICAL ERROR: Crawlee storage configuration failed. Exiting.");
    throw new Error("Crawlee storage configuration failed");
  }

  logProgress("Scrape function started");

  // Extract context variables
  const isTestRun = context.isTestRun ?? false;
  const isValidation = context.isValidation ?? false;
  const filterByActiveBrands = context.filterByActiveBrands ?? false;
  const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;

  // Update the filtering configuration from context
  CONFIG.FILTERING.ENABLED = filterByActiveBrands || scrapeOnlyOwnProducts;
  CONFIG.FILTERING.BY_BRAND.ENABLED = filterByActiveBrands;
  CONFIG.FILTERING.BY_OWN_PRODUCTS.ENABLED = scrapeOnlyOwnProducts;

  // Update filter data in CONFIG
  if (filterByActiveBrands && context.activeBrandNames) {
    CONFIG.FILTERING.BY_BRAND.BRANDS = context.activeBrandNames;
  }

  if (scrapeOnlyOwnProducts) {
    if (context.ownProductEans) {
      CONFIG.FILTERING.BY_OWN_PRODUCTS.EANS = context.ownProductEans;
    }
    if (context.ownProductSkuBrands) {
      CONFIG.FILTERING.BY_OWN_PRODUCTS.SKU_BRANDS = context.ownProductSkuBrands;
    }
  }

  logProgress(`Context: isTestRun=${isTestRun}, isValidation=${isValidation}, filterByActiveBrands=${filterByActiveBrands}`, 1);

  try {
    // Collection phase
    let productUrls: string[] = [];
    let apiProducts: ScrapedProductData[] = [];

    if (CONFIG.COLLECTION_STRATEGY.TYPE === 'api') {
      // Collect products via API
      logProgress('Starting product collection via API', 1);
      apiProducts = await fetchProductsFromApi(isTestRun, isValidation);

      // Process API products
      const processedProducts: ScrapedProductData[] = [];
      for (const product of apiProducts) {
        if (productPassesFilters(product, context)) {
          processedProducts.push(product);
        }
      }

      // Write products to output
      for (const product of processedProducts) {
        console.log(JSON.stringify(product));
      }

      logProgress(`API collection complete. Processed ${processedProducts.length} products.`, 2);
      return; // API collection is complete, return early
    } else {
      // Collect product URLs via scraping
      logProgress('Starting product URL collection via scraping', 1);
      productUrls = await discoverProductUrls(isTestRun || isValidation);

      // The random selection for test/validation runs is now handled in discoverProductUrls
      logProgress(`Collected ${productUrls.length} product URLs for scraping.`, 1);
    }

    // Abort if no URLs found
    if (productUrls.length === 0) {
      logProgress(`No product URLs found to process. Exiting.`, 1);
      return;
    }

    // Prepare for product scraping
    logProgress(`Phase 2: Starting product data extraction for ${productUrls.length} URLs`, 2);

    // Track progress
    let processedCount = 0;
    let batchCount = 0;
    const totalUrls = productUrls.length;
    const batchSize = CONFIG.PERFORMANCE.BATCH_SIZE;

    // Track products for batch processing
    const processedProducts: ScrapedProductData[] = [];

    // Set up progress reporting
    const progressInterval = setInterval(() => {
      logProgress(`Phase 2: Processing products: ${processedCount}/${totalUrls} (Batch: ${batchCount})`, 2);
    }, 5000);

    // Calculate optimal concurrency based on system resources
    const optimalConcurrency = Math.min(
      Math.max(2, os.cpus().length * 2), // 2 concurrent requests per CPU core, minimum 2
      CONFIG.PERFORMANCE.MAX_CONCURRENCY // But never exceed the configured maximum
    );

    logProgress(`Using dynamic concurrency: ${optimalConcurrency} concurrent requests for product extraction`, 2);

    // Initialize a request queue for product extraction
    const requestQueue = await RequestQueue.open();

    // Add all product URLs to the queue
    for (const url of productUrls) {
      await requestQueue.addRequest({
        url,
        userData: { label: 'PRODUCT' }
      });
    }

    // Configure crawler for product page scraping with optimized settings
    const crawler = new CheerioCrawler({
      requestQueue,
      maxConcurrency: optimalConcurrency,
      requestHandlerTimeoutSecs: CONFIG.PERFORMANCE.REQUEST_TIMEOUT,
      maxRequestRetries: CONFIG.PERFORMANCE.MAX_RETRIES,

      // Use session pool for better handling of rate limiting
      useSessionPool: true,
      sessionPoolOptions: {
        maxPoolSize: 20,
        sessionOptions: {
          maxUsageCount: 50,
        },
      },

      // Implement rate limiting
      maxRequestsPerMinute: CONFIG.PERFORMANCE.MAX_REQUESTS_PER_MINUTE,

      // Optimize memory usage
      additionalMimeTypes: ['application/ld+json'],

      // Main request handler
      requestHandler: async ({ request, $, log }) => {
        const { url } = request;

        log.info(`Processing product page: ${url}`);

        try {
          // Extract product data
          const productData = await extractProductData($, url);

          if (productData) {
            // Apply filtering
            if (productPassesFilters(productData, context)) {
              processedProducts.push(productData);

              // Increment processed count for progress reporting
              processedCount++;

              // Check if we've reached the batch size
              if (processedProducts.length >= batchSize) {
                // Write the batch to stdout (which will be captured by PriceTracker)
                logProgress(`Writing batch ${++batchCount} with ${processedProducts.length} products`, 2);

                // Output each product in the batch
                for (const product of processedProducts) {
                  console.log(JSON.stringify(product));
                }

                // Clear the batch
                processedProducts.length = 0;
              }

              // Report progress every 10 products
              if (processedCount % 10 === 0) {
                logProgress(`Processed ${processedCount}/${totalUrls} products`, 2);
              }
            }
          } else {
            log.info(`Failed to extract product data from ${url}`);
          }
        } catch (error) {
          logError(`Error processing product ${url}`, error);
        }
      },

      // Handle failed requests
      failedRequestHandler: async ({ request, error }) => {
        logError(`Request ${request.url} failed: ${error instanceof Error ? error.message : String(error)}`);

        // Increment processed count to maintain accurate progress reporting
        processedCount++;
      }
    });

    try {
      // Start the crawler
      await crawler.run();
    } finally {
      // Clear the progress interval
      clearInterval(progressInterval);

      // Process any remaining products in the batch
      if (processedProducts.length > 0) {
        logProgress(`Writing final batch with ${processedProducts.length} products`, 2);

        // Output each remaining product
        for (const product of processedProducts) {
          console.log(JSON.stringify(product));
        }

        // Clear the batch
        processedProducts.length = 0;
        batchCount++;
      }
    }

    logProgress(`Crawler finished. Processed ${processedCount} products in ${batchCount} batches.`, 2);

  } catch (error) {
    logError("Error in web scraping", error);
    throw error;
  }
}

// ------------------------------------ //
// --------- MAIN EXECUTION ----------- //
// ------------------------------------ //

// Process command line arguments
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

// Main execution function
(async () => {
  if (argv._[0] === 'metadata') {
    try {
      console.log(JSON.stringify(getMetadata()));
    } catch (e) {
      logError('Error generating metadata', e);
      throw e; // Let the outer catch handle this
    }
  } else if (argv._[0] === 'scrape') {
    if (!argv.context) {
      throw new Error('Missing --context argument for scrape command');
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
      throw e; // Let the outer catch handle this
    }
  }
})().catch(e => {
  logError('Unhandled top-level error', e);
  throw e; // This will cause the process to exit with a non-zero code
});