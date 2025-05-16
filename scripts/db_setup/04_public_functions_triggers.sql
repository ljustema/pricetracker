-- =========================================================================
-- Functions and triggers
-- =========================================================================
-- Generated: 2025-05-16 15:00:54
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
    AS $$
BEGIN
    RAISE WARNING 'PgBouncer auth request: %', p_usename;

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

COMMENT ON FUNCTION public.claim_next_scraper_job(worker_type_filter text) IS 'Atomically claims the next pending scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';

--
-- Name: cleanup_scraped_products(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_scraped_products() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Remove all records in scraped_products that are older than 30 days
  DELETE FROM scraped_products
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
BEGIN
    -- Products with same EAN (non-null)
    RETURN QUERY
    SELECT 
        'ean_' || p.ean AS group_id,
        p.id AS product_id,
        p.name,
        p.sku,
        p.ean,
        p.brand,
        p.brand_id,
        'Same EAN: ' || p.ean AS match_reason
    FROM 
        products p
    WHERE 
        p.user_id = p_user_id AND 
        p.ean IS NOT NULL AND 
        p.ean != '' AND
        EXISTS (
            SELECT 1 FROM products p2 
            WHERE p2.ean = p.ean AND p2.user_id = p.user_id AND p2.id != p.id
        )
    
    UNION ALL
    
    -- Products with same brand_id and SKU (non-null)
    SELECT 
        'brand_sku_' || p.brand_id::text || '_' || p.sku AS group_id,
        p.id AS product_id,
        p.name,
        p.sku,
        p.ean,
        p.brand,
        p.brand_id,
        'Same brand+SKU: ' || COALESCE(p.brand, '') || ' + ' || p.sku AS match_reason
    FROM 
        products p
    WHERE 
        p.user_id = p_user_id AND 
        p.brand_id IS NOT NULL AND 
        p.sku IS NOT NULL AND 
        p.sku != '' AND
        EXISTS (
            SELECT 1 FROM products p2 
            WHERE p2.brand_id = p.brand_id AND p2.sku = p.sku 
            AND p2.user_id = p.user_id AND p2.id != p.id
        )
    
    ORDER BY group_id, product_id;

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

CREATE FUNCTION public.get_brand_analytics(p_user_id uuid, p_brand_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, is_active boolean, needs_review boolean, created_at timestamp with time zone, updated_at timestamp with time zone, product_count bigint, competitor_count bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH product_counts AS (
    SELECT
      b.id AS brand_id,
      COUNT(p.id) AS product_count
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
    AS $$
BEGIN
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
    ORDER BY changed_at DESC;

--
-- Name: get_or_create_company(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_company(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_company_id UUID;

--
-- Name: get_or_create_unknown_brand(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_unknown_brand(user_id_param uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    brand_id_result UUID;

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
-- Name: get_products_filtered(uuid, integer, integer, text, text, text, text, text, boolean, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_id uuid DEFAULT NULL::uuid, p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _query text;

--
-- Name: get_products_filtered_with_user_check(uuid, integer, integer, text, text, text, text, text, boolean, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered_with_user_check(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_id uuid DEFAULT NULL::uuid, p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result json;

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
-- Name: merge_products_api(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_products_api(primary_id uuid, duplicate_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    primary_record RECORD;

--
-- Name: process_pending_integration_products(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_pending_integration_products(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;

--
-- Name: process_staged_integration_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_staged_integration_product() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    existing_product_id UUID;

--
-- Name: FUNCTION process_staged_integration_product(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.process_staged_integration_product() IS 'Processes staged integration products and updates the products table.
Prices from integrations like Prestashop already include tax, so no tax adjustment is needed.';

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

COMMENT ON FUNCTION public.record_price_change() IS 'Processes scraped products to match them with existing products, creates new products when no match is found, and records price changes.';

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
-- Name: update_integration_run_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_run_status(run_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;

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
-- Name: secrets_encrypt_secret_secret(); Type: FUNCTION; Schema: vault; Owner: -
--

CREATE FUNCTION vault.secrets_encrypt_secret_secret() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
		BEGIN
		        new.secret = CASE WHEN new.secret IS NULL THEN NULL ELSE
			CASE WHEN new.key_id IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.secret, 'utf8'),
				pg_catalog.convert_to((new.id::text || new.description::text || new.created_at::text || new.updated_at::text)::text, 'utf8'),
				new.key_id::uuid,
				new.nonce
			  ),
				'base64') END END;

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
-- Name: scraped_products price_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER price_change_trigger AFTER INSERT ON public.scraped_products FOR EACH ROW EXECUTE FUNCTION public.record_price_change();

--
-- Name: staged_integration_products process_staged_integration_product_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER process_staged_integration_product_trigger BEFORE UPDATE ON public.staged_integration_products FOR EACH ROW EXECUTE FUNCTION public.process_staged_integration_product();

--
-- Name: scraper_runs retry_fetch_failed_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER retry_fetch_failed_trigger AFTER UPDATE ON public.scraper_runs FOR EACH ROW EXECUTE FUNCTION public.retry_fetch_failed_runs();

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
-- Name: scraper_runs trg_auto_trim_progress_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_trim_progress_messages BEFORE UPDATE ON public.scraper_runs FOR EACH ROW WHEN ((new.progress_messages IS NOT NULL)) EXECUTE FUNCTION public.auto_trim_progress_messages();

--
-- Name: scraper_runs update_scraper_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_scraper_status_trigger AFTER UPDATE ON public.scraper_runs FOR EACH ROW EXECUTE FUNCTION public.update_scraper_status_from_run();

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

