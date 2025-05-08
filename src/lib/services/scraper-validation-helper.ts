/**
 * Helper functions for validating and fixing TypeScript scraper scripts
 */

/**
 * Validates a TypeScript scraper script and fixes common issues
 * @param scriptContent The original script content
 * @returns An object with the fixed script and a list of applied fixes
 */
export function validateAndFixScriptStructure(scriptContent: string): { 
  fixedScript: string; 
  appliedFixes: string[];
  isValid: boolean;
} {
  const appliedFixes: string[] = [];
  let isValid = true;
  let fixedScript = scriptContent;

  // Check for required patterns
  const hasYargsPattern = scriptContent.includes('yargs(hideBin(process.argv))');
  const hasGetMetadataFunction = /function\s+getMetadata\s*\(/m.test(scriptContent);
  const hasScrapeFunction = /async\s+function\s+scrape\s*\(/m.test(scriptContent);

  // Fix missing yargs pattern
  if (!hasYargsPattern) {
    isValid = false;
    appliedFixes.push('Added missing yargs command-line argument parsing');
    
    // Check if imports are missing
    if (!scriptContent.includes('import yargs from')) {
      fixedScript = fixedScript.replace(
        /^(import .+;\n)/m,
        '$1// @ts-expect-error - Suppress TS7016 error until types are installed\nimport yargs from \'yargs\'; // For command-line argument parsing\n// @ts-expect-error - Suppress TS7016 error until types are installed\nimport { hideBin } from \'yargs/helpers\';\n'
      );
    }
    
    // Add the main execution block if it's missing
    if (!scriptContent.includes('(async () => {')) {
      fixedScript += `

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
            const contextData: ScriptContext = JSON.parse(argv.context);
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
});`;
    }
  }

  // Fix missing getMetadata function
  if (!hasGetMetadataFunction) {
    isValid = false;
    appliedFixes.push('Added missing getMetadata function');
    
    // Add ScriptMetadata interface if missing
    if (!scriptContent.includes('interface ScriptMetadata')) {
      fixedScript = fixedScript.replace(
        /(interface .+\{[\s\S]+?\})/m,
        '$1\n\n/**\n * Defines the structure for the scraper\'s metadata.\n */\ninterface ScriptMetadata {\n    name: string;\n    version: string;\n    description: string;\n    target_url: string; // Base URL or main entry point\n    required_libraries?: string[]; // e.g., [\'cheerio\', \'node-fetch\'] - Informational\n    batch_size?: number; // Recommended batch size\n}'
      );
    }
    
    // Add getMetadata function
    const metadataFunction = `
/**
 * Returns metadata about the scraper.
 */
function getMetadata(): ScriptMetadata {
    // IMPORTANT: Only use standard libraries here.
    // Third-party libraries should be imported within the 'scrape' function.
    const metadata: ScriptMetadata = {
        name: "AI Generated Scraper", // CHANGE THIS
        version: "1.0.0", // CHANGE THIS
        description: "AI-generated scraper for competitor website", // CHANGE THIS
        target_url: "https://example.com", // Base URL or main entry point - CHANGE THIS
        required_libraries: ["crawlee", "playwright"], // List libraries needed by 'scrape' function
        // Add other relevant metadata as needed
    };
    return metadata;
}`;
    
    // Insert before the scrape function or at the end if no scrape function
    if (hasScrapeFunction) {
      fixedScript = fixedScript.replace(
        /(async\s+function\s+scrape)/m,
        `${metadataFunction}\n\n$1`
      );
    } else {
      fixedScript += `\n${metadataFunction}`;
    }
  }

  // Fix missing scrape function
  if (!hasScrapeFunction) {
    isValid = false;
    appliedFixes.push('Added missing async scrape function');
    
    // Add ScriptContext interface if missing
    if (!scriptContent.includes('interface ScriptContext')) {
      fixedScript = fixedScript.replace(
        /(interface .+\{[\s\S]+?\})/m,
        '$1\n\n/**\n * Defines the context object passed by the worker during execution.\n */\ninterface ScriptContext {\n    activeBrandNames?: string[];\n    filterByActiveBrands?: boolean;\n    ownProductEans?: string[];\n    ownProductSkuBrands?: { sku: string; brand: string }[];\n    scrapeOnlyOwnProducts?: boolean;\n    isTestRun?: boolean;\n    isValidation?: boolean;\n    run_id?: string;\n    log?: (level: \'info\' | \'warn\' | \'error\' | \'debug\', message: string, data?: unknown) => void;\n}'
      );
    }
    
    // Add scrape function
    const scrapeFunction = `
/**
 * Main scraping function. It should:
 * 1. Perform the scraping logic (fetching pages, parsing data).
 * 2. Apply filtering based on the provided context if necessary.
 * 3. Print one JSON object per valid product found to stdout using console.log().
 */
async function scrape(context: ScriptContext): Promise<void> {
    logProgress("Scrape function started.");
    logProgress(\`Received context: \${JSON.stringify(context)}\`);

    // Extract context variables
    const isTestRun = context.isTestRun ?? false;
    const isValidation = context.isValidation ?? false;
    const filterByActiveBrands = context.filterByActiveBrands ?? false;
    const activeBrandNames = filterByActiveBrands ? new Set(context.activeBrandNames || []) : null;
    const scrapeOnlyOwnProducts = context.scrapeOnlyOwnProducts ?? false;
    const ownProductEans = scrapeOnlyOwnProducts ? new Set(context.ownProductEans || []) : null;

    // Example implementation - replace with actual scraping logic
    const productData = {
        name: "Example Product",
        price: 199.99,
        currency: "SEK",
        url: "https://example.com/product/123",
        is_available: true
    };

    // Output product data as JSON
    console.log(JSON.stringify(productData));
    
    logProgress("Scrape function completed.");
}`;
    
    // Add the scrape function
    fixedScript += `\n${scrapeFunction}`;
  }

  // Add logging helpers if missing
  if (!scriptContent.includes('function logProgress') || !scriptContent.includes('function logError')) {
    isValid = false;
    appliedFixes.push('Added missing logging helper functions');
    
    const loggingHelpers = `
// --- Logging Helpers ---
function logProgress(message: string): void {
    console.error(\`PROGRESS: \${message}\`);
}

function logError(message: string, error?: unknown): void {
    console.error(\`ERROR: \${message}\`);
    if (error instanceof Error && error.stack) {
        console.error(error.stack);
    } else if (error) {
        console.error(String(error));
    }
}`;
    
    // Insert at the beginning of the file after imports
    fixedScript = fixedScript.replace(
      /^(import .+;\n+)/m,
      `$1${loggingHelpers}\n\n`
    );
  }

  return {
    fixedScript,
    appliedFixes,
    isValid: isValid || appliedFixes.length === 0
  };
}
