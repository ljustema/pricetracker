-- This SQL script schedules jobs and sets up error handling for workers using pg_cron.
-- It should be run last, after 04_public_functions_triggers.sql.
-- Requires the pg_cron extension to be enabled in the database.

-- Create a function to handle worker errors more gracefully
CREATE OR REPLACE FUNCTION handle_worker_error()
RETURNS TRIGGER AS $$
BEGIN
    -- If a run has been in 'pending' status for more than 5 minutes, mark it as failed
    UPDATE scraper_runs
    SET
        status = 'failed',
        error_message = 'Worker timeout: The job was not picked up by a worker within 5 minutes',
        completed_at = NOW()
    WHERE
        status = 'pending'
        AND started_at < NOW() - INTERVAL '5 minutes'
        AND id NOT IN (SELECT run_id FROM scraper_run_timeouts WHERE processed = false);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to retry failed runs with specific error messages
CREATE OR REPLACE FUNCTION retry_fetch_failed_runs()
RETURNS TRIGGER AS $$
BEGIN
    -- If a run has failed with 'fetch failed' and hasn't been retried more than 3 times,
    -- create a new run with the same parameters
    IF NEW.status = 'failed' AND NEW.error_message = 'fetch failed' THEN
        -- Check if this run has already been retried too many times
        DECLARE
            retry_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO retry_count
            FROM scraper_runs
            WHERE
                scraper_id = NEW.scraper_id
                AND error_message = 'fetch failed'
                AND started_at > NOW() - INTERVAL '1 hour';

            IF retry_count < 3 THEN
                -- Create a new run with the same parameters
                INSERT INTO scraper_runs (
                    scraper_id,
                    user_id,
                    status,
                    started_at,
                    is_test_run,
                    scraper_type
                )
                VALUES (
                    NEW.scraper_id,
                    NEW.user_id,
                    'pending',
                    NOW(),
                    NEW.is_test_run,
                    NEW.scraper_type
                );

                -- Log the retry
                RAISE NOTICE 'Retrying failed run % for scraper %', NEW.id, NEW.scraper_id;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to retry failed runs
DROP TRIGGER IF EXISTS retry_fetch_failed_trigger ON scraper_runs;

CREATE TRIGGER retry_fetch_failed_trigger
AFTER UPDATE OF status ON scraper_runs
FOR EACH ROW
WHEN (NEW.status = 'failed' AND NEW.error_message = 'fetch failed')
EXECUTE FUNCTION retry_fetch_failed_runs();

-- Add comments to explain the functions and triggers
COMMENT ON FUNCTION handle_worker_error() IS
'Handles worker timeouts by marking pending jobs as failed if they have been pending for too long';

COMMENT ON FUNCTION retry_fetch_failed_runs() IS
'Automatically retries runs that failed with "fetch failed" error, up to 3 times within an hour';

COMMENT ON TRIGGER retry_fetch_failed_trigger ON scraper_runs IS
'Triggers automatic retry of runs that failed with "fetch failed" error';

-- Schedule jobs using pg_cron
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    -- Create the pg_cron extension if it doesn't exist
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- If jobs already exist, unschedule them first to avoid duplicates or errors on re-run
    PERFORM cron.unschedule('cleanup_scraped_products_job');
    PERFORM cron.unschedule('worker_timeout_handler');

    -- Schedule the cleanup job to run at 03:00 UTC every day
    PERFORM cron.schedule(
      'cleanup_scraped_products_job', -- Job name
      '0 3 * * *',                    -- Cron schedule (every day at 3:00 AM UTC)
      'SELECT cleanup_scraped_products()' -- SQL command to execute
    );

    -- Schedule the worker timeout handler to run every minute
    PERFORM cron.schedule(
      'worker_timeout_handler',       -- Job name
      '* * * * *',                    -- Cron schedule (every minute)
      'SELECT handle_worker_error()'  -- SQL command to execute
    );

    RAISE NOTICE 'Scheduled jobs using pg_cron: "cleanup_scraped_products_job" (daily) and "worker_timeout_handler" (every minute).';
  ELSE
    -- If pg_cron is not available, log a message
    RAISE NOTICE 'pg_cron extension is not available. The scheduled functions need to be run manually or via an external scheduler.';
  END IF;
END $$;