CREATE OR REPLACE FUNCTION claim_next_integration_job()
RETURNS SETOF integration_runs -- Returns a setof because SKIP LOCKED might return 0 or 1 row
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_job_id UUID;
BEGIN
  -- Find the oldest pending job for integration runs.
  -- Lock the row to prevent other workers from picking it up simultaneously.
  -- SKIP LOCKED ensures that if another worker has already locked this row,
  -- this transaction won't wait but will instead try to find the next available job.
  SELECT ir.id
  INTO claimed_job_id
  FROM integration_runs ir
  WHERE ir.status = 'pending'
  ORDER BY ir.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_job_id IS NULL THEN
    -- No job found, or all available jobs are currently locked by other transactions.
    RETURN;
  END IF;

  -- Update the job status to 'processing' and set the started_at timestamp.
  -- The RETURNING clause will return the updated row(s).
  RETURN QUERY
  UPDATE integration_runs ir
  SET status = 'processing', started_at = NOW()
  WHERE ir.id = claimed_job_id AND ir.status = 'pending' -- Double-check status
  RETURNING ir.*; -- Return all columns from the updated integration_runs row
END;
$$;

-- Grant execute permission to the roles that will be calling this function
GRANT EXECUTE ON FUNCTION claim_next_integration_job() TO authenticated;
GRANT EXECUTE ON FUNCTION claim_next_integration_job() TO service_role; -- Common for backend services

COMMENT ON FUNCTION claim_next_integration_job() IS 'Atomically claims the next pending integration job. It selects, locks, and updates the job status to "processing" in a single transaction, returning the claimed job. Uses FOR UPDATE SKIP LOCKED for concurrency.';