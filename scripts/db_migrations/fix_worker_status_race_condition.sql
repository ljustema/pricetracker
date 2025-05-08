-- Fix for race condition between main app and worker when updating scraper_runs status
-- This script adds a claimed_by_worker_at timestamp and modifies the claim_next_scraper_job function
-- to prevent the main app from marking a job as failed too early

-- 1. Add claimed_by_worker_at column to scraper_runs table
ALTER TABLE scraper_runs
ADD COLUMN IF NOT EXISTS claimed_by_worker_at TIMESTAMP WITH TIME ZONE;

-- 2. Update the claim_next_scraper_job function to set the claimed_by_worker_at timestamp
DROP FUNCTION IF EXISTS claim_next_scraper_job(TEXT);

CREATE OR REPLACE FUNCTION claim_next_scraper_job(worker_type_filter TEXT)
RETURNS TABLE (
    -- Columns from scraper_runs
    id UUID,
    created_at TIMESTAMPTZ,
    scraper_id UUID,
    user_id UUID,
    status TEXT,
    scraper_type TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    error_details TEXT,
    product_count INTEGER,
    is_test_run BOOLEAN,
    -- Additional column from scrapers table
    fetched_competitor_id UUID  -- Renamed to make it distinct
)
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_job_id_val UUID;
BEGIN
  -- Atomically find a job, lock it, and update its status.
  -- This CTE structure ensures atomicity for the find-and-update part.
  WITH potential_job AS (
    SELECT sr_inner.id
    FROM scraper_runs sr_inner
    WHERE sr_inner.status = 'pending' AND sr_inner.scraper_type = worker_type_filter
    ORDER BY sr_inner.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED -- Crucial for concurrency: if locked, try next
  ),
  updated_job AS (
    UPDATE scraper_runs sr_update
    SET
      status = 'running',
      started_at = NOW(),
      claimed_by_worker_at = NOW() -- Set the claimed_by_worker_at timestamp
    FROM potential_job pj
    WHERE sr_update.id = pj.id AND sr_update.status = 'pending' -- Ensure it's still pending before update
    RETURNING sr_update.id -- Return the ID of the job that was actually updated
  )
  SELECT uj.id INTO claimed_job_id_val FROM updated_job uj;

  IF claimed_job_id_val IS NULL THEN
    -- No job was found and claimed (either no pending jobs, or all were locked by other transactions).
    RETURN; -- Exits the function, returning an empty set.
  END IF;

  -- If a job was successfully claimed and updated,
  -- return its full details along with the competitor_id from the related scraper.
  RETURN QUERY
  SELECT
    sr.id,
    sr.created_at,
    sr.scraper_id,
    sr.user_id,
    CAST(sr.status AS TEXT), -- Cast to TEXT if status is an ENUM, to match RETURNS TABLE
    CAST(sr.scraper_type AS TEXT), -- Cast to TEXT if scraper_type is an ENUM
    sr.started_at,
    sr.completed_at,
    sr.error_message,
    sr.error_details,
    sr.product_count,
    sr.is_test_run,
    s.competitor_id AS fetched_competitor_id -- Alias to match the RETURNS TABLE definition
  FROM scraper_runs sr
  JOIN scrapers s ON sr.scraper_id = s.id
  WHERE sr.id = claimed_job_id_val; -- Select the specific job that was claimed
END;
$$;

-- Grant execute permission to the roles that will be calling this function
GRANT EXECUTE ON FUNCTION claim_next_scraper_job(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_next_scraper_job(TEXT) TO service_role;

COMMENT ON FUNCTION claim_next_scraper_job(TEXT) IS 'Atomically claims the next pending scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';

-- 3. Modify the timeout handling in the main app to respect the claimed_by_worker_at timestamp
-- This function will be used by the scheduled task that processes timeouts
CREATE OR REPLACE FUNCTION should_mark_run_as_failed(run_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  run_record scraper_runs%ROWTYPE;
  grace_period_minutes INTEGER := 5; -- Grace period for worker to process a job after claiming it
BEGIN
  -- Get the run record
  SELECT * INTO run_record FROM scraper_runs WHERE id = run_id;

  -- If run doesn't exist, return false
  IF run_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If run is not in pending or running status, return false
  IF run_record.status NOT IN ('pending', 'running') THEN
    RETURN FALSE;
  END IF;

  -- If run is in pending status and has timed out, return true
  IF run_record.status = 'pending' THEN
    RETURN TRUE;
  END IF;

  -- If run is in running status, check if it has been claimed by a worker
  IF run_record.status = 'running' AND run_record.claimed_by_worker_at IS NOT NULL THEN
    -- Check if the worker has had enough time to process the job
    RETURN (NOW() - run_record.claimed_by_worker_at) > (grace_period_minutes * INTERVAL '1 minute');
  END IF;

  -- Default case: don't mark as failed
  RETURN FALSE;
END;
$$;

-- 4. Update the handle_worker_error function to respect the claimed_by_worker_at timestamp
CREATE OR REPLACE FUNCTION handle_worker_error()
RETURNS TRIGGER AS $$
BEGIN
    -- If a run has been in 'pending' status for more than 5 minutes, mark it as failed
    -- BUT only if it hasn't been claimed by a worker
    UPDATE scraper_runs
    SET
        status = 'failed',
        error_message = 'Worker timeout: The job was not picked up by a worker within 5 minutes',
        completed_at = NOW()
    WHERE
        status = 'pending'
        AND started_at < NOW() - INTERVAL '5 minutes'
        AND claimed_by_worker_at IS NULL
        AND id NOT IN (SELECT run_id FROM scraper_run_timeouts WHERE processed = false);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Create a function to handle the case where a job is marked as failed with "Script execution failed with non-zero exit code 1"
CREATE OR REPLACE FUNCTION prevent_premature_failure()
RETURNS TRIGGER AS $$
BEGIN
    -- If the job is being marked as failed with "Script execution failed with non-zero exit code 1"
    -- but it has been claimed by a worker recently, prevent the update
    IF NEW.status = 'failed' AND
       NEW.error_message = 'Script execution failed with non-zero exit code 1' AND
       OLD.claimed_by_worker_at IS NOT NULL AND
       (NOW() - OLD.claimed_by_worker_at) < INTERVAL '2 minutes'
    THEN
        -- Prevent the update by returning OLD
        RAISE NOTICE 'Preventing premature failure of job % that was claimed by worker at %',
                     OLD.id, OLD.claimed_by_worker_at;
        RETURN OLD;
    END IF;

    -- Otherwise, allow the update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to prevent premature failures
DROP TRIGGER IF EXISTS prevent_premature_failure_trigger ON scraper_runs;
CREATE TRIGGER prevent_premature_failure_trigger
BEFORE UPDATE OF status ON scraper_runs
FOR EACH ROW
WHEN (NEW.status = 'failed' AND NEW.error_message = 'Script execution failed with non-zero exit code 1')
EXECUTE FUNCTION prevent_premature_failure();

-- Grant execute permission to the roles that will be calling this function
GRANT EXECUTE ON FUNCTION should_mark_run_as_failed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION should_mark_run_as_failed(UUID) TO service_role;

-- Grant execute permission for the handle_worker_error function
GRANT EXECUTE ON FUNCTION handle_worker_error() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_worker_error() TO service_role;

COMMENT ON FUNCTION should_mark_run_as_failed(UUID) IS 'Determines if a scraper run should be marked as failed based on its status and claimed_by_worker_at timestamp. Prevents marking a job as failed too early after a worker has claimed it.';
COMMENT ON FUNCTION handle_worker_error() IS 'Handles worker timeouts by marking pending jobs as failed if they have been pending for too long and have not been claimed by a worker.';
