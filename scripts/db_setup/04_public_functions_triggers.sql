-- =========================================================================
-- Functions and triggers
-- =========================================================================
-- Generated: 2025-06-05 13:39:40
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';

--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';

--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';

--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';

--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;

create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';

--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';

--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;

IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';

--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

--
-- Name: append_log_to_scraper_run(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_log_to_scraper_run(p_run_id uuid, p_log_entry jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE scraper_runs
  SET progress_messages = coalesce(progress_messages, '[]'::jsonb) || p_log_entry
  WHERE id = p_run_id;

--
-- Name: append_logs_to_scraper_run(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_logs_to_scraper_run(p_run_id uuid, p_log_entries text[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Use a single update to append all log entries at once
  UPDATE scraper_runs
  SET progress_messages = COALESCE(progress_messages, ARRAY[]::text[]) || p_log_entries
  WHERE id = p_run_id;

--
-- Name: FUNCTION append_logs_to_scraper_run(p_run_id uuid, p_log_entries text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.append_logs_to_scraper_run(p_run_id uuid, p_log_entries text[]) IS 'Efficiently appends multiple log entries to a scraper run''s progress_messages in a single database operation';

--
-- Name: auto_trim_progress_messages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_trim_progress_messages() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_message_count integer;

--
-- Name: FUNCTION auto_trim_progress_messages(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_trim_progress_messages() IS 'Automatically trims progress_messages when they exceed 200 entries';

--
-- Name: calculate_next_integration_run_time(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_next_integration_run_time(sync_frequency text, last_sync_at timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_run timestamp with time zone;

--
-- Name: calculate_next_scraper_run_time(jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_next_scraper_run_time(schedule_config jsonb, last_run timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    frequency text;

--
-- Name: claim_next_integration_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_next_integration_job() RETURNS SETOF public.integration_runs
    LANGUAGE plpgsql
    AS $$
DECLARE
  claimed_job_id UUID;

--
-- Name: FUNCTION claim_next_integration_job(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_next_integration_job() IS 'Atomically claims the next pending integration job. It selects, locks, and updates the job status to "processing" in a single transaction, returning the claimed job. Uses FOR UPDATE SKIP LOCKED for concurrency.';

--
-- Name: claim_next_scraper_job(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_next_scraper_job(worker_type_filter text) RETURNS TABLE(id uuid, created_at timestamp with time zone, scraper_id uuid, user_id uuid, status text, scraper_type text, started_at timestamp with time zone, completed_at timestamp with time zone, error_message text, error_details text, product_count integer, is_test_run boolean, fetched_competitor_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
  claimed_job_id_val UUID;

--
-- Name: FUNCTION claim_next_scraper_job(worker_type_filter text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_next_scraper_job(worker_type_filter text) IS 'Atomically claims the next pending or initializing scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';

--
-- Name: cleanup_old_debug_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_debug_logs() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count integer;

--
-- Name: cleanup_old_scraper_runs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_scraper_runs() RETURNS integer
    LANGUAGE plpgsql
    AS $$ DECLARE deleted_count integer; BEGIN DELETE FROM public.scraper_runs WHERE created_at < now() - interval '30 days' AND status IN ('completed', 'failed'); GET DIAGNOSTICS deleted_count = ROW_COUNT; INSERT INTO public.debug_logs (message, created_at) VALUES ('Cleaned up ' || deleted_count || ' old scraper runs', now()); RETURN deleted_count; END; $$;

--
-- Name: cleanup_rate_limit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_rate_limit_logs() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM rate_limit_log 
  WHERE created_at < NOW() - INTERVAL '24 hours';

--
-- Name: cleanup_temp_competitors_scraped_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_temp_competitors_scraped_data() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Remove all records in temp_competitors_scraped_data that are older than 30 days
  DELETE FROM temp_competitors_scraped_data
  WHERE scraped_at < NOW() - INTERVAL '30 days';

--
-- Name: count_distinct_competitors_for_brand(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_distinct_competitors_for_brand(p_user_id uuid, p_brand_id uuid) RETURNS integer
    LANGUAGE sql
    AS $$
  SELECT COUNT(DISTINCT pc.competitor_id)
  FROM price_changes pc
  JOIN products p ON pc.product_id = p.id
  WHERE p.user_id = p_user_id
    AND p.brand_id = p_brand_id;

--
-- Name: create_profile_for_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_for_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Create a user profile when a user is created in auth.users
  BEGIN
    INSERT INTO user_profiles (id, name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name');

--
-- Name: FUNCTION create_profile_for_user(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_profile_for_user() IS 'Creates a user profile when a user is created in auth.users. Includes error handling to prevent failures during user creation.';

--
-- Name: create_scheduled_integration_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_scheduled_integration_jobs() RETURNS TABLE(jobs_created integer, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    integration_record record;

--
-- Name: create_scheduled_scraper_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_scheduled_scraper_jobs() RETURNS TABLE(jobs_created integer, message text)
    LANGUAGE plpgsql
    AS $$ DECLARE scraper_record record; job_count integer := 0; new_job_id uuid; current_timestamp timestamp with time zone := now(); max_python_jobs integer := 1; max_typescript_jobs integer := 1; current_python_jobs integer; current_typescript_jobs integer; max_jobs_per_run integer := 2; BEGIN SELECT COUNT(*) INTO current_python_jobs FROM public.scraper_runs sr WHERE sr.status IN ('pending', 'initializing', 'running') AND sr.scraper_type = 'python'; SELECT COUNT(*) INTO current_typescript_jobs FROM public.scraper_runs sr WHERE sr.status IN ('pending', 'initializing', 'running') AND sr.scraper_type = 'typescript'; RAISE NOTICE 'Current jobs - Python: %/%, TypeScript: %/%, Max per run: %', current_python_jobs, max_python_jobs, current_typescript_jobs, max_typescript_jobs, max_jobs_per_run; IF current_python_jobs >= max_python_jobs AND current_typescript_jobs >= max_typescript_jobs THEN RETURN QUERY SELECT 0, 'All workers busy - Python: ' || current_python_jobs || '/' || max_python_jobs || ', TypeScript: ' || current_typescript_jobs || '/' || max_typescript_jobs; RETURN; END IF; FOR scraper_record IN SELECT s.id, s.user_id, s.name, s.scraper_type, s.schedule, s.last_run, s.competitor_id FROM public.scrapers s WHERE s.is_active = true AND s.schedule IS NOT NULL AND (s.last_run IS NULL OR s.last_run < current_timestamp - interval '23 hours') ORDER BY COALESCE(s.last_run, '1970-01-01'::timestamp with time zone) ASC LIMIT 20 LOOP IF job_count >= max_jobs_per_run THEN RAISE NOTICE 'Reached max jobs per run limit (%)', max_jobs_per_run; EXIT; END IF; IF scraper_record.scraper_type = 'python' AND current_python_jobs >= max_python_jobs THEN CONTINUE; END IF; IF scraper_record.scraper_type = 'typescript' AND current_typescript_jobs >= max_typescript_jobs THEN CONTINUE; END IF; IF NOT EXISTS ( SELECT 1 FROM public.scraper_runs sr WHERE sr.scraper_id = scraper_record.id AND sr.status IN ('pending', 'initializing', 'running') ) THEN INSERT INTO public.scraper_runs ( id, scraper_id, user_id, status, started_at, is_test_run, scraper_type, created_at ) VALUES ( gen_random_uuid(), scraper_record.id, scraper_record.user_id, 'pending', current_timestamp, false, scraper_record.scraper_type, current_timestamp ) RETURNING id INTO new_job_id; job_count := job_count + 1; IF scraper_record.scraper_type = 'python' THEN current_python_jobs := current_python_jobs + 1; ELSIF scraper_record.scraper_type = 'typescript' THEN current_typescript_jobs := current_typescript_jobs + 1; END IF; RAISE NOTICE 'Created scheduled job % for scraper % (%) - Priority: %', new_job_id, scraper_record.name, scraper_record.scraper_type, CASE WHEN scraper_record.last_run IS NULL THEN 'Never run' ELSE extract(epoch from (current_timestamp - scraper_record.last_run))/3600 || ' hours ago' END; END IF; END LOOP; RETURN QUERY SELECT job_count, 'Created ' || job_count || ' scheduled scraper jobs (Python: ' || current_python_jobs || '/' || max_python_jobs || ', TypeScript: ' || current_typescript_jobs || '/' || max_typescript_jobs || ')'; END; $$;

--
-- Name: FUNCTION create_user_for_nextauth(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_user_for_nextauth() IS 'Creates a user in the next_auth schema when a user is created in auth.users. Uses the correct column name "emailVerified" (camelCase) instead of "email_verified" (snake_case).';

--
-- Name: create_user_for_nextauth(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_for_nextauth(user_id uuid, email text, name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Insert the user into auth.users if it doesn't exist
  INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    user_id,
    email,
    jsonb_build_object('name', name),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

--
-- Name: create_utility_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_utility_jobs() RETURNS TABLE(jobs_created integer, message text)
    LANGUAGE plpgsql
    AS $$ DECLARE job_count integer := 0; last_cleanup_check timestamp with time zone; BEGIN SELECT COALESCE(MAX(dl.created_at), '1970-01-01'::timestamp with time zone) INTO last_cleanup_check FROM public.debug_logs dl WHERE dl.message LIKE '%cleanup_utility_job%' AND dl.created_at > now() - interval '1 day'; IF last_cleanup_check < now() - interval '23 hours' THEN INSERT INTO public.debug_logs (message, created_at) VALUES ('cleanup_utility_job - daily_cleanup at ' || now(), now()); job_count := job_count + 1; PERFORM cleanup_old_scraper_runs(); PERFORM cleanup_old_debug_logs(); PERFORM process_scraper_timeouts(); RAISE NOTICE 'Created utility cleanup job at %', now(); END IF; RETURN QUERY SELECT job_count, 'Created ' || job_count || ' utility jobs'; END; $$;

--
-- Name: debug_create_scheduled_scraper_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_create_scheduled_scraper_jobs() RETURNS TABLE(scraper_id uuid, scraper_name text, should_run boolean, has_pending_job boolean, job_created boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    scraper_record record;

--
-- Name: dismiss_product_duplicates(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    ordered_id_1 UUID;

--
-- Name: FUNCTION dismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.dismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) IS 'Dismisses product duplicates to prevent them from appearing in future duplicate detection';

--
-- Name: ensure_one_active_scraper_per_competitor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_one_active_scraper_per_competitor() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Ensure only one active scraper per competitor
  IF NEW.is_active THEN
    UPDATE scrapers
    SET is_active = FALSE
    WHERE competitor_id = NEW.competitor_id AND id <> NEW.id;

--
-- Name: ensure_user_exists_simple(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_exists_simple(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Call the existing function with minimal data
  PERFORM create_user_for_nextauth(
    p_user_id,
    'user-' || p_user_id || '@example.com', -- Placeholder email
    'User ' || p_user_id::text -- Placeholder name
  );

--
-- Name: FUNCTION ensure_user_exists_simple(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.ensure_user_exists_simple(p_user_id uuid) IS 'Ensures a user exists in all necessary tables by calling create_user_for_nextauth with minimal data.';

--
-- Name: find_brand_by_name_or_alias(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_brand_by_name_or_alias(p_user_id uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_brand_id UUID;

--
-- Name: find_or_create_brand(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_or_create_brand(p_user_id uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_brand_id UUID;

--
-- Name: find_potential_duplicates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_potential_duplicates(p_user_id uuid) RETURNS TABLE(group_id text, product_id uuid, name text, sku text, ean text, brand text, brand_id uuid, match_reason text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    settings JSONB;

--
-- Name: FUNCTION find_potential_duplicates(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_potential_duplicates(p_user_id uuid) IS 'Enhanced duplicate detection with user settings support, fuzzy matching, and dismissed duplicates exclusion';

--
-- Name: find_potential_duplicates(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_potential_duplicates(p_user_id uuid, p_limit integer DEFAULT NULL::integer) RETURNS TABLE(group_id text, product_id uuid, name text, sku text, ean text, brand text, brand_id uuid, match_reason text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    settings JSONB;

--
-- Name: find_product_with_fuzzy_matching(uuid, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_product_with_fuzzy_matching(p_user_id uuid, p_ean text, p_brand text, p_sku text, p_name text, p_brand_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    settings JSONB;

--
-- Name: FUNCTION find_product_with_fuzzy_matching(p_user_id uuid, p_ean text, p_brand text, p_sku text, p_name text, p_brand_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_product_with_fuzzy_matching(p_user_id uuid, p_ean text, p_brand text, p_sku text, p_name text, p_brand_id uuid) IS 'Enhanced product matching with user settings support and fuzzy matching';

--
-- Name: get_admin_user_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_user_stats() RETURNS TABLE(total_users bigint, active_users_last_30_days bigint, new_users_last_30_days bigint, free_users bigint, premium_users bigint, enterprise_users bigint, suspended_users bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.user_profiles) as total_users,
        (SELECT COUNT(*) FROM public.user_profiles WHERE updated_at >= NOW() - INTERVAL '30 days') as active_users_last_30_days,
        (SELECT COUNT(*) FROM public.user_profiles WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_last_30_days,
        (SELECT COUNT(*) FROM public.user_profiles WHERE subscription_tier = 'free') as free_users,
        (SELECT COUNT(*) FROM public.user_profiles WHERE subscription_tier = 'premium') as premium_users,
        (SELECT COUNT(*) FROM public.user_profiles WHERE subscription_tier = 'enterprise') as enterprise_users,
        (SELECT COUNT(*) FROM public.user_profiles WHERE is_suspended = true) as suspended_users;

--
-- Name: FUNCTION get_admin_user_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_user_stats() IS 'Returns overview statistics for admin dashboard including user counts by subscription tier and activity.';

--
-- Name: get_brand_aliases(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brand_aliases(p_user_id uuid) RETURNS TABLE(brand_id uuid, aliases text[])
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.brand_id,
    ARRAY_AGG(ba.alias_name) AS aliases
  FROM
    brand_aliases ba
  WHERE
    ba.user_id = p_user_id
  GROUP BY
    ba.brand_id;

--
-- Name: get_brand_analytics(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brand_analytics(p_user_id uuid, p_brand_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, is_active boolean, needs_review boolean, created_at timestamp with time zone, updated_at timestamp with time zone, product_count bigint, our_products_count bigint, competitor_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH product_counts AS (
    SELECT
      b.id AS brand_id,
      COUNT(p.id) AS product_count,
      COUNT(CASE WHEN p.our_price IS NOT NULL THEN 1 END) AS our_products_count
    FROM
      brands b
    LEFT JOIN
      products p ON b.id = p.brand_id AND p.user_id = b.user_id
    WHERE
      b.user_id = p_user_id
      AND (p_brand_id IS NULL OR b.id = p_brand_id)
    GROUP BY
      b.id
  ),
  competitor_counts AS (
    SELECT
      b.id AS brand_id,
      COUNT(DISTINCT pc.competitor_id) AS competitor_count
    FROM
      brands b
    LEFT JOIN
      products p ON b.id = p.brand_id AND p.user_id = b.user_id
    LEFT JOIN
      price_changes pc ON p.id = pc.product_id AND pc.user_id = b.user_id
    WHERE
      b.user_id = p_user_id
      AND (p_brand_id IS NULL OR b.id = p_brand_id)
    GROUP BY
      b.id
  )
  SELECT
    b.id,
    b.name,
    b.is_active,
    b.needs_review,
    b.created_at,
    b.updated_at,
    COALESCE(pc.product_count, 0) AS product_count,
    COALESCE(pc.our_products_count, 0) AS our_products_count,
    COALESCE(cc.competitor_count, 0) AS competitor_count
  FROM
    brands b
  LEFT JOIN
    product_counts pc ON b.id = pc.brand_id
  LEFT JOIN
    competitor_counts cc ON b.id = cc.brand_id
  WHERE
    b.user_id = p_user_id
    AND (p_brand_id IS NULL OR b.id = p_brand_id)
  ORDER BY
    b.name ASC;

--
-- Name: FUNCTION get_brand_analytics(p_user_id uuid, p_brand_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_brand_analytics(p_user_id uuid, p_brand_id uuid) IS 'Enhanced brand analytics function that includes our_products_count (products with our_price IS NOT NULL)';

--
-- Name: get_brands_for_competitor(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brands_for_competitor(p_user_id uuid, p_competitor_id uuid) RETURNS TABLE(brand_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.brand_id
  FROM
    price_changes pc
  JOIN
    products p ON pc.product_id = p.id
  WHERE
    pc.user_id = p_user_id
    AND pc.competitor_id = p_competitor_id
    AND p.brand_id IS NOT NULL;

--
-- Name: get_competitor_names_for_brand(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_competitor_names_for_brand(p_user_id uuid, p_brand_id uuid) RETURNS TABLE(competitor_names text[])
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ARRAY_AGG(DISTINCT c.name) AS competitor_names
  FROM
    price_changes pc
  JOIN
    products p ON pc.product_id = p.id
  JOIN
    competitors c ON pc.competitor_id = c.id
  WHERE
    p.user_id = p_user_id
    AND p.brand_id = p_brand_id
    AND c.user_id = p_user_id;

--
-- Name: get_competitor_statistics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_competitor_statistics(p_user_id uuid) RETURNS TABLE(competitor_id uuid, product_count bigint, brand_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH competitor_products AS (
    -- Get distinct product IDs for each competitor
    SELECT DISTINCT
      pc.competitor_id,
      pc.product_id
    FROM
      price_changes pc
    WHERE
      pc.user_id = p_user_id
  ),
  product_counts AS (
    -- Count products per competitor
    SELECT
      cp.competitor_id,
      COUNT(cp.product_id) AS product_count
    FROM
      competitor_products cp
    GROUP BY
      cp.competitor_id
  ),
  brand_counts AS (
    -- Count distinct brands per competitor
    SELECT
      cp.competitor_id,
      COUNT(DISTINCT p.brand_id) AS brand_count
    FROM
      competitor_products cp
    JOIN
      products p ON cp.product_id = p.id
    WHERE
      p.user_id = p_user_id
      AND p.brand_id IS NOT NULL
    GROUP BY
      cp.competitor_id
  )
  SELECT
    c.id AS competitor_id,
    COALESCE(pc.product_count, 0) AS product_count,
    COALESCE(bc.brand_count, 0) AS brand_count
  FROM
    competitors c
  LEFT JOIN
    product_counts pc ON c.id = pc.competitor_id
  LEFT JOIN
    brand_counts bc ON c.id = bc.competitor_id
  WHERE
    c.user_id = p_user_id;

--
-- Name: get_conversation_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_conversation_summary(user_uuid uuid) RETURNS TABLE(conversation_id uuid, subject text, status text, category text, priority text, created_at timestamp with time zone, updated_at timestamp with time zone, total_messages bigint, unread_messages bigint, last_message_content text, last_message_sender text, last_message_time timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id as conversation_id,
    sc.subject,
    sc.status,
    sc.category,
    sc.priority,
    sc.created_at,
    sc.updated_at,
    COUNT(sm.id) as total_messages,
    COUNT(CASE WHEN sm.sender_type = 'admin' AND sm.read_by_recipient = FALSE THEN 1 END) as unread_messages,
    (
      SELECT sm2.message_content 
      FROM support_messages sm2 
      WHERE sm2.conversation_id = sc.id 
      ORDER BY sm2.created_at DESC 
      LIMIT 1
    ) as last_message_content,
    (
      SELECT sm2.sender_type 
      FROM support_messages sm2 
      WHERE sm2.conversation_id = sc.id 
      ORDER BY sm2.created_at DESC 
      LIMIT 1
    ) as last_message_sender,
    (
      SELECT sm2.created_at 
      FROM support_messages sm2 
      WHERE sm2.conversation_id = sc.id 
      ORDER BY sm2.created_at DESC 
      LIMIT 1
    ) as last_message_time
  FROM support_conversations sc
  LEFT JOIN support_messages sm ON sc.id = sm.conversation_id
  WHERE sc.user_id = user_uuid
  GROUP BY sc.id, sc.subject, sc.status, sc.category, sc.priority, sc.created_at, sc.updated_at
  ORDER BY sc.updated_at DESC;

--
-- Name: get_cron_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cron_jobs() RETURNS TABLE(jobid bigint, schedule text, command text, nodename text, nodeport integer, database text, username text, active boolean, jobname text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Return cron jobs data
    RETURN QUERY
    SELECT 
        j.jobid,
        j.schedule,
        j.command,
        j.nodename,
        j.nodeport,
        j.database,
        j.username,
        j.active,
        j.jobname
    FROM cron.job j
    ORDER BY j.jobname;

--
-- Name: get_dismissed_product_duplicates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dismissed_product_duplicates(p_user_id uuid) RETURNS TABLE(id uuid, product_id_1 uuid, product_id_2 uuid, product_name_1 text, product_name_2 text, dismissal_key text, dismissed_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pdd.id,
        pdd.product_id_1,
        pdd.product_id_2,
        p1.name AS product_name_1,
        p2.name AS product_name_2,
        pdd.dismissal_key,
        pdd.dismissed_at
    FROM products_dismissed_duplicates pdd
    LEFT JOIN products p1 ON pdd.product_id_1 = p1.id
    LEFT JOIN products p2 ON pdd.product_id_2 = p2.id
    WHERE pdd.user_id = p_user_id
    ORDER BY pdd.dismissed_at DESC;

--
-- Name: FUNCTION get_dismissed_product_duplicates(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dismissed_product_duplicates(p_user_id uuid) IS 'Gets all dismissed product duplicates for a user';

--
-- Name: get_integration_run_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_integration_run_stats(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;

--
-- Name: get_latest_competitor_prices(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_competitor_prices(p_user_id uuid, p_product_id uuid) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_price numeric, new_price numeric, price_change_percentage numeric, currency_code text, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_platform text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$BEGIN
    -- First get competitor prices
    RETURN QUERY
    WITH LatestCompetitorPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'competitor'::TEXT AS source_type,
            c.name AS source_name,
            c.website AS source_website,
            NULL::TEXT AS source_platform,
            pc.competitor_id AS source_id,
            pc.url AS url, -- Use URL from price_changes table for competitor prices
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.competitor_id IS NOT NULL
    ),
    LatestIntegrationPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'integration'::TEXT AS source_type,
            i.name AS source_name,
            NULL::TEXT AS source_website,
            i.platform AS source_platform,
            pc.integration_id AS source_id,
            COALESCE(pc.url, p.url) AS url, -- Try price_changes URL first, then products URL
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        JOIN products p ON pc.product_id = p.id -- Join with products to get url
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.integration_id IS NOT NULL
    )
    (
        SELECT
            lcp.id AS id,
            lcp.product_id AS product_id,
            lcp.competitor_id AS competitor_id,
            lcp.integration_id AS integration_id,
            lcp.old_price AS old_price,
            lcp.new_price AS new_price,
            lcp.price_change_percentage AS price_change_percentage,
            lcp.currency_code AS currency_code,
            lcp.changed_at AS changed_at,
            lcp.source_type AS source_type,
            lcp.source_name AS source_name,
            lcp.source_website AS source_website,
            lcp.source_platform AS source_platform,
            lcp.source_id AS source_id,
            lcp.url AS url
        FROM LatestCompetitorPrices lcp
        WHERE lcp.rn = 1
    )
    UNION ALL
    (
        SELECT
            lip.id AS id,
            lip.product_id AS product_id,
            lip.competitor_id AS competitor_id,
            lip.integration_id AS integration_id,
            lip.old_price AS old_price,
            lip.new_price AS new_price,
            lip.price_change_percentage AS price_change_percentage,
            lip.currency_code AS currency_code,
            lip.changed_at AS changed_at,
            lip.source_type AS source_type,
            lip.source_name AS source_name,
            lip.source_website AS source_website,
            lip.source_platform AS source_platform,
            lip.source_id AS source_id,
            lip.url AS url
        FROM LatestIntegrationPrices lip
        WHERE lip.rn = 1
    )
    ORDER BY new_price ASC;

--
-- Name: get_latest_competitor_prices_batch(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_competitor_prices_batch(p_user_id uuid, p_product_ids uuid[]) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_price numeric, new_price numeric, price_change_percentage numeric, currency_code text, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_platform text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Get competitor and integration prices for multiple products at once
    RETURN QUERY
    WITH LatestCompetitorPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'competitor'::TEXT AS source_type,
            c.name AS source_name,
            c.website AS source_website,
            NULL::TEXT AS source_platform,
            pc.competitor_id AS source_id,
            pc.url AS url,
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = ANY(p_product_ids)
        AND pc.competitor_id IS NOT NULL
    ),
    LatestIntegrationPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'integration'::TEXT AS source_type,
            i.name AS source_name,
            NULL::TEXT AS source_website,
            i.platform AS source_platform,
            pc.integration_id AS source_id,
            COALESCE(pc.url, p.url) AS url,
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        JOIN products p ON pc.product_id = p.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = ANY(p_product_ids)
        AND pc.integration_id IS NOT NULL
    )
    (
        SELECT
            lcp.id AS id,
            lcp.product_id AS product_id,
            lcp.competitor_id AS competitor_id,
            lcp.integration_id AS integration_id,
            lcp.old_price AS old_price,
            lcp.new_price AS new_price,
            lcp.price_change_percentage AS price_change_percentage,
            lcp.currency_code AS currency_code,
            lcp.changed_at AS changed_at,
            lcp.source_type AS source_type,
            lcp.source_name AS source_name,
            lcp.source_website AS source_website,
            lcp.source_platform AS source_platform,
            lcp.source_id AS source_id,
            lcp.url AS url
        FROM LatestCompetitorPrices lcp
        WHERE lcp.rn = 1
    )
    UNION ALL
    (
        SELECT
            lip.id AS id,
            lip.product_id AS product_id,
            lip.competitor_id AS competitor_id,
            lip.integration_id AS integration_id,
            lip.old_price AS old_price,
            lip.new_price AS new_price,
            lip.price_change_percentage AS price_change_percentage,
            lip.currency_code AS currency_code,
            lip.changed_at AS changed_at,
            lip.source_type AS source_type,
            lip.source_name AS source_name,
            lip.source_website AS source_website,
            lip.source_platform AS source_platform,
            lip.source_id AS source_id,
            lip.url AS url
        FROM LatestIntegrationPrices lip
        WHERE lip.rn = 1
    )
    ORDER BY product_id, new_price ASC;

--
-- Name: get_or_create_unknown_brand(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_unknown_brand(user_id_param uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    brand_id_result UUID;

--
-- Name: get_or_create_user_settings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_user_settings(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_settings_id UUID;

--
-- Name: get_product_price_history(uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_product_price_history(p_user_id uuid, p_product_id uuid, p_source_id uuid, p_limit integer) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_price numeric, new_price numeric, price_change_percentage numeric, currency_code text, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_platform text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- First get competitor prices
    RETURN QUERY
    WITH CompetitorPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'competitor'::TEXT AS source_type,
            c.name AS source_name,
            c.website AS source_website,
            NULL::TEXT AS source_platform,
            pc.competitor_id AS source_id,
            pc.url AS url -- Use URL from price_changes table
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.competitor_id IS NOT NULL
        AND (p_source_id IS NULL OR pc.competitor_id = p_source_id)
    ),
    IntegrationPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'integration'::TEXT AS source_type,
            i.name AS source_name,
            NULL::TEXT AS source_website,
            i.platform AS source_platform,
            pc.integration_id AS source_id,
            COALESCE(pc.url, p.url) AS url -- Try price_changes URL first, then products URL
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        JOIN products p ON pc.product_id = p.id -- Join with products to get url
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.integration_id IS NOT NULL
        AND (p_source_id IS NULL OR pc.integration_id = p_source_id)
    )
    (
        SELECT
            cp.id AS id,
            cp.product_id AS product_id,
            cp.competitor_id AS competitor_id,
            cp.integration_id AS integration_id,
            cp.old_price AS old_price,
            cp.new_price AS new_price,
            cp.price_change_percentage AS price_change_percentage,
            cp.currency_code AS currency_code,
            cp.changed_at AS changed_at,
            cp.source_type AS source_type,
            cp.source_name AS source_name,
            cp.source_website AS source_website,
            cp.source_platform AS source_platform,
            cp.source_id AS source_id,
            cp.url AS url
        FROM CompetitorPrices cp
    )
    UNION ALL
    (
        SELECT
            ip.id AS id,
            ip.product_id AS product_id,
            ip.competitor_id AS competitor_id,
            ip.integration_id AS integration_id,
            ip.old_price AS old_price,
            ip.new_price AS new_price,
            ip.price_change_percentage AS price_change_percentage,
            ip.currency_code AS currency_code,
            ip.changed_at AS changed_at,
            ip.source_type AS source_type,
            ip.source_name AS source_name,
            ip.source_website AS source_website,
            ip.source_platform AS source_platform,
            ip.source_id AS source_id,
            ip.url AS url
        FROM IntegrationPrices ip
    )
    ORDER BY changed_at DESC
    LIMIT p_limit;

--
-- Name: get_products_filtered(uuid, integer, integer, text, text, text, text, text, boolean, uuid[], boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_ids uuid[] DEFAULT NULL::uuid[], p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _query text;

--
-- Name: get_products_filtered(uuid, integer, integer, text, text, text, text, text, boolean, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_id uuid DEFAULT NULL::uuid, p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _query text;

--
-- Name: get_products_filtered_with_user_check(uuid, integer, integer, text, text, text, text, text, boolean, uuid[], boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered_with_user_check(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_ids uuid[] DEFAULT NULL::uuid[], p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result json;

--
-- Name: get_products_filtered_with_user_check(uuid, integer, integer, text, text, text, text, text, boolean, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered_with_user_check(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_id uuid DEFAULT NULL::uuid, p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result json;

--
-- Name: get_scheduling_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_scheduling_stats() RETURNS TABLE(metric_name text, metric_value bigint, description text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'active_scrapers'::text,
        COUNT(*)::bigint,
        'Number of active scrapers'::text
    FROM public.scrapers 
    WHERE is_active = true
    
    UNION ALL
    
    SELECT 
        'active_integrations'::text,
        COUNT(*)::bigint,
        'Number of active integrations'::text
    FROM public.integrations 
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
        'pending_scraper_jobs'::text,
        COUNT(*)::bigint,
        'Number of pending scraper jobs'::text
    FROM public.scraper_runs 
    WHERE status = 'pending'
    
    UNION ALL
    
    SELECT 
        'running_scraper_jobs'::text,
        COUNT(*)::bigint,
        'Number of running scraper jobs'::text
    FROM public.scraper_runs 
    WHERE status = 'running'
    
    UNION ALL
    
    SELECT 
        'pending_integration_jobs'::text,
        COUNT(*)::bigint,
        'Number of pending integration jobs'::text
    FROM public.integration_runs 
    WHERE status = 'pending'
    
    UNION ALL
    
    SELECT 
        'processing_integration_jobs'::text,
        COUNT(*)::bigint,
        'Number of processing integration jobs'::text
    FROM public.integration_runs 
    WHERE status = 'processing'
    
    UNION ALL
    
    SELECT 
        'jobs_completed_today'::text,
        COUNT(*)::bigint,
        'Number of jobs completed today'::text
    FROM (
        SELECT completed_at FROM public.scraper_runs 
        WHERE status = 'completed' AND completed_at >= date_trunc('day', now())
        UNION ALL
        SELECT completed_at FROM public.integration_runs 
        WHERE status = 'completed' AND completed_at >= date_trunc('day', now())
    ) completed_jobs;

--
-- Name: get_unique_competitor_products(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unique_competitor_products(p_user_id uuid, p_competitor_id uuid) RETURNS integer
    LANGUAGE sql
    AS $$
  SELECT COUNT(DISTINCT pc1.product_id)
  FROM price_changes pc1
  WHERE pc1.user_id = p_user_id
    AND pc1.competitor_id = p_competitor_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_changes pc2
      WHERE pc2.user_id = p_user_id
        AND pc2.product_id = pc1.product_id
        AND (
          (pc2.competitor_id IS NOT NULL AND pc2.competitor_id != p_competitor_id)
          OR pc2.integration_id IS NOT NULL
        )
    );

--
-- Name: get_unique_integration_products(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unique_integration_products(p_user_id uuid, p_integration_id uuid) RETURNS integer
    LANGUAGE sql
    AS $$
  SELECT COUNT(DISTINCT pc1.product_id)
  FROM price_changes pc1
  WHERE pc1.user_id = p_user_id
    AND pc1.integration_id = p_integration_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_changes pc2
      WHERE pc2.user_id = p_user_id
        AND pc2.product_id = pc1.product_id
        AND (
          (pc2.integration_id IS NOT NULL AND pc2.integration_id != p_integration_id)
          OR pc2.competitor_id IS NOT NULL
        )
    );

--
-- Name: get_unread_message_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unread_message_count(user_uuid uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM support_messages sm
    JOIN support_conversations sc ON sm.conversation_id = sc.id
    WHERE sc.user_id = user_uuid
    AND sm.sender_type = 'admin'
    AND sm.read_by_recipient = FALSE
  );

--
-- Name: get_user_growth_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_growth_stats(period_days integer DEFAULT 30) RETURNS TABLE(date date, new_users bigint, cumulative_users bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '1 day' * period_days,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE as date
    ),
    daily_signups AS (
        SELECT 
            created_at::DATE as signup_date,
            COUNT(*) as new_users
        FROM public.user_profiles
        WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * period_days
        GROUP BY created_at::DATE
    )
    SELECT 
        ds.date,
        COALESCE(daily_signups.new_users, 0) as new_users,
        (SELECT COUNT(*) FROM public.user_profiles WHERE created_at::DATE <= ds.date) as cumulative_users
    FROM date_series ds
    LEFT JOIN daily_signups ON ds.date = daily_signups.signup_date
    ORDER BY ds.date;

--
-- Name: FUNCTION get_user_growth_stats(period_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_growth_stats(period_days integer) IS 'Returns user growth statistics over a specified period in days.';

--
-- Name: get_user_matching_settings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_matching_settings(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    settings JSONB;

--
-- Name: FUNCTION get_user_matching_settings(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_matching_settings(p_user_id uuid) IS 'Gets user matching settings with defaults';

--
-- Name: get_user_workload(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_workload() RETURNS TABLE(user_id uuid, user_name text, user_email text, active_scrapers bigint, active_integrations bigint, jobs_today bigint, avg_execution_time_ms numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        COALESCE(s.scraper_count, 0) as active_scrapers,
        COALESCE(i.integration_count, 0) as active_integrations,
        COALESCE(j.jobs_today, 0) as jobs_today,
        COALESCE(j.avg_execution_time, 0) as avg_execution_time_ms
    FROM public.user_profiles u
    LEFT JOIN (
        SELECT scrapers.user_id, COUNT(*) as scraper_count
        FROM public.scrapers
        WHERE is_active = true
        GROUP BY scrapers.user_id
    ) s ON u.id = s.user_id
    LEFT JOIN (
        SELECT integrations.user_id, COUNT(*) as integration_count
        FROM public.integrations
        WHERE status = 'active'
        GROUP BY integrations.user_id
    ) i ON u.id = i.user_id
    LEFT JOIN (
        SELECT
            scraper_runs.user_id,
            COUNT(*) as jobs_today,
            AVG(scraper_runs.execution_time_ms) as avg_execution_time  -- Fixed: changed from execution_time to execution_time_ms
        FROM public.scraper_runs
        WHERE scraper_runs.created_at >= CURRENT_DATE
        GROUP BY scraper_runs.user_id
    ) j ON u.id = j.user_id
    ORDER BY u.name;

--
-- Name: get_user_workload_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_workload_stats() RETURNS TABLE(user_id uuid, user_name text, user_email text, active_scrapers bigint, active_integrations bigint, jobs_today bigint, jobs_this_week bigint, jobs_this_month bigint, avg_execution_time_ms numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        COALESCE(s.scraper_count, 0) as active_scrapers,
        COALESCE(i.integration_count, 0) as active_integrations,
        COALESCE(j.jobs_today, 0) as jobs_today,
        COALESCE(j.jobs_this_week, 0) as jobs_this_week,
        COALESCE(j.jobs_this_month, 0) as jobs_this_month,
        COALESCE(j.avg_execution_time, 0) as avg_execution_time_ms
    FROM public.user_profiles u
    LEFT JOIN (
        SELECT scrapers.user_id, COUNT(*) as scraper_count
        FROM public.scrapers
        WHERE is_active = true
        GROUP BY scrapers.user_id
    ) s ON u.id = s.user_id
    LEFT JOIN (
        SELECT integrations.user_id, COUNT(*) as integration_count
        FROM public.integrations
        WHERE status = 'active'
        GROUP BY integrations.user_id
    ) i ON u.id = i.user_id
    LEFT JOIN (
        SELECT
            scraper_runs.user_id,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) as jobs_today,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())) as jobs_this_week,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) as jobs_this_month,
            AVG(execution_time_ms) as avg_execution_time
        FROM public.scraper_runs
        WHERE created_at >= date_trunc('month', now())
        GROUP BY scraper_runs.user_id
    ) j ON u.id = j.user_id
    ORDER BY u.id;

--
-- Name: FUNCTION get_user_workload_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_workload_stats() IS 'Returns user workload distribution with active scrapers, integrations, and job statistics including daily, weekly, and monthly counts. Removed is_approved column reference.';

--
-- Name: get_worker_capacity_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_worker_capacity_config() RETURNS TABLE(worker_type text, max_concurrent_jobs integer, current_jobs integer, description text)
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

--
-- Name: handle_worker_error(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_worker_error() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: FUNCTION handle_worker_error(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_worker_error() IS 'Handles worker timeouts by marking pending jobs as failed if they have been pending for too long and have not been claimed by a worker.';

--
-- Name: mark_conversation_messages_read(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversation_messages_read(conversation_uuid uuid, reader_type text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  updated_count INTEGER;

--
-- Name: merge_product_data(text, text, text, text, text, text, text, text, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_product_data(existing_name text, new_name text, existing_sku text, new_sku text, existing_ean text, new_ean text, existing_brand text, new_brand text, existing_brand_id uuid, new_brand_id uuid, existing_image_url text, new_image_url text, existing_url text, new_url text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN jsonb_build_object(
        'name', CASE 
            WHEN new_name IS NOT NULL AND LENGTH(TRIM(new_name)) > LENGTH(COALESCE(TRIM(existing_name), '')) 
            THEN new_name 
            ELSE COALESCE(existing_name, new_name) 
        END,
        'sku', COALESCE(existing_sku, new_sku), -- Keep existing SKU if present
        'ean', COALESCE(existing_ean, new_ean), -- Add EAN if missing
        'brand', COALESCE(existing_brand, new_brand), -- Keep existing brand if present
        'brand_id', COALESCE(existing_brand_id, new_brand_id), -- Keep existing brand_id if present
        'image_url', CASE 
            WHEN new_image_url IS NOT NULL AND LENGTH(TRIM(new_image_url)) > 0 
            THEN new_image_url 
            ELSE existing_image_url 
        END,
        'url', CASE 
            WHEN new_url IS NOT NULL AND LENGTH(TRIM(new_url)) > 0 
            THEN new_url 
            ELSE existing_url 
        END
    );

--
-- Name: FUNCTION merge_product_data(existing_name text, new_name text, existing_sku text, new_sku text, existing_ean text, new_ean text, existing_brand text, new_brand text, existing_brand_id uuid, new_brand_id uuid, existing_image_url text, new_image_url text, existing_url text, new_url text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.merge_product_data(existing_name text, new_name text, existing_sku text, new_sku text, existing_ean text, new_ean text, existing_brand text, new_brand text, existing_brand_id uuid, new_brand_id uuid, existing_image_url text, new_image_url text, existing_url text, new_url text) IS 'Intelligently merges product data preferring more complete information';

--
-- Name: merge_products_api(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_products_api(primary_id uuid, duplicate_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    primary_record RECORD;

--
-- Name: FUNCTION merge_products_api(primary_id uuid, duplicate_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.merge_products_api(primary_id uuid, duplicate_id uuid) IS 'Enhanced product merging with intelligent data selection and no temp table updates';

--
-- Name: normalize_sku(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_sku(sku text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Return NULL if input is NULL or empty
  IF sku IS NULL OR TRIM(sku) = '' THEN
    RETURN NULL;

--
-- Name: FUNCTION normalize_sku(sku text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_sku(sku text) IS 'Normalizes SKU by removing separators and converting to uppercase. Used for fuzzy SKU matching.';

--
-- Name: optimize_scraper_schedules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimize_scraper_schedules() RETURNS integer
    LANGUAGE plpgsql
    AS $$ DECLARE scraper_record record; update_count integer := 0; time_slot integer := 0; total_scrapers integer; minutes_per_slot integer; new_hour integer; new_minute integer; new_time text; updated_schedule jsonb; BEGIN SELECT COUNT(*) INTO total_scrapers FROM public.scrapers WHERE is_active = true; minutes_per_slot := GREATEST(5, (24 * 60) / GREATEST(total_scrapers, 1)); FOR scraper_record IN SELECT id, schedule, user_id FROM public.scrapers WHERE is_active = true ORDER BY user_id, id LOOP new_hour := (time_slot * minutes_per_slot) / 60; new_minute := (time_slot * minutes_per_slot) % 60; new_time := LPAD((new_hour % 24)::text, 2, '0') || ':' || LPAD(new_minute::text, 2, '0'); updated_schedule := jsonb_set( scraper_record.schedule, '{time}', to_jsonb(new_time) ); UPDATE public.scrapers SET schedule = updated_schedule, updated_at = now() WHERE id = scraper_record.id; update_count := update_count + 1; time_slot := time_slot + 1; END LOOP; INSERT INTO public.debug_logs (message, created_at) VALUES ('Optimized scraper schedules - updated_scrapers: ' || update_count || ', total_scrapers: ' || total_scrapers || ', minutes_per_slot: ' || minutes_per_slot, now()); RETURN update_count; END; $$;

--
-- Name: process_pending_integration_products(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_pending_integration_products(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;

--
-- Name: process_scraper_timeouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_scraper_timeouts() RETURNS integer
    LANGUAGE plpgsql
    AS $$ DECLARE timeout_count integer := 0; timeout_record record; BEGIN FOR timeout_record IN SELECT sr.id, sr.scraper_id, sr.started_at FROM public.scraper_runs sr WHERE sr.status = 'running' AND sr.started_at < now() - interval '2 hours' LOOP UPDATE public.scraper_runs SET status = 'failed', completed_at = now(), error_message = 'Job timed out after 2 hours' WHERE id = timeout_record.id; timeout_count := timeout_count + 1; INSERT INTO public.debug_logs (message, created_at) VALUES ('Scraper run timed out - run_id: ' || timeout_record.id || ', scraper_id: ' || timeout_record.scraper_id || ', started_at: ' || timeout_record.started_at, now()); END LOOP; RETURN timeout_count; END; $$;

--
-- Name: process_staged_integration_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_staged_integration_product() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    existing_product_id UUID;

--
-- Name: FUNCTION process_staged_integration_product(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.process_staged_integration_product() IS 'Enhanced integration processing with user settings support and intelligent data merging';

--
-- Name: record_price_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_price_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    last_price DECIMAL(10, 2);

--
-- Name: FUNCTION record_price_change(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_price_change() IS 'Enhanced competitor price processing with user settings support and fuzzy matching';

--
-- Name: retry_error_integration_products(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_error_integration_products(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;

--
-- Name: retry_fetch_failed_runs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_fetch_failed_runs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  retry_count INTEGER;

--
-- Name: FUNCTION retry_fetch_failed_runs(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.retry_fetch_failed_runs() IS 'Automatically retries runs that failed with "fetch failed" error, up to 3 times within an hour';

--
-- Name: set_product_brand_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_product_brand_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.brand_id IS NULL AND NEW.brand IS NOT NULL THEN
    SELECT id INTO NEW.brand_id FROM brands WHERE name = NEW.brand LIMIT 1;

--
-- Name: set_statement_timeout(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_statement_timeout(p_milliseconds integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  EXECUTE format('SET statement_timeout = %s', p_milliseconds);

--
-- Name: sync_brand_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_brand_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_brand_id UUID;

--
-- Name: sync_brand_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_brand_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If brand_id is set, update the brand column with the brand name
    IF NEW.brand_id IS NOT NULL THEN
        SELECT name INTO NEW.brand
        FROM brands
        WHERE id = NEW.brand_id;

--
-- Name: trim_progress_messages(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_progress_messages(p_run_id uuid, p_max_messages integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_messages text[];

--
-- Name: FUNCTION trim_progress_messages(p_run_id uuid, p_max_messages integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trim_progress_messages(p_run_id uuid, p_max_messages integer) IS 'Trims the progress_messages array to prevent database bloat';

--
-- Name: undismiss_product_duplicates(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.undismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    ordered_id_1 UUID;

--
-- Name: FUNCTION undismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.undismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) IS 'Undismisses product duplicates to allow them to appear in duplicate detection again';

--
-- Name: update_conversation_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE support_conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;

--
-- Name: update_integration_run_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_run_status(run_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;

--
-- Name: update_scheduling_config(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_scheduling_config(p_max_python_workers integer DEFAULT 1, p_max_typescript_workers integer DEFAULT 1, p_max_integration_workers integer DEFAULT 1, p_max_jobs_per_run integer DEFAULT 2) RETURNS text
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

--
-- Name: update_scraper_status_from_run(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_scraper_status_from_run() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- When a scraper run is completed or failed, update the scraper's status
  IF NEW.status IN ('completed', 'failed') THEN
    -- Comment out the debug logging
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Updating scraper status from run: ' || NEW.id ||
    --         ', Status: ' || NEW.status ||
    --         ', Execution time: ' || NEW.execution_time_ms ||
    --         ', Products per second: ' || NEW.products_per_second);

--
-- Name: FUNCTION update_scraper_status_from_run(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_scraper_status_from_run() IS 'Modified to remove debug logging to debug_logs table';

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
  v_order_by text;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();

--
-- Name: users create_nextauth_user_trigger; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER create_nextauth_user_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_for_nextauth();

--
-- Name: users create_profile_trigger; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER create_profile_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_user();

--
-- Name: scrapers one_active_scraper_per_competitor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER one_active_scraper_per_competitor BEFORE INSERT OR UPDATE ON public.scrapers FOR EACH ROW EXECUTE FUNCTION public.ensure_one_active_scraper_per_competitor();

--
-- Name: temp_competitors_scraped_data price_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER price_change_trigger AFTER INSERT ON public.temp_competitors_scraped_data FOR EACH ROW EXECUTE FUNCTION public.record_price_change();

--
-- Name: temp_integrations_scraped_data process_temp_integration_product_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER process_temp_integration_product_trigger BEFORE UPDATE ON public.temp_integrations_scraped_data FOR EACH ROW EXECUTE FUNCTION public.process_staged_integration_product();

--
-- Name: products set_product_brand_id_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_brand_id_trigger BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_product_brand_id();

--
-- Name: products sync_brand_id_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_brand_id_trigger BEFORE INSERT OR UPDATE OF brand ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_brand_id();

--
-- Name: products sync_brand_name_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_brand_name_trigger BEFORE INSERT OR UPDATE OF brand_id ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_brand_name();

--
-- Name: support_messages trigger_update_conversation_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_timestamp AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

--
-- Name: professional_scraper_requests update_professional_scraper_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_professional_scraper_requests_updated_at BEFORE UPDATE ON public.professional_scraper_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: scraper_runs update_scraper_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_scraper_status_trigger AFTER UPDATE ON public.scraper_runs FOR EACH ROW EXECUTE FUNCTION public.update_scraper_status_from_run();

--
-- Name: support_conversations update_support_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_support_conversations_updated_at BEFORE UPDATE ON public.support_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();

--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();

