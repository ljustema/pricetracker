/**
 * Type definitions for the enhanced scraper template with placeholders
 * These types define the structure of the placeholders that will be filled
 * during the multi-phase AI scraper generation process.
 */

/**
 * Defines the collection strategy type
 */
export type CollectionStrategyType = 'api' | 'scraping';

/**
 * Defines the structure for API endpoint configuration
 */
export interface ApiEndpoint {
  url: string;
  method: 'GET' | 'POST';
  params?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

/**
 * Defines the structure for API endpoints configuration
 *
 * @example
 * ```typescript
 * const API_ENDPOINTS: ApiEndpointsConfig = {
 *   productList: {
 *     url: 'https://example.com/api/products',
 *     method: 'GET',
 *     params: {
 *       page: '1',
 *       limit: '50'
 *     },
 *     headers: {
 *       'Accept': 'application/json'
 *     }
 *   },
 *   productDetail: {
 *     url: 'https://example.com/api/products/{id}',
 *     method: 'GET',
 *     headers: {
 *       'Accept': 'application/json'
 *     }
 *   }
 * };
 * ```
 */
export interface ApiEndpointsConfig {
  productList: ApiEndpoint;
  productDetail?: ApiEndpoint;
  categories?: ApiEndpoint;
  brands?: ApiEndpoint;
  search?: ApiEndpoint;
  [key: string]: ApiEndpoint | undefined;
}

/**
 * Defines the structure for API response data
 */
export interface ApiResponseData {
  name?: string;
  price?: string | number;
  currency?: string;
  url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
  image?: string;
  in_stock?: boolean;
  description?: string;
  [key: string]: unknown;
}

/**
 * Defines the structure for API data mapping function
 *
 * @example
 * ```typescript
 * const mapApiResponseToProductData: ApiDataMappingFunction = async (apiResponse) => {
 *   return {
 *     name: apiResponse.name,
 *     competitor_price: parseFloat(apiResponse.price),
 *     currency_code: apiResponse.currency || 'SEK',
 *     url: apiResponse.url,
 *     sku: apiResponse.sku,
 *     brand: apiResponse.brand,
 *     ean: apiResponse.ean,
 *     image_url: apiResponse.image,
 *     is_available: apiResponse.in_stock
 *   };
 * };
 * ```
 */
export type ApiDataMappingFunction = (
  apiResponse: ApiResponseData
) => Promise<ScrapedProductData | null>;

/**
 * Defines the structure for URL collection function
 *
 * @example
 * ```typescript
 * const collectProductUrls: UrlCollectionFunction = async (page, baseUrl) => {
 *   await page.waitForSelector('.product-item', { timeout: 30000 });
 *
 *   const productUrls = await page.$$eval('.product-item a', (links) =>
 *     links.map(link => link.href)
 *   );
 *
 *   return productUrls;
 * };
 * ```
 */
export type UrlCollectionFunction = (
  page: import('playwright').Page,
  baseUrl: string
) => Promise<string[]>;

/**
 * Defines the structure for pagination handling function
 *
 * @example
 * ```typescript
 * const handlePagination: PaginationHandlingFunction = async (page, baseUrl) => {
 *   const hasNextPage = await page.$('.pagination .next');
 *   if (!hasNextPage) {
 *     return [];
 *   }
 *
 *   const nextPageUrl = await page.$eval('.pagination .next a', (a) => a.href);
 *   return [nextPageUrl];
 * };
 * ```
 */
export type PaginationHandlingFunction = (
  page: import('playwright').Page,
  baseUrl: string
) => Promise<string[]>;

/**
 * Defines the structure for product data extraction function
 *
 * @example
 * ```typescript
 * const extractProductData: ProductDataExtractionFunction = async (page, url) => {
 *   await page.waitForSelector('.product-name', { timeout: 30000 });
 *
 *   const name = await page.$eval('.product-name', (el) => el.textContent?.trim() || '');
 *   const priceText = await page.$eval('.product-price', (el) => el.textContent?.trim() || '');
 *   const price = parseFloat(priceText.replace(/[^0-9,.]/g, '').replace(',', '.'));
 *
 *   return {
 *     name,
 *     competitor_price: price,
 *     currency_code: 'SEK',
 *     url,
 *     is_available: true
 *   };
 * };
 * ```
 */
export type ProductDataExtractionFunction = (
  page: import('playwright').Page,
  url: string
) => Promise<ScrapedProductData | null>;

/**
 * Defines the structure for scraped product data
 */
export interface ScrapedProductData {
  url: string;
  name: string;
  competitor_price: number | null; // Updated field name to match new pricing structure
  currency_code: string | null; // Updated field name to match new pricing structure
  sku?: string | null;
  brand?: string | null;
  ean?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_available: boolean;
  raw_price?: string | null;
}

/**
 * Defines the structure for template placeholders
 */
export interface TemplatePlaceholders {
  COLLECTION_STRATEGY_TYPE: CollectionStrategyType;
  API_ENDPOINTS_CONFIG: ApiEndpointsConfig | null;
  API_DATA_MAPPING: string; // Function code as string
  URL_COLLECTION_STRATEGY: string; // Function code as string
  PAGINATION_HANDLING: string; // Function code as string
  PRODUCT_DATA_EXTRACTION: string; // Function code as string
}

/**
 * Defines the structure for scraper template configuration
 */
export interface ScraperTemplateConfig {
  name: string;
  description: string;
  competitorUrl: string;
  competitorId: string;
  userId: string;
  placeholders: TemplatePlaceholders;
}
