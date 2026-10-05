/**
 * PriceTracker - Stockholms Ljusbutik Product Scraper
 *
 * This scraper is specifically designed for ljusbutik.se to collect product data
 * including handling product variants that share the same URL.
 *
 * STOCK TRACKING UPDATE (2025-06-27):
 * - Added stock status extraction from .stockInfo > .stock elements
 * - Handles Swedish stock status text like "Finns i lager", "Finns i lager (Fåtal kvar)", and "Beställningsvara. Leveranstid c:a 7-10 arbetsdagar"
 * - Stock data is stored in temp_competitors_scraped_data for processing by database functions
 *
 * Version 1.2.0 - Fixed stock data format to match worker expectations
 */

// ------------------------------------ //
// ------- CONFIGURATION SECTION ------ //
// ------------------------------------ //

const CONFIG = {
  // Site information
  SITE: {
    NAME: "Stockholms Ljusbutik",
    BASE_URL: "https://www.ljusbutik.se",
    LANGUAGE: "sv",
  },

  // Collection strategy configuration
  COLLECTION_STRATEGY: {
    TYPE: "scraping", // Using web scraping approach

    // Scraping settings
    SCRAPING: {
      // URL discovery method
      URL_DISCOVERY: {
        METHOD: "sitemap", // Using sitemap discovery

        // Sitemap settings
        SITEMAP: {
          INDEX_URL: "https://www.ljusbutik.se/sv/sitemap-articles-1.xml",
          PRODUCT_SITEMAP_FILTER: "sitemap-articles", // Products are in articles sitemaps
          PRODUCT_URL_FILTER: "/articles/", // All product URLs contain /articles/
        },
      },
    }
  },

  // Product data extraction settings
  PRODUCT_EXTRACTION: {
    // CSS selectors for extracting product data
    SELECTORS: {
      NAME: "h1.product-header__title",
      PRICE: 'div.priceWrap > span[itemprop="offers"] > span[itemprop="price"]',
      CURRENCY: ".product-price__currency",
      SKU: "td:contains('Leverantörens artikelnummer') + td",
      BRAND: "td:contains('Varumärke') + td a",
      EAN: "td:contains('EAN-kod') + td",
      IMAGE_URL: ".product-image__main img",
      DESCRIPTION: ".description[itemprop='description']",
      AVAILABILITY: {
        SELECTOR: ".product-availability__status",
        IN_STOCK_TEXT: ["I lager", "Finns i butik", "Leveranstid"],
        OUT_OF_STOCK_TEXT: ["Slut i lager", "Ej i lager", "Utgått", "Slutsåld"],
      },
      // Special selectors for variants
      VARIANT_CONTAINER: ".product-variants, .variant-selector, select[name*='variant']",
      VARIANT_OPTIONS: ".variant-option, option[value]",
      ACTIVE_VARIANT: ".variant-option--active, option:selected",
      // Table selectors for specifications
      SPEC_TABLE: "table.attributes",
      ARTICLE_NUMBER: "td:contains('Artikelnummer') + td",
    },

    // JSON-LD schema.org extraction settings
    SCHEMA_ORG: {
      ENABLED: false, // Enable schema.org extraction
      SCRIPT_SELECTOR: "script[type='application/ld+json']"
    },

    // Microdata extraction settings
    MICRODATA: {
      ENABLED: false, // Enable microdata extraction
    }
  },

  // Performance settings
  PERFORMANCE: {
    MAX_CONCURRENCY: 10, // Conservative concurrency for site stability
    BATCH_SIZE: 100, // Smaller batches for variant handling
    REQUEST_TIMEOUT: 30, // 30 seconds timeout
    MAX_RETRIES: 3,
    REQUEST_DELAY: 100, // 100ms delay between requests
    MAX_REQUESTS_PER_MINUTE: 2000, // Conservative rate limiting
  },

  // Filtering settings
  FILTERING: {
    ENABLED: false,
    BY_BRAND: {
      ENABLED: false,
      BRANDS: [] as string[]
    },
    BY_OWN_PRODUCTS: {
      ENABLED: false,
      EANS: [] as string[],
      SKU_BRANDS: [] as { sku: string; brand: string }[]
    }
  },

  // Testing/validation settings
  TEST_SETTINGS: {
    TEST_MODE_LIMIT: 20,
    VALIDATION_MODE_LIMIT: 20
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
  total_stock: number | null;
  combinations_stock: Array<{
    article_number: string;
    stock: number;
    price: number;
    campaign_price?: number;
    stock_type: number;
    empty_stock_text?: string;
  }> | null;
  raw_data: Record<string, any> | null;
}

interface ScrapedProductData {
  name: string;
  competitor_price: number | null; // Updated field name to match temp_competitors_scraped_data table
  currency_code: string | null; // Updated field name to match temp_competitors_scraped_data table, allow null for database default
  competitor_url: string; // Updated field name to match temp_competitors_scraped_data table
  sku: string | null;
  brand: string | null;
  ean: string | null;
  image_url: string | null;
  is_available: boolean;
  description?: string | null;
  raw_price?: string | null;
  variant_info?: string | null; // Added for variant tracking
  stock_quantity?: number | null; // Stock quantity for temp_competitors_scraped_data
  stock_status?: string | null; // Stock status for temp_competitors_scraped_data
  availability_date?: Date | null; // Availability date for temp_competitors_scraped_data
  raw_stock_data?: Record<string, any> | null; // Raw stock data for debugging
  stock_data?: StockData | null; // New structured stock data to match worker expectations
  raw_data?: Record<string, string | number | boolean | null> | null; // Custom fields data - specifications from attributes table
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
// ------ METADATA FUNCTION ----------- //
// ------------------------------------ //

function getMetadata(): ScriptMetadata {
  const metadata: ScriptMetadata = {
    name: `${CONFIG.SITE.NAME} Product Scraper`,
    version: "1.0.0",
    description: `Product data collector for ${CONFIG.SITE.NAME} with variant handling support`,
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
    const memoryConfig = new Configuration({
      persistStorage: false,
    });

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
      // For 404 errors, just return empty array without logging error (expected when discovering sitemap count)
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xmlContent = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
    });

    const result = parser.parse(xmlContent);
    const urlElements = result.urlset?.url || [];

    const urls = Array.isArray(urlElements)
      ? urlElements.map((item: any) => {
          return typeof item === 'object' && item.loc ? item.loc : '';
        }).filter(url => url.includes(CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_URL_FILTER))
      : [];

    logProgress(`Found ${urls.length} product URLs in sitemap`);
    return urls;
  } catch (error) {
    // Only log non-404 errors to avoid stderr pollution
    if (error instanceof Error && !error.message.includes('404')) {
      logError(`Error fetching sitemap ${sitemapUrl}`, error);
    }
    return [];
  }
}

/**
 * Discovers product URLs from Stockholms Ljusbutik's sitemap structure
 */
async function discoverProductUrlsFromSitemap(isTestRun: boolean): Promise<string[]> {
  logProgress('Fetching product URLs from sitemap', 1);

  try {
    // For Stockholms Ljusbutik, the products are directly in the sitemap-articles files
    // We need to check if there are multiple sitemap files (sitemap-articles-1.xml, sitemap-articles-2.xml, etc.)
    const allUrls: string[] = [];
    let sitemapIndex = 1;
    let foundUrls = true;

    while (foundUrls) {
      const sitemapUrl = `https://www.ljusbutik.se/sv/sitemap-articles-${sitemapIndex}.xml`;
      
      try {
        const urls = await fetchSitemapUrls(sitemapUrl);
        if (urls.length > 0) {
          allUrls.push(...urls);
          logProgress(`Found ${urls.length} URLs in sitemap-articles-${sitemapIndex}.xml`, 1);
          sitemapIndex++;
        } else {
          foundUrls = false;
        }
      } catch (error) {
        // No more sitemaps found
        foundUrls = false;
      }

      // For test runs, limit the number of sitemaps to process
      if (isTestRun && sitemapIndex > 2) {
        break;
      }
    }

    logProgress(`Total product URLs discovered: ${allUrls.length}`, 1);
    return allUrls;
  } catch (error) {
    logError(`Error discovering product URLs from sitemap`, error);
    return [];
  }
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
    default:
      logError(`Unknown URL discovery method: ${method}`);
      break;
  }

  if (isTestRun && productUrls.length > 0) {
    const testLimit = CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT;
    logProgress(`Test mode: selecting ${testLimit} random URLs`, 1);

    const shuffledUrls = [...productUrls].sort(() => Math.random() - 0.5);
    return shuffledUrls.slice(0, testLimit);
  }

  return productUrls;
}

// ------------------------------------ //
// ---- CUSTOM FIELDS EXTRACTION ------ //
// ------------------------------------ //

/**
 * Extract custom fields from Ljusbutik's attributes table
 * This extracts all the product specifications from the attributes table
 */
function extractLjusbutikAttributeFields($: any): Record<string, string | number | boolean | null> {
  const customFields: Record<string, string | number | boolean | null> = {};

  try {
    // Look for the attributes table
    const attributeTable = $('table.attributes');

    if (attributeTable.length === 0) {
      return customFields;
    }

    const rows = attributeTable.find('tr');

    rows.each((_index: number, row: any) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length === 2) {
        // Extract title text but exclude popup content and info icons
        const titleCell = $(cells[0]);

        // Clone the cell and remove popup elements and info icons
        const titleCellClone = titleCell.clone();
        titleCellClone.find('a.lightbox, .fa, div[style*="display:none"], div[id*="_popup"]').remove();

        const title = titleCellClone.text().trim();
        const value = $(cells[1]).text().trim();

        // Skip empty values
        if (!title || !value) {
          return;
        }

        // Skip fields we already extract as main fields
        if (title === 'EAN-kod' || title === 'Leverantörens artikelnummer' || title === 'Varumärke' || title === 'Artikelnummer') {
          return;
        }

        // Clean up the key - remove colons, convert to snake_case
        let key = title
          .replace(/[:\s]+$/, '') // Remove trailing colons and spaces
          .toLowerCase()
          .replace(/[^a-z0-9åäöÅÄÖ]+/g, '_') // Replace non-alphanumeric with underscores (including Swedish chars)
          .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
          .replace(/_+/g, '_'); // Replace multiple underscores with single

        // Try to convert value to appropriate type
        let processedValue: string | number | boolean | null = value;

        // Check for boolean values (Swedish)
        if (value.toLowerCase() === 'ja' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'true') {
          processedValue = true;
        } else if (value.toLowerCase() === 'nej' || value.toLowerCase() === 'no' || value.toLowerCase() === 'false') {
          processedValue = false;
        } else {
          // Try to parse as number for measurements (but keep original if it contains units)
          const numericMatch = value.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZåäöÅÄÖ%]*)\s*$/);
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
      }
    });

  } catch (error) {
    logError('Error extracting attribute fields', error);
  }

  return customFields;
}

// ------------------------------------ //
// ---- PRODUCT DATA EXTRACTION ------- //
// ------------------------------------ //

/**
 * Extracts product variants if they exist on the page
 * For ljusbutik.se, variants are typically color/finish options
 */
async function extractProductVariants($: any, baseProductData: ScrapedProductData): Promise<ScrapedProductData[]> {
  const products: ScrapedProductData[] = [];
  
  try {
    // Check for variant dropdowns (common pattern on ljusbutik.se)
    const variantSelect = $('select[name*="variant"], select.variant-selector, select#variant');
    
    if (variantSelect.length > 0) {
      // Extract variants from dropdown options
      const options = variantSelect.find('option');
      
      if (options.length > 1) { // More than one option means variants exist
        options.each((_i: number, elem: any) => {
          const optionEl = $(elem);
          const variantValue = optionEl.val();
          
          // Skip empty or placeholder options
          if (!variantValue || variantValue === '' || variantValue === '0') {
            return;
          }
          
          const variantText = optionEl.text().trim();
          
          // Create a new product entry for this variant
          const variantProduct: ScrapedProductData = {
            ...baseProductData,
            variant_info: variantText
          };
          
          // Try to extract variant-specific data from the option text
          // Some sites include price or SKU info in the option text
          const priceMatch = variantText.match(/(\d+[\s,.]?\d*)\s*kr/i);
          if (priceMatch) {
            const cleanedPrice = priceMatch[1].replace(/\s/g, '').replace(',', '.');
            const price = parseFloat(cleanedPrice);
            if (!isNaN(price)) {
              variantProduct.competitor_price = price;
              variantProduct.raw_price = priceMatch[0];
            }
          }
          
          // Look for SKU patterns in variant text
          const skuMatch = variantText.match(/\(([A-Z0-9\-]+)\)/);
          if (skuMatch) {
            variantProduct.sku = skuMatch[1];
          }
          
          // Update the name to include variant info
          if (variantText && !variantText.includes(baseProductData.name)) {
            variantProduct.name = `${baseProductData.name} - ${variantText}`;
          }
          
          products.push(variantProduct);
        });
      } else {
        // Only one option or no variants found
        products.push(baseProductData);
      }
    } else {
      // Check for other variant patterns (e.g., color swatches, radio buttons)
      const variantButtons = $('.variant-option, .color-option, input[type="radio"][name*="variant"]');
      
      if (variantButtons.length > 0) {
        variantButtons.each((_i: number, elem: any) => {
          const buttonEl = $(elem);
          let variantName = '';
          let variantSku = '';
          
          // Extract variant info based on element type
          if (buttonEl.is('input')) {
            variantName = buttonEl.attr('data-variant-name') || buttonEl.next('label').text().trim();
            variantSku = buttonEl.attr('data-sku') || '';
          } else {
            variantName = buttonEl.text().trim() || buttonEl.attr('title') || '';
            variantSku = buttonEl.attr('data-sku') || '';
          }
          
          if (variantName) {
            const variantProduct: ScrapedProductData = {
              ...baseProductData,
              variant_info: variantName,
              name: `${baseProductData.name} - ${variantName}`
            };
            
            if (variantSku) {
              variantProduct.sku = variantSku;
            }
            
            products.push(variantProduct);
          }
        });
      } else {
        // No variants found, return base product
        products.push(baseProductData);
      }
    }
    
    // If no products were added, return the base product
    if (products.length === 0) {
      products.push(baseProductData);
    }
    
  } catch (error) {
    logError('Error extracting variants, returning base product', error);
    products.push(baseProductData);
  }

  return products;
}

// ------------------------------------ //
// ------ STOCK DATA EXTRACTION ------- //
// ------------------------------------ //

/**
 * Extract stock data from Ljusbutik product pages
 * Handles stock status text from .stockInfo > .stock elements
 */
function extractStockData($: any, url: string): StockData | null {
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

    // --- Extract stock status from Ljusbutik's stock display ---
    // Look for stock information in .stockInfo > .stock elements
    const stockInfoDiv = $('.stockInfo');
    if (stockInfoDiv.length > 0) {
      const stockElement = stockInfoDiv.find('.stock');
      if (stockElement.length > 0) {
        const stockText = stockElement.text().trim();
        if (stockText) {
          stockData.status = stockText;
          rawStockInfo.status_source = '.stockInfo > .stock';
          rawStockInfo.original_status = stockText;
          rawStockInfo.stock_element_classes = stockElement.attr('class');
        }
      }
    }

    // Fallback: look for other stock status indicators
    if (!stockData.status) {
      const statusSelectors = [
        '.stock-status',
        '.availability-status',
        '.product-availability',
        '.stock-info',
        '.stock'
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

    // --- Store all raw data for debugging and future improvements ---
    // Collect all stock-related text for analysis
    rawStockInfo.all_stock_text = {
      stockInfo_div: $('.stockInfo').text().trim(),
      stock_elements: $('.stock, .inventory, .availability').map((_: number, el: any) => $(el).text().trim()).get(),
      delivery_info: $('.delivery-info, .shipping-info').text().trim()
    };

    // Only set raw_data if we found any stock information
    if (Object.keys(rawStockInfo).length > 0) {
      stockData.raw_data = rawStockInfo;
    }

    // Log what we found for debugging
    if (stockData.status !== null) {
      logProgress(`Extracted stock data for ${url}: status="${stockData.status}"`);
    }

    return stockData;
  } catch (error) {
    logError(`Error extracting stock data from ${url}`, error);
    return null;
  }
}

/**
 * Helper function to extract product data from Stockholms Ljusbutik
 */
async function extractProductData($: any, url: string): Promise<ScrapedProductData[] | null> {
  try {
    // First check if product is discontinued (Slutsåld)
    const stockInfo = $('.stockInfo .stock, .stock-info, .availability-info');
    if (stockInfo.length > 0) {
      const stockText = stockInfo.text().toLowerCase();
      if (stockText.includes('slutsåld')) {
        logProgress(`Skipping discontinued product: ${url}`);
        return null; // Skip this product entirely
      }
    }
    // Initialize base product data
    const baseProductData: ScrapedProductData = {
      name: '',
      competitor_price: null,
      currency_code: null, // Let database set user's primary currency
      competitor_url: url, // Updated field name to match temp_competitors_scraped_data table
      sku: null,
      brand: null,
      ean: null,
      image_url: null,
      is_available: true,
      description: null,
      raw_price: null,
      stock_quantity: null,
      stock_status: null,
      availability_date: null,
      raw_stock_data: null,
      stock_data: null,
      raw_data: null
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
                  if (!baseProductData.name && product.name) {
                    baseProductData.name = product.name.toString();
                  }

                  if (baseProductData.competitor_price === null && product.offers && product.offers.price) {
                    const priceStr = String(product.offers.price);
                    baseProductData.raw_price = priceStr;
                    baseProductData.competitor_price = parseFloat(priceStr);
                    if (product.offers.priceCurrency) {
                      baseProductData.currency_code = product.offers.priceCurrency;
                    }
                  }

                  if (baseProductData.sku === null && product.sku) {
                    baseProductData.sku = product.sku.toString();
                  }

                  if (baseProductData.brand === null && product.brand && product.brand.name) {
                    baseProductData.brand = product.brand.name.toString();
                  }

                  if (baseProductData.image_url === null && product.image) {
                    if (Array.isArray(product.image) && product.image.length > 0) {
                      baseProductData.image_url = product.image[0].toString();
                    } else if (typeof product.image === 'string') {
                      baseProductData.image_url = product.image;
                    }
                  }

                  if (baseProductData.ean === null && product.gtin13) {
                    baseProductData.ean = product.gtin13.toString();
                  }

                  if (baseProductData.description === null && product.description) {
                    baseProductData.description = product.description;
                  }

                  if (product.offers && product.offers.availability) {
                    const availability = product.offers.availability.toString();
                    baseProductData.is_available = availability.includes('InStock');
                  }
                }
              }
            }
          } catch (_e) {
            // Continue to CSS selector extraction
          }
        });
      }
    }

    // --- 2. Extract using CSS selectors for any missing data ---

    // Extract Name - Look for common patterns in Swedish lighting sites
    if (!baseProductData.name) {
      // Try multiple possible selectors
      const nameSelectors = [
        'h1.product-title',
        'h1.product-name',
        '.product-header h1',
        'h1[itemprop="name"]',
        '.product-info h1',
        'h1'
      ];
      
      for (const selector of nameSelectors) {
        const nameEl = $(selector);
        if (nameEl.length > 0) {
          const text = nameEl.first().text().trim();
          if (text && text.length > 0) {
            baseProductData.name = text;
            break;
          }
        }
      }
    }

    // Extract Price - Handle Swedish price formats
    if (baseProductData.competitor_price === null) {
      // Use the specific selector for ljusbutik.se price structure
      const priceEl = $('div.priceWrap > span[itemprop="offers"] > span[itemprop="price"]');
      if (priceEl.length > 0) {
        const priceContent = priceEl.attr('content');
        if (priceContent) {
          baseProductData.competitor_price = parseFloat(priceContent);
          baseProductData.raw_price = priceEl.text().trim();
        }
      }
    }

    // Extract SKU/Article number from table structure
    if (baseProductData.sku === null) {
      // Try the table-based selector first (most accurate for this site)
      const skuRow = $('td:contains("Leverantörens artikelnummer")').parent();
      if (skuRow.length > 0) {
        const skuCell = skuRow.find('td').eq(1); // Second td in the row
        if (skuCell.length > 0) {
          const skuText = skuCell.text().trim();
          if (skuText && skuText.length > 0) {
            baseProductData.sku = skuText;
          }
        }
      }
      
      // Fallback to other selectors if table method fails
      if (!baseProductData.sku) {
        const skuSelectors = [
          '.product-sku',
          '.sku',
          '[itemprop="sku"]',
          '.art-nr',
          '.article-number'
        ];
        
        for (const selector of skuSelectors) {
          const skuEl = $(selector);
          if (skuEl.length > 0) {
            let skuText = skuEl.text().trim();
            skuText = skuText.replace(/^(Artikelnr|Art\.nr|SKU):?\s*/i, '').trim();
            if (skuText && skuText.length > 0) {
              baseProductData.sku = skuText;
              break;
            }
          }
        }
      }
    }

    // Extract Brand from table structure
    if (baseProductData.brand === null) {
      // Try the table-based selector first
      const brandRow = $('td:contains("Varumärke")').parent();
      if (brandRow.length > 0) {
        const brandCell = brandRow.find('td').eq(1); // Second td in the row
        const brandLink = brandCell.find('a');
        if (brandLink.length > 0) {
          baseProductData.brand = brandLink.text().trim();
        } else if (brandCell.length > 0) {
          baseProductData.brand = brandCell.text().trim();
        }
      }
      
      // Fallback to other selectors
      if (!baseProductData.brand) {
        const brandSelectors = [
          '.product-brand',
          '.brand',
          '[itemprop="brand"]',
          '.manufacturer',
          'a[href*="/brands/"]',
          '.product-manufacturer'
        ];
        
        for (const selector of brandSelectors) {
          const brandEl = $(selector);
          if (brandEl.length > 0) {
            const brandText = brandEl.first().text().trim();
            if (brandText && brandText.length > 0) {
              baseProductData.brand = brandText;
              break;
            }
          }
        }
      }
    }

    // Extract EAN from table structure
    if (baseProductData.ean === null) {
      // Try the table-based selector first
      const eanRow = $('td:contains("EAN-kod")').parent();
      if (eanRow.length > 0) {
        const eanCell = eanRow.find('td').eq(1); // Second td in the row
        if (eanCell.length > 0) {
          const eanText = eanCell.text().trim();
          const cleanEan = eanText.replace(/[^0-9]/g, '');
          if (cleanEan.length === 13) {
            baseProductData.ean = cleanEan;
          }
        }
      }
    }

    // Extract Image URL
    if (baseProductData.image_url === null) {
      const imgSelectors = [
        '.product-image img',
        '.product-photo img',
        'img[itemprop="image"]',
        '.main-image img',
        '.product-main-image img'
      ];
      
      for (const selector of imgSelectors) {
        const imgEl = $(selector);
        if (imgEl.length > 0) {
          const imgUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
          if (imgUrl) {
            // Make sure URL is absolute
            if (imgUrl.startsWith('//')) {
              baseProductData.image_url = 'https:' + imgUrl;
            } else if (imgUrl.startsWith('/')) {
              baseProductData.image_url = CONFIG.SITE.BASE_URL + imgUrl;
            } else {
              baseProductData.image_url = imgUrl;
            }
            break;
          }
        }
      }
    }

    // Extract Availability
    const availabilitySelectors = [
      '.stockInfo .stock',
      '.availability',
      '.stock-status',
      '.product-availability',
      '[itemprop="availability"]',
      '.in-stock',
      '.product-stock'
    ];
    
    for (const selector of availabilitySelectors) {
      const availEl = $(selector);
      if (availEl.length > 0) {
        const availText = availEl.text().trim().toLowerCase();
        
        const outOfStockTerms = ['slut i lager', 'ej i lager', 'utgått', 'slutsåld', 'tillfälligt slut'];
        const inStockTerms = ['i lager', 'finns i lager', 'leveranstid', 'skickas inom'];
        
        if (outOfStockTerms.some(term => availText.includes(term))) {
          baseProductData.is_available = false;
          break;
        } else if (inStockTerms.some(term => availText.includes(term))) {
          baseProductData.is_available = true;
          break;
        }
      }
    }

    // Extract custom fields from attributes table (specifications)
    const customFields = extractLjusbutikAttributeFields($);
    if (Object.keys(customFields).length > 0) {
      baseProductData.raw_data = customFields;
    }

    // Extract stock data
    const stockData = extractStockData($, url);
    if (stockData) {
      // Set the stock_data object to match worker expectations
      baseProductData.stock_data = {
        quantity: stockData.quantity,
        status: stockData.status,
        availability_date: stockData.availability_date,
        total_stock: null,
        combinations_stock: null,
        raw_data: stockData.raw_data
      };

      // Also set individual fields for backward compatibility
      baseProductData.stock_quantity = stockData.quantity;
      baseProductData.stock_status = stockData.status;
      baseProductData.availability_date = stockData.availability_date;
      baseProductData.raw_stock_data = stockData.raw_data;

      logProgress(`Extracted stock data for ${url}: status="${stockData.status}"`);
    }

    // Validate required fields
    if (!baseProductData.name) {
      return null;
    }

    // Extract variants and return all products
    const products = await extractProductVariants($, baseProductData);
    return products;

  } catch (error) {
    logError(`Error extracting product data from ${url}`, error);
    return null;
  }
}

// ------------------------------------ //
// ------- FILTERING METHODS ---------- //
// ------------------------------------ //

// Match the database identifier rules before emitting rows. Products without
// a usable EAN or brand + supplier SKU are intentionally skipped.
function hasMatchingIdentifiers(product: ScrapedProductData): boolean {
  const ean = (product.ean || '').trim();
  const validEan = /^[0-9]{8,13}$/.test(ean)
    && !(ean.length === 8 && /^(.)\1{7}$/.test(ean))
    && !(ean.length >= 12 && /^(.)\1{11,12}$/.test(ean));
  const brand = (product.brand || '').trim();
  const sku = (product.sku || '').trim();
  return validEan || (!!brand && !!sku && sku !== '-');
}

function productPassesFilters(product: ScrapedProductData, context: ScriptContext): boolean {
  if (!hasMatchingIdentifiers(product)) return false;
  if (!CONFIG.FILTERING.ENABLED) {
    return true;
  }

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

  if (CONFIG.FILTERING.BY_OWN_PRODUCTS.ENABLED && context.scrapeOnlyOwnProducts) {
    const eanMatch = product.ean &&
                     context.ownProductEans &&
                     context.ownProductEans.includes(product.ean);

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

  return true;
}

// ------------------------------------ //
// ------- MAIN SCRAPE FUNCTION ------- //
// ------------------------------------ //

async function scrape(context: ScriptContext): Promise<void> {
  try {
    configureCrawleeStorage();
  } catch (_configError) {
    console.error("CRITICAL ERROR: Crawlee storage configuration failed. Exiting.");
    throw new Error("Crawlee storage configuration failed");
  }

  logProgress("Scrape function started");

  const isTestRun = context.isTestRun ?? false;
  const isValidation = context.isValidation ?? false;
  const filterByActiveBrands = context.filterByActiveBrands ?? false;
  const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;

  CONFIG.FILTERING.ENABLED = filterByActiveBrands || scrapeOnlyOwnProducts;
  CONFIG.FILTERING.BY_BRAND.ENABLED = filterByActiveBrands;
  CONFIG.FILTERING.BY_OWN_PRODUCTS.ENABLED = scrapeOnlyOwnProducts;

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
    let productUrls: string[] = [];

    logProgress('Starting product URL collection via scraping', 1);
    productUrls = await discoverProductUrls(isTestRun || isValidation);

    logProgress(`Collected ${productUrls.length} product URLs for scraping.`, 1);

    if (productUrls.length === 0) {
      logProgress(`No product URLs found to process. Exiting.`, 1);
      return;
    }

    logProgress(`Phase 2: Starting product data extraction for ${productUrls.length} URLs`, 2);

    let processedCount = 0;
    let batchCount = 0;
    const totalUrls = productUrls.length;
    const batchSize = CONFIG.PERFORMANCE.BATCH_SIZE;

    const processedProducts: ScrapedProductData[] = [];

    const progressInterval = setInterval(() => {
      logProgress(`Phase 2: Processing products: ${processedCount}/${totalUrls} (Batch: ${batchCount})`, 2);
    }, 5000);

    const optimalConcurrency = Math.min(
      Math.max(2, os.cpus().length),
      CONFIG.PERFORMANCE.MAX_CONCURRENCY
    );

    logProgress(`Using dynamic concurrency: ${optimalConcurrency} concurrent requests for product extraction`, 2);

    const requestQueue = await RequestQueue.open();

    for (const url of productUrls) {
      await requestQueue.addRequest({
        url,
        userData: { label: 'PRODUCT' }
      });
    }

    const crawler = new CheerioCrawler({
      requestQueue,
      maxConcurrency: optimalConcurrency,
      requestHandlerTimeoutSecs: CONFIG.PERFORMANCE.REQUEST_TIMEOUT,
      maxRequestRetries: CONFIG.PERFORMANCE.MAX_RETRIES,

      useSessionPool: true,
      sessionPoolOptions: {
        maxPoolSize: 10,
        sessionOptions: {
          maxUsageCount: 50,
        },
      },

      maxRequestsPerMinute: CONFIG.PERFORMANCE.MAX_REQUESTS_PER_MINUTE,

      additionalMimeTypes: ['application/ld+json'],

      requestHandler: async ({ request, $, log }) => {
        const { url } = request;

        log.info(`Processing product page: ${url}`);

        try {
          const products = await extractProductData($, url);

          if (products && products.length > 0) {
            for (const productData of products) {
              if (productPassesFilters(productData, context)) {
                processedProducts.push(productData);
                processedCount++;

                if (processedProducts.length >= batchSize) {
                  logProgress(`Writing batch ${++batchCount} with ${processedProducts.length} products`, 2);

                  for (const product of processedProducts) {
                    console.log(JSON.stringify(product));
                  }

                  processedProducts.length = 0;
                }

                if (processedCount % 10 === 0) {
                  logProgress(`Processed ${processedCount}/${totalUrls} products`, 2);
                }
              }
            }
          } else {
            log.info(`Failed to extract product data from ${url}`);
            processedCount++;
          }
        } catch (error) {
          logError(`Error processing product ${url}`, error);
          processedCount++;
        }
      },

      failedRequestHandler: async ({ request, error }) => {
        logError(`Request ${request.url} failed: ${error instanceof Error ? error.message : String(error)}`);
        processedCount++;
      }
    });

    try {
      await crawler.run();
    } finally {
      clearInterval(progressInterval);

      if (processedProducts.length > 0) {
        logProgress(`Writing final batch with ${processedProducts.length} products`, 2);

        for (const product of processedProducts) {
          console.log(JSON.stringify(product));
        }

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