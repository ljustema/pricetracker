-- =========================================================================
-- Other database objects
-- =========================================================================
-- Generated: 2025-05-28 15:44:40
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 16.8

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;

--
-- Name: pgsodium; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgsodium;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;

--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);

alter default privileges in schema cron grant all on tables to postgres with grant option;

alter default privileges in schema cron grant all on functions to postgres with grant option;

alter default privileges in schema cron grant all on sequences to postgres with grant option;

alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;

alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;

alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

grant all privileges on all tables in schema cron to postgres with grant option;

END IF;

END;

$$;

BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;

$$;

-- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;

grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;

grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;

grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;

alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;

alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;

alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

-- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;

grant usage on schema graphql to postgres with grant option;

END IF;

END;

$_$;

END IF;

GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;

END IF;

END IF;

END;

$$;

END IF;

END LOOP;

END; $$;

BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';

END IF;

END LOOP;

END; $$;

BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );

ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );

END IF;

END;

$$;

END IF;

END;

$_$;

RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;

END;

$_$;

END;

$$;

END;

$$;

BEGIN
  -- If progress_messages has more than 200 entries, trim it to 100
  IF NEW.progress_messages IS NOT NULL THEN
    v_message_count := array_length(NEW.progress_messages, 1);

IF v_message_count IS NOT NULL AND v_message_count > 200 THEN
      NEW.progress_messages := NEW.progress_messages[(v_message_count - 100 + 1):v_message_count];

END IF;

END IF;

RETURN NEW;

END;

$$;

base_time timestamp with time zone;

BEGIN
    -- Use last_sync_at as base, or current time minus interval if never synced
    base_time := COALESCE(last_sync_at, now() - interval '1 day');

CASE sync_frequency
        WHEN 'daily' THEN
            -- Run once per day at 3 AM
            next_run := date_trunc('day', base_time) + interval '3 hours';

IF next_run <= base_time THEN
                next_run := next_run + interval '1 day';

END IF;

WHEN 'weekly' THEN
            -- Run once per week on Monday at 3 AM
            next_run := date_trunc('week', base_time) + interval '1 day' + interval '3 hours';

IF next_run <= base_time THEN
                next_run := next_run + interval '1 week';

END IF;

WHEN 'monthly' THEN
            -- Run once per month on the 1st at 3 AM
            next_run := date_trunc('month', base_time) + interval '1 month' + interval '3 hours';

ELSE
            -- Default to daily
            next_run := date_trunc('day', base_time) + interval '3 hours';

IF next_run <= base_time THEN
                next_run := next_run + interval '1 day';

END IF;

END CASE;

RETURN next_run;

END;

$$;

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

SET default_tablespace = '';

SET default_table_access_method = heap;

END IF;

$$;

$$;

BEGIN
    DELETE FROM public.debug_logs
    WHERE created_at < now() - interval '7 days';

GET DIAGNOSTICS deleted_count = ROW_COUNT;

RETURN deleted_count;

END;

$$;

END;

$$;

-- Keep only the most recent record for each product/competitor combination
  -- for records that are between 3 and 30 days old
  DELETE FROM scraped_products sp1
  WHERE scraped_at < NOW() - INTERVAL '3 days'
    AND scraped_at > NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1
      FROM scraped_products sp2
      WHERE sp2.product_id = sp1.product_id
        AND sp2.competitor_id = sp1.competitor_id
        AND sp2.scraped_at > sp1.scraped_at
    );

-- Remove products without product_id that are older than 1 day
  -- (these couldn't be matched and have insufficient data)
  DELETE FROM scraped_products
  WHERE product_id IS NULL
    AND scraped_at < NOW() - INTERVAL '1 day';

END;

$$;

$$;

EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;

END;

RETURN NEW;

END;

$$;

current_timestamp timestamp with time zone := now();

RETURN;

END IF;

EXIT;

END IF;

END IF;

END LOOP;

END;

$$;

RETURN NEW;

END;

$$;

-- The trigger create_profile_for_user will automatically create a profile
END;

$$;

current_time timestamp with time zone := now();

should_run_flag boolean;

BEGIN
    -- Process all active scrapers
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
    LOOP
        -- Check if scraper should run
        should_run_flag := (scraper_record.last_run IS NULL OR scraper_record.last_run < current_time - interval '23 hours');

END IF;

END LOOP;

END;

$$;

END IF;

RETURN NEW;

END;

$$;

EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail
  RAISE WARNING 'Error ensuring user exists: %', SQLERRM;

END;

$$;

BEGIN
  -- First try to find by exact brand name
  SELECT id INTO v_brand_id
  FROM brands
  WHERE user_id = p_user_id AND name = p_name;

-- If not found, try to find by alias
  IF v_brand_id IS NULL THEN
    SELECT brand_id INTO v_brand_id
    FROM brand_aliases
    WHERE user_id = p_user_id AND alias_name = p_name;

END IF;

RETURN v_brand_id;

END;

$$;

BEGIN
  -- First try to find by exact brand name
  SELECT id INTO v_brand_id
  FROM brands
  WHERE user_id = p_user_id AND name = p_name;

-- If not found, try to find by alias
  IF v_brand_id IS NULL THEN
    SELECT brand_id INTO v_brand_id
    FROM brand_aliases
    WHERE user_id = p_user_id AND alias_name = p_name;

END IF;

-- If still not found, create a new brand
  IF v_brand_id IS NULL THEN
    INSERT INTO brands (
      user_id,
      name,
      is_active,
      needs_review
    ) VALUES (
      p_user_id,
      p_name,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_brand_id;

END IF;

RETURN v_brand_id;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs, return empty result
        RETURN;

END;

$$;

BEGIN
    SELECT jsonb_build_object(
        'processed', COUNT(*) FILTER (WHERE status = 'processed'),
        'created', COUNT(*) FILTER (WHERE status = 'processed' AND product_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM price_changes pc WHERE pc.product_id = staged_integration_products.product_id AND pc.changed_at < staged_integration_products.processed_at
        )),
        'updated', COUNT(*) FILTER (WHERE status = 'processed' AND product_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM price_changes pc WHERE pc.product_id = staged_integration_products.product_id AND pc.changed_at < staged_integration_products.processed_at
        )),
        'errors', COUNT(*) FILTER (WHERE status = 'error'),
        'pending', COUNT(*) FILTER (WHERE status = 'pending')
    )
    INTO stats
    FROM staged_integration_products
    WHERE integration_run_id = run_id;

RETURN stats;

END;

$$;

END;$$;

BEGIN
  -- Check if the user already has a company
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE user_id = p_user_id
  LIMIT 1;

-- If not, create a new company
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      user_id,
      primary_currency,
      currency_format,
      matching_rules,
      price_thresholds
    ) VALUES (
      p_user_id,
      'SEK',
      '#,##0.00',
      '{"ean_priority": true, "sku_brand_fallback": true}'::jsonb,
      '{"significant_increase": 10.0, "significant_decrease": 5.0}'::jsonb
    )
    RETURNING id INTO v_company_id;

END IF;

RETURN v_company_id;

END;

$$;

BEGIN
    -- Try to find existing 'Unknown' brand
    SELECT id INTO brand_id_result
    FROM public.brands
    WHERE name = 'Unknown' AND user_id = user_id_param
    LIMIT 1;

-- If not found, create it
    IF brand_id_result IS NULL THEN
        INSERT INTO public.brands (name, user_id, needs_review, is_active)
        VALUES ('Unknown', user_id_param, TRUE, TRUE)
        RETURNING id INTO brand_id_result;

END IF;

RETURN brand_id_result;

END;

$$;

END;

$$;

_count_query text;

_offset integer;

_limit integer;

_sort_direction text;

_allowed_sort_columns text[] := ARRAY['name', 'sku', 'ean', 'brand', 'category', 'our_price', 'cost_price', 'created_at', 'updated_at'];

_safe_sort_by text;

_result json;

_total_count bigint;

BEGIN
    -- Calculate offset and limit
    _offset := (p_page - 1) * p_page_size;

_limit := p_page_size;

-- Validate sort_by parameter to prevent null field name error
    IF p_sort_by IS NULL OR p_sort_by = '' THEN
        _safe_sort_by := 'created_at';

ELSIF p_sort_by = ANY(_allowed_sort_columns) THEN
        _safe_sort_by := p_sort_by;

ELSE
        _safe_sort_by := 'created_at'; -- Default sort column
    END IF;

-- Validate and sanitize sort direction
    IF p_sort_order IS NULL OR p_sort_order = '' THEN
        _sort_direction := 'DESC';

ELSIF lower(p_sort_order) = 'asc' THEN
        _sort_direction := 'ASC';

ELSE
        _sort_direction := 'DESC';

END IF;

-- Base query construction for counting
    _count_query := format('
        WITH CompetitorPricesForFilter AS (
            SELECT
                pc.product_id,
                MIN(pc.new_price) as min_competitor_price
            FROM price_changes pc
            WHERE pc.user_id = %L 
            AND pc.competitor_id IS NOT NULL
            GROUP BY pc.product_id
        )
        SELECT count(DISTINCT p.id)
        FROM products p
        LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
        LEFT JOIN CompetitorPricesForFilter cpf ON p.id = cpf.product_id
        WHERE p.user_id = %L', p_user_id, p_user_id);

-- Apply filters dynamically to count query
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _count_query := _count_query || format(' AND p.brand_id = %L', p_brand);

END IF;

IF p_category IS NOT NULL AND p_category <> '' THEN
        _count_query := _count_query || format(' AND p.category = %L', p_category);

END IF;

IF p_search IS NOT NULL AND p_search <> '' THEN
        _count_query := _count_query || format(' AND (p.name ILIKE %L OR p.sku ILIKE %L OR p.ean ILIKE %L OR p.brand ILIKE %L OR p.category ILIKE %L)',
                               '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');

END IF;

IF p_is_active IS NOT NULL THEN
        _count_query := _count_query || format(' AND p.is_active = %L', p_is_active);

END IF;

IF p_has_price = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL';

END IF;

-- Add price comparison filters to count query
    IF p_price_lower_than_competitors = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price < cpf.min_competitor_price';

END IF;

IF p_price_higher_than_competitors = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price > cpf.min_competitor_price';

END IF;

-- Add competitor filter to count query (modified for array)
    IF p_competitor_ids IS NOT NULL AND array_length(p_competitor_ids, 1) > 0 THEN
        _count_query := _count_query || format('
            AND p.id IN (
                SELECT DISTINCT pc.product_id
                FROM price_changes pc
                WHERE pc.user_id = %L
                AND pc.competitor_id = ANY(%L)
            )', p_user_id, p_competitor_ids);

END IF;

-- Execute count query first
    EXECUTE _count_query INTO _total_count;

-- Base query construction for data fetching
    _query := format('
        WITH CompetitorPricesForFilter AS (
            SELECT
                pc.product_id,
                MIN(pc.new_price) as min_competitor_price
            FROM price_changes pc
            WHERE pc.user_id = %L 
            AND pc.competitor_id IS NOT NULL
            GROUP BY pc.product_id
        ),
        FilteredProductsBase AS ( -- Renamed to avoid conflict later
            SELECT p.id
            FROM products p
            LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
            LEFT JOIN CompetitorPricesForFilter cpf ON p.id = cpf.product_id
            WHERE p.user_id = %L', p_user_id, p_user_id);

-- Apply filters dynamically to data query (similar to count query)
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _query := _query || format(' AND p.brand_id = %L', p_brand);

END IF;

IF p_category IS NOT NULL AND p_category <> '' THEN
        _query := _query || format(' AND p.category = %L', p_category);

END IF;

IF p_search IS NOT NULL AND p_search <> '' THEN
        _query := _query || format(' AND (p.name ILIKE %L OR p.sku ILIKE %L OR p.ean ILIKE %L OR p.brand ILIKE %L OR p.category ILIKE %L)',
                               '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');

END IF;

IF p_is_active IS NOT NULL THEN
        _query := _query || format(' AND p.is_active = %L', p_is_active);

END IF;

IF p_has_price = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL';

END IF;

-- Add price comparison filters to data query
    IF p_price_lower_than_competitors = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price < cpf.min_competitor_price';

END IF;

IF p_price_higher_than_competitors = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price > cpf.min_competitor_price';

END IF;

-- Add competitor filter to data query (modified for array)
    IF p_competitor_ids IS NOT NULL AND array_length(p_competitor_ids, 1) > 0 THEN
        _query := _query || format('
            AND p.id IN (
                SELECT DISTINCT pc.product_id
                FROM price_changes pc
                WHERE pc.user_id = %L
                AND pc.competitor_id = ANY(%L)
            )', p_user_id, p_competitor_ids);

END IF;

-- Add grouping, sorting and pagination to the subquery selecting product IDs
    -- Add id as a secondary sort to ensure consistent ordering
    _query := _query || format('
            GROUP BY p.id -- Ensure unique product IDs before sorting/limiting
            ORDER BY p.%I %s, p.id ASC
            LIMIT %L OFFSET %L
        ),
        LatestCompetitorPrices AS (
            SELECT
                pc.product_id,
                pc.competitor_id as source_id,
                pc.new_price,
                ''competitor'' as source_type,
                c.name as source_name,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            JOIN competitors c ON pc.competitor_id = c.id
            WHERE pc.user_id = %L AND pc.competitor_id IS NOT NULL
        ),
        LatestIntegrationPrices AS (
            SELECT
                pc.product_id,
                pc.integration_id as source_id,
                pc.new_price,
                ''integration'' as source_type,
                i.name as source_name,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            JOIN integrations i ON pc.integration_id = i.id
            WHERE pc.user_id = %L AND pc.integration_id IS NOT NULL
        ),
        AllLatestPrices AS (
            SELECT product_id, source_id, new_price, source_type, source_name FROM LatestCompetitorPrices WHERE rn = 1
            UNION ALL
            SELECT product_id, source_id, new_price, source_type, source_name FROM LatestIntegrationPrices WHERE rn = 1
        ),
        AggregatedSourcePrices AS (
            SELECT
                product_id,
                jsonb_object_agg(
                    source_id::text,
                    jsonb_build_object(''price'', new_price, ''source_type'', source_type, ''source_name'', COALESCE(source_name, ''Unknown''))
                ) as source_prices
            FROM AllLatestPrices
            GROUP BY product_id
        ),
        AggregatedCompetitorPrices AS (
             SELECT
                product_id,
                jsonb_object_agg(source_id::text, new_price) as competitor_prices
            FROM AllLatestPrices
            GROUP BY product_id
        )
        -- Final SELECT joining products with aggregated prices
        SELECT
            p.*,
            COALESCE(asp.source_prices, ''{}''::jsonb) as source_prices,
            COALESCE(acp.competitor_prices, ''{}''::jsonb) as competitor_prices
        FROM products p
        JOIN FilteredProductsBase fp ON p.id = fp.id -- Join with the filtered product IDs
        LEFT JOIN AggregatedSourcePrices asp ON p.id = asp.product_id
        LEFT JOIN AggregatedCompetitorPrices acp ON p.id = acp.product_id
        ORDER BY p.%I %s, p.id ASC', -- Apply final sorting based on the main product table fields with id as secondary sort
        _safe_sort_by, _sort_direction, _limit, _offset, -- Parameters for LIMIT/OFFSET
        p_user_id, -- For LatestCompetitorPrices CTE
        p_user_id, -- For LatestIntegrationPrices CTE
        _safe_sort_by, _sort_direction -- Parameters for final ORDER BY
    );

-- Execute the main query and construct the JSON result
    EXECUTE format('SELECT json_build_object(%L, COALESCE(json_agg(q), %L::json), %L, %L) FROM (%s) q',
                   'data', '[]', 'totalCount', _total_count, _query)
    INTO _result;

RETURN _result;

END;

$$;

_count_query text;

_offset integer;

_limit integer;

_sort_direction text;

_allowed_sort_columns text[] := ARRAY['name', 'sku', 'ean', 'brand', 'category', 'our_price', 'cost_price', 'created_at', 'updated_at'];

_safe_sort_by text;

_result json;

_total_count bigint;

BEGIN
    -- Calculate offset and limit
    _offset := (p_page - 1) * p_page_size;

_limit := p_page_size;

-- Validate sort_by parameter to prevent null field name error
    IF p_sort_by IS NULL OR p_sort_by = '' THEN
        _safe_sort_by := 'created_at';

ELSIF p_sort_by = ANY(_allowed_sort_columns) THEN
        _safe_sort_by := p_sort_by;

ELSE
        _safe_sort_by := 'created_at'; -- Default sort column
    END IF;

-- Validate and sanitize sort direction
    IF p_sort_order IS NULL OR p_sort_order = '' THEN
        _sort_direction := 'DESC';

ELSIF lower(p_sort_order) = 'asc' THEN
        _sort_direction := 'ASC';

ELSE
        _sort_direction := 'DESC';

END IF;

-- Base query construction for counting
    _count_query := format('
        WITH CompetitorPricesForFilter AS (
            SELECT
                pc.product_id,
                MIN(pc.new_price) as min_competitor_price
            FROM price_changes pc
            WHERE pc.user_id = %L 
            AND pc.competitor_id IS NOT NULL
            GROUP BY pc.product_id
        )
        SELECT count(DISTINCT p.id)
        FROM products p
        LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
        LEFT JOIN CompetitorPricesForFilter cpf ON p.id = cpf.product_id
        WHERE p.user_id = %L', p_user_id, p_user_id);

-- Apply filters dynamically to count query
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _count_query := _count_query || format(' AND p.brand_id = %L', p_brand);

END IF;

IF p_category IS NOT NULL AND p_category <> '' THEN
        _count_query := _count_query || format(' AND p.category = %L', p_category);

END IF;

IF p_search IS NOT NULL AND p_search <> '' THEN
        _count_query := _count_query || format(' AND (p.name ILIKE %L OR p.sku ILIKE %L OR p.ean ILIKE %L OR p.brand ILIKE %L OR p.category ILIKE %L)',
                               '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');

END IF;

IF p_is_active IS NOT NULL THEN
        _count_query := _count_query || format(' AND p.is_active = %L', p_is_active);

END IF;

IF p_has_price = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL';

END IF;

-- Add price comparison filters to count query
    IF p_price_lower_than_competitors = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price < cpf.min_competitor_price';

END IF;

IF p_price_higher_than_competitors = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price > cpf.min_competitor_price';

END IF;

-- Add competitor filter to count query
    IF p_competitor_id IS NOT NULL THEN
        _count_query := _count_query || format('
            AND p.id IN (
                SELECT DISTINCT pc.product_id
                FROM price_changes pc
                WHERE pc.user_id = %L
                AND pc.competitor_id = %L
            )', p_user_id, p_competitor_id);

END IF;

-- Execute count query first
    EXECUTE _count_query INTO _total_count;

-- Base query construction for data fetching
    _query := format('
        WITH CompetitorPricesForFilter AS (
            SELECT
                pc.product_id,
                MIN(pc.new_price) as min_competitor_price
            FROM price_changes pc
            WHERE pc.user_id = %L 
            AND pc.competitor_id IS NOT NULL
            GROUP BY pc.product_id
        ),
        FilteredProductsBase AS ( -- Renamed to avoid conflict later
            SELECT p.id
            FROM products p
            LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
            LEFT JOIN CompetitorPricesForFilter cpf ON p.id = cpf.product_id
            WHERE p.user_id = %L', p_user_id, p_user_id);

-- Apply filters dynamically to data query (similar to count query)
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _query := _query || format(' AND p.brand_id = %L', p_brand);

END IF;

IF p_category IS NOT NULL AND p_category <> '' THEN
        _query := _query || format(' AND p.category = %L', p_category);

END IF;

IF p_search IS NOT NULL AND p_search <> '' THEN
        _query := _query || format(' AND (p.name ILIKE %L OR p.sku ILIKE %L OR p.ean ILIKE %L OR p.brand ILIKE %L OR p.category ILIKE %L)',
                               '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');

END IF;

IF p_is_active IS NOT NULL THEN
        _query := _query || format(' AND p.is_active = %L', p_is_active);

END IF;

IF p_has_price = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL';

END IF;

-- Add price comparison filters to data query
    IF p_price_lower_than_competitors = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price < cpf.min_competitor_price';

END IF;

IF p_price_higher_than_competitors = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL AND cpf.min_competitor_price IS NOT NULL AND p.our_price > cpf.min_competitor_price';

END IF;

-- Add competitor filter to data query
    IF p_competitor_id IS NOT NULL THEN
        _query := _query || format('
            AND p.id IN (
                SELECT DISTINCT pc.product_id
                FROM price_changes pc
                WHERE pc.user_id = %L
                AND pc.competitor_id = %L
            )', p_user_id, p_competitor_id);

END IF;

-- Add grouping, sorting and pagination to the subquery selecting product IDs
    -- Add id as a secondary sort to ensure consistent ordering
    _query := _query || format('
            GROUP BY p.id -- Ensure unique product IDs before sorting/limiting
            ORDER BY p.%I %s, p.id ASC
            LIMIT %L OFFSET %L
        ),
        LatestCompetitorPrices AS (
            SELECT
                pc.product_id,
                pc.competitor_id as source_id,
                pc.new_price,
                ''competitor'' as source_type,
                c.name as source_name,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            JOIN competitors c ON pc.competitor_id = c.id
            WHERE pc.user_id = %L AND pc.competitor_id IS NOT NULL
        ),
        LatestIntegrationPrices AS (
            SELECT
                pc.product_id,
                pc.integration_id as source_id,
                pc.new_price,
                ''integration'' as source_type,
                i.name as source_name,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            JOIN integrations i ON pc.integration_id = i.id
            WHERE pc.user_id = %L AND pc.integration_id IS NOT NULL
        ),
        AllLatestPrices AS (
            SELECT product_id, source_id, new_price, source_type, source_name FROM LatestCompetitorPrices WHERE rn = 1
            UNION ALL
            SELECT product_id, source_id, new_price, source_type, source_name FROM LatestIntegrationPrices WHERE rn = 1
        ),
        AggregatedSourcePrices AS (
            SELECT
                product_id,
                jsonb_object_agg(
                    source_id::text,
                    jsonb_build_object(''price'', new_price, ''source_type'', source_type, ''source_name'', COALESCE(source_name, ''Unknown''))
                ) as source_prices
            FROM AllLatestPrices
            GROUP BY product_id
        ),
        AggregatedCompetitorPrices AS (
             SELECT
                product_id,
                jsonb_object_agg(source_id::text, new_price) as competitor_prices
            FROM AllLatestPrices
            GROUP BY product_id
        )
        -- Final SELECT joining products with aggregated prices
        SELECT
            p.*,
            COALESCE(asp.source_prices, ''{}''::jsonb) as source_prices,
            COALESCE(acp.competitor_prices, ''{}''::jsonb) as competitor_prices
        FROM products p
        JOIN FilteredProductsBase fp ON p.id = fp.id -- Join with the filtered product IDs
        LEFT JOIN AggregatedSourcePrices asp ON p.id = asp.product_id
        LEFT JOIN AggregatedCompetitorPrices acp ON p.id = acp.product_id
        ORDER BY p.%I %s, p.id ASC', -- Apply final sorting based on the main product table fields with id as secondary sort
        _safe_sort_by, _sort_direction, _limit, _offset, -- Parameters for LIMIT/OFFSET
        p_user_id, -- For LatestCompetitorPrices CTE
        p_user_id, -- For LatestIntegrationPrices CTE
        _safe_sort_by, _sort_direction -- Parameters for final ORDER BY
    );

-- Execute the main query and construct the JSON result
    EXECUTE format('SELECT json_build_object(%L, COALESCE(json_agg(q), %L::json), %L, %L) FROM (%s) q',
                   'data', '[]', 'totalCount', _total_count, _query)
    INTO _result;

RETURN _result;

END;

$$;

BEGIN
  -- First ensure the user exists
  PERFORM ensure_user_exists_simple(p_user_id);

-- Then call the original function with all parameters
  SELECT get_products_filtered(
    p_user_id,
    p_page,
    p_page_size,
    p_sort_by,
    p_sort_order,
    p_brand,
    p_category,
    p_search,
    p_is_active,
    p_competitor_ids,
    p_has_price,
    p_price_lower_than_competitors,
    p_price_higher_than_competitors
  ) INTO v_result;

RETURN v_result;

END;

$$;

BEGIN
  -- First ensure the user exists
  PERFORM ensure_user_exists_simple(p_user_id);

-- Then call the original function with all parameters
  SELECT get_products_filtered(
    p_user_id,
    p_page,
    p_page_size,
    p_sort_by,
    p_sort_order,
    p_brand,
    p_category,
    p_search,
    p_is_active,
    p_competitor_id,
    p_has_price,
    p_price_lower_than_competitors,
    p_price_higher_than_competitors
  ) INTO v_result;

RETURN v_result;

END;

$$;

END;

$$;

$$;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

RETURN NULL;

END;

$$;

BEGIN
  -- Mark messages as read based on reader type
  IF reader_type = 'user' THEN
    -- User reading admin messages
    UPDATE support_messages 
    SET read_by_recipient = TRUE
    WHERE conversation_id = conversation_uuid
    AND sender_type = 'admin'
    AND read_by_recipient = FALSE;

GET DIAGNOSTICS updated_count = ROW_COUNT;

-- Update last read timestamp for user
    UPDATE support_conversations
    SET last_read_by_user = NOW()
    WHERE id = conversation_uuid;

ELSIF reader_type = 'admin' THEN
    -- Admin reading user messages
    UPDATE support_messages 
    SET read_by_recipient = TRUE
    WHERE conversation_id = conversation_uuid
    AND sender_type = 'user'
    AND read_by_recipient = FALSE;

GET DIAGNOSTICS updated_count = ROW_COUNT;

-- Update last read timestamp for admin
    UPDATE support_conversations
    SET last_read_by_admin = NOW()
    WHERE id = conversation_uuid;

ELSE
    updated_count := 0;

END IF;

RETURN updated_count;

END;

$$;

duplicate_record RECORD;

result JSONB;

price_changes_count INT := 0;

scraped_products_count INT := 0;

staged_products_count INT := 0;

remaining_refs BOOLEAN;

BEGIN
    -- Set a longer statement timeout for this operation
    SET LOCAL statement_timeout = '120000'; -- 2 minutes in milliseconds
    
    -- Get the primary and duplicate product records
    SELECT * INTO primary_record FROM products WHERE id = primary_id;

SELECT * INTO duplicate_record FROM products WHERE id = duplicate_id;

-- Check if both records exist
    IF primary_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Primary product not found',
            'primary_id', primary_id,
            'duplicate_id', duplicate_id
        );

END IF;

IF duplicate_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Duplicate product not found',
            'primary_id', primary_id,
            'duplicate_id', duplicate_id
        );

END IF;

-- Update the primary product with any missing information from the duplicate
    UPDATE products
    SET
        name = COALESCE(primary_record.name, duplicate_record.name),
        sku = COALESCE(primary_record.sku, duplicate_record.sku),
        ean = COALESCE(primary_record.ean, duplicate_record.ean),
        brand_id = COALESCE(primary_record.brand_id, duplicate_record.brand_id),
        brand = COALESCE(primary_record.brand, duplicate_record.brand),
        category = COALESCE(primary_record.category, duplicate_record.category),
        description = COALESCE(primary_record.description, duplicate_record.description),
        image_url = COALESCE(primary_record.image_url, duplicate_record.image_url),
        our_price = COALESCE(primary_record.our_price, duplicate_record.our_price),
        wholesale_price = COALESCE(primary_record.wholesale_price, duplicate_record.wholesale_price),
        currency_code = COALESCE(primary_record.currency_code, duplicate_record.currency_code),
        url = COALESCE(primary_record.url, duplicate_record.url),
        updated_at = NOW()
    WHERE id = primary_id;

-- Update references in price_changes table and count affected rows
    UPDATE price_changes
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

GET DIAGNOSTICS price_changes_count = ROW_COUNT;

-- Update references in scraped_products table and count affected rows
    UPDATE scraped_products
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

GET DIAGNOSTICS scraped_products_count = ROW_COUNT;

-- Update references in staged_integration_products table and count affected rows
    UPDATE staged_integration_products
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

GET DIAGNOSTICS staged_products_count = ROW_COUNT;

-- Check if there are any remaining references to the duplicate product
    SELECT EXISTS (
        SELECT 1 FROM staged_integration_products WHERE product_id = duplicate_id
        UNION ALL
        SELECT 1 FROM scraped_products WHERE product_id = duplicate_id
        UNION ALL
        SELECT 1 FROM price_changes WHERE product_id = duplicate_id
        LIMIT 1
    ) INTO remaining_refs;

IF remaining_refs THEN
        -- There are still references to the duplicate product
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cannot delete product: still referenced in other tables',
            'primary_id', primary_id,
            'duplicate_id', duplicate_id,
            'stats', jsonb_build_object(
                'price_changes_updated', price_changes_count,
                'scraped_products_updated', scraped_products_count,
                'staged_products_updated', staged_products_count
            )
        );

END IF;

-- Delete the duplicate product
    BEGIN
        DELETE FROM products WHERE id = duplicate_id;

-- Return success result with statistics
        result := jsonb_build_object(
            'success', true,
            'message', 'Products merged successfully',
            'primary_id', primary_id,
            'duplicate_id', duplicate_id,
            'stats', jsonb_build_object(
                'price_changes_updated', price_changes_count,
                'scraped_products_updated', scraped_products_count,
                'staged_products_updated', staged_products_count
            )
        );

EXCEPTION WHEN OTHERS THEN
        -- Return detailed error information
        result := jsonb_build_object(
            'success', false,
            'message', 'Error deleting duplicate product: ' || SQLERRM,
            'detail', SQLSTATE,
            'primary_id', primary_id,
            'duplicate_id', duplicate_id,
            'stats', jsonb_build_object(
                'price_changes_updated', price_changes_count,
                'scraped_products_updated', scraped_products_count,
                'staged_products_updated', staged_products_count
            )
        );

END;

RETURN result;

EXCEPTION WHEN OTHERS THEN
    -- Return detailed error information
    result := jsonb_build_object(
        'success', false,
        'message', 'Error merging products: ' || SQLERRM,
        'detail', SQLSTATE,
        'primary_id', primary_id,
        'duplicate_id', duplicate_id
    );

RETURN result;

END;

$$;

BEGIN
    -- Force processing of any pending products by updating them in place
    UPDATE staged_integration_products
    SET status = status  -- This is a no-op update that will trigger the AFTER UPDATE trigger
    WHERE integration_run_id = run_id AND status = 'pending';

-- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

-- Update the run status
    PERFORM update_integration_run_status(run_id);

RETURN stats;

END;

$$;

old_price DECIMAL(10, 2);

new_price DECIMAL(10, 2);

v_brand_id UUID;

BEGIN
    -- Only process products with 'pending' status
    IF NEW.status != 'pending' THEN
        RETURN NEW;

END IF;

BEGIN
        -- Use the price directly from the integration without adding tax
        -- Prices from integrations (like Prestashop) already include tax
        IF NEW.price IS NOT NULL THEN
            new_price := NEW.price; -- Use price directly, no tax adjustment needed
        ELSE
            new_price := NULL;

END IF;

-- Try to find the brand ID
        IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
            -- Look for an exact match first
            SELECT id INTO v_brand_id
            FROM brands
            WHERE user_id = NEW.user_id
              AND LOWER(name) = LOWER(NEW.brand)
              AND is_active = TRUE
            LIMIT 1;

-- If no exact match, try to find a similar brand
            IF v_brand_id IS NULL THEN
                SELECT id INTO v_brand_id
                FROM brands
                WHERE user_id = NEW.user_id
                  AND is_active = TRUE
                  AND (
                    -- Try different similarity approaches
                    LOWER(name) LIKE LOWER('%' || NEW.brand || '%') OR
                    LOWER(NEW.brand) LIKE LOWER('%' || name || '%')
                  )
                ORDER BY
                    -- Prioritize shorter names that are more likely to be exact matches
                    LENGTH(name) ASC
                LIMIT 1;

END IF;

END IF;

-- Try to find an existing product by EAN or SKU+brand
        IF (NEW.ean IS NOT NULL AND NEW.ean != '') THEN
            -- Match by EAN (preferred)
            SELECT id, our_price INTO existing_product_id, old_price
            FROM products
            WHERE user_id = NEW.user_id
              AND ean = NEW.ean
            LIMIT 1;

ELSIF (NEW.sku IS NOT NULL AND NEW.sku != '' AND NEW.brand IS NOT NULL AND NEW.brand != '' AND v_brand_id IS NOT NULL) THEN
            -- Match by SKU + brand
            SELECT id, our_price INTO existing_product_id, old_price
            FROM products
            WHERE user_id = NEW.user_id
              AND sku = NEW.sku
              AND brand_id = v_brand_id
            LIMIT 1;

END IF;

-- If we found an existing product, update it
        IF existing_product_id IS NOT NULL THEN
            -- Update the product with all available data
            -- IMPORTANT: Always update all fields with the latest values from integration
            UPDATE products
            SET
                name = NEW.name,
                sku = NEW.sku,
                ean = NEW.ean,
                brand_id = v_brand_id,
                image_url = NEW.image_url,
                our_price = new_price, -- Use the price directly without adding tax
                wholesale_price = NEW.wholesale_price,
                currency_code = COALESCE(NEW.currency_code, 'SEK'),
                url = NEW.url,
                category = COALESCE(NEW.raw_data->>'category', category),
                description = COALESCE(NEW.raw_data->>'description', description),
                updated_at = NOW()
            WHERE id = existing_product_id;

-- Record price change if price has changed
            IF old_price IS DISTINCT FROM new_price AND new_price IS NOT NULL THEN
                INSERT INTO price_changes (
                    user_id,
                    product_id,
                    competitor_id,
                    old_price,
                    new_price,
                    price_change_percentage,
                    integration_id,
                    currency_code,
                    url
                )
                SELECT
                    NEW.user_id,
                    existing_product_id,
                    NULL,
                    old_price,
                    new_price,
                    CASE
                        WHEN old_price = 0 OR old_price IS NULL THEN 0
                        ELSE ((new_price - old_price) / old_price) * 100
                    END,
                    NEW.integration_id,
                    COALESCE(NEW.currency_code, 'SEK'),
                    NEW.url
                WHERE old_price IS NOT NULL OR new_price IS NOT NULL;

END IF;

-- Update the staged product
            NEW.product_id := existing_product_id;

NEW.status := 'processed';

NEW.processed_at := NOW();

ELSE
            -- Create a new product only if we have sufficient data
            -- This is a redundant check since we already validated above, but keeping it for safety
            IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
               (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL) THEN

                INSERT INTO products (
                    user_id,
                    name,
                    sku,
                    ean,
                    brand_id,
                    image_url,
                    our_price,
                    wholesale_price,
                    currency_code,
                    url,
                    category,
                    description
                )
                VALUES (
                    NEW.user_id,
                    NEW.name,
                    NEW.sku,
                    NEW.ean,
                    v_brand_id,
                    NEW.image_url,
                    new_price, -- Use the price directly without adding tax
                    NEW.wholesale_price,
                    COALESCE(NEW.currency_code, 'SEK'),
                    NEW.url,
                    COALESCE(NEW.raw_data->>'category', NULL),
                    COALESCE(NEW.raw_data->>'description', NULL)
                )
                RETURNING id INTO existing_product_id;

-- Update the staged product
                NEW.product_id := existing_product_id;

NEW.status := 'processed';

NEW.processed_at := NOW();

ELSE
                -- Product lacks sufficient data, mark as error
                NEW.status := 'error';

NEW.error_message := 'Product lacks sufficient data for matching. Requires either EAN or both SKU and brand.';

END IF;

END IF;

EXCEPTION WHEN OTHERS THEN
            -- Handle errors
            NEW.status := 'error';

NEW.error_message := SQLERRM;

END;

RETURN NEW;

END;

$$;

price_change_pct DECIMAL(10, 2);

matched_product_id UUID;

v_brand_id UUID;  -- Renamed from brand_id to v_brand_id to avoid ambiguity
  debug_info TEXT;

BEGIN
  -- Match product if not already matched
  IF NEW.product_id IS NULL THEN
    -- Try to match by EAN first
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
      SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND ean = NEW.ean LIMIT 1;

END IF;

-- If no match by EAN, try to match by brand and SKU
    IF matched_product_id IS NULL AND NEW.brand IS NOT NULL AND NEW.sku IS NOT NULL AND NEW.brand != '' AND NEW.sku != '' THEN
      -- Use find_or_create_brand function to get or create the brand
      SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;

-- If brand found, try to match by brand_id and SKU
      IF v_brand_id IS NOT NULL THEN
        SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND brand_id = v_brand_id AND sku = NEW.sku LIMIT 1;

END IF;

-- If still no match, try by brand name and SKU
      IF matched_product_id IS NULL THEN
        SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND brand = NEW.brand AND sku = NEW.sku LIMIT 1;

END IF;

END IF;

-- If no match found, create a new product if we have sufficient data
    IF matched_product_id IS NULL THEN
      -- Check if we have sufficient data to create a product
      IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
         (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL) THEN

        -- Create a new product
        INSERT INTO products (
          user_id,
          name,
          sku,
          ean,
          brand,
          brand_id,
          image_url,
          url,
          currency_code
        ) VALUES (
          NEW.user_id,
          NEW.name,
          NEW.sku,
          NEW.ean,
          NEW.brand,
          v_brand_id,
          NEW.image_url,
          NEW.url,
          COALESCE(NEW.currency_code, 'SEK')
        )
        RETURNING id INTO matched_product_id;

-- Update the scraped_product with the new product_id
        NEW.product_id := matched_product_id;

ELSE
        -- Insufficient data to create a product
        RETURN NEW;

END IF;

ELSE
      -- Update the scraped_product with the matched product_id
      NEW.product_id := matched_product_id;

END IF;

END IF;

-- Get the latest price for this product from this competitor
  SELECT new_price INTO last_price
  FROM price_changes
  WHERE competitor_id = NEW.competitor_id
    AND product_id = NEW.product_id
  ORDER BY changed_at DESC
  LIMIT 1;

-- Only add a price change if:
  -- 1. This is the first time we see this product (last_price IS NULL), OR
  -- 2. The price has actually changed
  IF last_price IS NULL THEN
    -- First time for the product, record initial price
    INSERT INTO price_changes (
      user_id,
      product_id,
      competitor_id,
      old_price,
      new_price,
      price_change_percentage,
      changed_at,
      currency_code,
      url
    ) VALUES (
      NEW.user_id,
      NEW.product_id,
      NEW.competitor_id,
      NEW.price, -- Use current price as old price the first time
      NEW.price,
      0,  -- 0% change the first time
      NOW(),
      NEW.currency_code,
      NEW.url
    );

ELSE
    -- Calculate price change percentage
    IF last_price = 0 THEN
      price_change_pct := 0; -- Avoid division by zero
    ELSE
      price_change_pct := ((NEW.price - last_price) / last_price) * 100;

END IF;

-- Check if price has changed
    IF NEW.price != last_price THEN
      -- Only add price change entry if the price changed
      INSERT INTO price_changes (
        user_id,
        product_id,
        competitor_id,
        old_price,
        new_price,
        price_change_percentage,
        changed_at,
        currency_code,
        url
      ) VALUES (
        NEW.user_id,
        NEW.product_id,
        NEW.competitor_id,
        last_price,
        NEW.price,
        price_change_pct,
        NOW(),
        NEW.currency_code,
        NEW.url
      );

END IF;

END IF;

-- Leave products in scraped_products for now
  -- Daily cleanup will handle removing them
  RETURN NEW;

END;

$$;

BEGIN
    -- Reset error products to pending status
    UPDATE staged_integration_products
    SET
        status = 'pending',
        error_message = NULL
    WHERE integration_run_id = run_id AND status = 'error';

-- Force processing of these products
    UPDATE staged_integration_products
    SET status = status  -- This is a no-op update that will trigger the AFTER UPDATE trigger
    WHERE integration_run_id = run_id AND status = 'pending';

-- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

-- Update the run status
    PERFORM update_integration_run_status(run_id);

RETURN stats;

END;

$$;

BEGIN
  IF NEW.status = 'failed' AND NEW.error_message = 'fetch failed' THEN
    SELECT COUNT(*) INTO retry_count
    FROM scraper_runs
    WHERE scraper_id = NEW.scraper_id
      AND error_message = 'fetch failed'
      AND started_at > NOW() - INTERVAL '1 hour';

IF retry_count < 3 THEN
      INSERT INTO scraper_runs (
        scraper_id, user_id, status, started_at, is_test_run, scraper_type
      ) VALUES (
        NEW.scraper_id, NEW.user_id, 'pending', NOW(), NEW.is_test_run, NEW.scraper_type
      );

END IF;

END IF;

RETURN NEW;

END;

$$;

END IF;

RETURN NEW;

END;

$$;

BEGIN
    -- If brand column is updated but brand_id is not, update brand_id
    IF NEW.brand IS NOT NULL AND NEW.brand != '' AND 
       (NEW.brand_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.brand != OLD.brand)) THEN
        -- Find or create the brand
        SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;

NEW.brand_id := v_brand_id;

END IF;

RETURN NEW;

END;

$$;

END IF;

RETURN NEW;

END;

$$;

v_message_count integer;

BEGIN
  -- Get current messages
  SELECT progress_messages INTO v_current_messages
  FROM scraper_runs
  WHERE id = p_run_id;

-- If no messages or null, do nothing
  IF v_current_messages IS NULL OR array_length(v_current_messages, 1) IS NULL THEN
    RETURN;

END IF;

v_message_count := array_length(v_current_messages, 1);

-- If we have more messages than the max, trim the oldest ones
  IF v_message_count > p_max_messages THEN
    UPDATE scraper_runs
    SET progress_messages = v_current_messages[(v_message_count - p_max_messages + 1):v_message_count]
    WHERE id = p_run_id;

END IF;

END;

$$;

RETURN NEW;

END;

$$;

integration_record RECORD;

BEGIN
    -- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

-- Get the integration ID
    SELECT integration_id INTO integration_record
    FROM integration_runs
    WHERE id = run_id;

-- If there are no pending products, mark the run as completed
    IF (stats->>'pending')::INTEGER = 0 THEN
        UPDATE integration_runs
        SET
            status = 'completed',
            completed_at = NOW(),
            products_processed = (stats->>'processed')::INTEGER,
            products_created = (stats->>'created')::INTEGER,
            products_updated = (stats->>'updated')::INTEGER,
            error_message = CASE
                WHEN (stats->>'errors')::INTEGER > 0
                THEN format('Completed with %s errors', (stats->>'errors')::INTEGER)
                ELSE NULL
            END
        WHERE id = run_id;

-- Update the integration status
        UPDATE integrations
        SET
            status = 'active',
            last_sync_at = NOW(),
            last_sync_status = 'success'
        WHERE id = integration_record.integration_id;

END IF;

END;

$$;

END;

$$;

UPDATE scrapers
    SET
      status = CASE
        WHEN NEW.status = 'completed' THEN 'idle'
        WHEN NEW.status = 'failed' THEN 'error'
        ELSE status
      END,
      error_message = CASE
        WHEN NEW.status = 'failed' THEN NEW.error_message
        ELSE NULL
      END,
      last_run = NEW.completed_at,
      execution_time = COALESCE(
        NEW.execution_time_ms,
        EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000
      ),
      last_products_per_second = NEW.products_per_second,
      updated_at = NOW()
    WHERE id = NEW.scraper_id;

-- Comment out the debug logging
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Updated scraper: ' || NEW.scraper_id ||
    --         ' with execution_time: ' || COALESCE(
    --           NEW.execution_time_ms,
    --           EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000
    --         ) ||
    --         ', last_products_per_second: ' || NEW.products_per_second);

END IF;

RETURN NEW;

END;

$$;

RETURN NEW;

END;

$$;

RETURN NEW;

END;

$$;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;

claimed_role regrole;

claims jsonb;

subscription_id uuid;

subscription_has_access bool;

visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];

-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

-- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

-- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;

end if;

execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);

end if;

visible_to_subscription_ids = '{}';

for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;

else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

execute 'execute walrus_rls_stmt' into subscription_has_access;

if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;

end if;

end if;

end loop;

perform set_config('role', null, true);

return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

end if;

end loop;

perform set_config('role', null, true);

end;

$$;

BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';

END IF;

-- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);

PERFORM realtime.send (row_data, event_name, topic_name);

ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;

END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;

END;

$$;

begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;

return res;

end
    $$;

res boolean;

begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;

return res;

end;

$$;

$_$;

-- Attempt to insert the message
    INSERT INTO realtime.messages (payload, event, topic, private, extension)
    VALUES (payload, event, topic, private, 'broadcast');

EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      PERFORM pg_notify(
          'realtime:system',
          jsonb_build_object(
              'error', SQLERRM,
              'function', 'realtime.send',
              'event', event,
              'topic', topic,
              'private', private
          )::text
      );

END;

END;

$$;

filter realtime.user_defined_filter;

col_type regtype;

in_val jsonb;

begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;

end if;

-- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );

if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;

end if;

-- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);

if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';

end if;

else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);

end if;

end loop;

-- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

return new;

end;

$$;

$$;

-- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';

END
$$;

_filename text;

BEGIN
	select string_to_array(name, '/') into _parts;

select _parts[array_length(_parts,1)] into _filename;

-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));

END
$$;

BEGIN
	select string_to_array(name, '/') into _parts;

return _parts[array_length(_parts,1)];

END
$$;

BEGIN
	select string_to_array(name, '/') into _parts;

return _parts[1:array_length(_parts,1)-1];

END
$$;

END
$$;

END;

$_$;

END;

$_$;

END;

$$;

v_sort_order text;

begin
  case
    when sortcolumn = 'name' then
      v_order_by = 'name';

when sortcolumn = 'updated_at' then
      v_order_by = 'updated_at';

when sortcolumn = 'created_at' then
      v_order_by = 'created_at';

when sortcolumn = 'last_accessed_at' then
      v_order_by = 'last_accessed_at';

else
      v_order_by = 'name';

end case;

case
    when sortorder = 'asc' then
      v_sort_order = 'asc';

when sortorder = 'desc' then
      v_sort_order = 'desc';

else
      v_sort_order = 'asc';

end case;

v_order_by = v_order_by || ' ' || v_sort_order;

return query execute
    'with folders as (
       select path_tokens[$1] as folder
       from storage.objects
         where objects.name ilike $2 || $3 || ''%''
           and bucket_id = $4
           and array_length(objects.path_tokens, 1) <> $1
       group by folder
       order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;

end;

$_$;

RETURN NEW;

END;

$$;

RETURN new;

END;

$$;

--
-- Name: decrypted_secrets; Type: VIEW; Schema: vault; Owner: -
--

CREATE VIEW vault.decrypted_secrets AS
 SELECT secrets.id,
    secrets.name,
    secrets.description,
    secrets.secret,
        CASE
            WHEN (secrets.secret IS NULL) THEN NULL::text
            ELSE
            CASE
                WHEN (secrets.key_id IS NULL) THEN NULL::text
                ELSE convert_from(pgsodium.crypto_aead_det_decrypt(decode(secrets.secret, 'base64'::text), convert_to(((((secrets.id)::text || secrets.description) || (secrets.created_at)::text) || (secrets.updated_at)::text), 'utf8'::name), secrets.key_id, secrets.nonce), 'utf8'::name)
            END
        END AS decrypted_secret,
    secrets.key_id,
    secrets.nonce,
    secrets.created_at,
    secrets.updated_at
   FROM vault.secrets;

--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);

--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);

--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);

--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);

--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);

--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);

--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);

--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';

--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);

--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);

--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);

--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);

--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);

--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);

--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);

--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);

--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);

--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);

--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);

--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);

--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);

--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);

--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);

--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);

--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);

--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);

--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);

--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);

--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);

--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);

--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));

--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);

--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));

--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);

--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);

--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);

--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';

--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));

--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);

--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);

--
-- Name: idx_admin_communication_log_admin_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_communication_log_admin_user_id ON public.admin_communication_log USING btree (admin_user_id);

--
-- Name: idx_admin_communication_log_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_communication_log_sent_at ON public.admin_communication_log USING btree (sent_at);

--
-- Name: idx_admin_communication_log_target_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_communication_log_target_user_id ON public.admin_communication_log USING btree (target_user_id);

--
-- Name: idx_brand_aliases_alias_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_aliases_alias_name ON public.brand_aliases USING btree (alias_name);

--
-- Name: idx_brand_aliases_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_aliases_brand_id ON public.brand_aliases USING btree (brand_id);

--
-- Name: idx_brand_aliases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_aliases_user_id ON public.brand_aliases USING btree (user_id);

--
-- Name: idx_brands_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_is_active ON public.brands USING btree (is_active);

--
-- Name: idx_brands_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_name ON public.brands USING btree (name);

--
-- Name: idx_brands_needs_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_needs_review ON public.brands USING btree (needs_review);

--
-- Name: idx_brands_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_user_id ON public.brands USING btree (user_id);

--
-- Name: idx_dismissed_duplicates_brand_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dismissed_duplicates_brand_ids ON public.dismissed_duplicates USING btree (brand_id_1, brand_id_2);

--
-- Name: idx_dismissed_duplicates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dismissed_duplicates_user_id ON public.dismissed_duplicates USING btree (user_id);

--
-- Name: idx_integration_runs_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_runs_integration_id ON public.integration_runs USING btree (integration_id);

--
-- Name: idx_integration_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_runs_status ON public.integration_runs USING btree (status);

--
-- Name: idx_integration_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_runs_user_id ON public.integration_runs USING btree (user_id);

--
-- Name: idx_integrations_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrations_platform ON public.integrations USING btree (platform);

--
-- Name: idx_integrations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrations_status ON public.integrations USING btree (status);

--
-- Name: idx_integrations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integrations_user_id ON public.integrations USING btree (user_id);

--
-- Name: idx_marketing_contacts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_contacts_created_at ON public.marketing_contacts USING btree (created_at);

--
-- Name: idx_marketing_contacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_contacts_status ON public.marketing_contacts USING btree (status);

--
-- Name: idx_price_changes_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_competitor_id ON public.price_changes USING btree (competitor_id);

--
-- Name: idx_price_changes_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_integration_id ON public.price_changes USING btree (integration_id);

--
-- Name: idx_price_changes_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_product_id ON public.price_changes USING btree (product_id);

--
-- Name: idx_price_changes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id ON public.price_changes USING btree (user_id);

--
-- Name: INDEX idx_price_changes_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id IS 'Optimizes user-based price_changes queries';

--
-- Name: idx_price_changes_user_id_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_changed_at ON public.price_changes USING btree (user_id, changed_at DESC);

--
-- Name: INDEX idx_price_changes_user_id_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_changed_at IS 'Optimizes time-based price change queries';

--
-- Name: idx_price_changes_user_id_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_competitor_id ON public.price_changes USING btree (user_id, competitor_id) WHERE (competitor_id IS NOT NULL);

--
-- Name: INDEX idx_price_changes_user_id_competitor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_competitor_id IS 'Optimizes competitor-based price queries';

--
-- Name: idx_price_changes_user_id_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_integration_id ON public.price_changes USING btree (user_id, integration_id) WHERE (integration_id IS NOT NULL);

--
-- Name: INDEX idx_price_changes_user_id_integration_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_integration_id IS 'Optimizes integration-based price queries';

--
-- Name: idx_price_changes_user_id_percentage_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_percentage_changed_at ON public.price_changes USING btree (user_id, price_change_percentage, changed_at DESC);

--
-- Name: INDEX idx_price_changes_user_id_percentage_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_percentage_changed_at IS 'Optimizes dashboard price drop queries';

--
-- Name: idx_price_changes_user_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_product_id ON public.price_changes USING btree (user_id, product_id);

--
-- Name: INDEX idx_price_changes_user_id_product_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_product_id IS 'Optimizes get_brand_analytics function joins';

--
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand ON public.products USING btree (brand);

--
-- Name: idx_products_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand_id ON public.products USING btree (brand_id);

--
-- Name: idx_products_brand_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand_sku ON public.products USING btree (brand, sku);

--
-- Name: idx_products_ean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_ean ON public.products USING btree (ean);

--
-- Name: idx_products_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_user_id ON public.products USING btree (user_id);

--
-- Name: INDEX idx_products_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_products_user_id IS 'Optimizes user-based product queries';

--
-- Name: idx_products_user_id_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_user_id_brand_id ON public.products USING btree (user_id, brand_id);

--
-- Name: INDEX idx_products_user_id_brand_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_products_user_id_brand_id IS 'Optimizes product-brand joins in analytics';

--
-- Name: idx_professional_scraper_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_professional_scraper_requests_created_at ON public.professional_scraper_requests USING btree (created_at);

--
-- Name: idx_professional_scraper_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_professional_scraper_requests_status ON public.professional_scraper_requests USING btree (status);

--
-- Name: idx_professional_scraper_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_professional_scraper_requests_user_id ON public.professional_scraper_requests USING btree (user_id);

--
-- Name: idx_rate_limit_log_ip_endpoint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_log_ip_endpoint ON public.rate_limit_log USING btree (ip_address, endpoint);

--
-- Name: idx_rate_limit_log_window_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_log_window_start ON public.rate_limit_log USING btree (window_start);

--
-- Name: idx_scraped_products_brand_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraped_products_brand_sku ON public.scraped_products USING btree (brand, sku);

--
-- Name: idx_scraped_products_ean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraped_products_ean ON public.scraped_products USING btree (ean);

--
-- Name: idx_scraped_products_scraper_id_scraped_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraped_products_scraper_id_scraped_at ON public.scraped_products USING btree (scraper_id, scraped_at);

--
-- Name: idx_scraper_ai_sessions_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_ai_sessions_competitor_id ON public.scraper_ai_sessions USING btree (competitor_id);

--
-- Name: idx_scraper_ai_sessions_current_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_ai_sessions_current_phase ON public.scraper_ai_sessions USING btree (current_phase);

--
-- Name: idx_scraper_ai_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_ai_sessions_user_id ON public.scraper_ai_sessions USING btree (user_id);

--
-- Name: idx_scraper_runs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_runs_created_at ON public.scraper_runs USING btree (created_at);

--
-- Name: idx_scraper_runs_scraper_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_runs_scraper_id ON public.scraper_runs USING btree (scraper_id);

--
-- Name: idx_scraper_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_runs_started_at ON public.scraper_runs USING btree (started_at);

--
-- Name: idx_scraper_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_runs_status ON public.scraper_runs USING btree (status);

--
-- Name: idx_scraper_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_runs_user_id ON public.scraper_runs USING btree (user_id);

--
-- Name: idx_scrapers_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scrapers_competitor_id ON public.scrapers USING btree (competitor_id);

--
-- Name: idx_scrapers_execution_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scrapers_execution_time ON public.scrapers USING btree (execution_time);

--
-- Name: idx_scrapers_scraper_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scrapers_scraper_type ON public.scrapers USING btree (scraper_type);

--
-- Name: idx_staged_integration_products_ean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staged_integration_products_ean ON public.staged_integration_products USING btree (ean) WHERE (ean IS NOT NULL);

--
-- Name: idx_staged_integration_products_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staged_integration_products_integration_id ON public.staged_integration_products USING btree (integration_id);

--
-- Name: idx_staged_integration_products_integration_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staged_integration_products_integration_run_id ON public.staged_integration_products USING btree (integration_run_id);

--
-- Name: idx_staged_integration_products_sku_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staged_integration_products_sku_brand ON public.staged_integration_products USING btree (sku, brand) WHERE ((sku IS NOT NULL) AND (brand IS NOT NULL));

--
-- Name: idx_staged_integration_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staged_integration_products_status ON public.staged_integration_products USING btree (status);

--
-- Name: idx_support_conversations_admin_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_conversations_admin_user_id ON public.support_conversations USING btree (admin_user_id);

--
-- Name: idx_support_conversations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_conversations_created_at ON public.support_conversations USING btree (created_at);

--
-- Name: idx_support_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_conversations_status ON public.support_conversations USING btree (status);

--
-- Name: idx_support_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_conversations_user_id ON public.support_conversations USING btree (user_id);

--
-- Name: idx_support_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_conversation_created ON public.support_messages USING btree (conversation_id, created_at);

--
-- Name: idx_support_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_conversation_id ON public.support_messages USING btree (conversation_id);

--
-- Name: idx_support_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_created_at ON public.support_messages USING btree (created_at);

--
-- Name: idx_support_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_sender_id ON public.support_messages USING btree (sender_id);

--
-- Name: idx_support_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_unread ON public.support_messages USING btree (conversation_id, sender_type, read_by_recipient);

--
-- Name: idx_user_profiles_admin_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_admin_role ON public.user_profiles USING btree (admin_role) WHERE (admin_role IS NOT NULL);

--
-- Name: idx_user_profiles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_created_at ON public.user_profiles USING btree (created_at);

--
-- Name: idx_user_profiles_is_suspended; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_is_suspended ON public.user_profiles USING btree (is_suspended) WHERE (is_suspended = true);

--
-- Name: idx_user_profiles_subscription_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_subscription_tier ON public.user_profiles USING btree (subscription_tier);

--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);

--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);

--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);

--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);

--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);

--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");

--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');

--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();

--
-- PostgreSQL database dump complete
--;

