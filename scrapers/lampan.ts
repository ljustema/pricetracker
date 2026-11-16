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
          INDEX_URL: "https://lampan.se/sitemap.xml.gz",
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
    MAX_CONCURRENCY: 1, // Moderate concurrency after successful recovery
    BATCH_SIZE: 25, // Keep this optimization - fewer database writes
    REQUEST_TIMEOUT: 60,
    MAX_RETRIES: 3, // Same as Python version
    REQUEST_DELAY: 3000, // Small delay to avoid overwhelming the server
    MAX_REQUESTS_PER_MINUTE: 20, // Moderate ceiling: ten requests/second on average
  },

  // Testing settings
  TEST_SETTINGS: {
    TEST_MODE_LIMIT: 200,
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

import { Configuration } from 'crawlee';
import { XMLParser } from 'fast-xml-parser';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { gunzipSync } from 'node:zlib';

let lastLampanRequestStarted = 0;

async function fetchLampanText(url: string, accept: string): Promise<string> {
 const target=new URL(url);
 if(target.protocol!=='https:'||target.hostname!=='lampan.se')throw new Error('Unexpected Lampan resource URL');
 for(let attempt=0;attempt<3;attempt++) {
  const pause=CONFIG.PERFORMANCE.REQUEST_DELAY-(Date.now()-lastLampanRequestStarted);
  if(pause>0)await new Promise(resolve=>setTimeout(resolve,pause));
  lastLampanRequestStarted=Date.now();
  logProgress(`Lampan request ${attempt+1}/3 (timeout 30000ms): ${target.href}`,2);
  let timeoutRetryDelay=5000*(attempt+1);
  try {
   const response=await fetch(url,{headers:{'User-Agent':'PriceTracker/1.0 (+https://www.pricetracker.se)','Accept':accept,'Accept-Language':'sv-SE,sv;q=0.9'},signal:AbortSignal.timeout(30000),size:25000000});
   if(response.status===429&&attempt<2) {
    const retry=response.headers.get('retry-after');
    const requested=retry?(/^\d+$/.test(retry)?Number(retry)*1000:Date.parse(retry)-Date.now()):15000*(attempt+1);
    if(!Number.isFinite(requested)||requested>180000)throw new Error(`Lampan HTTP 429: long Retry-After ${retry||'unknown'}, run stopped`);
    const wait=Math.max(requested,15000*(attempt+1));
    timeoutRetryDelay=wait;
    logProgress(`Rate limited; waiting ${wait}ms before retry ${attempt+2}/3: ${target.href}`,2);
    await response.arrayBuffer();
    await new Promise(resolve=>setTimeout(resolve,wait));
    continue;
   }
   if([500,502,503,504].includes(response.status)&&attempt<2) {
    const wait=5000*(attempt+1);
    logProgress(`Temporary server error HTTP ${response.status}; waiting ${wait}ms before retry ${attempt+2}/3: ${target.href}`,2);
    await response.arrayBuffer();
    await new Promise(resolve=>setTimeout(resolve,wait));
    continue;
   }
   if(!response.ok)throw new Error(`Lampan HTTP ${response.status} ${response.statusText}: ${target.href}`);
   let bytes=Buffer.from(await response.arrayBuffer());
   if(bytes[0]===0x1f&&bytes[1]===0x8b)bytes=gunzipSync(bytes,{maxOutputLength:25000000});
   const text=bytes.toString('utf8');
   if(!text.trim()||/<title>\s*Just a moment|cf-chl-/i.test(text))throw new Error(`Lampan returned an empty page or access challenge: ${target.href}`);
   return text;
  } catch(error) {
   const name=error&&typeof error==='object'&&'name' in error?error.name:null;
   if(name!=='AbortError'&&name!=='TimeoutError')throw error;
   if(attempt===2)throw new Error(`Lampan timeout after 3 attempts (30000ms each): ${target.href}`);
   const wait=timeoutRetryDelay;
   logProgress(`Lampan timeout on attempt ${attempt+1}/3; waiting ${wait}ms before retry ${attempt+2}/3: ${target.href}`,2);
   await new Promise(resolve=>setTimeout(resolve,wait));
  }
 }
 throw new Error(`Lampan request attempts exhausted: ${target.href}`);
}



// Node.js globals
declare const process: any;
declare const Buffer: any;

// ------------------------------------ //
interface LampanCatalog {
 version: number; generatedAt: string; urlChecks?: boolean;
 brands: Array<{id:string;name:string;aliases:string[]}>;
 ownProducts: Array<{id:string;ean:string|null;sku:string|null;brandId:string}>;
 known: Array<{url:string;productId:string;brandId:string;verifiedAt:string|null}>;
 seen: Array<{url:string;verifiedAt:string|null}>;
}
interface LampanListing { url:string;sku:string|null;brandId:string }

function normalizeCatalogBrand(value: string): string {
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function normalizeCatalogSku(value: string): string {
 return value.toLowerCase().replace(/[^a-z0-9]/g,'');
}
function isLampanProductUrl(value: unknown): value is string {
 if(typeof value!=='string')return false;
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='lampan.se'&&/^\/p\/[^?#]+\/$/.test(url.pathname)&&!url.search&&!url.hash;}catch{return false;}
}
function buildCatalogIndex(plan: LampanCatalog) {
 const brandIds=new Map<string,Set<string>>();
 for(const brand of plan.brands)for(const name of [brand.name,...brand.aliases]) {
  const key=normalizeCatalogBrand(name);if(!key)continue;
  if(!brandIds.has(key))brandIds.set(key,new Set());brandIds.get(key)!.add(brand.id);
 }
 const brandFor=(name:string):string|null=>{const ids=brandIds.get(normalizeCatalogBrand(name));return ids?.size===1?[...ids][0]:null;};
 const ownSkus=new Set<string>();const ownEans=new Set<string>();const ownSkuEans=new Map<string,Set<string>>();
 for(const p of plan.ownProducts){const sku=normalizeCatalogSku(p.sku||'');const ean=sanitizeEAN(p.ean);if(ean)ownEans.add(ean);if(sku){const key=p.brandId+'|'+sku;ownSkus.add(key);if(!ownSkuEans.has(key))ownSkuEans.set(key,new Set());if(ean)ownSkuEans.get(key)!.add(ean);}}
 return {brandFor,ownSkus,ownEans,ownSkuEans};
}
function catalogIdentifierConflict(product:ScrapedProductData,index:ReturnType<typeof buildCatalogIndex>):string|null {
 const ean=sanitizeEAN(product.ean),brandId=index.brandFor(product.brand||'');
 if(!brandId)return null;
 const known=index.ownSkuEans.get(brandId+'|'+normalizeCatalogSku(product.sku||''));
 if(ean&&index.ownEans.has(ean))return null;
 if(ean&&known?.size&&!known.has(ean))return 'conflicting_ean_for_own_sku_brand';
 if(!ean&&known&&known.size>1)return 'ambiguous_own_sku_brand';
 return null;
}
function extractBrandLinks(html: string,plan: LampanCatalog): Array<{url:string;brandId:string}> {
 const $=cheerio.load(html);const index=buildCatalogIndex(plan);const results=new Map<string,{url:string;brandId:string}>();
 $('a[href]').each((_i,element)=>{
  const raw=$(element).attr('href');if(!raw)return;const url=new URL(raw,CONFIG.SITE.BASE_URL);
  if(url.hostname!=='lampan.se'||url.protocol!=='https:'||!/^\/varumarken\/[^/]+\/$/.test(url.pathname))return;
  const id=index.brandFor($(element).text().trim())||index.brandFor($(element).find('img').attr('alt')||'')||index.brandFor(decodeURIComponent(url.pathname.split('/')[2]));
  if(id)results.set(url.href,{url:url.href,brandId:id});
 });
 return [...results.values()].sort((a,b)=>a.url.localeCompare(b.url));
}
function extractBrandListings(html: string,brandId:string,plan:LampanCatalog): {items:LampanListing[];total:number;page:number} {
 const $=cheerio.load(html);const index=buildCatalogIndex(plan);const items=new Map<string,LampanListing>();
 const read=(node:any):void=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(read);return;}
  if(node.mainEntity?.itemListElement) {
   for(const entry of node.mainEntity.itemListElement) {
    const p=entry.item;if(!p)continue;const brand=typeof p.brand==='string'?p.brand:p.brand?.name;
    if(!brand||index.brandFor(brand)!==brandId)continue;
    const offers=Array.isArray(p.offers)?p.offers:[p.offers];
    const url=p.url||offers.find((o:any)=>isLampanProductUrl(o?.url))?.url;
    if(isLampanProductUrl(url))items.set(url,{url,sku:typeof p.sku==='string'?p.sku:null,brandId});
   }
  }
  if(node['@graph'])read(node['@graph']);
 };
 $('script[type="application/ld+json"]').each((_i,element)=>{try{read(JSON.parse($(element).text()));}catch{}});
 const text=$('.pagination-load-more__num-products').first().text();
 const count=text.match(/\(\s*([\d\s]+)\s+av\s+([\d\s]+)\s*\)/);
 const total=count?Number(count[2].replace(/\s/g,'')):items.size;
 const page=Number(html.match(/WGR\.pagination\.init\(\{"page":(\d+)/)?.[1]||1);
 return {items:[...items.values()],total,page};
}
async function discoverCatalogListings(plan:LampanCatalog):Promise<LampanListing[]> {
 const html=await fetchLampanText('https://lampan.se/varumarken/','text/html');
 const brands=extractBrandLinks(html,plan);
 if(!brands.length&&plan.brands.length)throw new Error('No owned brands could be identified on Lampan');
 const items=new Map<string,LampanListing>();
 for(const brand of brands) {
  const first=extractBrandListings(await fetchLampanText(brand.url,'text/html'),brand.brandId,plan);
  if(first.total>0&&!first.items.length)throw new Error('Brand listing has no usable product identifiers');
  const collected=new Map(first.items.map(p=>[p.url,p]));
  const pages=first.items.length?Math.ceil(first.total/first.items.length):1;
  if(pages>150)throw new Error('Unexpected Lampan brand pagination size');
  if(pages>1) {
   const lastUrl=new URL(brand.url);lastUrl.searchParams.set('page',String(pages));
   const last=extractBrandListings(await fetchLampanText(lastUrl.href,'text/html'),brand.brandId,plan);
   last.items.forEach(p=>collected.set(p.url,p));
   // The public load-more URL currently returns all pages through page=N.
   // Fall back to normal pagination if Lampan changes that behavior.
   if(collected.size<first.total)for(let page=2;page<pages;page++) {
    const url=new URL(brand.url);url.searchParams.set('page',String(page));
    const next=extractBrandListings(await fetchLampanText(url.href,'text/html'),brand.brandId,plan);
    next.items.forEach(p=>collected.set(p.url,p));
   }
  }
  if(collected.size<first.total)throw new Error(`Incomplete brand discovery: ${collected.size}/${first.total}`);
  for(const p of collected.values())items.set(p.url,p);
  logProgress(`Discovered ${collected.size} products within owned brand ${brand.brandId}`,1);
 }
 logProgress(`Brand discovery selected ${brands.length} owned brands and ${items.size} product URLs`,1);
 return [...items.values()];
}
function selectDiscoveryUrls(listings:LampanListing[],plan:LampanCatalog,visited:Set<string>,limit:number):string[] {
 const index=buildCatalogIndex(plan);const seen=new Map(plan.seen.map(p=>[p.url,p.verifiedAt]));
 const stamp=(value:string|null|undefined)=>value?Date.parse(value):0;
 const candidates=listings.filter(p=>!visited.has(p.url)).sort((a,b)=>(stamp(seen.get(a.url))-stamp(seen.get(b.url)))||a.url.localeCompare(b.url));
 const own=(p:LampanListing)=>index.ownSkus.has(p.brandId+'|'+normalizeCatalogSku(p.sku||''));
 const potential=candidates.filter(own),explore=candidates.filter(p=>!own(p));
 // Reserve exploration for EAN-only matches/new supplier SKU spellings too.
 const ownQuota=Math.ceil(limit*2/3);
 const selected=[...potential.slice(0,ownQuota),...explore.slice(0,limit-ownQuota)];
 const chosen=new Set(selected.map(p=>p.url));
 for(const p of candidates)if(selected.length<limit&&!chosen.has(p.url)){selected.push(p);chosen.add(p.url);}
 return selected.map(p=>p.url);
}
async function runLampanCatalog(context:ScriptContext):Promise<void> {
 const plan=context.lampanCatalog;
 if(!plan||plan.version!==1||!Array.isArray(plan.known)||!Array.isArray(plan.ownProducts)||!Array.isArray(plan.brands)||!Array.isArray(plan.seen))throw new Error('Complete Lampan catalog context is required');
 if(!plan.ownProducts.length||!plan.brands.length)throw new Error('Own catalog or owned brands are empty');
 const index=buildCatalogIndex(plan);const visited=new Set<string>();
 const maximum=context.isValidation?20:context.isTestRun?CONFIG.TEST_SETTINGS.TEST_MODE_LIMIT:2100;
 const discoveryBudget=context.isValidation?5:context.isTestRun?Math.ceil(maximum/5):100;
 const known=[...new Set(plan.known.filter(p=>isLampanProductUrl(p.url)&&plan.brands.some(b=>b.id===p.brandId)).map(p=>p.url))].slice(0,maximum-discoveryBudget);
 const checked:string[]=[];let pages=0;let accepted=0;let serverErrors=0;let consecutiveServerErrors=0;let identityConflicts=0;const conflictUrls:string[]=[];
 const flushChecks=()=>{if(checked.length&&plan.urlChecks)console.log(JSON.stringify({type:'lampan_url_checks',urls:checked.splice(0)}));else checked.length=0;};
 const read=async(url:string)=>{
  visited.add(url);
  let html:string;
  try{html=await fetchLampanText(url,'text/html');}
  catch(error){
   if(error instanceof Error&&/Lampan HTTP (500|502|503|504) /.test(error.message)) {
    serverErrors++;consecutiveServerErrors++;pages++;checked.push(url);
    logProgress(`WARNING: Product skipped after server error retries; price not verified: ${url}`,2);
    if(consecutiveServerErrors>=3||serverErrors>=10)throw new Error(`Lampan server errors exceeded safety limit (${consecutiveServerErrors} consecutive, ${serverErrors} total): ${url}`);
    if(checked.length>=20)flushChecks();
    return;
   }
   if(error instanceof Error&&/Lampan HTTP (404|410) /.test(error.message)){checked.push(url);pages++;if(checked.length>=20)flushChecks();logProgress(`Product page removed: ${url}`,2);return;}throw error;}
  consecutiveServerErrors=0;
  const product=await extractProductData(cheerio.load(html),url);pages++;checked.push(url);
  const brandId=product?index.brandFor(product.brand||''):null;
  const identityConflict=product?catalogIdentifierConflict(product,index):null;
  if(identityConflict){identityConflicts++;if(conflictUrls.length<10)conflictUrls.push(url);logProgress(`Identifier conflict (${identityConflict}), not emitted: ${url}`,2);}
  if(product&&!identityConflict&&product.competitor_price!==null&&product.competitor_price>0&&brandId&&
    (sanitizeEAN(product.ean)||(product.brand&&normalizeCatalogSku(product.sku||'')))&&productPassesFilters(product)) {
   console.log(JSON.stringify(product));accepted++;
  }
  if(checked.length>=20)flushChecks();
  if(pages%20===0)logProgress(`Catalog progress: ${pages} pages checked, ${accepted} valid prices`,2);
 };
 try {
  logProgress(`Priority refresh: ${known.length}/${plan.known.length} known own URLs; discovery reserve ${discoveryBudget}`,1);
  for(const url of known)await read(url);
  const listings=await discoverCatalogListings(plan);
  const allKnown=new Set([...visited,...plan.known.map(p=>p.url)]);
  const discovery=selectDiscoveryUrls(listings,plan,allKnown,discoveryBudget);
  logProgress(`Discovery checks: ${discovery.length} product pages within owned brands`,1);
  for(const url of discovery)await read(url);
 }finally{flushChecks();}
 logProgress(`LAMPAN_CATALOG_COMPLETE ${JSON.stringify({pages,accepted,known:known.length,ownedBrands:plan.brands.length,serverErrors,identityConflicts,conflictUrls})}`,2);
}


// ------- INTERFACES SECTION --------- //
// ------------------------------------ //

interface ScriptContext {
  lampanCatalog?: LampanCatalog;
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
    version: "2.0.0",
    description: `Product data collector for ${CONFIG.SITE.NAME} using catalog-prioritized low-rate product scraping`,
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
  const xml = await fetchLampanText(sitemapUrl, 'application/xml, text/xml, */*');
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_' }).parse(xml);
  if (!parsed.urlset) throw new Error('Lampan sitemap is not a urlset');
  const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
  const urls = entries.map((entry: any) => entry?.loc).filter((value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'lampan.se' && url.pathname.startsWith('/p/');
    } catch { return false; }
  });
  const unique = [...new Set<string>(urls)];
  logProgress(`Read ${unique.length} product URLs from Lampan's advertised sitemap`);
  return unique;
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

/** Read the page's own Product from JSON-LD, including ItemPage and @graph wrappers. */
function extractStructuredProduct($: any, url: string): any | null {
  const products: any[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.includes('Product')) products.push(node);
    // Do not descend into offers or related/recommended products.
    visit(node.mainEntity);
    visit(node['@graph']);
  };
  $(CONFIG.PRODUCT_EXTRACTION.SCHEMA_ORG.SCRIPT_SELECTOR).each((_i: number, element: any) => {
    try { visit(JSON.parse($(element).text())); }
    catch (error) { logError(`Invalid product JSON-LD for ${url}`, error); }
  });
  const normalizeUrl = (value: string): string => {
    const parsed = new URL(value, url);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  };
  return products.find(product => {
    if (typeof product.url !== 'string') return false;
    try { return normalizeUrl(product.url) === normalizeUrl(url); }
    catch { return false; }
  }) || (products.length === 1 && !products[0].url ? products[0] : null);
}

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

    // Lampan now publishes identifiers in ItemPage.mainEntity JSON-LD.
    const structuredProduct = extractStructuredProduct($, url);
    if (structuredProduct) {
      // The old price meta tag is also absent: use the current offer, not
      // combinations[0].price, which may contain the undiscounted price.
      const offers = Array.isArray(structuredProduct.offers)
        ? structuredProduct.offers : [structuredProduct.offers];
      const matchingOffers = offers.filter((offer: any) => {
        if (!offer || typeof offer !== 'object') return false;
        if (!offer.url) return true;
        try {
          return new URL(offer.url, url).pathname.replace(/\/$/, '') === new URL(url).pathname.replace(/\/$/, '')
            && new URL(offer.url, url).origin === new URL(url).origin;
        } catch { return false; }
      });
      if (matchingOffers.length === 1) {
        const offer = matchingOffers[0];
        const price = Number(offer.price);
        if (Number.isFinite(price) && price > 0) {
          productData.competitor_price = price;
          productData.raw_price = String(offer.price);
          if (typeof offer.priceCurrency === 'string') productData.currency_code = offer.priceCurrency;
        }
      }
      if (!productData.brand) {
        const brand = typeof structuredProduct.brand === 'string'
          ? structuredProduct.brand : structuredProduct.brand?.name;
        productData.brand = typeof brand === 'string' ? brand.trim() || null : null;
      }
      if (!productData.ean) {
        for (const key of ['gtin13', 'gtin8', 'gtin12', 'gtin14', 'gtin']) {
          const value = structuredProduct[key];
          if (typeof value !== 'string') continue;
          productData.ean = sanitizeEAN(value);
          if (productData.ean) break;
        }
      }
      if (!productData.sku && typeof structuredProduct.sku === 'string') {
        productData.sku = structuredProduct.sku.trim() || null;
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
  logProgress(`Reading ${productUrls.length} product pages sequentially, at most one request/second`, 2);
  const pending: ScrapedProductData[] = [];
  let checked = 0;
  const flush = () => {
    for (const product of pending) console.log(JSON.stringify(product));
    pending.length = 0;
  };
  try {
    for (const url of productUrls) {
      const started = Date.now();
      const html = await fetchLampanText(url, 'text/html');
      const product = await extractProductData(cheerio.load(html), url);
      checked++;
      if (product && productPassesFilters(product)) pending.push(product);
      if (pending.length >= CONFIG.PERFORMANCE.BATCH_SIZE) flush();
      if (checked % 10 === 0) logProgress(`Checked ${checked}/${productUrls.length} product pages`, 2);
      // No retries or session rotation on access denial: stop the bounded run.
      const wait = CONFIG.PERFORMANCE.REQUEST_DELAY - (Date.now() - started);
      if (wait > 0 && checked < productUrls.length) await new Promise(resolve => setTimeout(resolve, wait));
    }
  } finally {
    flush();
  }
  logProgress(`Finished ${checked} product-page checks`, 2);
}

// ------------------------------------ //
// ------- MAIN SCRAPE FUNCTION ------- //
// ------------------------------------ //

/**
 * Main scraping function with 2-step process and database batching
 */
async function scrape(context: ScriptContext): Promise<void> {
  // LAMPAN_CATALOG_PLAN_V1: no unfiltered fallback when catalog context is missing.
  CONFIG.FILTERING.ENABLED = false;
  await runLampanCatalog(context);
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
