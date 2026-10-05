/**
 * PriceTracker - Bright123 Product Scraper
 *
 * High-performance scraper for bright123.se using the Crawlee framework.
 * This scraper discovers product URLs through sitemaps and extracts product data.
 *
 * STOCK TRACKING UPDATE (2025-06-27):
 * - Added stock status extraction from .stockInfo > .stock elements
 * - Handles Swedish stock status text like "Finns i lager. 1-3 arbetsdagar" and "Beställningsvara. ca 1-2 veckor"
 * - Stock data is stored in temp_competitors_scraped_data for processing by database functions
 *
 * Version 1.2.0
 */

// ------------------------------------ //
// ------- CONFIGURATION SECTION ------ //
// ------------------------------------ //

const CONFIG = {
    // Site information
    SITE: {
      NAME: "Bright123",
      BASE_URL: "https://www.bright123.se",
      LANGUAGE: "sv",
    },

    // Collection strategy configuration
    COLLECTION_STRATEGY: {
      TYPE: "scraping", // This scraper uses web scraping

      // Scraping settings
      SCRAPING: {
        // URL discovery method
        URL_DISCOVERY: {
          METHOD: "sitemap", // Uses sitemaps to discover product URLs

          // Sitemap settings
          SITEMAP: {
            INDEX_URL: "https://www.bright123.se/sv/sitemap-articles-1.xml",
            PRODUCT_URL_FILTER: "/articles/", // String that identifies a product URL
          },
        }
      }
    },

    // Product data extraction settings
    PRODUCT_EXTRACTION: {
      // CSS selectors for extracting product data
      SELECTORS: {
        NAME: "h1 span[itemprop='name']",
        PRICE: {
          CONTAINER: "div.priceContainer",
          DISCOUNT_PRICE: "span.discountPrice span[itemprop='price']",
          REGULAR_PRICE: "span.price span[itemprop='price']"
        },
        CURRENCY: null, // Default to SEK
        SKU: "table.attributes", // Need to find rows that contain "Leverantörens artikelnummer"
        BRAND: "h1 span.trademark a",
        EAN: "table.attributes", // Need to find rows that contain "EAN-kod"
        IMAGE_URL: "div.articleImage img[itemprop='image']",
        DESCRIPTION: "div.product-description", // This is a placeholder, adjust if needed
        AVAILABILITY: {
          SELECTOR: ".product-stock-status span", // This is a placeholder, adjust if needed
          IN_STOCK_TEXT: ["I lager", "På lager"],
          OUT_OF_STOCK_TEXT: ["Utgången produkt", "Slut i lager"],
        }
      },

      // JSON-LD schema.org extraction settings
      SCHEMA_ORG: {
        ENABLED: true,
        SCRIPT_SELECTOR: "script[type='application/ld+json']"
      },
    },

    // Performance settings
    PERFORMANCE: {
      MAX_CONCURRENCY: 10, // Number of concurrent requests (increased for better performance)
      BATCH_SIZE: 100, // Number of products to process before writing a batch
      REQUEST_TIMEOUT: 60, // Timeout in seconds for each request
      MAX_RETRIES: 3, // Maximum number of retries for failed requests
      REQUEST_DELAY: 100, // Delay between requests in milliseconds
      MAX_REQUESTS_PER_MINUTE: 1000, // Rate limiting (increased for better performance)
    },

    // Filtering settings
    FILTERING: {
      ENABLED: false, // Will be set to true if filtering is enabled in context
      BY_BRAND: {
        ENABLED: false, // Will be set based on context
        BRANDS: [] as string[] // Will be populated from context
      },
      BY_OWN_PRODUCTS: {
        ENABLED: false, // Will be set based on context
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

  import { CheerioCrawler, RequestQueue, log, ProxyConfiguration, Configuration } from 'crawlee';
  import { XMLParser } from 'fast-xml-parser';
  import yargs from 'yargs';
  import { hideBin } from 'yargs/helpers';
  import fetch from 'node-fetch';
  import * as path from 'path';
  import * as os from 'os';
  import * as fs from 'fs';
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
    attributes?: {
      _triton_ref?: string;
      _triton_title?: string;
      _xmlns_xsi?: string;
      _xmlns_triton?: string;
      _xmlns_xhtml?: string;
      _xmlns?: string;
      _xsi_schemaLocation?: string;
      [key: string]: string | undefined;
    };
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
      name: "Bright123 Crawlee Scraper",
      version: "1.1.0",
      description: "High-performance scraper for bright123.se using Crawlee framework with optimized concurrency, batch processing, improved schema.org data extraction, dynamic sitemap discovery, and memory-only storage for better performance. Includes rate limiting optimizations to prevent HTTP/2 GOAWAY errors.",
      target_url: CONFIG.SITE.BASE_URL,
      required_libraries: ["crawlee", "fast-xml-parser", "node-fetch", "yargs"],
      batch_size: CONFIG.PERFORMANCE.BATCH_SIZE,
      max_concurrency: CONFIG.PERFORMANCE.MAX_CONCURRENCY,
      collection_strategy: "scraping"
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
        storageClient: {
          useMemoryStorage: true, // Force memory storage to avoid file system issues
        },
      });

      // Set global configuration to use memory storage
      Configuration.getGlobalConfig().set('persistStorage', false);
      Configuration.getGlobalConfig().set('storageClient.useMemoryStorage', true);

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
   * Handles custom sitemap format with triton attributes
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

      // Parse XML with fast-xml-parser - configure to handle custom namespaces
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '_',
        attributesGroupName: 'attributes',
        parseAttributeValue: true,
        processEntities: false,
        htmlEntities: false,
      });

      const result = parser.parse(xmlContent);

      // Handle the custom sitemap format with triton attributes
      const urlElements = result.urlset?.url || [];

      // Extract URLs from the sitemap
      const urls: string[] = [];

      if (Array.isArray(urlElements)) {
        for (const item of urlElements) {
          // Check if the item has a loc property
          if (typeof item === 'object' && item.loc) {
            const url = item.loc;

            // Log additional triton attributes if available for debugging
            if (item.attributes &&
                (item.attributes._triton_ref || item.attributes._triton_title)) {
              logProgress(`Found product: ${item.attributes._triton_title || 'Unknown'}, Ref: ${item.attributes._triton_ref || 'Unknown'}`);
            }

            // Apply product URL filter if configured
            if (!CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_URL_FILTER ||
                url.includes(CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_URL_FILTER)) {
              urls.push(url);
            }
          }
        }
      }

      logProgress(`Found ${urls.length} product URLs in sitemap`);
      return urls;
    } catch (error) {
      logError(`Error fetching sitemap ${sitemapUrl}`, error);
      return [];
    }
  }

  /**
   * Fallback method to extract product URLs from category pages
   */
  async function fetchProductUrlsFromCategories(): Promise<string[]> {
    const BASE_URL = CONFIG.SITE.BASE_URL;
    const categoryPaths = [
      "/sv/produkter",
      "/sv/produkter/elektronik",
      "/sv/produkter/hem-tradgard",
      "/sv/produkter/sport-fritid",
      "/sv/produkter/bygg-verktyg"
    ];

    let allProductUrls: string[] = [];

    for (const categoryPath of categoryPaths) {
      try {
        const categoryUrl = `${BASE_URL}${categoryPath}`;
        logProgress(`Checking category: ${categoryUrl}`);

        const response = await fetch(categoryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
          }
        });

        if (!response.ok) {
          logError(`Failed to fetch category page: ${response.status} ${response.statusText}`);
          continue;
        }

        const htmlContent = await response.text();

        // Simple regex to find product links
        const productLinkPattern = /href=['"]([^'"]*(?:articles|artikel|product)[^'"]*)['"]/gi;
        let match: RegExpExecArray | null;
        const categoryProductUrls: string[] = [];

        while ((match = productLinkPattern.exec(htmlContent)) !== null) {
          let url = match[1];

          // Normalize URLs
          if (url.startsWith('/')) {
            url = `${BASE_URL}${url}`;
          } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `${BASE_URL}/${url}`;
          }

          categoryProductUrls.push(url);
        }

        logProgress(`Found ${categoryProductUrls.length} products in category ${categoryPath}`);
        allProductUrls.push(...categoryProductUrls);

      } catch (error) {
        logError(`Error fetching product URLs from category ${categoryPath}`, error);
      }
    }

    // Remove duplicates
    return [...new Set(allProductUrls)];
  }

  /**
   * Discovers product URLs based on the configured discovery method
   * Optimized version using Crawlee's RequestQueue for better performance
   */
  async function discoverProductUrls(isTestRun: boolean): Promise<string[]> {
    logProgress('Starting optimized product URL discovery with Crawlee', 1);

    // Calculate optimal concurrency based on system resources
    const optimalConcurrency = Math.min(
      Math.max(2, os.cpus().length * 2), // 2 concurrent requests per CPU core, minimum 2
      CONFIG.PERFORMANCE.MAX_CONCURRENCY // But never exceed the configured maximum
    );

    logProgress(`Using dynamic concurrency: ${optimalConcurrency} concurrent requests for sitemap processing`, 1);

    // Initialize a request queue for URL discovery
    const requestQueue = await RequestQueue.open();

    // Store all discovered product URLs
    const allProductUrls: string[] = [];

    // Add the sitemap index to the queue
    if (isTestRun) {
      // For test runs, just use the sitemap directly
      await requestQueue.addRequest({
        url: CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.INDEX_URL,
        userData: {
          label: 'PRODUCT_SITEMAP'
        }
      });
    } else {
      // For full runs, start with the sitemap index
      await requestQueue.addRequest({
        url: CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.INDEX_URL,
        userData: {
          label: 'PRODUCT_SITEMAP'
        }
      });
    }

    // Create a crawler for URL discovery
    const crawler = new CheerioCrawler({
      requestQueue,
      maxConcurrency: optimalConcurrency,
      requestHandlerTimeoutSecs: CONFIG.PERFORMANCE.REQUEST_TIMEOUT,
      maxRequestRetries: CONFIG.PERFORMANCE.MAX_RETRIES,

      // Use session pool for better rate limiting
      useSessionPool: true,
      sessionPoolOptions: {
        maxPoolSize: 20,
        sessionOptions: {
          maxUsageCount: 50,
        },
      },

      // Implement rate limiting
      maxRequestsPerMinute: CONFIG.PERFORMANCE.MAX_REQUESTS_PER_MINUTE,

      // Main request handler
      requestHandler: async ({ request, $, log }) => {
        const { url } = request;
        const { label } = request.userData;

        // Handle product sitemap
        if (label === 'PRODUCT_SITEMAP') {
          log.info(`Processing product sitemap: ${url}`);

          try {
            // Parse XML with fast-xml-parser
            const xmlContent = $.html();
            const parser = new XMLParser({
              ignoreAttributes: false,
              attributeNamePrefix: '_',
              attributesGroupName: 'attributes',
              parseAttributeValue: true,
              processEntities: false,
              htmlEntities: false,
            });

            const result = parser.parse(xmlContent);
            const urlElements = result.urlset?.url || [];

            // Extract URLs from the sitemap
            const productUrls = Array.isArray(urlElements)
              ? urlElements
                  .map((item: any) => {
                    return typeof item === 'object' && item.loc ? item.loc : '';
                  })
                  .filter(url => url.includes(CONFIG.COLLECTION_STRATEGY.SCRAPING.URL_DISCOVERY.SITEMAP.PRODUCT_URL_FILTER))
              : [];

            // Add all product URLs to our collection
            allProductUrls.push(...productUrls);

            logProgress(`Found ${productUrls.length} product URLs in sitemap ${url}`, 1);
            logProgress(`Total unique product URLs collected: ${allProductUrls.length}`, 1);

            // For test runs, check if we have enough products
            if (isTestRun && allProductUrls.length >= 50) {
              logProgress(`Test run - found more than 50 products, stopping URL discovery`, 1);
              await crawler.autoscaledPool?.abort();
            }
          } catch (error) {
            logError(`Error parsing product sitemap ${url}: ${error}`, error);

            // If sitemap approach fails, try category pages as fallback
            if (allProductUrls.length === 0) {
              logProgress('Sitemap approach did not yield results, trying category pages', 1);
              const categoryUrls = await fetchProductUrlsFromCategories();
              allProductUrls.push(...categoryUrls);
              logProgress(`Found ${categoryUrls.length} product URLs from categories`, 1);
            }
          }
        }
      },

      // Handle failed requests
      failedRequestHandler: async ({ request, error }) => {
        logError(`Request ${request.url} failed: ${error.message}`);

        // If sitemap approach fails, try category pages as fallback
        if (allProductUrls.length === 0) {
          logProgress('Sitemap request failed, trying category pages as fallback', 1);
          const categoryUrls = await fetchProductUrlsFromCategories();
          allProductUrls.push(...categoryUrls);
          logProgress(`Found ${categoryUrls.length} product URLs from categories`, 1);
        }
      }
    });

    // Run the crawler
    await crawler.run();

    logProgress(`URL discovery complete. Found ${allProductUrls.length} unique product URLs`, 1);

    // Remove duplicates
    const uniqueUrls = [...new Set(allProductUrls)];

    // For test runs, limit the number of URLs
    if (isTestRun && uniqueUrls.length > CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT) {
      logProgress(`Test run - limiting to ${CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT} products out of ${uniqueUrls.length}`, 1);
      return uniqueUrls.slice(0, CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT);
    }

    return uniqueUrls;
  }

  // ------------------------------------ //
  // ---- CUSTOM FIELDS EXTRACTION ------ //
  // ------------------------------------ //

  /**
   * Extract custom fields from Bright123's attributes table
   * This extracts all the product specifications from the attributes table
   */
  function extractBright123AttributeFields($: any): Record<string, string | number | boolean | null> {
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
          const title = $(cells[0]).text().trim();
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
   * Clean price text to extract numeric value
   * Optimized version with better handling of Swedish price formats
   */
  function parsePrice(priceText: string | null | undefined): number | null {
    if (!priceText) return null;

    try {
      // Remove non-numeric characters except for decimal separators
      const cleaned = priceText
        .replace('kr', '')
        .replace(/\s/g, '')
        .replace(/[^\d,\.]/g, '')
        .replace(',', '.');

      const price = parseFloat(cleaned);

      if (isNaN(price)) {
        return null;
      }

      // Sanity check for large numbers (possible formatting issues)
      if (price > 100000) {
        return price / 1000;
      }

      // Convert to integer if it's a whole number
      return price % 1 === 0 ? Math.floor(price) : price;
    } catch (error) {
      return null;
    }
  }

  // ------------------------------------ //
  // ------ STOCK DATA EXTRACTION ------- //
  // ------------------------------------ //

  /**
   * Extract stock data from Bright123 product pages
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

      // --- Extract stock status from Bright123's stock display ---
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
   * Extracts product data from a page
   */
  async function extractProductData($: any, url: string): Promise<ScrapedProductData | null> {
    try {
      // Initialize product data with defaults
      let productData: ScrapedProductData = {
        name: '',
        competitor_price: null,
        currency_code: null, // Let database set user's primary currency
        competitor_url: url, // Updated field name to match temp_competitors_scraped_data table
        sku: null,
        brand: null,
        ean: null,
        image_url: null,
        is_available: true, // Default to true unless found otherwise
        description: null,
        raw_price: null,
        stock_quantity: null,
        stock_status: null,
        availability_date: null,
        raw_stock_data: null,
        stock_data: null,
        raw_data: null
      };

      // Extract product name
      const nameEl = $(CONFIG.PRODUCT_EXTRACTION.SELECTORS.NAME);
      if (nameEl.length > 0) {
        productData.name = nameEl.text().trim();
      }

      // Extract price
      const priceContainer = $(CONFIG.PRODUCT_EXTRACTION.SELECTORS.PRICE.CONTAINER);
      if (priceContainer.length > 0) {
        // Check for discount price first
        const discountPriceEl = priceContainer.find(CONFIG.PRODUCT_EXTRACTION.SELECTORS.PRICE.DISCOUNT_PRICE);

        if (discountPriceEl.length > 0) {
          const priceAttr = discountPriceEl.attr('content');

          if (priceAttr) {
            try {
              productData.competitor_price = parseFloat(priceAttr);
              productData.raw_price = priceAttr;
            } catch (e) {
              const priceText = discountPriceEl.text().trim();
              productData.raw_price = priceText;
              productData.competitor_price = parsePrice(priceText);
            }
          } else {
            const priceText = discountPriceEl.text().trim();
            productData.raw_price = priceText;
            productData.competitor_price = parsePrice(priceText);
          }
        } else {
          // Try regular price
          const regularPriceEl = priceContainer.find(CONFIG.PRODUCT_EXTRACTION.SELECTORS.PRICE.REGULAR_PRICE);

          if (regularPriceEl.length > 0) {
            const priceAttr = regularPriceEl.attr('content');

            if (priceAttr) {
              try {
                productData.competitor_price = parseFloat(priceAttr);
                productData.raw_price = priceAttr;
              } catch (e) {
                const priceText = regularPriceEl.text().trim();
                productData.raw_price = priceText;
                productData.competitor_price = parsePrice(priceText);
              }
            } else {
              const priceText = regularPriceEl.text().trim();
              productData.raw_price = priceText;
              productData.competitor_price = parsePrice(priceText);
            }
          }
        }
      }

      // Extract brand
      const brandEl = $(CONFIG.PRODUCT_EXTRACTION.SELECTORS.BRAND);
      if (brandEl.length > 0) {
        productData.brand = brandEl.text().trim();
      }

      // Extract image URL
      const imgEl = $(CONFIG.PRODUCT_EXTRACTION.SELECTORS.IMAGE_URL);
      if (imgEl.length > 0) {
        let imgSrc = imgEl.attr('src');

        if (imgSrc) {
          // Ensure absolute URL
          if (imgSrc.startsWith('/')) {
            imgSrc = `${CONFIG.SITE.BASE_URL}${imgSrc}`;
          } else if (!imgSrc.startsWith('http')) {
            imgSrc = `${CONFIG.SITE.BASE_URL}/${imgSrc}`;
          }

          productData.image_url = imgSrc;
        }
      }

      // Extract SKU and EAN from attribute table
      const attributeTable = $(CONFIG.PRODUCT_EXTRACTION.SELECTORS.SKU);
      if (attributeTable.length > 0) {
        const rows = attributeTable.find('tr');

        rows.each((_: number, row: any) => {
          const cells = $(row).find('td');

          if (cells.length === 2) {
            const title = $(cells[0]).text().trim();
            const value = $(cells[1]).text().trim();

            if (title === 'EAN-kod') {
              productData.ean = value;
            } else if (title === 'Leverantörens artikelnummer') {
              productData.sku = value;
            }
          }
        });
      }

      // Extract custom fields from attributes table (specifications)
      const customFields = extractBright123AttributeFields($);
      if (Object.keys(customFields).length > 0) {
        productData.raw_data = customFields;
      }

      // Extract stock data
      const stockData = extractStockData($, url);
      if (stockData) {
        // Set the stock_data object to match worker expectations
        productData.stock_data = {
          quantity: stockData.quantity,
          status: stockData.status,
          availability_date: stockData.availability_date,
          total_stock: null,
          combinations_stock: null,
          raw_data: stockData.raw_data
        };

        // Also set individual fields for backward compatibility
        productData.stock_quantity = stockData.quantity;
        productData.stock_status = stockData.status;
        productData.availability_date = stockData.availability_date;
        productData.raw_stock_data = stockData.raw_data;

        logProgress(`Extracted stock data for ${url}: status="${stockData.status}"`);
      }

      // If no name or price found, extraction failed
      if (!productData.name || productData.competitor_price === null) {
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
    } catch (configError) {
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
      // Collect product URLs via scraping
      logProgress('Starting product URL collection via scraping', 1);
      let productUrls = await discoverProductUrls(isTestRun || isValidation);

      // Limit URLs for test/validation runs
      if (isValidation) {
        productUrls = productUrls.slice(0, CONFIG.TEST_SETTINGS.VALIDATION_MODE_LIMIT);
        logProgress(`Validation run - processing ${CONFIG.TEST_SETTINGS.VALIDATION_MODE_LIMIT} products`);
      } else if (isTestRun) {
        productUrls = productUrls.slice(0, CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT);
        logProgress(`Test run - processing ${CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT} products`);
      }

      // Abort if no URLs found
      if (productUrls.length === 0) {
        logProgress(`No product URLs found to process. Exiting.`, 1);
        return;
      }

      // PHASE 2: Extract product data using optimized Crawlee implementation
      logProgress(`Phase 2: Starting optimized product data extraction for ${productUrls.length} URLs`, 2);

      // Calculate optimal concurrency based on system resources
      const optimalConcurrency = Math.min(
        Math.max(2, os.cpus().length * 2), // 2 concurrent requests per CPU core, minimum 2
        CONFIG.PERFORMANCE.MAX_CONCURRENCY // But never exceed the configured maximum
      );

      logProgress(`Using dynamic concurrency: ${optimalConcurrency} concurrent requests for product extraction`, 2);

      // Initialize a request queue for product extraction
      const requestQueue = await RequestQueue.open();

      // Track progress
      let processedCount = 0;
      let batchCount = 0;
      const totalUrls = productUrls.length;
      const batchSize = CONFIG.PERFORMANCE.BATCH_SIZE;

      // Track products for batch processing
      const processedProducts: ScrapedProductData[] = [];

      // Add all product URLs to the queue
      for (const url of productUrls) {
        await requestQueue.addRequest({
          url,
          userData: { label: 'PRODUCT' }
        });
      }

      // Set up progress reporting
      const progressInterval = setInterval(() => {
        logProgress(`Phase 2: Processing products: ${processedCount}/${totalUrls} (Batch: ${batchCount})`, 2);
      }, 5000);

      // Configure crawler for product page scraping with optimized settings
      const crawler = new CheerioCrawler({
        requestQueue,
        maxConcurrency: optimalConcurrency,
        requestHandlerTimeoutSecs: CONFIG.PERFORMANCE.REQUEST_TIMEOUT,
        maxRequestRetries: CONFIG.PERFORMANCE.MAX_RETRIES,

        // Use session pool for better rate limiting
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
          logError(`Request ${request.url} failed: ${error.message}`);

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