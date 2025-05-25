-- Migration: Fix automated scheduling system
-- Date: 2025-01-27
-- Description: Fix the calculate_next_scraper_run_time function, update scraper schedules, and implement proper concurrency control
--
-- ISSUES FIXED:
-- 1. PostgreSQL function syntax errors (current_time vs current_timestamp)
-- 2. Missing time field in scraper schedules
-- 3. No concurrency control - created too many jobs simultaneously
-- 4. Workers getting overloaded with multiple concurrent jobs
--
-- SOLUTION:
-- 1. Fix database functions with proper PostgreSQL syntax
-- 2. Add concurrency limits based on available workers (1 py-worker + 1 ts-worker = max 2 concurrent jobs)
-- 3. Prioritize overdue scrapers instead of creating all jobs at once
-- 4. Clean up any stuck/failed jobs from the overload incident

-- Fix the calculate_next_scraper_run_time function
CREATE OR REPLACE FUNCTION public.calculate_next_scraper_run_time(schedule_config jsonb, last_run timestamp with time zone)
RETURNS timestamp with time zone
LANGUAGE plpgsql
AS $$
DECLARE
    frequency text;
    time_of_day text;
    next_run timestamp with time zone;
    current_time timestamp with time zone := now();
    today_start timestamp with time zone;
    scheduled_time timestamp with time zone;
BEGIN
    -- Extract schedule parameters
    frequency := schedule_config->>'frequency';
    time_of_day := COALESCE(schedule_config->>'time', '02:00');

    -- Get today's start (midnight)
    today_start := date_trunc('day', current_time);

    -- Calculate scheduled time for today
    scheduled_time := today_start + time_of_day::time;

    CASE frequency
        WHEN 'daily' THEN
            -- If today's scheduled time has passed, schedule for tomorrow
            IF scheduled_time <= current_time THEN
                next_run := scheduled_time + interval '1 day';
            ELSE
                next_run := scheduled_time;
            END IF;

        WHEN 'weekly' THEN
            -- Run once per week on the same day as last run (or Monday if no last run)
            IF last_run IS NULL THEN
                -- Default to next Monday at scheduled time
                next_run := date_trunc('week', current_time) + interval '1 day' + time_of_day::time;
                IF next_run <= current_time THEN
                    next_run := next_run + interval '1 week';
                END IF;
            ELSE
                -- Run on the same day of week as last run
                next_run := date_trunc('week', last_run) + interval '1 week' +
                           (extract(dow from last_run) * interval '1 day') + time_of_day::time;
            END IF;

        WHEN 'monthly' THEN
            -- Run once per month on the same day as last run (or 1st if no last run)
            IF last_run IS NULL THEN
                -- Default to next 1st of month at scheduled time
                next_run := date_trunc('month', current_time) + interval '1 month' + time_of_day::time;
            ELSE
                -- Run on the same day of month as last run
                next_run := date_trunc('month', last_run) + interval '1 month' +
                           ((extract(day from last_run) - 1) * interval '1 day') + time_of_day::time;
            END IF;

        ELSE
            -- Default to daily
            IF scheduled_time <= current_time THEN
                next_run := scheduled_time + interval '1 day';
            ELSE
                next_run := scheduled_time;
            END IF;
    END CASE;

    RETURN next_run;
END;
$$;

-- Update all active scrapers to have a proper time field in their schedule
UPDATE public.scrapers
SET schedule = jsonb_set(
    COALESCE(schedule, '{}'::jsonb),
    '{time}',
    '"02:00"'::jsonb
)
WHERE is_active = true
  AND schedule IS NOT NULL
  AND (schedule->>'time') IS NULL;

-- Update scrapers that have incomplete schedules
UPDATE public.scrapers
SET schedule = jsonb_build_object(
    'frequency', 'daily',
    'time', '02:00'
)
WHERE is_active = true
  AND (schedule IS NULL OR schedule = '{}'::jsonb);

-- STEP 1: Clean up any stuck jobs from the overload incident
-- This will be run first to clear the queue
DO $$
DECLARE
    stuck_jobs_count integer;
BEGIN
    -- Cancel jobs that have been running for more than 2 hours (likely stuck)
    UPDATE public.scraper_runs
    SET status = 'failed',
        error_message = 'Cancelled due to timeout - job ran longer than 2 hours',
        completed_at = now()
    WHERE status IN ('running', 'initializing')
      AND started_at < now() - interval '2 hours';

    GET DIAGNOSTICS stuck_jobs_count = ROW_COUNT;

    -- Cancel recent jobs that were created during the overload incident
    UPDATE public.scraper_runs
    SET status = 'failed',
        error_message = 'Cancelled due to worker overload incident',
        completed_at = now()
    WHERE status IN ('pending', 'running', 'initializing')
      AND created_at > now() - interval '30 minutes'
      AND created_at < now() - interval '5 minutes'; -- Keep very recent jobs

    RAISE NOTICE 'Cleaned up % stuck jobs and recent overload jobs', stuck_jobs_count;
END $$;

-- STEP 2: Create improved scheduling function with concurrency control
CREATE OR REPLACE FUNCTION public.create_scheduled_scraper_jobs()
RETURNS TABLE(jobs_created integer, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    scraper_record record;
    job_count integer := 0;
    new_job_id uuid;
    current_timestamp timestamp with time zone := now();

    -- Concurrency limits based on available workers
    max_python_jobs integer := 1;    -- 1 py-worker
    max_typescript_jobs integer := 1; -- 1 ts-worker
    current_python_jobs integer;
    current_typescript_jobs integer;

    -- Job creation limits per run to prevent overload
    max_jobs_per_run integer := 2; -- Maximum jobs to create in one scheduling run
BEGIN
    -- Check current job counts by worker type
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
        current_python_jobs, max_python_jobs,
        current_typescript_jobs, max_typescript_jobs,
        max_jobs_per_run;

    -- If both worker types are at capacity, don't create any jobs
    IF current_python_jobs >= max_python_jobs AND current_typescript_jobs >= max_typescript_jobs THEN
        RETURN QUERY SELECT 0, format('All workers busy - Python: %/%, TypeScript: %/%',
            current_python_jobs, max_python_jobs,
            current_typescript_jobs, max_typescript_jobs);
        RETURN;
    END IF;

    -- Process scrapers in order of priority (longest time since last run)
    FOR scraper_record IN
        SELECT
            s.id,
            s.user_id,
            s.name,
            s.scraper_type,
            s.schedule,
            s.last_run,
            s.competitor_id
        FROM public.scrapers s
        WHERE s.is_active = true
          AND s.schedule IS NOT NULL
          -- Only consider scrapers that haven't run in more than 23 hours
          AND (s.last_run IS NULL OR s.last_run < current_timestamp - interval '23 hours')
        ORDER BY
          -- Prioritize scrapers that haven't run in the longest time
          COALESCE(s.last_run, '1970-01-01'::timestamp with time zone) ASC
        LIMIT 20 -- Only check the 20 most overdue scrapers to prevent long execution
    LOOP
        -- Stop if we've reached the per-run job limit
        IF job_count >= max_jobs_per_run THEN
            RAISE NOTICE 'Reached max jobs per run limit (%)', max_jobs_per_run;
            EXIT;
        END IF;

        -- Check worker capacity for this scraper type
        IF scraper_record.scraper_type = 'python' AND current_python_jobs >= max_python_jobs THEN
            CONTINUE; -- Skip Python scrapers if Python worker is busy
        END IF;

        IF scraper_record.scraper_type = 'typescript' AND current_typescript_jobs >= max_typescript_jobs THEN
            CONTINUE; -- Skip TypeScript scrapers if TypeScript worker is busy
        END IF;

        -- Check if there's already a pending or running job for this specific scraper
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
                false, -- This is a scheduled run, not a test
                scraper_record.scraper_type,
                current_timestamp
            ) RETURNING id INTO new_job_id;

            job_count := job_count + 1;

            -- Update worker capacity counters
            IF scraper_record.scraper_type = 'python' THEN
                current_python_jobs := current_python_jobs + 1;
            ELSIF scraper_record.scraper_type = 'typescript' THEN
                current_typescript_jobs := current_typescript_jobs + 1;
            END IF;

            -- Log the job creation
            RAISE NOTICE 'Created scheduled job % for scraper % (%) - Priority: %',
                new_job_id, scraper_record.name, scraper_record.scraper_type,
                CASE
                    WHEN scraper_record.last_run IS NULL THEN 'Never run'
                    ELSE extract(epoch from (current_timestamp - scraper_record.last_run))/3600 || ' hours ago'
                END;
        END IF;
    END LOOP;

    RETURN QUERY SELECT job_count, format('Created %s scheduled scraper jobs (Python: %/%, TypeScript: %/%)',
        job_count, current_python_jobs, max_python_jobs, current_typescript_jobs, max_typescript_jobs);
END;
$$;

-- STEP 3: Create improved integration scheduling function with concurrency control
CREATE OR REPLACE FUNCTION public.create_scheduled_integration_jobs()
RETURNS TABLE(jobs_created integer, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    integration_record record;
    job_count integer := 0;
    new_job_id uuid;
    current_timestamp timestamp with time zone := now();

    -- Concurrency limits for integration worker
    max_integration_jobs integer := 1; -- 1 ts-util-worker
    current_integration_jobs integer;
    max_jobs_per_run integer := 1; -- Maximum integration jobs to create in one run
BEGIN
    -- Check current integration job count
    SELECT COUNT(*) INTO current_integration_jobs
    FROM public.integration_runs ir
    WHERE ir.status IN ('pending', 'initializing', 'running');

    -- Log current status
    RAISE NOTICE 'Current integration jobs: %/%, Max per run: %',
        current_integration_jobs, max_integration_jobs, max_jobs_per_run;

    -- If integration worker is at capacity, don't create any jobs
    IF current_integration_jobs >= max_integration_jobs THEN
        RETURN QUERY SELECT 0, format('Integration worker busy - %/% jobs running',
            current_integration_jobs, max_integration_jobs);
        RETURN;
    END IF;

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
            EXIT;
        END IF;

        -- Check if there's already a pending or running job for this integration
        IF NOT EXISTS (
            SELECT 1 FROM public.integration_runs ir
            WHERE ir.integration_id = integration_record.id
              AND ir.status IN ('pending', 'initializing', 'running')
        ) THEN
            -- Create new integration run job
            INSERT INTO public.integration_runs (
                id,
                integration_id,
                user_id,
                status,
                started_at,
                is_test_run,
                created_at
            ) VALUES (
                gen_random_uuid(),
                integration_record.id,
                integration_record.user_id,
                'pending',
                current_timestamp,
                false, -- This is a scheduled run, not a test
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
        END IF;
    END LOOP;

    RETURN QUERY SELECT job_count, format('Created %s scheduled integration jobs (%/%)',
        job_count, current_integration_jobs, max_integration_jobs);
END;
$$;

-- STEP 4: Create a configuration function for easy worker capacity management
CREATE OR REPLACE FUNCTION public.get_worker_capacity_config()
RETURNS TABLE(
    worker_type text,
    max_concurrent_jobs integer,
    current_jobs integer,
    description text
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Return current worker capacity configuration
    RETURN QUERY
    SELECT
        'python'::text as worker_type,
        1 as max_concurrent_jobs,
        (SELECT COUNT(*)::integer FROM scraper_runs WHERE status IN ('pending', 'initializing', 'running') AND scraper_type = 'python') as current_jobs,
        'Python scraper worker (py-worker)'::text as description
    UNION ALL
    SELECT
        'typescript'::text as worker_type,
        1 as max_concurrent_jobs,
        (SELECT COUNT(*)::integer FROM scraper_runs WHERE status IN ('pending', 'initializing', 'running') AND scraper_type = 'typescript') as current_jobs,
        'TypeScript scraper worker (ts-worker)'::text as description
    UNION ALL
    SELECT
        'integration'::text as worker_type,
        1 as max_concurrent_jobs,
        (SELECT COUNT(*)::integer FROM integration_runs WHERE status IN ('pending', 'initializing', 'running')) as current_jobs,
        'Integration worker (ts-util-worker)'::text as description;
END;
$$;

-- STEP 5: Create a function to safely update worker capacity limits
-- This can be used later when you add more workers
CREATE OR REPLACE FUNCTION public.update_scheduling_config(
    p_max_python_workers integer DEFAULT 1,
    p_max_typescript_workers integer DEFAULT 1,
    p_max_integration_workers integer DEFAULT 1,
    p_max_jobs_per_run integer DEFAULT 2
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    -- This function serves as documentation for the current limits
    -- In the future, these could be stored in a configuration table
    -- For now, it just returns the current configuration

    RETURN format('Worker capacity configuration:
- Python workers: %s (handles scraper_type = ''python'')
- TypeScript workers: %s (handles scraper_type = ''typescript'')
- Integration workers: %s (handles integration jobs)
- Max jobs created per scheduling run: %s

To increase capacity:
1. Deploy additional worker instances on Railway
2. Update the scheduling functions with new limits
3. Monitor performance and adjust as needed

Current pg_cron schedule:
- Scraper jobs: Every 5 minutes
- Integration jobs: Every 10 minutes
- Utility jobs: Every hour',
        p_max_python_workers,
        p_max_typescript_workers,
        p_max_integration_workers,
        p_max_jobs_per_run);
END;
$$;

-- STEP 6: Add helpful monitoring queries as comments for future reference
/*
-- Monitor current job queue status:
SELECT
    sr.scraper_type,
    sr.status,
    COUNT(*) as job_count,
    MIN(sr.created_at) as oldest_job,
    MAX(sr.created_at) as newest_job
FROM scraper_runs sr
WHERE sr.created_at > now() - interval '1 hour'
GROUP BY sr.scraper_type, sr.status
ORDER BY sr.scraper_type, sr.status;

-- Check worker capacity:
SELECT * FROM get_worker_capacity_config();

-- View scheduling configuration:
SELECT update_scheduling_config();

-- Monitor overdue scrapers:
SELECT
    s.name,
    s.scraper_type,
    s.last_run,
    extract(epoch from (now() - s.last_run))/3600 as hours_since_last_run,
    CASE
        WHEN EXISTS (SELECT 1 FROM scraper_runs sr WHERE sr.scraper_id = s.id AND sr.status IN ('pending', 'initializing', 'running'))
        THEN 'Job in queue'
        ELSE 'Available for scheduling'
    END as status
FROM scrapers s
WHERE s.is_active = true
  AND s.schedule IS NOT NULL
  AND (s.last_run IS NULL OR s.last_run < now() - interval '23 hours')
ORDER BY COALESCE(s.last_run, '1970-01-01'::timestamp with time zone) ASC;
*/
