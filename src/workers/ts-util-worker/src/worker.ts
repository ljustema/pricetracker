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

// Using `any` for now as Database types are not available
const supabase = createClient<any>(supabaseUrl, supabaseServiceRoleKey);

const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds (adjust as needed)
const HEALTH_CHECK_INTERVAL_MS = 300000; // 5 minutes between health check logs

console.log(`Starting TypeScript Utility Worker (Polling interval: ${POLLING_INTERVAL_MS}ms)`);

// Interface for sync results
interface SyncResult {
  success: boolean;
  productsProcessed: number;
  productsUpdated: number;
  productsCreated: number;
  errorMessage?: string;
  logDetails?: Record<string, any>[];
}

// Track last poll message time and job time
let lastPollMessageTime = 0;
let lastJobTime = Date.now();
let lastHealthCheckTime = Date.now();

// Function to fetch and process integration jobs
async function fetchAndProcessIntegrationJob() {
  let job: any = null; // Define job variable in the outer scope for the catch block

  try {
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
    // 1. Fetch a pending job
    const { data: fetchedJob, error: fetchError } = await supabase
      .from('integration_runs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching integration job:', fetchError);
      return; // Wait for the next poll interval
    }

    if (!fetchedJob) {
      // No job found, wait for the next poll interval
      return;
    }
    job = fetchedJob; // Assign to the outer scope variable

    console.log(`Found integration job: ${job.id}, Integration ID: ${job.integration_id}`);

    // 2. Claim the job (Update status to 'processing')
    const { error: claimError } = await supabase
      .from('integration_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending'); // Ensure it's still pending

    if (claimError) {
      console.error(`Error claiming integration job ${job.id}:`, claimError);
      job = null; // Reset job if claim failed
      return; // Failed to claim, maybe another worker got it. Wait.
    }

    console.log(`Integration job ${job.id} claimed successfully.`);

    // Update last job time when a job is successfully claimed
    lastJobTime = Date.now();

    // 3. Fetch the integration details
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', job.integration_id)
      .single();

    if (integrationError) {
      throw new Error(`Failed to fetch integration details: ${integrationError.message}`);
    }

    // Check if this is a test run
    const isTestRun = job.configuration?.is_test_run === true;
    const testRunLimit = job.configuration?.limit || 10;
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
        // Import the PrestashopClient dynamically
        const { PrestashopClient } = await import('./prestashop-client');

        // Initialize the Prestashop client
        const client = new PrestashopClient(integration.api_url, integration.api_key);

        // Test the connection
        console.log('Testing API connection...');
        const connectionTest = await client.testConnection();
        if (!connectionTest) {
          throw new Error('Failed to connect to Prestashop API');
        }
        console.log('API connection successful');

        // Update run status to processing
        await supabase
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

        // Fetch a limited number of products for the test run using the optimized getProducts method
        console.log(`Starting test run to fetch ${testRunLimit} random ${activeOnly ? 'active ' : ''}products...`);
        const products = await client.getProducts({
          limit: testRunLimit,
          activeOnly,
          random: true
        });

        console.log(`Fetched ${products.length} products for test run`);

        // Debug: Log the active status of each product
        products.forEach(product => {
          console.log(`Product ${product.id}: ${product.name} - Active: ${product.active}`);
        });

        // Store the test products in the run
        await supabase
          .from('integration_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            products_processed: products.length,
            test_products: products,
            log_details: JSON.stringify([{
              timestamp: new Date().toISOString(),
              level: 'info',
              phase: 'TEST_RUN',
              message: 'Test run completed successfully',
              data: { product_count: products.length }
            }])
          })
          .eq('id', job.id);

        console.log(`Test run completed successfully. Fetched ${products.length} products.`);

      } catch (error) {
        console.error('Test run failed:', error);

        // Update run status to failed
        await supabase
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
      }

    } else {
      // Regular full sync
      console.log(`Starting full sync for integration ${integration.name} (${integration.platform})`);

      // Create an instance of the IntegrationSyncService
      const syncService = new IntegrationSyncService(
        job.user_id,
        job.integration_id,
        job.id,
        supabase
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
        await supabase
          .from('integration_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unhandled worker error',
          })
          .eq('id', job.id);
        console.error(`Job ${job.id} marked as failed due to unhandled worker error.`);
      } catch (updateError) {
        console.error(`Failed to update job ${job.id} status after unhandled error:`, updateError);
      }
    }
  }
}

// Function to log structured messages
function logStructured(level: string, phase: string, message: string, data?: any) {
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
