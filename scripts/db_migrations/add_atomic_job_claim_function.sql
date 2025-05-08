DROP FUNCTION IF EXISTS claim_next_scraper_job(TEXT);

CREATE OR REPLACE FUNCTION claim_next_scraper_job(worker_type_filter TEXT)
RETURNS TABLE (
    -- Columns from scraper_runs
    id UUID,
    created_at TIMESTAMPTZ,
    scraper_id UUID,
    user_id UUID,
    status TEXT, -- Consider using the actual ENUM type if 'scraper_run_status' exists
    scraper_type TEXT, -- Consider using an ENUM type if one exists
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    error_details TEXT, -- Corrected type to match scraper_runs table
    product_count INTEGER,
    is_test_run BOOLEAN,
    -- is_validation_run BOOLEAN, -- Temporarily removed as it does not exist in scraper_runs table
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
    SET status = 'running', started_at = NOW()
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
    -- sr.is_validation_run, -- Temporarily removed
    s.competitor_id AS fetched_competitor_id -- Alias to match the RETURNS TABLE definition
  FROM scraper_runs sr
  JOIN scrapers s ON sr.scraper_id = s.id
  WHERE sr.id = claimed_job_id_val; -- Select the specific job that was claimed
END;
$$;

-- Grant execute permission to the roles that will be calling this function
GRANT EXECUTE ON FUNCTION claim_next_scraper_job(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_next_scraper_job(TEXT) TO service_role; -- Common for backend services

COMMENT ON FUNCTION claim_next_scraper_job(TEXT) IS 'Atomically claims the next pending scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';
