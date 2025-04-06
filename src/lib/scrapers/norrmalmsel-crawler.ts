// pricetracker/src/lib/scrapers/norrmalmsel-crawler.ts

import {
    CheerioCrawler,
    RequestQueue,
    Dataset,
    log,
    LogLevel,
    CheerioCrawlingContext, // Import context type
    Request, // Import Request type for failed handler
    Log, // Import Log type for failed handler
    CheerioCrawlerOptions, // Correct options type
} from 'crawlee';
import * as cheerio from 'cheerio'; // Import cheerio namespace
import { URL } from 'url'; // Use Node.js URL
import { ScrapedProductData } from '../services/scraper-types'; // Use relative path for robustness

// --- Constants ---
const BASE_URL = "https://www.norrmalmsel.se";
const BRAND_URL = "https://www.norrmalmsel.se/varumarken";
const LABELS = {
    BRAND_LIST: 'BRAND_LIST',
    BRAND_PAGE: 'BRAND_PAGE',
    PRODUCT_DETAIL: 'PRODUCT_DETAIL',
};
const PROGRESS_BATCH_SIZE = 100; // Report progress every 100 products

// --- Types ---
export type ProgressCallback = (data: {
    processedProductCount: number;
    batchNumber: number;
    estimatedTotalProducts?: number; // Optional: Can be estimated later
}) => Promise<void>;


// --- Helper Functions ---

/**
 * Extracts and cleans the price from text.
 * @param priceText Raw price string
 * @returns Parsed price as a number or null
 */
function parsePrice(priceText: string | undefined | null): number | null {
    if (!priceText) return null;
    let cleanedPrice = priceText.replace(/kr|sek|\s|&nbsp;/gi, '').trim();
    cleanedPrice = cleanedPrice.replace(',', '.');
    cleanedPrice = cleanedPrice.replace(/[^\d.]/g, '');
    const parts = cleanedPrice.split('.');
    if (parts.length > 2) {
        cleanedPrice = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    } else if (parts.length === 2 && parts[0] === '') {
        cleanedPrice = '0' + cleanedPrice;
    } else if (parts.length === 1 && cleanedPrice !== '') {
         // Integer price
    } else if (cleanedPrice === '' || cleanedPrice === '.') {
        return null;
    }
    try {
        const price = parseFloat(cleanedPrice);
        return isNaN(price) ? null : price;
    } catch (_error) {
        log.warning(`Could not parse price from cleaned string: '${cleanedPrice}' (original: '${priceText}')`);
        return null;
    }
}

/**
 * Parses product details from the Cheerio context of a product page.
 * @param $ CheerioAPI context from Crawlee
 * @param productUrl The URL of the product page
 * @returns Scraped product data or null if essential info is missing
 */
function parseProductDetails($: cheerio.CheerioAPI, productUrl: string): Partial<Omit<ScrapedProductData, 'scraper_id' | 'competitor_id' | 'user_id' | 'scraped_at' | 'product_id'>> | null {
    const product: Partial<ScrapedProductData> = { url: productUrl };
    try {
        product.name = $('h1[data-testid="product-title"]').first().text().trim() || undefined;
        const metaPrice = $('meta[property="product:price:amount"]').attr('content');
        if (metaPrice) {
            product.price = parsePrice(metaPrice) ?? undefined;
        } else {
            const priceDivText = $('div.price.n77d0ua').first().text();
            product.price = parsePrice(priceDivText) ?? undefined;
        }
        product.brand = $('#drop-header-brand span.drop-text').first().text().trim() || undefined;
        let imageUrl = $('div.slick-slide.slick-active.slick-current picture[data-flight-image] img').first().attr('src');
        if (!imageUrl) {
            imageUrl = $(`img[alt="${product.name}"]`).first().attr('src');
        }
        if (imageUrl) {
            try { product.image_url = new URL(imageUrl, BASE_URL).toString(); }
            catch (_urlError) { log.warning(`Invalid image URL found: ${imageUrl} on page ${productUrl}`); product.image_url = undefined; }
        } else { product.image_url = undefined; }
        product.sku = undefined;
        $('tr').each((_, element) => {
            const tr = $(element); const th = tr.find('th');
            if (th.text().trim() === 'Artikelnummer') { product.sku = th.next('td').text().trim(); return false; }
        });
        product.ean = undefined;
        $('#article-details tr').each((_, element) => {
            const tr = $(element); const th = tr.find('th');
            if (th.text().includes('EAN')) { product.ean = th.next('td').text().trim(); return false; }
        });
        product.currency = 'SEK';
        if (!product.name || product.price === undefined) {
            log.debug(`Skipping product - missing essential info (name or price): ${productUrl}`); return null;
        }
        const hasEan = !!product.ean; const hasBrandSku = !!product.brand && !!product.sku;
        if (!hasEan && !hasBrandSku) {
             log.debug(`Skipping product - insufficient identification (EAN or Brand+SKU): Name='${product.name}', Brand='${product.brand}', SKU='${product.sku}', EAN='${product.ean}' (${productUrl})`); return null;
        }
        return { name: product.name, price: product.price, currency: product.currency, url: product.url, image_url: product.image_url, sku: product.sku, brand: product.brand, ean: product.ean };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Error parsing product details for ${productUrl}: ${errorMessage}`); return null;
    }
}

// --- Main Scraper Function ---
interface NorrmalmselScraperOptions {
  isValidationRun?: boolean;
  maxRequests?: number;
  onProgress?: ProgressCallback; // Add callback parameter
}

export async function runNorrmalmselScraper(options: NorrmalmselScraperOptions = {}): Promise<ScrapedProductData[]> {
    log.setLevel(LogLevel.DEBUG);
    const start = Date.now(); // Define start time

    // --- Configure Crawlee to use MemoryStorage explicitly via Configuration ---
    // This sets the default storage for subsequent operations

    // Progress tracking variables
    let processedProductCount = 0;
    let batchNumber = 0;
    const onProgress = options.onProgress; // Get callback from options

    // Initialize RequestQueue and Dataset. They should use the storage from the Configuration instance.
    const requestQueue = await RequestQueue.open();
    const dataset = await Dataset.open();
    await requestQueue.addRequest({ url: BRAND_URL, label: LABELS.BRAND_LIST });

    // Define crawler options
    const crawlerOpts: CheerioCrawlerOptions = {
        requestQueue, // Pass the opened queue instance
        // dataset is NOT a direct crawler option, it's used within handlers
        maxConcurrency: 50,
        maxRequestRetries: options.isValidationRun ? 1 : 3,
        requestHandlerTimeoutSecs: 60,
        useSessionPool: true,
        // No need to pass configuration object itself here
    };

    // Apply maxRequestsPerCrawl conditionally
    if (options.maxRequests !== undefined && options.maxRequests !== null) {
        crawlerOpts.maxRequestsPerCrawl = options.maxRequests;
        log.info(`Limiting crawl to ${crawlerOpts.maxRequestsPerCrawl} requests.`);
    } else if (options.isValidationRun) {
        crawlerOpts.maxRequestsPerCrawl = 15;
        log.info(`Running in validation mode (default limit). Max requests: ${crawlerOpts.maxRequestsPerCrawl}`);
    }

    const crawler = new CheerioCrawler({
        ...crawlerOpts, // Spread the options

        // Define handlers directly in the constructor options
        async requestHandler(context: CheerioCrawlingContext) {
            // Defensive check for log object
            if (!context.log) {
                console.error(`Run ${context.request?.id || 'unknown'}: Crawlee context.log is undefined! URL: ${context.request?.url}`);
            }
            // Use the dataset instance scoped outside the handler
            const currentDataset = dataset;
            const currentRequestQueue = requestQueue;

            const { request, $, enqueueLinks, log } = context; // log might be undefined here if check above fails
            // Use log safely
            if (log) log.info(`Processing [${request.label || 'START'}]: ${request.url}`); else console.log(`Processing [${request.label || 'START'}]: ${request.url}`);

            if (request.label === LABELS.BRAND_LIST) {
                const brandLinks = $('li.s1e1rog7 a[href]')
                    .map((_, el) => { const href = $(el).attr('href'); return href ? new URL(href, BASE_URL).toString() : null; })
                    .get().filter((link): link is string => link !== null);
                if (log) log.info(`Found ${brandLinks.length} brand links.`); else console.log(`Found ${brandLinks.length} brand links.`);
                // Use the requestQueue instance defined outside
                for (const link of brandLinks) { await currentRequestQueue.addRequest({ url: link, label: LABELS.BRAND_PAGE }); }
            } else if (request.label === LABELS.BRAND_PAGE) {
                if (log) log.debug(`Extracting product links from brand page: ${request.url}`); else console.log(`Extracting product links from brand page: ${request.url}`);
                const productLinks = await enqueueLinks({ selector: 'div.product-card a', label: LABELS.PRODUCT_DETAIL, baseUrl: BASE_URL });
                if (log) log.info(`Enqueued ${productLinks.processedRequests.length} product links from ${request.url}`); else console.log(`Enqueued ${productLinks.processedRequests.length} product links from ${request.url}`);
                const paginationLinks = await enqueueLinks({ selector: 'a.s17fl53a.s5htbx1', label: LABELS.BRAND_PAGE, baseUrl: BASE_URL });
                if (paginationLinks.processedRequests.length > 0) { if (log) log.info(`Enqueued next page link: ${paginationLinks.processedRequests[0].uniqueKey}`); else console.log(`Enqueued next page link: ${paginationLinks.processedRequests[0].uniqueKey}`); }
                else { if (log) log.info(`No next page link found on ${request.url}`); else console.log(`No next page link found on ${request.url}`); }
            } else if (request.label === LABELS.PRODUCT_DETAIL) {
                if (log) log.debug(`Parsing product details: ${request.url}`); else console.log(`Parsing product details: ${request.url}`);
                const productData = parseProductDetails($, request.url);
                if (productData) {
                    if (log) log.info(`Successfully parsed product: ${productData.name}`); else console.log(`Successfully parsed product: ${productData.name}`);
                    processedProductCount++; // Increment count defined outside
                    // Use the dataset instance defined outside
                    await currentDataset.pushData(productData);
                    // Use onProgress and batchNumber defined outside
                    if (onProgress && processedProductCount % PROGRESS_BATCH_SIZE === 0) {
                        batchNumber++;
                        if (log) log.debug(`Reporting progress: Batch ${batchNumber}, Products ${processedProductCount}`); else console.log(`Reporting progress: Batch ${batchNumber}, Products ${processedProductCount}`);
                        try { await onProgress({ processedProductCount, batchNumber }); }
                        catch (progressError) { if (log) log.error(`Error in onProgress callback: ${progressError}`); else console.error(`Error in onProgress callback: ${progressError}`); }
                    }
                } else { if (log) log.warning(`Failed to parse sufficient details for: ${request.url}`); else console.warn(`Failed to parse sufficient details for: ${request.url}`); }
            } else {
                 if (log) log.warning(`Default handler processing unexpected URL/Label: [${request.label || 'NO_LABEL'}] ${request.url}`); else console.warn(`Default handler processing unexpected URL/Label: [${request.label || 'NO_LABEL'}] ${request.url}`);
            }
        },

        failedRequestHandler({ request, log }: { request: Request; log: Log }) {
             // Defensive check for log object
            if (!log) {
                console.error(`Run ${request?.id || 'unknown'}: Crawlee failedRequestHandler log is undefined! URL: ${request?.url}`);
                return; // Cannot log the error if log is undefined
            }
            log.error(`Request failed: ${request.url} (Retries: ${request.retryCount})`);
        },
    });

    log.info('>>> Starting NorrmalmsEl scraper (await crawler.run())...'); // Log before
    try {
        await crawler.run();
    } catch (crawlError) {
        // Log the error message specifically
        const errorMessage = crawlError instanceof Error ? crawlError.message : String(crawlError);
        log.error(`>>> ERROR during crawler.run(): ${errorMessage}`, { error: crawlError });
        throw crawlError; // Re-throw error to be caught by service
    }
    log.info('>>> Finished NorrmalmsEl scraper (await crawler.run()).'); // Log after
    log.info('NorrmalmsEl scraper finished.');

    // --- Final Progress Report (if needed) ---
    // Use onProgress, processedProductCount, batchNumber defined outside
    if (onProgress && processedProductCount % PROGRESS_BATCH_SIZE !== 0 && processedProductCount > 0) {
        batchNumber++;
        log.debug(`Reporting final progress: Batch ${batchNumber}, Products ${processedProductCount}`);
         try { await onProgress({ processedProductCount, batchNumber }); }
         catch (progressError) { log.error(`Error in final onProgress callback: ${progressError}`); }
    }

    // --- Data Processing & Filtering (Post-Crawl) ---
    log.info('Fetching scraped data...');
    // Use the dataset instance defined outside
    const results = await dataset.getData();
    const items = results.items as ScrapedProductData[];

    log.info(`Retrieved ${items.length} raw items from dataset.`);
    const filteredItems = items.filter(item => item !== null) as ScrapedProductData[];

    // Use start time defined outside
    const duration = (Date.now() - start) / 1000;
    log.info(`Scraping took ${duration.toFixed(2)} seconds. Found ${filteredItems.length} valid products.`);

    // Use processedProductCount defined outside
    if (filteredItems.length !== processedProductCount) {
         log.warning(`Mismatch between final filtered count (${filteredItems.length}) and incrementally counted products (${processedProductCount}). Using filtered count.`);
    }

    return filteredItems;
}

// --- Test Execution (Optional, for direct running) ---
// if (require.main === module) {
//     (async () => {
//         const products = await runNorrmalmselScraper({
//              async onProgress(data) {
//                  console.log(`--- Progress Update ---`);
//                  console.log(`Batch Number: ${data.batchNumber}`);
//                  console.log(`Products Processed: ${data.processedProductCount}`);
//                  console.log(`-----------------------`);
//              }
//         });
//         console.log(`Found ${products.length} products.`);
//         // await Dataset.exportToCSV('norrmalmsel_products'); // This would fail with memory storage
//     })();
// }