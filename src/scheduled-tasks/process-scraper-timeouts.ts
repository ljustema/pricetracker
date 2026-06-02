/**
 * Scheduled task to process scraper run timeouts
 * This function checks for scraper runs that have exceeded their timeout period
 * and marks them as failed.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import logger from '@/lib/utils/logger';

const CONTEXT = 'SCHEDULED:process-scraper-timeouts';

export async function processScraperTimeouts() {
  logger.info(CONTEXT, 'Starting scheduled task to process scraper timeouts');

  const supabaseAdmin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  try {
    // 1. Find all expired timeouts that haven't been processed yet
    const { data: expiredTimeouts, error: fetchError } = await supabaseAdmin
      .from('scraper_run_timeouts')
      .select('id, run_id, timeout_at')
      .lt('timeout_at', now)
      .eq('processed', false)
      .order('timeout_at', { ascending: true });

    if (fetchError) {
      logger.error(CONTEXT, `Error fetching expired timeouts: ${fetchError.message}`);
      return;
    }

    logger.info(CONTEXT, `Found ${expiredTimeouts?.length || 0} expired timeouts to process`);

    // 2. Process each expired timeout
    for (const timeout of expiredTimeouts || []) {
      logger.info(CONTEXT, `Processing timeout for run ${timeout.run_id}`);

      // 2.1 Check if the run should be marked as failed using our new function
      const { data: shouldFail, error: shouldFailError } = await supabaseAdmin
        .rpc('should_mark_run_as_failed', { run_id: timeout.run_id });

      if (shouldFailError) {
        logger.error(CONTEXT, `Error checking if run ${timeout.run_id} should be marked as failed: ${shouldFailError.message}`);
        continue;
      }

      // 2.2 Get run details for logging
      const { data: run, error: runError } = await supabaseAdmin
        .from('scraper_runs')
        .select('status, is_test_run, claimed_by_worker_at')
        .eq('id', timeout.run_id)
        .single();

      if (runError) {
        logger.error(CONTEXT, `Error fetching run ${timeout.run_id}: ${runError.message}`);
        continue;
      }

      // 2.3 If the function says we should mark it as failed, do so
      if (shouldFail) {
        const timeoutMessage = run.is_test_run
          ? 'Scraper test run exceeded timeout period'
          : 'Scraper run exceeded timeout period';

        const timeoutPeriod = run.is_test_run ? '1-minute' : '2-hour';
        const claimedStatus = run.claimed_by_worker_at
          ? `claimed by worker at ${run.claimed_by_worker_at}`
          : 'not claimed by any worker';

        logger.warn(CONTEXT, `Run ${timeout.run_id} exceeded ${timeoutPeriod} timeout (status: ${run.status}, ${claimedStatus}) - marking as failed`);

        const { error: updateError } = await supabaseAdmin
          .from('scraper_runs')
          .update({
            status: 'failed',
            error_message: timeoutMessage,
            completed_at: now
          })
          .eq('id', timeout.run_id);

        if (updateError) {
          logger.error(CONTEXT, `Error updating run ${timeout.run_id}: ${updateError.message}`);
          continue;
        }
      } else {
        logger.info(CONTEXT, `Run ${timeout.run_id} should not be marked as failed (status: ${run?.status}, claimed: ${!!run?.claimed_by_worker_at}) - no action needed`);
      }

      // 2.3 Mark the timeout as processed
      const { error: markError } = await supabaseAdmin
        .from('scraper_run_timeouts')
        .update({
          processed: true,
          processed_at: now
        })
        .eq('id', timeout.id);

      if (markError) {
        logger.error(CONTEXT, `Error marking timeout ${timeout.id} as processed: ${markError.message}`);
      }
    }

    logger.info(CONTEXT, 'Completed processing scraper timeouts');
  } catch (error) {
    logger.error(CONTEXT, `Unhandled error processing timeouts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// If this file is executed directly (e.g., via cron job)
if (require.main === module) {
  processScraperTimeouts()
    .then(() => {
      console.log('Timeout processing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error processing timeouts:', error);
      process.exit(1);
    });
}
