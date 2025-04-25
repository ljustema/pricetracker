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
      
      // 2.1 Check if the run is still pending
      const { data: run, error: runError } = await supabaseAdmin
        .from('scraper_runs')
        .select('status, is_test_run')
        .eq('id', timeout.run_id)
        .single();
        
      if (runError) {
        logger.error(CONTEXT, `Error fetching run ${timeout.run_id}: ${runError.message}`);
        continue;
      }
      
      // 2.2 If the run is still pending, mark it as failed
      if (run && run.status === 'pending') {
        const timeoutMessage = run.is_test_run 
          ? 'Scraper test run exceeded 1-minute timeout period'
          : 'Scraper run exceeded 24-hour timeout period';
          
        const timeoutPeriod = run.is_test_run ? '1-minute' : '24-hour';
        
        logger.warn(CONTEXT, `Run ${timeout.run_id} exceeded ${timeoutPeriod} timeout and is still pending - marking as failed`);
        
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
        logger.info(CONTEXT, `Run ${timeout.run_id} is no longer pending (status: ${run?.status}) - no action needed`);
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
