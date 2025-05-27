-- =========================================================================
-- Job-related objects
-- =========================================================================
-- Generated: 2025-05-27 10:02:57
-- This file is part of the PriceTracker database setup
-- =========================================================================

revoke all on table cron.job from postgres;

grant select on table cron.job to postgres with grant option;

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

-- Update the job status to 'processing' and set the started_at timestamp.
  -- The RETURNING clause will return the updated row(s).
  RETURN QUERY
  UPDATE integration_runs ir
  SET status = 'processing', started_at = NOW()
  WHERE ir.id = claimed_job_id AND ir.status = 'pending' -- Double-check status
  RETURNING ir.*; -- Return all columns from the updated integration_runs row
END;

BEGIN
  -- Atomically find a job, lock it, and update its status.
  -- This CTE structure ensures atomicity for the find-and-update part.
  WITH potential_job AS (
    SELECT sr_inner.id
    FROM scraper_runs sr_inner
    WHERE sr_inner.status IN ('pending', 'initializing') AND sr_inner.scraper_type = worker_type_filter
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
    WHERE sr_update.id = pj.id AND sr_update.status IN ('pending', 'initializing') -- Ensure it's still pending or initializing before update
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

job_count integer := 0;

new_job_id uuid;

-- Concurrency limits for integration worker
    max_integration_jobs integer := 1; -- 1 ts-util-worker
    current_integration_jobs integer;

max_jobs_per_run integer := 1; -- Maximum integration jobs to create in one run
BEGIN
    -- Check current integration job count (include 'processing' status)
    SELECT COUNT(*) INTO current_integration_jobs
    FROM public.integration_runs ir
    WHERE ir.status IN ('pending', 'initializing', 'running', 'processing');

-- Log current status
    RAISE NOTICE 'Current integration jobs: %/%, Max per run: %',
        current_integration_jobs, max_integration_jobs, max_jobs_per_run;

-- If integration worker is at capacity, don't create any jobs
    IF current_integration_jobs >= max_integration_jobs THEN
        RETURN QUERY SELECT 0, format('Integration worker busy - %s/%s jobs running',
            current_integration_jobs, max_integration_jobs);

-- Process integrations in order of priority (longest time since last sync)
    FOR integration_record IN
        SELECT
            i.id,
            i.user_id,
            i.name,
            i.platform,
            i.sync_frequency,
            i.last_sync_at
        FROM public.integrations i
        WHERE i.status = 'active'
          AND i.sync_frequency IS NOT NULL
          -- Only consider integrations that haven't synced in more than 23 hours
          AND (i.last_sync_at IS NULL OR i.last_sync_at < current_timestamp - interval '23 hours')
        ORDER BY
          -- Prioritize integrations that haven't synced in the longest time
          COALESCE(i.last_sync_at, '1970-01-01'::timestamp with time zone) ASC
        LIMIT 10 -- Only check the 10 most overdue integrations
    LOOP
        -- Stop if we've reached the per-run job limit or worker capacity
        IF job_count >= max_jobs_per_run OR current_integration_jobs >= max_integration_jobs THEN
            RAISE NOTICE 'Reached limit - jobs created: %, worker capacity: %/%',
                job_count, current_integration_jobs, max_integration_jobs;

-- Check if there's already a pending, running, or processing job for this integration
        IF NOT EXISTS (
            SELECT 1 FROM public.integration_runs ir
            WHERE ir.integration_id = integration_record.id
              AND ir.status IN ('pending', 'initializing', 'running', 'processing')
        ) THEN
            -- Create new integration run job
            INSERT INTO public.integration_runs (
                id,
                integration_id,
                user_id,
                status,
                started_at,
                created_at
            ) VALUES (
                gen_random_uuid(),
                integration_record.id,
                integration_record.user_id,
                'pending',
                current_timestamp,
                current_timestamp
            ) RETURNING id INTO new_job_id;

job_count := job_count + 1;

current_integration_jobs := current_integration_jobs + 1;

-- Log the job creation
            RAISE NOTICE 'Created scheduled job % for integration % (%) - Priority: %',
                new_job_id, integration_record.name, integration_record.platform,
                CASE
                    WHEN integration_record.last_sync_at IS NULL THEN 'Never synced'
                    ELSE extract(epoch from (current_timestamp - integration_record.last_sync_at))/3600 || ' hours ago'
                END;

RETURN QUERY SELECT job_count, format('Created %s scheduled integration jobs (%s/%s)',
        job_count, current_integration_jobs, max_integration_jobs);

has_pending_job_flag boolean;

job_created_flag boolean;

-- Check if there's already a pending job
        SELECT EXISTS (
            SELECT 1 FROM public.scraper_runs sr
            WHERE sr.scraper_id = scraper_record.id
              AND sr.status IN ('pending', 'initializing', 'running')
        ) INTO has_pending_job_flag;

job_created_flag := false;

IF should_run_flag AND NOT has_pending_job_flag THEN
            job_created_flag := true;

RETURN QUERY SELECT scraper_record.id, scraper_record.name, should_run_flag, has_pending_job_flag, job_created_flag;

