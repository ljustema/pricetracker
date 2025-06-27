-- =========================================================================
-- Job-related objects
-- =========================================================================
-- Generated: 2025-06-27 11:27:38
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
      claimed_by_worker_at = NOW(), -- Set the claimed_by_worker_at timestamp
      error_message = NULL -- Clear any info messages when worker claims the job
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

-- Log current state
    RAISE NOTICE 'Integration job scheduler: Current jobs: %/%, Max per run: %',
        current_integration_jobs, max_integration_jobs, max_jobs_per_run;

-- Exit early if we're at capacity
    IF current_integration_jobs >= max_integration_jobs THEN
        RETURN QUERY SELECT 0, format('Integration worker at capacity (%s/%s)',
            current_integration_jobs, max_integration_jobs);

-- Process integrations that are due to run based on their stored next_run_time
    FOR integration_record IN
        SELECT
            i.id,
            i.user_id,
            i.name,
            i.platform,
            i.sync_frequency,
            i.last_sync_at,
            i.next_run_time
        FROM public.integrations i
        WHERE i.status = 'active'
          AND i.is_active = true  -- Only run active integrations
          AND i.sync_frequency IS NOT NULL
          AND i.next_run_time IS NOT NULL
          -- Only consider integrations that are due to run
          AND i.next_run_time <= current_timestamp
        ORDER BY
          -- Prioritize integrations that are most overdue
          i.next_run_time ASC
        LIMIT 10 -- Only check the 10 most overdue integrations
    LOOP
        -- Stop if we've reached the per-run job limit or worker capacity
        IF job_count >= max_jobs_per_run OR current_integration_jobs >= max_integration_jobs THEN
            EXIT;

-- Check if there's already a pending/running job for this integration
        IF NOT EXISTS (
            SELECT 1 FROM public.integration_runs ir
            WHERE ir.integration_id = integration_record.id
              AND ir.status IN ('pending', 'initializing', 'running', 'processing')
        ) THEN
            -- Create a new integration run job
            INSERT INTO public.integration_runs (
                integration_id,
                user_id,
                status,
                created_at
            ) VALUES (
                integration_record.id,
                integration_record.user_id,
                'pending',
                current_timestamp
            ) RETURNING id INTO new_job_id;

job_count := job_count + 1;

current_integration_jobs := current_integration_jobs + 1;

-- Log the job creation
            RAISE NOTICE 'Created scheduled job % for integration % (%) - Due at: %',
                new_job_id, integration_record.name, integration_record.platform,
                integration_record.next_run_time;

RETURN QUERY SELECT job_count, format('Created %s scheduled integration jobs (%s/%s)',
        job_count, current_integration_jobs, max_integration_jobs);

job_count integer := 0;

new_job_id uuid;

-- Concurrency limits for scraper workers
    max_python_jobs integer := 1;

max_typescript_jobs integer := 1;

current_python_jobs integer;

current_typescript_jobs integer;

max_jobs_per_run integer := 2;

BEGIN
    -- Check current job counts by type
    SELECT COUNT(*) INTO current_python_jobs
    FROM public.scraper_runs sr
    WHERE sr.status IN ('pending', 'initializing', 'running')
      AND sr.scraper_type = 'python';

SELECT COUNT(*) INTO current_typescript_jobs
    FROM public.scraper_runs sr
    WHERE sr.status IN ('pending', 'initializing', 'running')
      AND sr.scraper_type = 'typescript';

-- Log current status
    RAISE NOTICE 'Current jobs - Python: %/%, TypeScript: %/%, Max per run: %',
        current_python_jobs, max_python_jobs, current_typescript_jobs, max_typescript_jobs, max_jobs_per_run;

-- If all workers are busy, don't create any jobs
    IF current_python_jobs >= max_python_jobs AND current_typescript_jobs >= max_typescript_jobs THEN
        RETURN QUERY SELECT 0, 'All workers busy - Python: ' || current_python_jobs || '/' || max_python_jobs || ', TypeScript: ' || current_typescript_jobs || '/' || max_typescript_jobs;

-- Process scrapers that are due to run based on their stored next_run_time
    FOR scraper_record IN
        SELECT
            s.id,
            s.user_id,
            s.name,
            s.scraper_type,
            s.schedule,
            s.last_run,
            s.next_run_time,
            s.competitor_id
        FROM public.scrapers s
        WHERE s.is_active = true
          AND s.schedule IS NOT NULL
          AND s.next_run_time IS NOT NULL
          -- Only consider scrapers that are due to run
          AND s.next_run_time <= current_timestamp
        ORDER BY
          -- Prioritize scrapers that are most overdue
          s.next_run_time ASC
        LIMIT 20 -- Only check the 20 most overdue scrapers
    LOOP
        -- Stop if we've reached the per-run job limit
        IF job_count >= max_jobs_per_run THEN
            RAISE NOTICE 'Reached max jobs per run limit (%)', max_jobs_per_run;

-- Check worker capacity by type
        IF scraper_record.scraper_type = 'python' AND current_python_jobs >= max_python_jobs THEN
            CONTINUE;

IF scraper_record.scraper_type = 'typescript' AND current_typescript_jobs >= max_typescript_jobs THEN
            CONTINUE;

-- Check if there's already a pending, running job for this scraper
        IF NOT EXISTS (
            SELECT 1 FROM public.scraper_runs sr
            WHERE sr.scraper_id = scraper_record.id
              AND sr.status IN ('pending', 'initializing', 'running')
        ) THEN
            -- Create new scraper run job
            INSERT INTO public.scraper_runs (
                id,
                scraper_id,
                user_id,
                status,
                started_at,
                is_test_run,
                scraper_type,
                created_at
            ) VALUES (
                gen_random_uuid(),
                scraper_record.id,
                scraper_record.user_id,
                'pending',
                current_timestamp,
                false,
                scraper_record.scraper_type,
                current_timestamp
            ) RETURNING id INTO new_job_id;

job_count := job_count + 1;

-- Update worker counts
            IF scraper_record.scraper_type = 'python' THEN
                current_python_jobs := current_python_jobs + 1;

ELSIF scraper_record.scraper_type = 'typescript' THEN
                current_typescript_jobs := current_typescript_jobs + 1;

-- Log the job creation
            RAISE NOTICE 'Created scheduled job % for scraper % (%) - Due at: %',
                new_job_id, scraper_record.name, scraper_record.scraper_type,
                scraper_record.next_run_time;

RETURN QUERY SELECT job_count, 'Created ' || job_count || ' scheduled scraper jobs (Python: ' || current_python_jobs || '/' || max_python_jobs || ', TypeScript: ' || current_typescript_jobs || '/' || max_typescript_jobs || ')';

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

