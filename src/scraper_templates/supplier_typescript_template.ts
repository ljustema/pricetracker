/**
 * TypeScript Supplier Scraper Template for PriceTracker
 *
 * IMPORTANT: Output one JSON object per product, per line (JSONL) to stdout using console.log().
 * This is required for compatibility with the PriceTracker worker and validation system.
 *
 * This template is specifically designed for scraping supplier websites to collect
 * procurement and sourcing data including wholesale prices, minimum order quantities,
 * lead times, and comprehensive stock level tracking.
 *
 * CUSTOM FIELDS: You can scrape any additional fields you want! PriceTracker now supports
 * custom fields, so feel free to extract specifications, descriptions, dimensions, or any
 * other supplier-specific data. Just add them to your ScrapedSupplierData interface and 
 * they will be stored as custom fields automatically.
 */

// --- Dependencies ---
// TODO: Install types: npm i --save-dev @types/yargs
import yargs from 'yargs'; // For command-line argument parsing
import { hideBin } from 'yargs/helpers';
// Add other necessary imports for your scraper here, e.g.:
// import fetch from 'node-fetch';
// import * as cheerio from 'cheerio';

// --- Types/Interfaces ---

/**
 * Defines the structure for scraped supplier product data.
 * Align this with the `temp_suppliers_scraped_data` table schema.
 */
interface ScrapedSupplierData {
    supplier_url: string; // Matches database schema
    name: string;
    supplier_price: number | null; // Supplier's selling price to us
    supplier_recommended_price?: number | null; // Supplier's recommended retail price
    currency_code: string | null;
    sku?: string | null; // Supplier's SKU (which becomes our SKU when we source from them)
    brand?: string | null;
    ean?: string | null;
    product_description?: string | null;
    category?: string | null;
    image_url?: string | null;
    minimum_order_quantity?: number | null;
    lead_time_days?: number | null;
    stock_quantity?: number | null; // FIXED: Changed from stock_level to match database
    stock_status?: string | null; // Stock status text (e.g., "In Stock", "Low Stock", "Back Order")
    availability_date?: Date | null; // Expected availability date for back orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw_stock_data?: Record<string, any> | null; // Raw stock data for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw_data?: Record<string, any> | null; // Custom fields data - matches database jsonb column
    // Note: is_available is not in the database schema, remove if not needed
    // Add other supplier-specific fields as needed and they'll be stored in raw_data
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
    isValidation?: boolean; // Added for validation mode
    run_id?: string;
    // Supplier information provided by the worker from database
    supplierInfo?: {
        id: string;
        name: string;
        website?: string;
        login_url?: string;
        login_username?: string;
        login_password?: string;
        api_key?: string;
        api_url?: string;
        contact_email?: string;
        notes?: string;
    };
    // Worker might inject helper functions like log, safeFetch, dbClient etc.
    log?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown) => void;
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

// --- Core Scraper Functions ---

/**
 * Returns metadata about the scraper.
 */
function getMetadata(): ScriptMetadata {
    // IMPORTANT: Only use standard libraries here.
    // Third-party libraries should be imported within the 'scrape' function.
    const metadata: ScriptMetadata = {
        name: "My Supplier TypeScript Scraper Template", // CHANGE THIS
        version: "1.0.0", // CHANGE THIS
        description: "Description of what this supplier TS scraper does.", // CHANGE THIS
        target_url: "https://supplier-example.com", // Base URL or main entry point - CHANGE THIS
        required_libraries: ["node-fetch", "cheerio"], // List libraries needed by 'scrape' function
        // Add other relevant metadata as needed
    };
    return metadata;
}

/**
 * Main scraping function for supplier data. It should:
 * 1. Perform the scraping logic (fetching pages, parsing supplier data).
 * 2. Apply filtering based on the provided context if necessary.
 * 3. Print one JSON object per valid product found to stdout using console.log().
 *    IMPORTANT: Output one JSON object per product, per line (JSONL).
 * 4. Print progress and error messages to stderr using logProgress() and logError().
 */
async function scrape(context: ScriptContext): Promise<void> {
    logProgress("Supplier scrape function started.");
    logProgress(`Received context: ${JSON.stringify(context)}`);

    // --- Import required libraries listed in get_metadata() HERE ---
    let _fetch: unknown;
    let _cheerio: unknown;
    try {
        // Use dynamic import for libraries that might not be globally available
        // fetch = (await import('node-fetch')).default;
        // cheerio = await import('cheerio');
        // import other libraries...
    } catch (e) {
        logError(`Failed to import required libraries. Ensure they are installed and listed in get_metadata().`, e);
        process.exit(1);
    }

    // --- Extract context variables ---
    const isTestRun = context.isTestRun ?? false;
    const isValidation = context.isValidation ?? false;
    const filterByActiveBrands = context.filterByActiveBrands ?? false;
    const activeBrandNames = filterByActiveBrands ? new Set(context.activeBrandNames || []) : null;
    const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;
    const ownProductEans = scrapeOnlyOwnProducts ? new Set(context.ownProductEans || []) : null;

    // Handle validation mode - get real data but limit quantity
    if (isValidation) {
        logProgress("Validation mode detected - fetching real data with limited quantity");
        // Continue with real scraping but limit the number of products
        // Set isTestRun to true to limit products for validation
        context.isTestRun = true;
    }

    // --- Supplier Scraper Implementation ---
    // Replace this example logic with your actual supplier scraping code.

    const base_url = "https://supplier-example.com/catalog"; // Get from metadata or define here
    logProgress(`Starting supplier scrape for base URL: ${base_url}`);

    // Example: Find product links (replace with actual logic)
    let productLinks = Array.from({ length: 20 }, (_, i) => `${base_url}/supplier-item-${i + 1}`);
    logProgress(`Found ${productLinks.length} potential supplier product links.`);

    if (isTestRun) {
        logProgress("Test run detected, limiting to 5 products.");
        productLinks = productLinks.slice(0, 5);
    }

    let productCount = 0;
    for (const link of productLinks) {
        try {
            logProgress(`Processing supplier product link: ${link}`);

            // Example: Fetch product page
            // const response = await fetch(link);
            // if (!response.ok) {
            //     logError(`HTTP error fetching ${link}: ${response.status}`);
            //     continue;
            // }
            // const productHtml = await response.text();

            // Example: Parse supplier product data (replace with actual parsing)
            // const $ = cheerio.load(productHtml);
            // const name = $('h1').text().trim();
            // const supplierPriceStr = $('.wholesale-price, .supplier-price').text().trim().replace(/[^0-9.]/g, '');
            // const supplierPrice = parseFloat(supplierPriceStr);
            // const recommendedPriceStr = $('.recommended-price, .retail-price').text().trim().replace(/[^0-9.]/g, '');
            // const supplierRecommendedPrice = parseFloat(recommendedPriceStr) || null;
            // const sku = $('.sku').text().trim() || undefined;
            // const brand = $('.brand').text().trim() || undefined;
            // const ean = $('.ean').text().trim() || undefined;
            // const minOrderQty = parseInt($('.min-order').text().replace(/[^0-9]/g, '')) || 1;
            // const leadTime = parseInt($('.lead-time').text().replace(/[^0-9]/g, '')) || null;
            // const stockQuantity = parseInt($('.stock-quantity').text().replace(/[^0-9]/g, '')) || null;
            // const stockStatus = $('.stock-status').text().trim() || null;
            // const imageUrl = $('img.product-image').attr('src');
            // const isAvailable = $('.availability').text().toLowerCase().includes('available');

            // Dummy data for example:
            const name = `Supplier Product from ${link}`;
            const supplierPrice = 8.99 + productCount; // Wholesale/supplier price
            const supplierRecommendedPrice = supplierPrice * 1.8; // Example: 80% markup
            const sku = `SUPP_SKU_${productCount}`;
            const brand = productCount % 2 === 0 ? "SupplierBrand" : "WholesaleBrand";
            const ean = productCount % 3 === 0 ? `1234567890${productCount.toString().padStart(3, '0')}` : undefined;
            const minOrderQty = [1, 5, 10, 25][productCount % 4];
            const leadTime = [7, 14, 21, 30][productCount % 4];
            const stockQuantity = Math.floor(Math.random() * 1000) + 100;
            const imageUrl = `${link}/supplier-image.jpg`;

            const supplierData: ScrapedSupplierData = {
                name: name,
                supplier_price: supplierPrice,
                supplier_recommended_price: supplierRecommendedPrice,
                currency_code: "SEK", // Or detect from page
                supplier_url: link, // Matches database schema
                image_url: imageUrl,
                sku: sku,
                brand: brand,
                ean: ean,
                minimum_order_quantity: minOrderQty,
                lead_time_days: leadTime,
                stock_quantity: stockQuantity, // FIXED: Changed from stock_level to match database
                stock_status: stockQuantity > 50 ? "In Stock" : "Low Stock", // Example stock status
                availability_date: null, // Set if back order
                raw_stock_data: { original_stock: stockQuantity }, // Example raw stock data
                product_description: `High-quality ${name} from trusted supplier`,
                category: "Electronics", // Extract from page
                raw_data: {} // Custom fields will be stored here
            };

            // --- Price Validation (Required) ---
            // Skip products with no valid price (validation requirement)
            if (!supplierData.supplier_price || supplierData.supplier_price <= 0) {
                logProgress(`Skipping product - no valid price (${supplierData.supplier_price})`);
                continue;
            }

            // --- Filtering Logic (Optional) ---
            let passesFilter = true;
            if (filterByActiveBrands && activeBrandNames) {
                if (!supplierData.brand || !activeBrandNames.has(supplierData.brand)) {
                    logProgress(`Skipping product (inactive brand): ${name} (${supplierData.brand})`);
                    passesFilter = false;
                }
            }
            if (passesFilter && scrapeOnlyOwnProducts && ownProductEans) {
                if (!supplierData.ean || !ownProductEans.has(supplierData.ean)) {
                    logProgress(`Skipping product (not own EAN): ${name} (${supplierData.ean})`);
                    passesFilter = false;
                }
            }

            // --- Output Product JSON ---
            if (passesFilter) {
                // Print the valid supplier product data as a JSON string to stdout
                console.log(JSON.stringify(supplierData));
                productCount++;
            }

        } catch (error) {
            logError(`Error processing supplier link ${link}`, error);
            // Continue to the next link
        }
    }

    logProgress(`Supplier scrape finished. Processed ${productLinks.length} links, found ${productCount} valid products.`);
}

// --- Main Execution Block ---

// Use yargs to parse command line arguments
const argv = yargs(hideBin(process.argv))
    .command('metadata', 'Output scraper metadata as JSON')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workaround until @types/yargs is installed
    .command('scrape', 'Run the supplier scraper', (yargs: any) => {
        return yargs.option('context', {
            type: 'string',
            description: 'Base64 encoded JSON string containing execution context',
            demandOption: true,
        });
    })
    .demandCommand(1, 'You must provide a command: metadata or scrape')
    .strict()
    .help()
    .parseSync();

// Execute based on command
(async () => {
    if (argv._[0] === 'metadata') {
        try {
            const metadata = getMetadata();
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

            // Parse context - try Base64 first (most common), then direct JSON
            try {
                // First try Base64 decoding (most common case for validation)
                const jsonContext = Buffer.from(contextString, 'base64').toString('utf-8');
                contextData = JSON.parse(jsonContext) as ScriptContext;
                logProgress("Context parsed as Base64 encoded JSON");
            } catch (base64ParseError) {
                // If Base64 parsing fails, try direct JSON parsing
                try {
                    contextData = JSON.parse(contextString) as ScriptContext;
                    logProgress("Context parsed as direct JSON");
                } catch (directParseError) {
                    logError("Failed to parse context", {
                        base64ParseError: base64ParseError instanceof Error ? base64ParseError.message : String(base64ParseError),
                        directParseError: directParseError instanceof Error ? directParseError.message : String(directParseError),
                        contextPreview: contextString.substring(0, 100)
                    });
                    throw new Error(`Failed to parse context: tried Base64 decoding and direct JSON parsing, both failed. Context starts with: ${contextString.substring(0, 20)}...`);
                }
            }

            await scrape(contextData);
            process.exit(0);
        } catch (e) {
            if (e instanceof SyntaxError) {
                logError("Failed to parse context JSON", e);
            } else {
                logError("Unhandled error during scrape execution", e);
            }
            process.exit(1);
        }
    }
})().catch(e => {
    logError("Unhandled top-level error", e);
    process.exit(1);
});
