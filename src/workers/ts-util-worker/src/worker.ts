import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as dotenv from 'dotenv';
import { IntegrationSyncService } from './integration-sync-service';



// Load environment variables from .env file
dotenv.config();

// Initialize environment
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key environment variables.');
  process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);

// Using unknown for database types as specific types are not available
const supabase = createClient<unknown>(supabaseUrl, supabaseServiceRoleKey);

// Type for integration data
interface Integration {
  id: string;
  name: string;
  platform: string;
  api_url: string;
  api_key: string;
  configuration: Record<string, unknown> | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Type for the data returned by the claim_next_integration_job RPC
interface ClaimedIntegrationJobData {
  id: string; // UUID
  created_at: string; // TIMESTAMPTZ
  integration_id: string; // UUID
  user_id: string; // UUID
  status: string;
  started_at: string | null; // TIMESTAMPTZ
  completed_at: string | null; // TIMESTAMPTZ
  error_message: string | null;
  log_details: Record<string, unknown> | null; // JSONB
  products_processed: number | null;
  products_updated: number | null;
  products_created: number | null;
  test_products: Record<string, unknown>[] | null; // JSONB
  configuration: Record<string, unknown> | null; // JSONB
}

const POLLING_INTERVAL_MS = 30000; // Poll every 30 seconds (reduced from 5 seconds)
const HEALTH_CHECK_INTERVAL_MS = 300000; // 5 minutes between health check logs

console.log(`Starting TypeScript Utility Worker (Polling interval: ${POLLING_INTERVAL_MS}ms)`);

// Interface for sync results
interface _SyncResult {
  success: boolean;
  productsProcessed: number;
  productsUpdated: number;
  productsCreated: number;
  errorMessage?: string;
  logDetails?: Record<string, unknown>[];
}

// Track last poll message time and job time
let lastPollMessageTime = 0;
let lastJobTime = Date.now();
let lastHealthCheckTime = Date.now();

// Job processing state to prevent race conditions
let isProcessingJob = false;
let currentJobId: string | null = null;

// Function to fetch and process integration jobs
async function fetchAndProcessIntegrationJob() {
  let job: ClaimedIntegrationJobData | null = null; // Define job variable in the outer scope for the catch block

  try {
    // RACE CONDITION PROTECTION: Skip if already processing a job
    if (isProcessingJob) {
      console.log(`Skipping poll - already processing integration job ${currentJobId}`);
      return;
    }

    // Periodically check for long periods of inactivity and log health status
    const currentTime = Date.now();
    if (currentTime - lastHealthCheckTime > HEALTH_CHECK_INTERVAL_MS) {
      const inactivityDuration = (currentTime - lastJobTime) / 1000; // Convert to seconds
      console.log(`Worker health check: ${inactivityDuration.toFixed(1)} seconds since last job processed. Worker is still running.`);
      lastHealthCheckTime = currentTime;
    }

    // Only log polling message once every minute to reduce noise
    if (currentTime - lastPollMessageTime > 60000) { // 1 minute
      console.log('Polling for pending integration jobs...');
      lastPollMessageTime = currentTime;
    }
    // 1. Atomically fetch and claim a pending job using RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'claim_next_integration_job'
    );

    if (rpcError) {
      console.error('Error calling claim_next_integration_job RPC:', rpcError);
      logStructured('error', 'RPC_CALL_ERROR', `Error calling claim_next_integration_job: ${rpcError.message}`, { details: rpcError.details, hint: rpcError.hint });
      return; // Wait for the next poll interval
    }

    // rpcData will be an array of ClaimedIntegrationJobData.
    // If the array is empty or null, no job was claimed.
    const claimedJobs = rpcData as ClaimedIntegrationJobData[] | null;

    if (!claimedJobs || claimedJobs.length === 0) {
      // console.log('No pending integration jobs found or claimed.'); // Can be noisy
      return; // No job claimed, wait for the next poll interval
    }

    job = claimedJobs[0]; // Assign the first (and should be only) claimed job

    // SET JOB PROCESSING STATE - Prevent race conditions
    isProcessingJob = true;
    currentJobId = job.id;

    // The job status is already 'processing' and started_at is set by the RPC function.
    console.log(`Integration job ${job.id} claimed successfully via RPC. Integration ID: ${job.integration_id}`);
    logStructured('info', 'JOB_CLAIMED', `Integration job ${job.id} claimed successfully via RPC.`);

    // Update last job time when a job is successfully claimed
    lastJobTime = Date.now();

    // 3. Fetch the integration details
    const { data: integrationData, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', job.integration_id)
      .single();

    if (integrationError || !integrationData) {
      throw new Error(`Failed to fetch integration details: ${integrationError?.message || 'Integration not found'}`);
    }

    // Type assertion for the integration data
    const integration = integrationData as Integration;

    // Check if this is a test run
    const isTestRun = job.configuration?.is_test_run === true;
    const testRunLimit = Number(job.configuration?.limit) || 10;
    const activeOnly = job.configuration?.activeOnly !== false; // Default to true if not specified

    // Pass the activeOnly setting to the integration configuration if it's not already set
    if (integration.configuration === null) {
      integration.configuration = {};
    }

    if (integration.configuration.activeOnly === undefined) {
      integration.configuration.activeOnly = activeOnly;
    }

    // 4. Execute the integration sync
    if (isTestRun) {
      console.log(`Starting TEST RUN for integration ${integration.name} (${integration.platform})`);

      try {
        let testResults;

        // Handle test run based on platform
        switch (integration.platform.toLowerCase()) {
          case 'prestashop':
            testResults = await runPrestashopTest(integration, testRunLimit, activeOnly);
            break;

          case 'google-feed':
            testResults = await runGoogleFeedTest(integration, testRunLimit);
            break;

          default:
            throw new Error(`Unsupported platform for test run: ${integration.platform}`);
        }

        console.log(`Test run successful for ${integration.platform}`);

        // Update run status to processing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult1 = await (supabase as any)
          .from('integration_runs')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            log_details: JSON.stringify([{
              timestamp: new Date().toISOString(),
              level: 'info',
              phase: 'TEST_RUN',
              message: 'Test run started'
            }])
          })
          .eq('id', job.id);

        if (updateResult1.error) {
          console.error('Failed to update integration run status:', updateResult1.error);
        }

        // Store the test results in the run
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult2 = await (supabase as any)
          .from('integration_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            products_processed: testResults.productsFound,
            test_products: testResults.sampleProducts,
            log_details: JSON.stringify([{
              timestamp: new Date().toISOString(),
              level: 'info',
              phase: 'TEST_RUN',
              message: 'Test run completed successfully',
              data: testResults
            }])
          })
          .eq('id', job.id);

        if (updateResult2.error) {
          console.error('Failed to update integration run with results:', updateResult2.error);
        }

        console.log(`Test run completed successfully. Found ${testResults.productsFound} products.`);

      } catch (error) {
        console.error('Test run failed:', error);

        // Update run status to failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult3 = await (supabase as any)
          .from('integration_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error during test run',
            log_details: JSON.stringify([{
              timestamp: new Date().toISOString(),
              level: 'error',
              phase: 'TEST_RUN',
              message: 'Test run failed',
              data: { error: error instanceof Error ? error.message : 'Unknown error' }
            }])
          })
          .eq('id', job.id);

        if (updateResult3.error) {
          console.error('Failed to update integration run with error:', updateResult3.error);
        }
      }

    } else {
      // Regular full sync
      console.log(`Starting full sync for integration ${integration.name} (${integration.platform})`);

      // Create an instance of the IntegrationSyncService
      const syncService = new IntegrationSyncService(
        job.user_id,
        job.integration_id,
        job.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any // Type assertion to work around the unknown type
      );

      // Execute the sync process
      const result = await syncService.executeSync();

      // 5. Update the job status based on the result
      if (result.success) {
        console.log(`Integration sync completed successfully. Processed: ${result.productsProcessed}, Updated: ${result.productsUpdated}, Created: ${result.productsCreated}`);
      } else {
        console.error(`Integration sync failed: ${result.errorMessage}`);
      }
    }

    // Job status is updated by the sync service itself or in the test run code above

  } catch (error) {
    console.error('Unhandled error during integration job processing:', error);
    // Attempt to mark the job as failed if an error occurred after it was claimed
    if (job && job.id) { // Check if job was successfully fetched and potentially claimed
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult4 = await (supabase as any)
          .from('integration_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unhandled worker error',
          })
          .eq('id', job.id);

        if (updateResult4.error) {
          console.error('Failed to update integration run with unhandled error:', updateResult4.error);
        }
        console.error(`Job ${job.id} marked as failed due to unhandled worker error.`);
      } catch (updateError) {
        console.error(`Failed to update job ${job.id} status after unhandled error:`, updateError);
      }
    }
  } finally {
    // ALWAYS reset job processing state to prevent race conditions
    isProcessingJob = false;
    currentJobId = null;
  }
}

// Helper function to run Prestashop test
async function runPrestashopTest(integration: Integration, testRunLimit: number, activeOnly: boolean) {
  // Import the PrestashopClient dynamically
  const { PrestashopClient } = await import('./prestashop-client');

  // Initialize the Prestashop client
  const client = new PrestashopClient(integration.api_url, integration.api_key);

  // Test the connection
  console.log('Testing Prestashop API connection...');
  const connectionTest = await client.testConnection();
  if (!connectionTest) {
    throw new Error('Failed to connect to Prestashop API');
  }
  console.log('Prestashop API connection successful');

  // Fetch a limited number of products for the test run
  console.log(`Starting test run to fetch ${testRunLimit} random ${activeOnly ? 'active ' : ''}products...`);
  const productsResult = await client.getProducts({
    limit: testRunLimit,
    activeOnly,
    random: true
  });

  // Type assertion to ensure products is treated as an array
  const products = productsResult as { id: string; name: string; active: boolean }[];

  console.log(`Fetched ${products.length} products for test run`);

  // Debug: Log the active status of each product
  products.forEach(product => {
    console.log(`Product ${product.id}: ${product.name} - Active: ${product.active}`);
  });

  return {
    productsFound: products.length,
    sampleProducts: products,
    platform: 'prestashop'
  };
}

// Helper function to run Google Feed XML test
async function runGoogleFeedTest(integration: Integration, testRunLimit: number) {
  const { XMLParser } = await import('fast-xml-parser');

  console.log('Testing Google Feed XML connection...');

  // Fetch the XML feed
  const response = await fetch(integration.api_url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch XML feed: ${response.status} ${response.statusText}`);
  }

  const xmlContent = await response.text();
  console.log('Google Feed XML fetched successfully');

  // Parse XML with fast-xml-parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    parseAttributeValue: true,
    processEntities: false,
    htmlEntities: false,
  });

  const parsedXml = parser.parse(xmlContent);

  // Extract items from the XML structure
  let items: Record<string, unknown>[] = [];

  if (parsedXml.rss?.channel?.item) {
    items = Array.isArray(parsedXml.rss.channel.item)
      ? parsedXml.rss.channel.item
      : [parsedXml.rss.channel.item];
  } else if (parsedXml.feed?.entry) {
    items = Array.isArray(parsedXml.feed.entry)
      ? parsedXml.feed.entry
      : [parsedXml.feed.entry];
  } else if (parsedXml.channel?.item) {
    items = Array.isArray(parsedXml.channel.item)
      ? parsedXml.channel.item
      : [parsedXml.channel.item];
  } else {
    throw new Error('No product items found in XML feed. Expected RSS/channel/item or feed/entry structure.');
  }

  console.log(`Found ${items.length} items in XML feed`);

  if (items.length === 0) {
    throw new Error('No product items found in XML feed');
  }

  // Get a random sample of products for the test
  const sampleItems: Record<string, unknown>[] = [];
  const totalItems = items.length;
  const sampleSize = Math.min(testRunLimit, totalItems);

  // Create array of random indices
  const randomIndices: number[] = [];
  while (randomIndices.length < sampleSize) {
    const randomIndex = Math.floor(Math.random() * totalItems);
    if (!randomIndices.includes(randomIndex)) {
      randomIndices.push(randomIndex);
    }
  }

  // Get items at random indices
  for (const index of randomIndices) {
    sampleItems.push(items[index]);
  }
  const sampleProducts = sampleItems.map((item, index) => {
    // Helper function to get value from XML item
    const getValue = (obj: Record<string, unknown> | null, key: string): string | null => {
      if (!obj || typeof obj !== 'object') return null;

      const value = obj[key];
      if (value === undefined || value === null) return null;

      if (typeof value === 'string') {
        return value.trim();
      }

      if (typeof value === 'object' && value && '#text' in value) {
        const textValue = (value as Record<string, unknown>)['#text'];
        return textValue ? textValue.toString().trim() : null;
      }

      return value.toString().trim();
    };

    // Helper function to parse price from string (e.g., "350 SEK" -> 350)
    const parsePrice = (priceStr: string | null): number | null => {
      if (!priceStr) return null;

      // Extract numeric value from price string
      const match = priceStr.match(/[\d,]+\.?\d*/);
      if (match) {
        const numericValue = match[0].replace(/,/g, '');
        const parsed = parseFloat(numericValue);
        return isNaN(parsed) ? null : parsed;
      }

      return null;
    };

    const priceStr = getValue(item, 'g:sale_price') || getValue(item, 'g:price');
    const costStr = getValue(item, 'g:cost_of_goods_sold');

    return {
      id: getValue(item, 'g:id') || `item-${index}`,
      name: getValue(item, 'title') || 'Unknown Product',
      price: parsePrice(priceStr) || 0,
      wholesale_price: parsePrice(costStr),
      reference: getValue(item, 'g:mpn') || '',
      ean13: getValue(item, 'g:gtin') || '',
      manufacturer_name: getValue(item, 'g:brand') || '',
      image_url: getValue(item, 'g:image_link') || '',
      active: true // Google Feed products are typically active
    };
  });

  console.log(`Processed ${sampleProducts.length} sample products for test run`);

  return {
    productsFound: items.length,
    sampleProducts: sampleProducts,
    platform: 'google-feed'
  };
}

// Function to log structured messages
function logStructured(level: string, phase: string, message: string, data?: unknown) {
  const timestamp = new Date();
  const logEntry = {
    ts: timestamp.toISOString(),
    lvl: level.toUpperCase(),
    phase,
    msg: message,
    data: data ?? null,
  };

  // Log to console
  console.log(`[Worker] [${level.toUpperCase()}] [${phase}] ${message}`, data ? JSON.stringify(data) : '');

  // Log to file asynchronously
  const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logsDir, `ts-util-worker-${dateStr}.log`);
  const logLine = JSON.stringify(logEntry) + '\n';

  fsPromises.appendFile(logFile, logLine).catch(err => {
    // Log failure to write file only to console to avoid loops
    console.error(`[Worker] Failed to write to log file ${logFile}: ${err}`);
  });
}

// Main polling loop
function startPolling() {
  // Run once immediately, then set interval
  fetchAndProcessIntegrationJob().catch(err => console.error("Initial poll failed:", err));

  const intervalId = setInterval(() => {
    fetchAndProcessIntegrationJob().catch(err => console.error("Polling cycle failed:", err));
  }, POLLING_INTERVAL_MS);

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('Shutting down worker...');
    clearInterval(intervalId);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    console.log('SIGINT received.');
    shutdown();
  });
  process.on('SIGTERM', () => {
    console.log('SIGTERM received.');
    shutdown();
  });
}

// Start the worker
startPolling();
