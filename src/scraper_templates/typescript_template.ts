/**
 * TypeScript Scraper Template for PriceTracker
 *
 * IMPORTANT: Output one JSON object per product, per line (JSONL) to stdout using console.log().
 * This is required for compatibility with the PriceTracker worker and validation system.
 *
 * This template provides a structure for creating TypeScript-based scrapers
 * that integrate with the PriceTracker worker system.
 *
 * CUSTOM FIELDS: You can scrape any additional fields you want! PriceTracker now supports
 * custom fields, so feel free to extract specifications, descriptions, dimensions, or any
 * other product data. Just add them to your ScrapedProductData interface and they will be
 * stored as custom fields automatically.
 */

// --- Dependencies ---
// TODO: Install types: npm i --save-dev @types/yargs
import yargs from 'yargs'; // For command-line argument parsing
import { hideBin } from 'yargs/helpers';
// import { promises as fs } from 'fs'; // Ensure this unused import is removed or commented
// Add other necessary imports for your scraper here, e.g.:
// import fetch from 'node-fetch';
// import * as cheerio from 'cheerio';

// --- Types/Interfaces ---

/**
 * Defines the structure for scraped product data.
 * Align this with the `temp_competitors_scraped_data` table schema.
 */
interface ScrapedProductData {
    competitor_url: string; // Renamed from url to match database schema
    name: string;
    competitor_price: number | null; // Updated field name to match temp_competitors_scraped_data table
    currency_code: string | null; // Updated field name to match temp_competitors_scraped_data table
    sku?: string | null;
    brand?: string | null;
    ean?: string | null;
    description?: string | null;
    image_url?: string | null;
    is_available: boolean;
    raw_price?: string | null; // Optional: Store the raw price string
    // Add other fields as needed
}

/**
 * Defines the structure for the scraper's metadata.
 */
interface ScriptMetadata {
    name: string;
    version: string;
    description: string;
    target_url: string; // Base URL or main entry point
    required_libraries?: string[]; // e.g., ['cheerio', 'node-fetch'] - Informational
    batch_size?: number; // Number of products to process before outputting a batch
    // Add other relevant metadata as needed
}

/**
 * Defines the context object passed by the worker during execution.
 */
interface ScriptContext {
    activeBrandNames?: string[];
    filterByActiveBrands?: boolean;
    ownProductEans?: string[];
    ownProductSkuBrands?: { sku: string; brand: string }[];
    scrapeOnlyOwnProducts?: boolean;
    isTestRun?: boolean;
    run_id?: string; // Added missing run_id from context
    // Worker might inject helper functions like log, safeFetch, dbClient etc.
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) => void;
    // safeFetch?: (url: string, options?: any) => Promise<Response>; // Example helper
}

// --- Logging Helper ---
// Use console.error for logging, prefixed as required by the worker
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

// --- Helper Functions ---
// Define helper functions for fetching, parsing, etc.
// Example:
// async function fetchPage(context: ScriptContext, url: string): Promise<string | null> {
//     const fetchFn = context.safeFetch || fetch; // Use injected fetch or global
//     try {
//         log(context, 'debug', `Fetching URL: ${url}`);
//         const response = await fetchFn(url, {
//             headers: { 'User-Agent': 'PriceTrackerBot/1.0' },
//             // Add timeout handling if using node-fetch or similar
//         });
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         return await response.text();
//     } catch (error: any) {
//         log(context, 'error', `Error fetching ${url}: ${error.message}`, { error });
//         return null;
//     }
// }

// function parseProductPage(context: ScriptContext, htmlContent: string, url: string): ScrapedProductData | null {
//     try {
//         // const $ = cheerio.load(htmlContent);
//         // ... Extract data using cheerio selectors ...
//         // Example structure:
//         // const productData: ScrapedProductData = {
//         //     url: url,
//         //     name: $('h1').text().trim(),
//         //     price: parseFloat($('.price').text().replace(/[^0-9.]/g, '')),
//         //     currency: 'USD', // Extract currency
//         //     sku: $('.sku').text().trim() || undefined,
//         //     brand: $('.brand').text().trim() || undefined,
//         //     ean: $('.ean').text().trim() || undefined,
//         //     is_available: $('.availability').text().toLowerCase().includes('in stock'),
//         //     // ... other fields
//         // };
//         // return productData;
//         return null; // Replace with actual implementation
//     } catch (error: any) {
//         log(context, 'error', `Error parsing page ${url}: ${error.message}`, { error });
//         return null;
//     }
// }


// --- Core Scraper Functions ---

/**
 * Returns metadata about the scraper.
 */
function getMetadata(): ScriptMetadata {
    // IMPORTANT: Only use standard libraries here.
    // Third-party libraries should be imported within the 'scrape' function.
    const metadata: ScriptMetadata = {
        name: "My TypeScript Scraper Template", // CHANGE THIS
        version: "1.1.0", // CHANGE THIS
        description: "Description of what this TS scraper does.", // CHANGE THIS
        target_url: "https://example.com", // Base URL or main entry point - CHANGE THIS
        required_libraries: ["node-fetch", "cheerio"], // List libraries needed by 'scrape' function
        // Add other relevant metadata as needed
    };
    return metadata;
}

/**
 * Main scraping function. It should:
 * 1. Perform the scraping logic (fetching pages, parsing data).
 * 2. Apply filtering based on the provided context if necessary.
 * 3. Print one JSON object per valid product found to stdout using console.log().
 *    IMPORTANT: Output one JSON object per product, per line (JSONL).
 * 4. Print progress and error messages to stderr using logProgress() and logError().
 */
async function scrape(context: ScriptContext): Promise<void> {
    logProgress("Scrape function started.");
    logProgress(`Received context: ${JSON.stringify(context)}`); // Be careful logging full context

    // --- Import required libraries listed in get_metadata() HERE ---
    let _fetch: unknown; // Use 'unknown' for safer dynamic imports
    let _cheerio: unknown;
    try {
        // Use dynamic import for libraries that might not be globally available
        // fetch = (await import('node-fetch')).default; // Commented out unused example assignment
        // cheerio = await import('cheerio'); // Commented out unused example assignment
        // import other libraries...
    } catch (e) {
        logError(`Failed to import required libraries. Ensure they are installed and listed in get_metadata().`, e);
        process.exit(1); // Exit if essential libraries are missing
    }

    // --- Extract context variables ---
    // const runId = context.run_id || 'N/A'; // Commented out unused example assignment
    const isTestRun = context.isTestRun ?? false;
    const filterByActiveBrands = context.filterByActiveBrands ?? false;
    const activeBrandNames = filterByActiveBrands ? new Set(context.activeBrandNames || []) : null;
    const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;
    const ownProductEans = scrapeOnlyOwnProducts ? new Set(context.ownProductEans || []) : null;
    // const ownProductSkuBrands = scrapeOnlyOwnProducts ? new Set((context.ownProductSkuBrands || []).map(p => `${p.sku}::${p.brand}`)) : null; // Add if needed

    // --- Scraper Implementation ---
    // Replace this example logic with your actual scraping code.

    const base_url = "https://example.com/products"; // Get from metadata or define here
    logProgress(`Starting scrape for base URL: ${base_url}`);

    // Example: Find product links (replace with actual logic)
    let productLinks = Array.from({ length: 24 }, (_, i) => `${base_url}/item-ts-${i + 1}`); // Dummy links (TS equivalent)
    logProgress(`Found ${productLinks.length} potential product links.`);

    if (isTestRun) {
        logProgress("Test run detected, limiting to 5 products.");
        productLinks = productLinks.slice(0, 5);
    }

    let productCount = 0;
    for (const link of productLinks) {
        try {
            logProgress(`Processing product link: ${link}`);

            // Example: Fetch product page
            // const response = await fetch(link);
            // if (!response.ok) {
            //     logError(`HTTP error fetching ${link}: ${response.status}`);
            //     continue;
            // }
            // const productHtml = await response.text();

            // Example: Parse product data (replace with actual parsing)
            // const $ = cheerio.load(productHtml);
            // const name = $('h1').text().trim();
            // const priceStr = $('.price').text().trim().replace(/[^0-9.]/g, '');
            // const price = parseFloat(priceStr);
            // const sku = $('.sku').text().trim() || undefined;
            // const brand = $('.brand').text().trim() || undefined;
            // const ean = $('.ean').text().trim() || undefined;
            // const imageUrl = $('img.product-image').attr('src');
            // const isAvailable = $('.availability').text().toLowerCase().includes('in stock');

            // Dummy data for example:
            const name = `TS Product from ${link}`;
            const price = 10.99 + productCount;
            const sku = `TS_SKU_${productCount}`;
            const brand = productCount % 2 === 0 ? "TypeScriptBrand" : "AnotherTSBrand";
            const ean = productCount % 3 === 0 ? `9876543210${productCount.toString().padStart(3, '0')}` : undefined;
            const imageUrl = `${link}/image.jpg`;
            const isAvailable = true;

            const productData: ScrapedProductData = {
                name: name,
                competitor_price: price,
                currency_code: "SEK", // Or detect from page
                competitor_url: link, // Updated field name to match database schema
                image_url: imageUrl,
                sku: sku,
                brand: brand,
                ean: ean,
                is_available: isAvailable,
            };

            // --- Filtering Logic (Optional) ---
            let passesFilter = true;
            if (filterByActiveBrands && activeBrandNames) {
                if (!productData.brand || !activeBrandNames.has(productData.brand)) {
                    logProgress(`Skipping product (inactive brand): ${name} (${productData.brand})`);
                    passesFilter = false;
                }
            }
            if (passesFilter && scrapeOnlyOwnProducts && ownProductEans) {
                 if (!productData.ean || !ownProductEans.has(productData.ean)) {
                    // Add SKU/Brand check here if needed
                    logProgress(`Skipping product (not own EAN): ${name} (${productData.ean})`);
                    passesFilter = false;
                 }
            }

            // --- Output Product JSON ---
            if (passesFilter) {
                // Print the valid product data as a JSON string to stdout
                console.log(JSON.stringify(productData));
                productCount++;
            }

        } catch (error) {
            logError(`Error processing link ${link}`, error);
            // Decide if you want to continue to the next link or exit
        }
    }

    logProgress(`Scrape finished. Processed ${productLinks.length} links, found ${productCount} valid products.`);
}


// --- Main Execution Block ---

// Use yargs to parse command line arguments
const argv = yargs(hideBin(process.argv))
    .command('metadata', 'Output scraper metadata as JSON')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workaround until @types/yargs is installed
    .command('scrape', 'Run the scraper', (yargs: any) => { // Use any and disable eslint rule
        return yargs.option('context', {
            type: 'string',
            description: 'JSON string containing execution context',
            demandOption: true, // Context is required for scrape
        });
    })
    .demandCommand(1, 'You must provide a command: metadata or scrape')
    .strict() // Fail on unknown options
    .help()
    .parseSync(); // Use synchronous parsing for simplicity at startup

// Execute based on command
(async () => {
    if (argv._[0] === 'metadata') {
        try {
            const metadata = getMetadata();
            // Output metadata JSON to stdout
            console.log(JSON.stringify(metadata));
        } catch (e) {
            logError("Error generating metadata", e);
            process.exit(1);
        }
    } else if (argv._[0] === 'scrape') {
        if (!argv.context) {
             logError("Missing --context argument for scrape command");
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
            process.exit(0); // Explicitly exit with success code
        } catch (e) {
            if (e instanceof SyntaxError) {
                 logError("Failed to parse context JSON", e);
            } else {
                 logError("Unhandled error during scrape execution", e);
            }
            process.exit(1); // Exit with error code
        }
    }
})().catch(e => {
     // Catch any top-level async errors just in case
     logError("Unhandled top-level error", e);
     process.exit(1);
});