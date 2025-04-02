-- This SQL script schedules the daily cleanup job for the scraped_products table using pg_cron.
-- It should be run last, after 04_public_functions_triggers.sql.
-- Requires the pg_cron extension to be enabled in the database.

-- Schedule a job to run the cleanup_scraped_products function daily
-- If pg_cron extension is available
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    -- If job already exists, unschedule it first to avoid duplicates or errors on re-run
    PERFORM cron.unschedule('cleanup_scraped_products_job');

    -- Schedule the job to run at 03:00 UTC every day
    PERFORM cron.schedule(
      'cleanup_scraped_products_job', -- Job name
      '0 3 * * *',                    -- Cron schedule (every day at 3:00 AM UTC)
      'SELECT cleanup_scraped_products()' -- SQL command to execute
    );
    RAISE NOTICE 'Scheduled daily cleanup job "cleanup_scraped_products_job" using pg_cron.';
  ELSE
    -- If pg_cron is not available, log a message
    RAISE NOTICE 'pg_cron extension is not available. The cleanup_scraped_products() function needs to be run manually or via an external scheduler.';
  END IF;
END $$;