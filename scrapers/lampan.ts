/**
 * PriceTracker - Lampan.se Product Scraper with Custom Fields Support
 *
 * This scraper collects product data from Lampan.se using the sitemap-based approach.
 * It extracts product information including prices, SKUs, EANs, availability, and custom fields.
 *
 * Based on the Python scraper: 1-GET_PRICES_Lampan.py
 * Converted to TypeScript using the Crawlee framework for better performance.
 *
 * PRICE EXTRACTION UPDATE (2024-06-13):
 * - Now prioritizes price from meta[itemprop="price"] tag in the HTML
 * - Falls back to JavaScript productData variable only if meta tag price is not available
 * - Added additional logging for price extraction debugging
 *
 * SKU EXTRACTION UPDATE (2024-06-13):
 * - Now prioritizes SKU from span[itemprop="sku"] element in the HTML
 * - Falls back to dataLayer (item_id/ecomm_prodid) if not found in HTML
 * - Falls back to JavaScript productData variable as last resort
 * - Added additional logging for SKU extraction debugging
 *
 * AVAILABILITY UPDATE (2024-06-13):
 * - Now checks if the add-to-cart button is hidden to determine if product is buyable
 * - Skips products that are not available for purchase (hidden add-to-cart button)
 * - Combines add-to-cart check with stock status check for better availability detection
 * - Added additional logging for availability detection
 *
 * CUSTOM FIELDS UPDATE (2025-01-27):
 * - Now extracts all product specifications from the "Fakta" table in the product popup
 * - Automatically creates custom fields for specifications like Watt, Sockel, HÃ¶jd, Diameter, etc.
 * - Custom fields are stored in raw_data and processed by PriceTracker's custom fields system
 * - Supports automatic type detection (text, number, boolean) for extracted specifications
 *
 * 2-STEP PROCESS UPDATE (2025-01-27):
 * - STEP 1: URL Discovery - Collects all product URLs from sitemap and reports total count for progress bar
 * - STEP 2: Product Scraping - Processes URLs in batches to prevent database overload
 * - Database batching: Outputs products in batches of 500 to avoid overwhelming the database
 * - Progress tracking: Reports both current/total products for accurate progress display
 */

// ------------------------------------ //
// ------- CONFIGURATION SECTION ------ //
// ------------------------------------ //

const CONFIG = {
  // Site information
  SITE: {
    NAME: "Lampan.se",
    BASE_URL: "https://lampan.se",
    LANGUAGE: "sv",
  },

  // Collection strategy configuration
  COLLECTION_STRATEGY: {
    TYPE: "scraping", // Using web scraping approach

    // Scraping settings
    SCRAPING: {
      // URL discovery method
      URL_DISCOVERY: {
        METHOD: "sitemap",

        // Sitemap settings
        SITEMAP: {
          INDEX_URL: "https://lampan.se/sitemap.xml",
          PRODUCT_SITEMAP_FILTER: "", // No filter needed as we directly use the main sitemap
          PRODUCT_URL_FILTER: "/p/", // Filter for product URLs containing "/p/"
        },
      },
    }
  },

  // Product data extraction settings
  PRODUCT_EXTRACTION: {
    // CSS selectors for extracting product data
    SELECTORS: {
      NAME: "h1.product-title",
      PRICE: ".js-price-field meta[itemprop='price']", // Updated to use meta tag price
      PRICE_DISPLAY: ".js-price-field .price", // Visual price display
      CURRENCY: "SEK", // Hardcoded as SEK since it's a Swedish site
      SKU: "span[itemprop='sku']", // Updated to use HTML element with itemprop="sku"
      BRAND: "meta[itemprop='brand']", // From the Python scraper
      EAN: "meta[itemprop='gtin13']", // From the Python scraper
      IMAGE_URL: ".product-image img",
      DESCRIPTION: ".product-description",
      AVAILABILITY: {
        SELECTOR: ".product-stock-item__text",
        IN_STOCK_TEXT: ["I lager", "Finns i lager"],
        OUT_OF_STOCK_TEXT: ["Ej i lager", "Slut i lager", "UtgÃ¥ngen produkt"]
      },
      // Add to cart button selector to check if product is buyable
      ADD_TO_CART: "#js-add-to-cart-area"
    },

    // JSON-LD schema.org extraction settings
    SCHEMA_ORG: {
      ENABLED: true,
      SCRIPT_SELECTOR: "script[type='application/ld+json']"
    },
  },

  // Performance settings - optimized based on the Python scraper
  PERFORMANCE: {
    MAX_CONCURRENCY: 4, // Moderate concurrency after successful recovery
    BATCH_SIZE: 500, // Keep this optimization - fewer database writes
    REQUEST_TIMEOUT: 60,
    MAX_RETRIES: 3, // Same as Python version
    REQUEST_DELAY: 100, // Small delay to avoid overwhelming the server
    MAX_REQUESTS_PER_MINUTE: 600, // Moderate ceiling: ten requests/second on average
  },

  // Testing settings
  TEST_SETTINGS: {
    TEST_MODE_LIMIT: 20,
    VALIDATION_MODE_LIMIT: 20
  },

  // Filtering settings
  FILTERING: {
    ENABLED: false, // Will be updated dynamically based on context
    BY_BRAND: {
      ENABLED: false,
      BRANDS: [] as string[] // Array of brand names to include
    },
    BY_OWN_PRODUCTS: {
      ENABLED: false,
      EANS: [] as string[], // Will be populated from context
      SKU_BRANDS: [] as { sku: string; brand: string }[] // Will be populated from context
    }
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

// Node.js globals
declare const process: any;
declare const Buffer: any;

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

interface StockData {
  quantity: number | null;
  status: string | null;
  availability_date: Date | null;
  total_stock: number | null; // Total stock across all combinations
  combinations_stock: Array<{
    article_number: string;
    stock: number;
    price: number;
    campaign_price?: number;
    stock_type: number;
    empty_stock_text?: string;
  }> | null; // Stock data for each product combination/variant
  raw_data: Record<string, any> | null;
}

interface ScrapedProductData {
  name: string;
  competitor_price: number | null; // Updated field name to match temp_competitors_scraped_data table
  currency_code: string | null; // Updated field name to match temp_competitors_scraped_data table, allow null for database default
  competitor_url: string;
  sku: string | null;
  brand: string | null;
  ean: string | null;
  image_url: string | null;
  is_available: boolean;
  description?: string | null;
  raw_price?: string | null;
  stock_status?: string | null; // Added for Lampan's stock status - DEPRECATED: use stock_data instead
  stock_data?: StockData | null; // New structured stock data
  raw_data?: Record<string, string | number | boolean | null> | null; // Custom fields data from Fakta table
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

// ------------------------------------ //
// --------- LOGGING SECTION ---------- //
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
// -------- VALIDATION SECTION -------- //
// ------------------------------------ //

/**
 * Validates if an EAN code is in a valid format
 * Valid EAN codes must be:
 * - 8-13 digits long (EAN-8, UPC-E, UPC-A, EAN-13)
 * - Contain only numeric characters
 * - Not be obviously invalid like single digits
 */
function isValidEAN(ean: string | null | undefined): boolean {
  if (!ean || typeof ean !== 'string') {
    return false;
  }

  // Remove any whitespace
  const cleanEan = ean.trim();

  // Check if it's empty after trimming
  if (!cleanEan) {
    return false;
  }

  // Check if it contains only digits
  if (!/^\d+$/.test(cleanEan)) {
    return false;
  }

  // Check length - valid EAN codes are 8, 12, or 13 digits
  // EAN-8: 8 digits
  // UPC-A: 12 digits
  // EAN-13: 13 digits
  // Some systems also accept 10 and 11 digit codes
  const length = cleanEan.length;
  if (length < 8 || length > 13) {
    return false;
  }

  // Additional check: reject obviously invalid codes like single digits repeated
  // or codes that are clearly not real EAN codes
  if (length === 8 && /^(\d)\1{7}$/.test(cleanEan)) {
    // Reject codes like "11111111" or "00000000"
    return false;
  }

  if (length >= 12 && /^(\d)\1{11,12}$/.test(cleanEan)) {
    // Reject codes like "111111111111" or "1111111111111"
    return false;
  }

  return true;
}

/**
 * Sanitizes an EAN code by validating it and returning null if invalid
 */
function sanitizeEAN(ean: string | null | undefined): string | null {
  if (!isValidEAN(ean)) {
    return null;
  }

  return ean!.trim();
}

// ------------------------------------ //
// ------ METADATA FUNCTION ----------- //
// ------------------------------------ //

function getMetadata(): ScriptMetadata {
  const metadata: ScriptMetadata = {
    name: `${CONFIG.SITE.NAME} Product Scraper`,
    version: "1.0.0",
    description: `Product data collector for ${CONFIG.SITE.NAME} using sitemap-based web scraping`,
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
 * Fetches product URLs from a sitemap with retry logic
 */
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const maxRetries = 5;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logProgress(`Fetching sitemap (attempt ${attempt}/${maxRetries}): ${sitemapUrl}`);

      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(30000) // Abort stalled sitemap requests after 30 seconds
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

      // Extract URLs from the sitemap that match the product URL filter
      const productFilter = CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_URL_FILTER;
      const urls = Array.isArray(urlElements)
        ? urlElements.map((item: SitemapUrl | { loc: string }) => {
            return typeof item === 'object' ? item.loc : '';
          }).filter(url => url.includes(productFilter))
        : [];

      logProgress(`Found ${urls.length} product URLs in sitemap`);
      return urls;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logError(`Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`, error);

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        logProgress(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  throw lastError || new Error(`Failed to fetch sitemap after ${maxRetries} attempts`);
}

/**
 * STEP 1: Discovers product URLs from the sitemap and reports total count
 */
async function discoverProductUrls(isTestRun: boolean): Promise<string[]> {
  logProgress(`STEP 1: Starting URL discovery from sitemap`, 1);

  // For Lampan, we directly use the main sitemap
  const sitemapUrl = CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.INDEX_URL;
  logProgress(`Fetching product URLs from sitemap: ${sitemapUrl}`, 1);

  const productUrls = await fetchSitemapUrls(sitemapUrl);

  // Report total URLs found for progress tracking
  logProgress(`URL discovery complete: Found ${productUrls.length} total product URLs`, 1);

  if (isTestRun && productUrls.length > 0) {
    const testLimit = CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT;
    logProgress(`Test mode: selecting ${testLimit} random URLs from ${productUrls.length} total`, 1);

    // Shuffle the array and take the first testLimit items
    const shuffledUrls = [...productUrls].sort(() => Math.random() - 0.5);
    const selectedUrls = shuffledUrls.slice(0, testLimit);

    logProgress(`Test mode URL selection complete: ${selectedUrls.length} URLs selected`, 1);
    return selectedUrls;
  }

  logProgress(`URL discovery phase complete: ${productUrls.length} URLs ready for processing`, 1);
  return productUrls;
}

// ------------------------------------ //
// ---- CUSTOM FIELDS EXTRACTION ------ //
// ------------------------------------ //

/**
 * Extract custom fields from Lampan's "Fakta" table
 * This extracts all the product specifications from the popup table
 */
function extractLampanFaktaFields($: any): Record<string, string | number | boolean | null> {
  const customFields: Record<string, string | number | boolean | null> = {};

  try {
    // Look for the Fakta table in the product popup
    const faktaTable = $('.popup-product__features table tbody tr');

    if (faktaTable.length === 0) {
      logProgress('No Fakta table found');
      return customFields;
    }

    faktaTable.each((_index: number, row: any) => {
      const $row = $(row);
      const keyElement = $row.find('td:first-child strong');
      const valueElement = $row.find('td:last-child');

      if (keyElement.length > 0 && valueElement.length > 0) {
        let key = keyElement.text().trim();
        const value = valueElement.text().trim();

        // Clean up the key - remove colons, convert to snake_case
        key = key
          .replace(/[:\s]+$/, '') // Remove trailing colons and spaces
          .toLowerCase()
          .replace(/[^a-z0-9Ã¥Ã¤Ã¶Ã…Ã„Ã–]+/g, '_') // Replace non-alphanumeric with underscores (including Swedish chars)
          .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
          .replace(/_+/g, '_'); // Replace multiple underscores with single

        // Skip empty keys or values
        if (!key || !value) {
          return;
        }

        // Skip the artikelnummer since we already extract it as SKU
        if (key === 'artikelnummer') {
          return;
        }

        // Try to convert value to appropriate type
        let processedValue: string | number | boolean | null = value;

        // Check for boolean values (Swedish)
        if (value.toLowerCase() === 'ja' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'true') {
          processedValue = true;
        } else if (value.toLowerCase() === 'nej' || value.toLowerCase() === 'no' || value.toLowerCase() === 'false') {
          processedValue = false;
        } else {
          // Try to parse as number for measurements (but keep original if it contains units)
          const numericMatch = value.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZÃ¥Ã¤Ã¶Ã…Ã„Ã–%]*)\s*$/);
          if (numericMatch) {
            const numericValue = parseFloat(numericMatch[1].replace(',', '.'));
            const unit = numericMatch[2];

            if (!isNaN(numericValue)) {
              if (!unit || unit === '') {
                // Pure number, convert to number
                processedValue = numericValue;
              } else {
                // Has units, keep as string but clean it up
                processedValue = `${numericValue}${unit}`;
              }
            }
          }
        }

        customFields[key] = processedValue;
        logProgress(`Extracted custom field: ${key} = ${processedValue}`);
      }
    });

  } catch (error) {
    logError('Error extracting Fakta fields', error);
  }

  return customFields;
}

// ------------------------------------ //
// ------ STOCK DATA EXTRACTION ------- //
// ------------------------------------ //

/**
 * Extract stock data from Lampan product pages
 * Handles various stock formats: numeric quantities, status text, and availability dates
 * For multi-variant products, extracts stock for the specific variant based on URL
 */
function extractStockData($: any, url: string, productSku?: string): StockData | null {
  const stockData: StockData = {
    quantity: null,
    status: null,
    availability_date: null,
    total_stock: null,
    combinations_stock: null,
    raw_data: null
  };

  try {
    // Initialize raw data object to store all stock-related information
    const rawStockInfo: Record<string, any> = {};

    // --- 1. Extract stock quantity from various sources ---

    // Look for explicit stock quantity indicators
    const stockQuantitySelectors = [
      '.stock-quantity',
      '.inventory-count',
      '[data-stock]',
      '.product-stock-quantity',
      '.stock-level'
    ];

    for (const selector of stockQuantitySelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_: number, element: any) => {
          const text = $(element).text().trim();
          const dataStock = $(element).attr('data-stock');

          // Try data attribute first
          if (dataStock) {
            const quantity = parseInt(dataStock);
            if (!isNaN(quantity) && stockData.quantity === null) {
              stockData.quantity = quantity;
              rawStockInfo.quantity_source = `data-stock attribute: ${dataStock}`;
            }
          }

          // Try extracting number from text
          const match = text.match(/(\d+)/);
          if (match && stockData.quantity === null) {
            const quantity = parseInt(match[1]);
            if (!isNaN(quantity)) {
              stockData.quantity = quantity;
              rawStockInfo.quantity_source = `text extraction: ${text}`;
            }
          }
        });
      }
    }

    // --- 2. Extract stock status from Lampan's stock display ---

    const stockDiv = $('.product-stock');
    if (stockDiv.length > 0) {
      const activeStock = stockDiv.find('.active-product-stock-item');
      if (activeStock.length > 0) {
        const stockText = activeStock.find('.product-stock-item__text').text().trim();
        if (stockText) {
          stockData.status = stockText;
          rawStockInfo.status_source = 'product-stock-item__text';
          rawStockInfo.original_status = stockText;
        }
      }
    }

    // Fallback: look for other stock status indicators
    if (!stockData.status) {
      const statusSelectors = [
        '.stock-status',
        '.availability-status',
        '.product-availability',
        '.stock-info'
      ];

      for (const selector of statusSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const statusText = element.text().trim();
          if (statusText) {
            stockData.status = statusText;
            rawStockInfo.status_source = selector;
            rawStockInfo.original_status = statusText;
            break;
          }
        }
      }
    }

    // --- 3. Extract availability dates ---

    // Look for delivery/availability date information
    const dateSelectors = [
      '.availability-date',
      '.delivery-date',
      '.expected-date',
      '.restock-date'
    ];

    for (const selector of dateSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const dateText = element.text().trim();
        rawStockInfo[`${selector}_text`] = dateText;

        // Try to extract date in various formats
        const datePatterns = [
          /(\d{4}-\d{2}-\d{2})/,           // YYYY-MM-DD
          /(\d{2}\/\d{2}\/\d{4})/,         // DD/MM/YYYY
          /(\d{1,2}\s+\w+\s+\d{4})/,      // DD Month YYYY
        ];

        for (const pattern of datePatterns) {
          const match = dateText.match(pattern);
          if (match && !stockData.availability_date) {
            try {
              const parsedDate = new Date(match[1]);
              if (!isNaN(parsedDate.getTime())) {
                stockData.availability_date = parsedDate;
                rawStockInfo.date_source = `${selector}: ${match[1]}`;
                break;
              }
            } catch (error) {
              // Continue to next pattern
            }
          }
        }
      }
    }

    // --- 4. Look for stock information in JavaScript variables (PRIMARY SOURCE for Lampan) ---

    const scriptTags = $('script').toArray();
    for (const scriptTag of scriptTags) {
      const scriptContent = $(scriptTag).html() || '';

      // Look for stock data in productData variable (this is the most reliable source for Lampan)
      const productDataMatch = /var\s+productData\s*=\s*(\{.*?\});/s.exec(scriptContent);
      if (productDataMatch && productDataMatch[1]) {
        try {
          const productDataJson = JSON.parse(productDataMatch[1]);

          // Extract stock from combinations (primary source)
          if (productDataJson.combinations && Array.isArray(productDataJson.combinations)) {
            const combinations = productDataJson.combinations;
            const combinationsStockData: Array<{
              article_number: string;
              stock: number;
              price: number;
              campaign_price?: number;
              stock_type: number;
              empty_stock_text?: string;
            }> = [];
            let totalStock = 0;

            // Process each combination/variant
            for (const combination of combinations) {
              if (combination && typeof combination.stock !== 'undefined') {
                const stock = parseInt(combination.stock) || 0;
                totalStock += stock;

                combinationsStockData.push({
                  article_number: combination.articleNumber || '',
                  stock: stock,
                  price: combination.price || 0,
                  campaign_price: combination.campaignPrice,
                  stock_type: combination.stockType || 0,
                  empty_stock_text: combination.emptyStockText
                });
              }
            }

            // Set stock data
            if (combinationsStockData.length > 0) {
              stockData.combinations_stock = combinationsStockData;
              stockData.total_stock = totalStock;

              // For multi-variant products, determine which variant this URL represents
              let targetVariantIndex = 0; // Default to first variant

              if (combinations.length > 1) {
                // Try to match the variant based on URL pattern
                // Lampan URLs for variants follow pattern: /product-name-X/ where X is variant index
                const urlVariantMatch = url.match(/-(\d+)\/?$/);
                if (urlVariantMatch) {
                  const urlVariantNumber = parseInt(urlVariantMatch[1]);
                  // Map URL variant number to combination index
                  // URL ends with -0, -1, -2, etc. which correspond to combination indices
                  if (urlVariantNumber >= 0 && urlVariantNumber < combinations.length) {
                    targetVariantIndex = urlVariantNumber;
                  }
                }

                // If we have a productSku, try to match it with the combinations
                if (productSku) {
                  const skuMatchIndex = combinations.findIndex((combo: any) =>
                    combo.articleNumber === productSku
                  );
                  if (skuMatchIndex >= 0) {
                    targetVariantIndex = skuMatchIndex;
                  }
                }
              }

              // Use the specific variant's stock data
              const targetVariant = combinationsStockData[targetVariantIndex];
              stockData.quantity = targetVariant.stock;
              stockData.status = targetVariant.empty_stock_text || null;

              if (combinations.length === 1) {
                rawStockInfo.quantity_source = 'productData.combinations[0].stock (single variant)';
              } else {
                rawStockInfo.quantity_source = `productData.combinations[${targetVariantIndex}].stock (variant ${targetVariantIndex} of ${combinations.length})`;
              }

              rawStockInfo.combinations_count = combinations.length;
              rawStockInfo.target_variant_index = targetVariantIndex;
              rawStockInfo.stock_type = combinations[targetVariantIndex].stockType;
              rawStockInfo.is_back_order = combinations[targetVariantIndex].isBackOrder;
            }
          }

          // Store additional productData info for debugging and future use
          rawStockInfo.productData_info = {
            id: productDataJson.id,
            stockLimit: productDataJson.stockLimit,
            isBackOrder: productDataJson.isBackOrder,
            combinations: productDataJson.combinations?.map((c: any) => ({
              stock: c.stock,
              stockType: c.stockType,
              emptyStockText: c.emptyStockText,
              isBackOrder: c.isBackOrder
            }))
          };

          // If we found stock data from productData, we can break early as this is the most reliable source
          if (stockData.quantity !== null) {
            break;
          }
        } catch (error) {
          logError('Error parsing productData for stock information', error);
        }
      }

      // Look for other stock-related JavaScript variables
      const stockVarPatterns = [
        /var\s+stock\s*=\s*(\d+)/,
        /var\s+inventory\s*=\s*(\d+)/,
        /"stock":\s*(\d+)/,
        /"inventory":\s*(\d+)/
      ];

      for (const pattern of stockVarPatterns) {
        const match = pattern.exec(scriptContent);
        if (match && stockData.quantity === null) {
          const quantity = parseInt(match[1]);
          if (!isNaN(quantity)) {
            stockData.quantity = quantity;
            rawStockInfo.quantity_source = `JavaScript variable: ${match[0]}`;
            break;
          }
        }
      }
    }

    // --- 5. Store all raw data for debugging and future improvements ---

    // Collect all stock-related text for analysis
    rawStockInfo.all_stock_text = {
      product_stock: $('.product-stock').text().trim(),
      stock_elements: $('.stock, .inventory, .availability').map((_: number, el: any) => $(el).text().trim()).get(),
      delivery_info: $('.delivery-info, .shipping-info').text().trim()
    };

    // Only set raw_data if we found any stock information
    if (Object.keys(rawStockInfo).length > 0) {
      stockData.raw_data = rawStockInfo;
    }

    // Log what we found for debugging
    if (stockData.quantity !== null || stockData.status !== null || stockData.availability_date !== null) {
      logProgress(`Extracted stock data for ${url}: quantity=${stockData.quantity}, status="${stockData.status}", date=${stockData.availability_date?.toISOString()?.split('T')[0]}`);
    }

    return stockData;
  } catch (error) {
    logError(`Error extracting stock data from ${url}`, error);
    return null;
  }
}

// ------------------------------------ //
// ---- PRODUCT DATA EXTRACTION ------- //
// ------------------------------------ //

/**
 * Extract product data from the page
 * This is customized for Lampan.se based on the Python scraper
 */
async function extractProductData($: any, url: string): Promise<ScrapedProductData | null> {
  try {
    // Initialize product data with defaults
    const productData: ScrapedProductData = {
      name: '',
      competitor_price: null,
      currency_code: null, // Let database set user's primary currency
      competitor_url: url,
      sku: null,
      brand: null,
      ean: null,
      image_url: null,
      is_available: true, // Default to true unless found otherwise
      description: null,
      stock_status: null,
      raw_data: null
    };

    // --- 1. Extract price from meta itemprop="price" tag (most reliable source) ---
    const priceMetaTag = $('.js-price-field meta[itemprop="price"]');
    if (priceMetaTag.length > 0) {
      const metaPrice = priceMetaTag.attr('content');
      if (metaPrice) {
        try {
          productData.raw_price = metaPrice;
          const parsedPrice = parseFloat(metaPrice);
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            productData.competitor_price = parsedPrice;
            logProgress(`Extracted price ${productData.competitor_price} from meta tag for ${url}`);
          } else {
            logProgress(`Invalid price in meta tag: "${metaPrice}" for ${url}`);
          }
        } catch (error) {
          logError(`Error parsing price from meta tag: ${metaPrice}`, error);
        }
      }
    }

    // --- 2. Extract data from productData JavaScript variable (as fallback) ---
    // Only use this if we couldn't get the price from the meta tag
    if (productData.competitor_price === null) {
      logProgress(`No price found in meta tag, trying JavaScript variable for ${url}`);
      const scriptTags = $('script').toArray();
      for (const scriptTag of scriptTags) {
        const scriptContent = $(scriptTag).html() || '';

        // Look for the productData variable in the script
        const match = /var\s+productData\s*=\s*(\{.*?\});/s.exec(scriptContent);
        if (match && match[1]) {
          try {
            const productDataJson = JSON.parse(match[1]);
            const combinations = productDataJson.combinations || [];

            if (combinations.length > 0) {
              // Extract price (only if not already found from meta tag)
              if (productData.competitor_price === null) {
                const price = combinations[0].price; // Use regular price, not campaign price
                if (price !== undefined) {
                  const parsedPrice = parseFloat(String(price));
                  if (!isNaN(parsedPrice) && parsedPrice > 0) {
                    productData.raw_price = String(price);
                    productData.competitor_price = parsedPrice;
                    logProgress(`Extracted fallback price ${productData.competitor_price} from JavaScript for ${url}`);
                  } else {
                    logProgress(`Invalid price in JavaScript data: "${price}" for ${url}`);
                  }
                }
              }

              // Extract SKU (article number) only if not already found from HTML
              if (!productData.sku && combinations[0].articleNumber) {
                productData.sku = combinations[0].articleNumber;
                logProgress(`Extracted fallback SKU ${productData.sku} from JavaScript for ${url}`);
              }
            }
          } catch (error) {
            logError('Error parsing productData JSON', error);
          }
        }
      }
    }

    // --- 3. Extract SKU from HTML element with itemprop="sku" ---
    const skuElement = $('span[itemprop="sku"]');
    if (skuElement.length > 0) {
      const skuText = skuElement.text().trim();
      if (skuText) {
        productData.sku = skuText;
        logProgress(`Extracted SKU ${productData.sku} from HTML element for ${url}`);
      }
    }

    // --- 3b. Extract SKU from dataLayer if not found in HTML ---
    if (!productData.sku) {
      const scriptTags = $('script').toArray();
      for (const scriptTag of scriptTags) {
        const scriptContent = $(scriptTag).html() || '';

        // Look for dataLayer.push with item_id or ecomm_prodid
        const dataLayerMatch = /dataLayer\.push\(\{.*?"(?:item_id|ecomm_prodid)":"([^"]+)".*?\}\)/s.exec(scriptContent);
        if (dataLayerMatch && dataLayerMatch[1]) {
          productData.sku = dataLayerMatch[1];
          logProgress(`Extracted SKU ${productData.sku} from dataLayer for ${url}`);
          break;
        }
      }
    }

    // --- 4. Extract EAN and manufacturer from meta tags ---
    const produktdata = $('#produktdata');
    if (produktdata.length > 0) {
      // Extract EAN with validation
      const eanMeta = produktdata.find('meta[itemprop="gtin13"]');
      if (eanMeta.length > 0) {
        const rawEan = eanMeta.attr('content');
        productData.ean = sanitizeEAN(rawEan);

        // Log EAN validation results for debugging
        if (rawEan && !productData.ean) {
          logProgress(`Invalid EAN code rejected: "${rawEan}" for ${url}`);
        } else if (productData.ean) {
          logProgress(`Valid EAN code extracted: "${productData.ean}" for ${url}`);
        }
      }

      // Extract brand/manufacturer
      const brandMeta = produktdata.find('meta[itemprop="brand"]');
      if (brandMeta.length > 0) {
        productData.brand = brandMeta.attr('content') || null;
      }
    }

    // --- 5. Check if product is buyable (has add to cart button) ---
    const addToCartArea = $(CONFIG.PRODUCT_EXTRACTION.SELECTORS.ADD_TO_CART);
    if (addToCartArea.length > 0) {
      // Check if the add to cart area has the "is-hidden" class
      const isHidden = addToCartArea.hasClass('is-hidden');
      if (isHidden) {
        // Product is not buyable
        productData.is_available = false;
        logProgress(`Product ${url} is not buyable (add to cart button is hidden)`);
      }
    }

    // --- 6. Extract stock status ---
    const stockDiv = $('.product-stock');
    if (stockDiv.length > 0) {
      const activeStock = stockDiv.find('.active-product-stock-item');
      if (activeStock.length > 0) {
        const stockText = activeStock.find('.product-stock-item__text').text().trim();
        productData.stock_status = stockText;

        // Determine availability based on stock text
        const outOfStockTexts = CONFIG.PRODUCT_EXTRACTION.SELECTORS.AVAILABILITY.OUT_OF_STOCK_TEXT;
        const isOutOfStock = outOfStockTexts.some(text =>
          stockText.toLowerCase().includes(text.toLowerCase())
        );

        // Only update availability if it's not already set to false by the add to cart check
        if (isOutOfStock && productData.is_available !== false) {
          productData.is_available = false;
          logProgress(`Product ${url} is not available based on stock text: "${stockText}"`);
        }
      }
    }

    // --- 7. Extract product name if not already found ---
    if (!productData.name) {
      const nameEl = $('h1.product-title');
      if (nameEl.length > 0) {
        productData.name = nameEl.text().trim();
      }
    }

    // --- 8. Extract image URL from JavaScript productData variable ---
    if (!productData.image_url) {
      // Try to extract image from JavaScript productData variable
      const scriptTags = $('script').toArray();
      for (const scriptTag of scriptTags) {
        const scriptContent = $(scriptTag).html() || '';

        // Look for the productData variable in the script
        const match = /var\s+productData\s*=\s*(\{.*?\});/s.exec(scriptContent);
        if (match && match[1]) {
          try {
            const productDataJson = JSON.parse(match[1]);

            // Extract image from combinations (most reliable source)
            if (productDataJson.combinations && Array.isArray(productDataJson.combinations)) {
              const combinations = productDataJson.combinations;

              // Get the first combination's images array
              if (combinations.length > 0 && combinations[0].images && Array.isArray(combinations[0].images)) {
                const images = combinations[0].images;

                // Get the first image's filename
                if (images.length > 0 && images[0].filename) {
                  const filename = images[0].filename;

                  // Filter out placeholder images from /images/list/ directory
                  if (!filename.includes('/images/list/')) {
                    // Construct full image URL - Lampan uses /images/normal/ for product images
                    const imageUrl = `/images/normal/${filename}`;

                    try {
                      // Convert relative URL to absolute URL
                      productData.image_url = new URL(imageUrl, CONFIG.SITE.BASE_URL).toString();
                      logProgress(`Extracted image URL from productData.combinations[0].images[0]: ${productData.image_url} for ${url}`);
                      break; // Found image, exit loop
                    } catch (error) {
                      // If URL construction fails, use the original src
                      productData.image_url = imageUrl.startsWith('http') ? imageUrl : `${CONFIG.SITE.BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                      break;
                    }
                  }
                }
              }
            }

            // Fallback: try to get image from productData.image
            if (!productData.image_url && productDataJson.image) {
              const imageUrl = productDataJson.image;
              if (!imageUrl.includes('/images/list/')) {
                try {
                  productData.image_url = new URL(imageUrl, CONFIG.SITE.BASE_URL).toString();
                  logProgress(`Extracted image URL from productData.image: ${productData.image_url} for ${url}`);
                  break;
                } catch (error) {
                  productData.image_url = imageUrl.startsWith('http') ? imageUrl : `${CONFIG.SITE.BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                  break;
                }
              }
            }
          } catch (error) {
            logError('Error parsing productData JSON for image', error);
          }
        }
      }
    }

    // Fallback: Extract image URL from HTML if not found in JavaScript
    if (!productData.image_url) {
      // Try product carousel
      const carouselImg = $('.product-carousel__img').first();
      if (carouselImg.length > 0) {
        const imgSrc = carouselImg.attr('src');
        if (imgSrc && !imgSrc.includes('/images/list/')) {
          try {
            productData.image_url = new URL(imgSrc, CONFIG.SITE.BASE_URL).toString();
            logProgress(`Extracted image URL from carousel: ${productData.image_url} for ${url}`);
          } catch (error) {
            productData.image_url = imgSrc.startsWith('http') ? imgSrc : `${CONFIG.SITE.BASE_URL}${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
          }
        }
      }
    }

    // Final fallback to other image elements
    if (!productData.image_url) {
      const imgEl = $('.product-image img').first();
      if (imgEl.length > 0) {
        const imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
        if (imgSrc && !imgSrc.includes('/images/list/')) {
          try {
            productData.image_url = new URL(imgSrc, CONFIG.SITE.BASE_URL).toString();
            logProgress(`Extracted image URL from product-image: ${productData.image_url} for ${url}`);
          } catch (error) {
            productData.image_url = imgSrc.startsWith('http') ? imgSrc : `${CONFIG.SITE.BASE_URL}${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
          }
        }
      }
    }

    // Log warning if we still don't have an image URL
    if (!productData.image_url) {
      logProgress(`WARNING: No valid image URL found for ${url} (placeholder filtered out)`);
    }

    // --- 9. Extract custom fields from Fakta table ---
    const customFields = extractLampanFaktaFields($);
    if (Object.keys(customFields).length > 0) {
      productData.raw_data = customFields;
      logProgress(`Extracted ${Object.keys(customFields).length} custom fields from Fakta table for ${url}`);
    }

    // --- 10. Extract stock data ---
    const stockData = extractStockData($, url, productData.sku || undefined);
    if (stockData) {
      productData.stock_data = stockData;

      // For backward compatibility, also set the old stock_status field
      if (stockData.status) {
        productData.stock_status = stockData.status;
      }

      logProgress(`Extracted stock data for ${url}: quantity=${stockData.quantity}, status="${stockData.status}"`);
    }

    // Validate the extracted data - name and price are required
    if (!productData.name) {
      return null;
    }

    // Ensure we have a valid price (prevents database constraint violations)
    if (productData.competitor_price === null || productData.competitor_price === undefined || isNaN(productData.competitor_price)) {
      logProgress(`Skipping product ${url} due to invalid price: ${productData.competitor_price}`);
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
function productPassesFilters(product: ScrapedProductData): boolean {
  // Always skip products that are not available for purchase
  if (product.is_available === false) {
    logProgress(`Skipping product ${product.competitor_url} because it is not available for purchase`);
    return false;
  }

  // Always skip products without a valid price (prevents database constraint violations)
  if (product.competitor_price === null || product.competitor_price === undefined) {
    logProgress(`Skipping product ${product.competitor_url} because it has no valid price`);
    return false;
  }

  // Skip filtering if not enabled
  if (!CONFIG.FILTERING.ENABLED) {
    return true;
  }

  // Filter by brand
  if (CONFIG.FILTERING.BY_BRAND.ENABLED &&
      CONFIG.FILTERING.BY_BRAND.BRANDS.length > 0 &&
      product.brand) {

    const brandMatches = CONFIG.FILTERING.BY_BRAND.BRANDS.some(
      activeBrand => product.brand?.toLowerCase().includes(activeBrand.toLowerCase()) || false
    );

    if (!brandMatches) {
      return false;
    }
  }

  // Filter by own products
  if (CONFIG.FILTERING.BY_OWN_PRODUCTS.ENABLED) {
    // Check if product matches by EAN
    const eanMatch = product.ean &&
                     CONFIG.FILTERING.BY_OWN_PRODUCTS.EANS.length > 0 &&
                     CONFIG.FILTERING.BY_OWN_PRODUCTS.EANS.includes(product.ean);

    // Check if product matches by SKU+Brand
    const skuBrandMatch = product.sku &&
                          product.brand &&
                          CONFIG.FILTERING.BY_OWN_PRODUCTS.SKU_BRANDS.length > 0 &&
                          CONFIG.FILTERING.BY_OWN_PRODUCTS.SKU_BRANDS.some(item =>
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
// ---- STEP 2: PRODUCT SCRAPING ------ //
// ------------------------------------ //

/**
 * STEP 2: Scrape product data from URLs with database batching
 */
async function scrapeProductData(productUrls: string[], context: ScriptContext): Promise<void> {
  logProgress(`STEP 2: Starting product data extraction for ${productUrls.length} URLs`, 2);

  // Track progress
  let processedCount = 0;
  let batchCount = 0;
  const totalUrls = productUrls.length;
  const batchSize = CONFIG.PERFORMANCE.BATCH_SIZE;

  // Track products for batch processing
  const processedProducts: ScrapedProductData[] = [];

  // Progress will be reported every 10 products processed (see event-based reporting below)

  // Calculate optimal concurrency based on system resources
  const optimalConcurrency = Math.min(
    Math.max(2, os.cpus().length * 2), // 2 concurrent requests per CPU core, minimum 2
    CONFIG.PERFORMANCE.MAX_CONCURRENCY // But never exceed the configured maximum
  );

  logProgress(`Using concurrency: ${optimalConcurrency} concurrent requests`, 2);

  // Initialize a request queue for product extraction
  const requestQueue = await RequestQueue.open();

  // Add all product URLs to the queue
  for (const url of productUrls) {
    await requestQueue.addRequest({
      url,
      userData: { label: 'PRODUCT' }
    });
  }

  // Configure crawler for product page scraping
  const crawler = new CheerioCrawler({
    requestQueue,
    maxConcurrency: optimalConcurrency,
    requestHandlerTimeoutSecs: CONFIG.PERFORMANCE.REQUEST_TIMEOUT,
    maxRequestRetries: CONFIG.PERFORMANCE.MAX_RETRIES,

    // Use session pool for better handling of rate limiting
    useSessionPool: true,
    sessionPoolOptions: {
      maxPoolSize: 20, // Back to original
      sessionOptions: {
        maxUsageCount: 50, // Back to original
      },
    },

    // Implement rate limiting
    maxRequestsPerMinute: CONFIG.PERFORMANCE.MAX_REQUESTS_PER_MINUTE,

    // Main request handler
    requestHandler: async ({ request, $, log }) => {
      const { url } = request;

      try {
        // Extract product data
        const productData = await extractProductData($, url);

        if (productData) {
          // Apply filtering
          if (productPassesFilters(productData)) {
            processedProducts.push(productData);

            // Increment processed count for progress reporting
            processedCount++;

            // Check if we've reached the batch size for database writing
            if (processedProducts.length >= batchSize) {
              // Write the batch to stdout (which will be captured by PriceTracker)
              logProgress(`Writing batch ${++batchCount} with ${processedProducts.length} products to database`, 2);

              // Output each product in the batch
              for (const product of processedProducts) {
                console.log(JSON.stringify(product));
              }

              // Clear the batch to prevent memory buildup
              processedProducts.length = 0;
            }

            // Report progress every 50 products for cleaner output
            if (processedCount % 50 === 0) {
              logProgress(`Products processed: ${processedCount}/${totalUrls}`, 2);
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
    // Process any remaining products in the batch
    if (processedProducts.length > 0) {
      logProgress(`Writing final batch with ${processedProducts.length} products to database`, 2);

      // Output each remaining product
      for (const product of processedProducts) {
        console.log(JSON.stringify(product));
      }

      // Clear the batch
      processedProducts.length = 0;
      batchCount++;
    }
  }

  logProgress(`STEP 2 complete: Processed ${processedCount} products in ${batchCount} batches`, 2);
}

// ------------------------------------ //
// ------- MAIN SCRAPE FUNCTION ------- //
// ------------------------------------ //

/**
 * Main scraping function with 2-step process and database batching
 */
async function scrape(context: ScriptContext): Promise<void> {
  // Configure Crawlee storage first
  try {
    configureCrawleeStorage();
  } catch (configError) {
    console.error("CRITICAL ERROR: Crawlee storage configuration failed. Exiting.");
    throw new Error("Crawlee storage configuration failed");
  }

  logProgress("Lampan.se scraper started with 2-step process");

  // Extract context variables
  const isTestRun = context.isTestRun ?? false;
  const isValidation = context.isValidation ?? false;
  const filterByActiveBrands = context.filterByActiveBrands ?? false;
  const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;

  // Update the filtering configuration from context
  const filteringEnabled = filterByActiveBrands || scrapeOnlyOwnProducts;

  // Update CONFIG.FILTERING based on context
  CONFIG.FILTERING.ENABLED = filteringEnabled;

  if (filterByActiveBrands && context.activeBrandNames) {
    CONFIG.FILTERING.BY_BRAND.ENABLED = true;
    CONFIG.FILTERING.BY_BRAND.BRANDS = context.activeBrandNames;
  }

  if (scrapeOnlyOwnProducts) {
    CONFIG.FILTERING.BY_OWN_PRODUCTS.ENABLED = true;
    if (context.ownProductEans) {
      CONFIG.FILTERING.BY_OWN_PRODUCTS.EANS = context.ownProductEans;
    }
    if (context.ownProductSkuBrands) {
      CONFIG.FILTERING.BY_OWN_PRODUCTS.SKU_BRANDS = context.ownProductSkuBrands;
    }
  }

  logProgress(`Context: isTestRun=${isTestRun}, isValidation=${isValidation}, filteringEnabled=${filteringEnabled}`);

  try {
    // ===== STEP 1: URL DISCOVERY =====
    logProgress('STEP 1: Starting URL discovery phase', 1);
    const productUrls = await discoverProductUrls(isTestRun || isValidation);

    if (productUrls.length === 0) {
      logProgress('No product URLs found. Exiting.', 1);
      return;
    }

    logProgress(`STEP 1 complete: Discovered ${productUrls.length} product URLs`, 1);

    // ===== STEP 2: PRODUCT SCRAPING =====
    await scrapeProductData(productUrls, context);

    logProgress("Scraping completed successfully");

  } catch (error) {
    logError("Error in scraping process", error);
    throw error;
  }
}

// ------------------------------------ //
// --------- MAIN EXECUTION ----------- //
// ------------------------------------ //

// Process command line arguments
const argv = yargs(hideBin(process.argv))
  .command('metadata', 'Output scraper metadata as JSON')
  .command('scrape', 'Run the scraper', (yargs: any) => {
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
      throw e;
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
      throw e;
    }
  }
})().catch(e => {
  logError('Unhandled top-level error', e);
  throw e; // This will cause the process to exit with a non-zero code
});
