import { ScraperExecutionService } from './lib/services/scraper-execution-service';
import { createSupabaseAdminClient } from './lib/supabase/server'; // Assuming this path is correct for standalone script
import { SupabaseClient } from '@supabase/supabase-js';

const POLLING_INTERVAL_MS = 10000; // Check for new jobs every 10 seconds
const MAX_CONCURRENT_JOBS = 1; // Limit to running one job at a time per worker instance

let runningJobs = 0;

async function findAndRunPendingJob(supabaseAdmin: SupabaseClient) {
    if (runningJobs >= MAX_CONCURRENT_JOBS) {
        // console.log(`Worker: Already running ${runningJobs} job(s). Skipping check.`);
        return; // Skip if max concurrency reached
    }

    console.log('Worker: Checking for pending scraper jobs...');

    try {
        // 1. Find one pending job
        const { data: pendingRun, error: findError } = await supabaseAdmin
            .from('scraper_runs')
            .select('*') // Select all needed fields for runScraperInternal
            .eq('status', 'pending')
            .order('created_at', { ascending: true }) // Process oldest first
            .limit(1)
            .maybeSingle(); // Get one or null

        if (findError) {
            console.error('Worker: Error finding pending job:', findError);
            return;
        }

        if (!pendingRun) {
            // console.log('Worker: No pending jobs found.');
            return;
        }

        console.log(`Worker: Found pending job ${pendingRun.id}. Attempting to claim...`);

        // 2. Try to claim the job by setting status to 'running'
        const { data: updatedRun, error: claimError } = await supabaseAdmin
            .from('scraper_runs')
            .update({ status: 'running', started_at: new Date().toISOString() }) // Update status and start time
            .eq('id', pendingRun.id)
            .eq('status', 'pending') // Ensure it's still pending (atomic claim)
            .select('*') // Select the updated record
            .single(); // Expect exactly one record to be updated

        if (claimError || !updatedRun) {
            // This could happen if another worker claimed it between find and update
            console.warn(`Worker: Failed to claim job ${pendingRun.id} (maybe claimed by another worker?):`, claimError);
            return;
        }

        console.log(`Worker: Successfully claimed job ${updatedRun.id}. Starting execution...`);
        runningJobs++;

        // 3. Execute the job using the existing internal service method
        try {
            // We need to access the private static method.
            // This requires a workaround or refactoring ScraperExecutionService.
            // For now, let's assume we can call it (may need adjustment).
            // If runScraperInternal is private, we might need to make it public static
            // or create a new public static method in ScraperExecutionService for the worker.
            // Let's assume it's callable for this example.
            await ScraperExecutionService.runScraperInternal(
                updatedRun.scraper_id,
                updatedRun.id,
                updatedRun.is_test_run ?? false // Handle potential null
            );
            console.log(`Worker: Job ${updatedRun.id} completed.`);
        } catch (executionError) {
            console.error(`Worker: Error executing job ${updatedRun.id}:`, executionError);
            // Error handling is mostly done within runScraperInternal's finally block,
            // which updates the DB status to 'failed'. We just log here.
        } finally {
             runningJobs--;
             console.log(`Worker: Finished processing job ${updatedRun.id}. Current running jobs: ${runningJobs}`);
        }

    } catch (error) {
        console.error('Worker: Unexpected error in main loop:', error);
    }
}

async function startWorker() {
    console.log('Worker: Starting up...');
    const supabaseAdmin = createSupabaseAdminClient();

    // Initial check
    await findAndRunPendingJob(supabaseAdmin);

    // Start polling loop
    setInterval(() => {
        findAndRunPendingJob(supabaseAdmin);
    }, POLLING_INTERVAL_MS);

    console.log(`Worker: Polling for jobs every ${POLLING_INTERVAL_MS / 1000} seconds.`);
}

// --- Entry Point ---
startWorker().catch(err => {
    console.error("Worker: Failed to start:", err);
    process.exit(1);
});