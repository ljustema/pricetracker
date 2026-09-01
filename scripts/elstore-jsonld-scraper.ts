/**
 * PriceTracker - Elstore.se JSON-LD scraper.
 *
 * It reads the product sitemaps, fetches product pages directly, extracts
 * stable fallback data from application/ld+json blocks, and uses Elstore's
 * product state API to expand pages into all variants.
 */

import { XMLParser } from 'fast-xml-parser';
import fetch from 'node-fetch';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const CONFIG = {
  SITE: {
    NAME: 'Elstore.se',
    BASE_URL: 'https://elstore.se',
  },
  SITEMAP: {
    INDEX_URL: 'https://elstore.se/sitemap.xml',
    PRODUCT_FILTER: '/sv/products/',
  },
  PERFORMANCE: {
    PAGE_CONCURRENCY: 6,
    API_CONCURRENCY: 2,
    REQUEST_TIMEOUT_MS: 30000,
    RETRIES: 4,
    API_BATCH_DELAY_MS: 1200,
  },
};

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

interface ScrapedProductData {
  name: string;
  competitor_price: number | null;
  currency_code: string;
  competitor_url: string;
  sku: string | null;
  brand: string | null;
  ean: string | null;
  image_url: string | null;
  is_available: boolean;
  description?: string | null;
  raw_price?: string | null;
  stock_data?: {
    quantity: number | null;
    status: string | null;
    availability_date: Date | null;
    total_stock: number | null;
    combinations_stock: null;
    raw_data: Record<string, unknown> | null;
  };
  stock_quantity?: number | null;
  stock_status?: string | null;
  availability_date?: Date | null;
  raw_stock_data?: Record<string, unknown> | null;
  raw_data?: null;
}

interface ProductCandidate {
  product_id: string;
  variant_id: string;
  url: string;
  fallback_name: string | null;
  fallback_brand: string | null;
  fallback_ean: string | null;
  fallback_image_url: string | null;
  fallback_description: string | null;
  fallback_price: number | null;
  fallback_currency_code: string;
  fallback_availability: string | null;
}

interface ApiSession {
  cookies: string;
  csrfToken: string;
}

interface JsonLdProduct {
  '@type'?: string | string[];
  name?: string;
  sku?: string | number;
  gtin?: string | number;
  gtin13?: string | number;
  mpn?: string | number;
  description?: string;
  image?: string | string[];
  brand?: string | { name?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
  category?: string;
}

interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  url?: string;
}

function getMetadata(): ScriptMetadata {
  return {
    name: 'Elstore JSON-LD Scraper',
    version: '2.0.0',
    description: 'Fast Elstore scraper based on sitemaps, JSON-LD fallback data, and the product state API.',
    target_url: CONFIG.SITE.BASE_URL,
    required_libraries: ['fast-xml-parser', 'node-fetch', 'yargs'],
    batch_size: 100,
    max_concurrency: CONFIG.PERFORMANCE.PAGE_CONCURRENCY,
    collection_strategy: 'scraping',
  };
}

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

function logWarning(message: string, error?: unknown): void {
  console.error(`WARNING: ${message}`);
  if (error instanceof Error) {
    console.error(`WARNING: ${error.message}`);
  } else if (error) {
    console.error(`WARNING: ${String(error)}`);
  }
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= CONFIG.PERFORMANCE.RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.PERFORMANCE.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        if (response.status === 403 || response.status === 429) {
          lastError = error;
          if (attempt < CONFIG.PERFORMANCE.RETRIES) {
            await waitWithBackoff(attempt, 3500);
            continue;
          }
        }
        throw error;
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < CONFIG.PERFORMANCE.RETRIES) {
        await waitWithBackoff(attempt, 1000);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function waitWithBackoff(attempt: number, baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * 1000);
  const delay = baseMs * Math.pow(2, attempt) + jitter;
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function pauseBetweenApiBatches(): Promise<void> {
  const jitter = Math.floor(Math.random() * 700);
  await new Promise(resolve => setTimeout(resolve, CONFIG.PERFORMANCE.API_BATCH_DELAY_MS + jitter));
}

async function fetchProductUrls(): Promise<string[]> {
  logProgress('Fetching product URLs from sitemap', 1);

  const parser = new XMLParser();
  const indexXml = await fetchText(CONFIG.SITEMAP.INDEX_URL);
  const index = parser.parse(indexXml);
  const sitemaps = toArray(index.sitemapindex?.sitemap)
    .map((entry: { loc?: string }) => entry.loc)
    .filter((loc: unknown): loc is string => typeof loc === 'string' && loc.includes('/products/'));

  logProgress(`Found ${sitemaps.length} product sitemaps`, 1);

  const urls: string[] = [];
  for (const sitemapUrl of sitemaps) {
    const sitemapXml = await fetchText(sitemapUrl);
    const sitemap = parser.parse(sitemapXml);
    const productUrls = toArray(sitemap.urlset?.url)
      .map((entry: { loc?: string }) => entry.loc)
      .filter((loc: unknown): loc is string => typeof loc === 'string' && loc.includes(CONFIG.SITEMAP.PRODUCT_FILTER));
    urls.push(...productUrls);
  }

  return Array.from(new Set(urls));
}

async function scrapeProductPage(url: string): Promise<ProductCandidate | null> {
  const html = await fetchText(url);
  const product = extractJsonLdProduct(html);
  const productId = html.match(/product-id=["'](\d+)["']/)?.[1] || null;
  const variantId = html.match(/variant-id=["'](\d+)["']/)?.[1] || null;

  if (!productId || !variantId) {
    logError(`No product/variant id found for ${url}`);
    return null;
  }

  const offer = first(toArray(product?.offers));
  const price = parsePrice(offer?.price);
  const currency = normalizeText(offer?.priceCurrency) || 'SEK';
  const image = first(toArray(product?.image));
  const availability = normalizeText(offer?.availability);

  return {
    product_id: productId,
    variant_id: variantId,
    url,
    fallback_name: normalizeText(product?.name),
    fallback_brand: normalizeText(typeof product?.brand === 'string' ? product.brand : product?.brand?.name),
    fallback_ean: normalizeText(product?.gtin13 ?? product?.gtin),
    fallback_image_url: normalizeText(image),
    fallback_description: normalizeText(product?.description),
    fallback_price: price,
    fallback_currency_code: currency.toUpperCase(),
    fallback_availability: availability,
  };
}

function extractJsonLdProduct(html: string): JsonLdProduct | null {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const script of scripts) {
    const jsonText = script
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim();

    if (!jsonText) continue;

    try {
      const parsed = JSON.parse(jsonText);
      const product = findProductNode(parsed);
      if (product) return product;
    } catch (_error) {
      continue;
    }
  }

  return null;
}

function findProductNode(value: unknown): JsonLdProduct | null {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findProductNode(entry);
      if (result) return result;
    }
    return null;
  }

  const obj = value as Record<string, unknown>;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some(entry => String(entry).toLowerCase() === 'product')) {
    return obj as JsonLdProduct;
  }

  if (Array.isArray(obj['@graph'])) {
    return findProductNode(obj['@graph']);
  }

  return null;
}

function productPassesFilters(product: ScrapedProductData, context: ScriptContext): boolean {
  if (context.filterByActiveBrands && product.brand) {
    const brands = context.activeBrandNames || [];
    if (brands.length > 0 && !brands.some(brand => normalizeComparable(brand) === normalizeComparable(product.brand))) {
      return false;
    }
  }

  if (context.scrapeOnlyOwnProducts) {
    const ean = normalizeComparable(product.ean);
    if (ean && (context.ownProductEans || []).some(ownEan => normalizeComparable(ownEan) === ean)) {
      return true;
    }

    const sku = normalizeComparable(product.sku);
    const brand = normalizeComparable(product.brand);
    if (sku && brand) {
      return (context.ownProductSkuBrands || []).some(item =>
        normalizeComparable(item.sku) === sku && normalizeComparable(item.brand) === brand
      );
    }

    return false;
  }

  return true;
}

async function establishApiSession(): Promise<ApiSession> {
  const response = await fetch(`${CONFIG.SITE.BASE_URL}/sv`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to establish API session: HTTP ${response.status}`);
  }

  const html = await response.text();
  const csrfToken = html.match(/name=["']csrf-token["'] content=["']([^"']+)["']/)?.[1] || '';
  const rawCookies = (response.headers as any).raw?.()['set-cookie'] || [];
  const cookies = rawCookies.map((cookie: string) => cookie.split(';')[0]).join('; ');

  return { cookies, csrfToken };
}

async function fetchProductState(candidate: ProductCandidate, session: ApiSession, attempt = 0): Promise<unknown | null> {
  const response = await fetch(`${CONFIG.SITE.BASE_URL}/frontend-api/product/state`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      'Content-Type': 'application/json',
      'Origin': CONFIG.SITE.BASE_URL,
      'Referer': `${CONFIG.SITE.BASE_URL}/sv`,
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': session.csrfToken,
      'Cookie': session.cookies,
    },
    body: JSON.stringify({
      product_id: candidate.product_id,
      variant_id: candidate.variant_id,
    }),
  });

  if (!response.ok) {
    if ((response.status === 403 || response.status === 429) && attempt < CONFIG.PERFORMANCE.RETRIES) {
      await waitWithBackoff(attempt, 4000);
      return await fetchProductState(candidate, session, attempt + 1);
    }
    throw new Error(`Product state API failed for ${candidate.product_id}/${candidate.variant_id}: HTTP ${response.status}`);
  }

  return await response.json();
}

function productsFromApiData(apiData: unknown, candidate: ProductCandidate): ScrapedProductData[] {
  const data = apiData as any;
  const mainProduct = data?.product || {};
  const selectedVariant = data?.selected_variant || {};
  const variants = Array.isArray(mainProduct.variants) && mainProduct.variants.length > 0
    ? mainProduct.variants
    : [selectedVariant];
  const brand = normalizeText(mainProduct.denormalized_brand?.name?.sv)
    || normalizeText(mainProduct.brand?.name?.sv)
    || normalizeText(mainProduct.brand?.name)
    || candidate.fallback_brand;

  return variants
    .filter((variantData: any) => variantData?.sku)
    .map((variantData: any) => {
      const formattedPrice = normalizeText(variantData.price?.formatted_price);
      const competitorPrice = parsePrice(formattedPrice) ?? candidate.fallback_price;
      const availableStock = Number(variantData.available_stock ?? 0);
      const displayStock = Number(variantData.display_stock ?? 0);
      const stockField = Number.parseFloat(String(variantData.stock ?? '0')) || 0;
      const stockQuantity = availableStock || displayStock || stockField || 0;
      const alwaysOrderable = Boolean(variantData.always_orderable);
      const stockStatus = stockQuantity > 0
        ? 'in_stock'
        : alwaysOrderable
          ? 'back_order'
          : 'out_of_stock';
      const isAvailable = stockQuantity > 0 || alwaysOrderable;
      const ean = normalizeText(variantData.gtin)
        || (variants.length === 1 ? candidate.fallback_ean : null);
      const image = findVariantImage(mainProduct.images, variantData.image_id) || candidate.fallback_image_url;

      return {
        name: normalizeText(variantData.name) || normalizeText(mainProduct.name) || candidate.fallback_name || '',
        competitor_price: competitorPrice,
        currency_code: candidate.fallback_currency_code || 'SEK',
        competitor_url: candidate.url,
        sku: normalizeText(variantData.sku),
        brand,
        ean,
        image_url: image,
        is_available: isAvailable,
        description: candidate.fallback_description,
        raw_price: formattedPrice,
        stock_quantity: stockQuantity > 0 ? stockQuantity : null,
        stock_status: stockStatus,
        availability_date: null,
        raw_stock_data: {
          available_stock: availableStock,
          display_stock: displayStock,
          stock_field: stockField,
          fallback_availability: candidate.fallback_availability,
        },
        stock_data: {
          quantity: stockQuantity > 0 ? stockQuantity : null,
          status: stockStatus,
          availability_date: null,
          total_stock: stockQuantity,
          combinations_stock: null,
          raw_data: null,
        },
        raw_data: null,
      };
    });
}

function findVariantImage(images: unknown, imageId: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const image = images.find((entry: any) => imageId && entry?.id === imageId) || images[0];
  return normalizeText(image?.thumb_url || image?.url || image?.src);
}

async function scrape(context: ScriptContext): Promise<void> {
  try {
    logProgress(`Received context: ${JSON.stringify(context)}`);

    let productUrls = await fetchProductUrls();
    logProgress(`Total product URLs discovered: ${productUrls.length}`, 1);

    if (context.isTestRun || context.limit_products) {
      const limit = context.limit_products || 20;
      productUrls = productUrls.slice(0, limit);
      logProgress(`Test mode: limiting to ${productUrls.length} URLs`, 1);
    }

    const session = await establishApiSession();
    logProgress(`API session established: csrf=${session.csrfToken ? 'yes' : 'no'}, cookies=${session.cookies ? 'yes' : 'no'}`, 1);

    let processed = 0;
    let apiProcessed = 0;
    let output = 0;
    let missingProductData = 0;
    const candidates: ProductCandidate[] = [];

    for (let i = 0; i < productUrls.length; i += CONFIG.PERFORMANCE.PAGE_CONCURRENCY) {
      const batch = productUrls.slice(i, i + CONFIG.PERFORMANCE.PAGE_CONCURRENCY);
      const pageCandidates = await Promise.all(batch.map(async url => {
        try {
          return await scrapeProductPage(url);
        } catch (error) {
          logError(`Failed to scrape ${url}`, error);
          return null;
        }
      }));

      for (const candidate of pageCandidates) {
        processed++;
        if (!candidate) {
          missingProductData++;
          continue;
        }
        candidates.push(candidate);
      }

      if (processed % 120 === 0 || processed === productUrls.length) {
        logProgress(`Processed ${processed}/${productUrls.length} pages, found ${candidates.length} API candidates`, 2);
      }
    }

    const uniqueCandidates = Array.from(
      new Map(candidates.map(candidate => [candidate.product_id, candidate])).values()
    );
    const emittedKeys = new Set<string>();
    logProgress(`Fetching variant data for ${uniqueCandidates.length} unique products`, 2);

    for (let i = 0; i < uniqueCandidates.length; i += CONFIG.PERFORMANCE.API_CONCURRENCY) {
      const batch = uniqueCandidates.slice(i, i + CONFIG.PERFORMANCE.API_CONCURRENCY);
      const batchProducts = await Promise.all(batch.map(async candidate => {
        try {
          const apiData = await fetchProductState(candidate, session);
          return productsFromApiData(apiData, candidate);
        } catch (error) {
          logWarning(`API failed for ${candidate.url}, falling back to page data`, error);
          return [{
            name: candidate.fallback_name || '',
            competitor_price: candidate.fallback_price,
            currency_code: candidate.fallback_currency_code,
            competitor_url: candidate.url,
            sku: null,
            brand: candidate.fallback_brand,
            ean: candidate.fallback_ean,
            image_url: candidate.fallback_image_url,
            is_available: !candidate.fallback_availability || /instock|limitedavailability|preorder/i.test(candidate.fallback_availability),
            description: candidate.fallback_description,
            raw_price: candidate.fallback_price === null ? null : String(candidate.fallback_price),
            stock_data: {
              quantity: null,
              status: candidate.fallback_availability?.split('/').pop()?.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase() || null,
              availability_date: null,
              total_stock: null,
              combinations_stock: null,
              raw_data: { availability: candidate.fallback_availability },
            },
            raw_data: null,
          } satisfies ScrapedProductData];
        }
      }));

      for (const product of batchProducts.flat()) {
        const key = `${normalizeComparable(product.brand)}|${normalizeComparable(product.sku)}|${normalizeComparable(product.ean)}|${normalizeComparable(product.name)}`;
        if (emittedKeys.has(key)) continue;
        emittedKeys.add(key);
        if (!productPassesFilters(product, context)) continue;
        console.log(JSON.stringify(product));
        output++;
      }

      apiProcessed += batch.length;
      if (apiProcessed % 80 === 0 || apiProcessed === uniqueCandidates.length) {
        logProgress(`Processed API data for ${apiProcessed}/${uniqueCandidates.length} products, output ${output} variants`, 3);
      }

      if (apiProcessed < uniqueCandidates.length) {
        await pauseBetweenApiBatches();
      }
    }

    if (output === 0) {
      throw new Error(`No products output. Missing product data pages: ${missingProductData}`);
    }

    if (missingProductData > Math.max(50, productUrls.length * 0.05)) {
      throw new Error(`Too many pages without JSON-LD product data: ${missingProductData}/${productUrls.length}`);
    }

    logProgress(`Scraping complete. Processed ${processed} pages, output ${output} variants, missing ${missingProductData}`, 3);
  } catch (error) {
    logError('Scrape failed', error);
    process.exitCode = 1;
  }
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first<T>(value: T[]): T | undefined {
  return value.length > 0 ? value[0] : undefined;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeComparable(value: unknown): string {
  return normalizeText(value)?.toLowerCase() || '';
}

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = normalizeText(value);
  if (!text) return null;

  const cleaned = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

(async () => {
  const argv = await yargs(hideBin(process.argv))
    .command('metadata', 'Print scraper metadata')
    .command('scrape', 'Run scraper')
    .option('context', {
      type: 'string',
      describe: 'Base64 encoded JSON context',
    })
    .demandCommand(1)
    .parse();

  const command = argv._[0];
  if (command === 'metadata') {
    console.log(JSON.stringify(getMetadata()));
    return;
  }

  if (command === 'scrape') {
    const contextText = argv.context
      ? Buffer.from(String(argv.context), 'base64').toString('utf-8')
      : '{}';
    await scrape(JSON.parse(contextText) as ScriptContext);
    return;
  }

  throw new Error(`Unknown command: ${String(command)}`);
})();
