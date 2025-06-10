import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as dotenv from 'dotenv';
import { IntegrationSyncService } from './integration-sync-service';

// Type definitions for Supabase client
interface SupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: unknown) => {
        single: () => Promise<{ data: unknown; error: unknown }>;
        limit: (count: number) => Promise<{ data: unknown; error: unknown }>;
      };
      limit: (count: number) => Promise<{ data: unknown; error: unknown }>;
    };
    update: (data: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ data: unknown; error: unknown }>;
    };
  };
}

interface Product {
  id: string;
  name: string;
  active: boolean;
  [key: string]: unknown;
}

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
<<<<<<< HEAD
        const updateResult1 = await (supabase as SupabaseClient)
=======
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult1 = await (supabase as any)
>>>>>>> 1bc71d5f5e53ac8705b08eb9b9c72dd099ea4d94
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

        // Fetch a limited number of products for the test run using the optimized getProducts method
        console.log(`Starting test run to fetch ${testRunLimit} random ${activeOnly ? 'active ' : ''}products...`);
        const productsResult = await client.getProducts({
          limit: testRunLimit,
          activeOnly,
          random: true
        });

        // Type assertion to ensure products is treated as an array
<<<<<<< HEAD
        const products = productsResult as Product[];
=======
        const products = productsResult as { id: string; name: string; active: boolean }[];
>>>>>>> 1bc71d5f5e53ac8705b08eb9b9c72dd099ea4d94

        console.log(`Fetched ${products.length} products for test run`);

        // Debug: Log the active status of each product
        products.forEach(product => {
          console.log(`Product ${product.id}: ${product.name} - Active: ${product.active}`);
        });

        // Store the test products in the run
<<<<<<< HEAD
        const updateResult2 = await (supabase as SupabaseClient)
=======
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult2 = await (supabase as any)
>>>>>>> 1bc71d5f5e53ac8705b08eb9b9c72dd099ea4d94
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

        if (updateResult2.error) {
          console.error('Failed to update integration run with results:', updateResult2.error);
        }

        console.log(`Test run completed successfully. Fetched ${products.length} products.`);

      } catch (error) {
        console.error('Test run failed:', error);

        // Update run status to failed
<<<<<<< HEAD
        const updateResult3 = await (supabase as SupabaseClient)
=======
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult3 = await (supabase as any)
>>>>>>> 1bc71d5f5e53ac8705b08eb9b9c72dd099ea4d94
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
<<<<<<< HEAD
        supabase as SupabaseClient // Type assertion to work around the unknown type
=======
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any // Type assertion to work around the unknown type
>>>>>>> 1bc71d5f5e53ac8705b08eb9b9c72dd099ea4d94
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
<<<<<<< HEAD
        const updateResult4 = await (supabase as SupabaseClient)
=======
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateResult4 = await (supabase as any)
>>>>>>> 1bc71d5f5e53ac8705b08eb9b9c72dd099ea4d94
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
