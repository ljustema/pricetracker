-- =========================================================================
-- Other database objects
-- =========================================================================
-- Generated: 2025-06-25 10:48:41
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.0

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET transaction_timeout = 0;

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

return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;

end;

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

timeout_count integer := 0;

BEGIN
    -- Find stalled integration runs (running for more than 1 hour without progress)
    FOR timeout_record IN
        SELECT ir.id, ir.integration_id, ir.started_at, ir.last_progress_update
        FROM public.integration_runs ir
        WHERE ir.status IN ('running', 'processing')
          AND (
            (ir.last_progress_update IS NOT NULL AND ir.last_progress_update < now() - interval '1 hour') OR
            (ir.last_progress_update IS NULL AND ir.started_at IS NOT NULL AND ir.started_at < now() - interval '1 hour')
          )
    LOOP
        -- Update the stalled run to failed status
        UPDATE public.integration_runs
        SET 
            status = 'failed',
            completed_at = now(),
            error_message = 'Integration run stalled - no progress update for over 1 hour (likely due to worker restart)'
        WHERE id = timeout_record.id;

-- Keep the integration status as active (don't set to error) so it can be rescheduled
        UPDATE public.integrations
        SET 
            last_sync_status = 'failed',
            last_sync_at = now(),
            updated_at = now()
            -- Note: NOT setting status = 'error', keeping it as 'active'
        WHERE id = timeout_record.integration_id;

timeout_count := timeout_count + 1;

-- Log the timeout
        INSERT INTO public.debug_logs (message, created_at)
        VALUES (
            'Integration run timed out - run_id: ' || timeout_record.id || 
            ', integration_id: ' || timeout_record.integration_id || 
            ', started_at: ' || timeout_record.started_at ||
            ', last_progress: ' || COALESCE(timeout_record.last_progress_update::text, 'NULL'),
            now()
        );

END LOOP;

RETURN timeout_count;

END;

$$;

-- Keep only the most recent record for each product/competitor combination
  -- for records that are between 3 and 30 days old
  DELETE FROM temp_competitors_scraped_data sp1
  WHERE scraped_at < NOW() - INTERVAL '3 days'
    AND scraped_at > NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1
      FROM temp_competitors_scraped_data sp2
      WHERE sp2.product_id = sp1.product_id
        AND sp2.competitor_id = sp1.competitor_id
        AND sp2.scraped_at > sp1.scraped_at
    );

-- Remove products without product_id that are older than 1 day
  -- (these couldn't be matched and have insufficient data)
  DELETE FROM temp_competitors_scraped_data
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

END IF;

END IF;

END LOOP;

END;

$$;

current_timestamp timestamp with time zone := now();

RETURN;

END IF;

EXIT;

END IF;

END IF;

END IF;

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

ordered_id_2 UUID;

dismissal_key TEXT;

BEGIN
    -- Ensure consistent ordering (smaller UUID first)
    IF p_product_id_1 < p_product_id_2 THEN
        ordered_id_1 := p_product_id_1;

ordered_id_2 := p_product_id_2;

ELSE
        ordered_id_1 := p_product_id_2;

ordered_id_2 := p_product_id_1;

END IF;

-- Create dismissal key
    dismissal_key := ordered_id_1::text || '_' || ordered_id_2::text;

-- Insert dismissal record (ignore if already exists)
    INSERT INTO products_dismissed_duplicates (
        user_id, product_id_1, product_id_2, dismissal_key
    ) VALUES (
        p_user_id, ordered_id_1, ordered_id_2, dismissal_key
    )
    ON CONFLICT (user_id, product_id_1, product_id_2) DO NOTHING;

RETURN jsonb_build_object(
        'success', true,
        'message', 'Product duplicate dismissed successfully',
        'product_id_1', ordered_id_1,
        'product_id_2', ordered_id_2,
        'dismissal_key', dismissal_key
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Error dismissing product duplicate: ' || SQLERRM,
        'product_id_1', p_product_id_1,
        'product_id_2', p_product_id_2
    );

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

similarity_threshold INTEGER;

BEGIN
    -- Get user matching settings
    settings := get_user_matching_settings(p_user_id);

similarity_threshold := COALESCE((settings->>'min_similarity_score')::INTEGER, 80);

-- 1. Products with same EAN (if EAN priority enabled)
    IF (settings->>'ean_priority')::BOOLEAN = true THEN
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
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_2 AND p3.ean = p.ean))
                  OR (pdd.product_id_2 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_1 AND p3.ean = p.ean)))
            );

END IF;

-- 2. Products with same brand+SKU (if SKU+brand fallback enabled)
    IF (settings->>'sku_brand_fallback')::BOOLEAN = true THEN
        RETURN QUERY
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
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_2 AND p3.brand_id = p.brand_id AND p3.sku = p.sku))
                  OR (pdd.product_id_2 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_1 AND p3.brand_id = p.brand_id AND p3.sku = p.sku)))
            );

-- 3. Products with same brand+normalized SKU (fuzzy SKU matching)
        RETURN QUERY
        SELECT 
            'fuzzy_sku_' || p.brand_id::text || '_' || normalize_sku(p.sku) AS group_id,
            p.id AS product_id,
            p.name,
            p.sku,
            p.ean,
            p.brand,
            p.brand_id,
            'Fuzzy brand+SKU: ' || COALESCE(p.brand, '') || ' + ' || p.sku || ' (normalized: ' || normalize_sku(p.sku) || ')' AS match_reason
        FROM 
            products p
        WHERE 
            p.user_id = p_user_id AND 
            p.brand_id IS NOT NULL AND 
            p.sku IS NOT NULL AND 
            p.sku != '' AND
            normalize_sku(p.sku) IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM products p2 
                WHERE p2.brand_id = p.brand_id 
                AND normalize_sku(p2.sku) = normalize_sku(p.sku)
                AND p2.sku != p.sku  -- Different original SKU but same normalized
                AND p2.user_id = p.user_id AND p2.id != p.id
            )
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id) OR (pdd.product_id_2 = p.id))
            );

END IF;

-- 4. Products with similar names (if fuzzy name matching enabled)
    IF (settings->>'fuzzy_name_matching')::BOOLEAN = true THEN
        RETURN QUERY
        SELECT 
            'fuzzy_name_' || p.id::text AS group_id,
            p.id AS product_id,
            p.name,
            p.sku,
            p.ean,
            p.brand,
            p.brand_id,
            'Similar name: ' || COALESCE(p.name, '') || ' (similarity: ' || 
            ROUND((100 - (levenshtein(LOWER(p.name), LOWER(p2.name)) * 100.0 / GREATEST(LENGTH(p.name), LENGTH(p2.name))))::numeric, 1) || '%)' AS match_reason
        FROM 
            products p
        JOIN products p2 ON p2.user_id = p.user_id AND p2.id != p.id
        WHERE 
            p.user_id = p_user_id AND 
            p.name IS NOT NULL AND p.name != '' AND
            p2.name IS NOT NULL AND p2.name != '' AND
            -- High similarity threshold for name matching
            (100 - (levenshtein(LOWER(p.name), LOWER(p2.name)) * 100.0 / GREATEST(LENGTH(p.name), LENGTH(p2.name)))) >= similarity_threshold
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id AND pdd.product_id_2 = p2.id)
                  OR (pdd.product_id_1 = p2.id AND pdd.product_id_2 = p.id))
            );

END IF;

RETURN;

END;

$$;

similarity_threshold INTEGER;

result_count INTEGER := 0;

BEGIN
    -- Get user matching settings
    settings := get_user_matching_settings(p_user_id);

similarity_threshold := COALESCE((settings->>'min_similarity_score')::INTEGER, 80);

-- 1. Products with same EAN (if EAN priority enabled)
    IF (settings->>'ean_priority')::BOOLEAN = true THEN
        FOR group_id, product_id, name, sku, ean, brand, brand_id, match_reason IN
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
                WHERE p2.ean = p.ean AND p2.user_id = p_user_id AND p2.id != p.id
            )
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_2 AND p3.ean = p.ean))
                  OR (pdd.product_id_2 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_1 AND p3.ean = p.ean)))
            )
        ORDER BY p.ean, p.id
        LOOP
            RETURN NEXT;

result_count := result_count + 1;

IF p_limit IS NOT NULL AND result_count >= p_limit THEN
                RETURN;

END IF;

END LOOP;

END IF;

-- 2. Products with same brand+SKU (if SKU+brand fallback enabled)
    IF (settings->>'sku_brand_fallback')::BOOLEAN = true AND (p_limit IS NULL OR result_count < p_limit) THEN
        FOR group_id, product_id, name, sku, ean, brand, brand_id, match_reason IN
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
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_2 AND p3.brand_id = p.brand_id AND p3.sku = p.sku))
                  OR (pdd.product_id_2 = p.id AND EXISTS (SELECT 1 FROM products p3 WHERE p3.id = pdd.product_id_1 AND p3.brand_id = p.brand_id AND p3.sku = p.sku)))
            )
        ORDER BY p.brand_id, p.sku, p.id
        LOOP
            RETURN NEXT;

result_count := result_count + 1;

IF p_limit IS NOT NULL AND result_count >= p_limit THEN
                RETURN;

END IF;

END LOOP;

-- 3. Products with same brand+normalized SKU (fuzzy SKU matching)
        FOR group_id, product_id, name, sku, ean, brand, brand_id, match_reason IN
        SELECT 
            'fuzzy_sku_' || p.brand_id::text || '_' || normalize_sku(p.sku) AS group_id,
            p.id AS product_id,
            p.name,
            p.sku,
            p.ean,
            p.brand,
            p.brand_id,
            'Fuzzy brand+SKU: ' || COALESCE(p.brand, '') || ' + ' || p.sku || ' (normalized: ' || normalize_sku(p.sku) || ')' AS match_reason
        FROM 
            products p
        WHERE 
            p.user_id = p_user_id AND 
            p.brand_id IS NOT NULL AND 
            p.sku IS NOT NULL AND 
            p.sku != '' AND
            normalize_sku(p.sku) IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM products p2 
                WHERE p2.brand_id = p.brand_id 
                AND normalize_sku(p2.sku) = normalize_sku(p.sku)
                AND p2.sku != p.sku  -- Different original SKU but same normalized
                AND p2.user_id = p_user_id AND p2.id != p.id
            )
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id) OR (pdd.product_id_2 = p.id))
            )
        ORDER BY p.brand_id, normalize_sku(p.sku), p.id
        LOOP
            RETURN NEXT;

result_count := result_count + 1;

IF p_limit IS NOT NULL AND result_count >= p_limit THEN
                RETURN;

END IF;

END LOOP;

END IF;

-- 4. Products with similar names (if fuzzy name matching enabled)
    IF (settings->>'fuzzy_name_matching')::BOOLEAN = true AND (p_limit IS NULL OR result_count < p_limit) THEN
        FOR group_id, product_id, name, sku, ean, brand, brand_id, match_reason IN
        SELECT 
            'fuzzy_name_' || p.id::text AS group_id,
            p.id AS product_id,
            p.name,
            p.sku,
            p.ean,
            p.brand,
            p.brand_id,
            'Similar name: ' || COALESCE(p.name, '') || ' (similarity: ' || 
            ROUND((100 - (levenshtein(LOWER(p.name), LOWER(p2.name)) * 100.0 / GREATEST(LENGTH(p.name), LENGTH(p2.name))))::numeric, 1) || '%)' AS match_reason
        FROM 
            products p
        JOIN products p2 ON p2.user_id = p.user_id AND p2.id != p.id
        WHERE 
            p.user_id = p_user_id AND 
            p.name IS NOT NULL AND p.name != '' AND
            p2.name IS NOT NULL AND p2.name != '' AND
            -- High similarity threshold for name matching
            (100 - (levenshtein(LOWER(p.name), LOWER(p2.name)) * 100.0 / GREATEST(LENGTH(p.name), LENGTH(p2.name)))) >= similarity_threshold
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id 
                AND ((pdd.product_id_1 = p.id AND pdd.product_id_2 = p2.id)
                  OR (pdd.product_id_1 = p2.id AND pdd.product_id_2 = p.id))
            )
        ORDER BY p.id, p2.id
        LOOP
            RETURN NEXT;

result_count := result_count + 1;

IF p_limit IS NOT NULL AND result_count >= p_limit THEN
                RETURN;

END IF;

END LOOP;

END IF;

RETURN;

END;

$$;

product_id UUID;

normalized_sku TEXT;

similarity_threshold INTEGER;

BEGIN
    -- Get user matching settings
    settings := get_user_matching_settings(p_user_id);

similarity_threshold := COALESCE((settings->>'min_similarity_score')::INTEGER, 80);

-- 1. EAN Priority (if enabled and valid EAN provided)
    IF (settings->>'ean_priority')::BOOLEAN = true AND p_ean IS NOT NULL AND p_ean != '' AND is_valid_ean(p_ean) THEN
        SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id AND ean = p_ean
        ORDER BY created_at ASC
        LIMIT 1;

IF product_id IS NOT NULL THEN
            RETURN product_id;

END IF;

END IF;

-- 2. SKU + Brand Priority (if enabled)
    IF (settings->>'sku_brand_priority')::BOOLEAN = true AND p_sku IS NOT NULL AND p_sku != '' AND p_brand IS NOT NULL AND p_brand != '' THEN
        -- Normalize SKU for fuzzy matching
        normalized_sku := normalize_sku_for_matching(p_sku);

SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id 
          AND normalize_sku_for_matching(sku) = normalized_sku
          AND (brand_id = p_brand_id OR LOWER(brand) = LOWER(p_brand))
        ORDER BY created_at ASC
        LIMIT 1;

IF product_id IS NOT NULL THEN
            RETURN product_id;

END IF;

END IF;

-- 3. Fallback: EAN matching (if not prioritized but valid EAN available)
    IF p_ean IS NOT NULL AND p_ean != '' AND is_valid_ean(p_ean) THEN
        SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id AND ean = p_ean
        ORDER BY created_at ASC
        LIMIT 1;

IF product_id IS NOT NULL THEN
            RETURN product_id;

END IF;

END IF;

-- 4. Fallback: SKU + Brand matching (if not prioritized)
    IF p_sku IS NOT NULL AND p_sku != '' AND p_brand IS NOT NULL AND p_brand != '' THEN
        -- Normalize SKU for fuzzy matching
        normalized_sku := normalize_sku_for_matching(p_sku);

SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id 
          AND normalize_sku_for_matching(sku) = normalized_sku
          AND (brand_id = p_brand_id OR LOWER(brand) = LOWER(p_brand))
        ORDER BY created_at ASC
        LIMIT 1;

IF product_id IS NOT NULL THEN
            RETURN product_id;

END IF;

END IF;

-- 5. Fuzzy name matching (if enabled and no other matches found)
    IF (settings->>'fuzzy_name_matching')::BOOLEAN = true AND p_name IS NOT NULL AND p_name != '' THEN
        SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id
          AND name IS NOT NULL AND name != ''
          AND (100 - (levenshtein(LOWER(name), LOWER(p_name)) * 100.0 / GREATEST(LENGTH(name), LENGTH(p_name)))) >= similarity_threshold
        ORDER BY 
            -- Prefer exact matches, then by similarity, then by creation date
            CASE WHEN LOWER(name) = LOWER(p_name) THEN 0 ELSE 1 END,
            levenshtein(LOWER(name), LOWER(p_name)),
            created_at ASC
        LIMIT 1;

IF product_id IS NOT NULL THEN
            RETURN product_id;

END IF;

END IF;

-- No match found
    RETURN NULL;

END;

$$;

END;

$$;

END;

$$;

END;

$$;

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    RETURN QUERY
    WITH brand_sales AS (
        SELECT 
            p.brand,
            COUNT(DISTINCT p.id) as products_tracked,
            SUM(ABS(sc.stock_change_quantity)) as total_sold,
            SUM(ABS(sc.stock_change_quantity) * COALESCE(pc.new_competitor_price, 0)) as total_revenue,
            AVG(ABS(sc.stock_change_quantity)) as avg_sales_per_product,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_days
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT new_competitor_price
            FROM price_changes_competitors pc2
            WHERE pc2.product_id = p.id 
              AND pc2.user_id = p_user_id
              AND pc2.changed_at <= sc.changed_at
              AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
            ORDER BY pc2.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        GROUP BY p.brand
    ),
    totals AS (
        SELECT SUM(total_revenue) as grand_total_revenue FROM brand_sales
    )
    SELECT 
        bs.brand,
        bs.products_tracked,
        bs.total_sold,
        bs.total_revenue,
        bs.avg_sales_per_product,
        bs.active_days,
        CASE 
            WHEN t.grand_total_revenue > 0 THEN (bs.total_revenue / t.grand_total_revenue * 100)
            ELSE 0 
        END as revenue_percentage,
        CASE 
            WHEN bs.active_days > 0 THEN (bs.total_sold::NUMERIC / bs.active_days)
            ELSE 0 
        END as avg_daily_sales,
        CASE 
            WHEN bs.active_days > 0 THEN (bs.total_revenue / bs.active_days)
            ELSE 0 
        END as avg_daily_revenue
    FROM brand_sales bs
    CROSS JOIN totals t
    ORDER BY bs.total_revenue DESC;

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

date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    SELECT json_build_object(
        'total_sales', (
            SELECT COALESCE(SUM(ABS(stock_change_quantity)), 0)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND stock_change_quantity < 0
              AND changed_at >= date_filter_start
              AND changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ),
        'total_revenue', (
            SELECT COALESCE(SUM(ABS(sc.stock_change_quantity) * pc.new_competitor_price), 0)
            FROM stock_changes_competitors sc
            JOIN price_changes_competitors pc ON pc.product_id = sc.product_id
            WHERE sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND sc.changed_at >= date_filter_start
              AND sc.changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
              AND pc.changed_at <= sc.changed_at
        ),
        'unique_products_sold', (
            SELECT COUNT(DISTINCT product_id)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND stock_change_quantity < 0
              AND changed_at >= date_filter_start
              AND changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ),
        'unique_brands_sold', (
            SELECT COUNT(DISTINCT p.brand)
            FROM stock_changes_competitors sc
            JOIN products p ON sc.product_id = p.id
            WHERE sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND sc.changed_at >= date_filter_start
              AND sc.changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        ),
        'total_inventory_value', (
            WITH current_stock AS (
                SELECT DISTINCT ON (product_id, competitor_id)
                    product_id, new_stock_quantity
                FROM stock_changes_competitors
                WHERE user_id = p_user_id 
                  AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
                ORDER BY product_id, competitor_id, changed_at DESC
            )
            SELECT COALESCE(SUM(cs.new_stock_quantity * pc.new_competitor_price), 0)
            FROM current_stock cs
            JOIN LATERAL (
                SELECT new_competitor_price
                FROM price_changes_competitors pc2
                WHERE pc2.product_id = cs.product_id 
                  AND pc2.user_id = p_user_id
                  AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
                ORDER BY pc2.changed_at DESC
                LIMIT 1
            ) pc ON true
            WHERE cs.new_stock_quantity > 0
        ),
        'dead_stock_count', (
            SELECT COUNT(DISTINCT p.id)
            FROM products p
            LEFT JOIN stock_changes_competitors sc ON p.id = sc.product_id 
              AND sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
            WHERE p.user_id = p_user_id
              AND (sc.changed_at IS NULL OR sc.changed_at < NOW() - INTERVAL '30 days')
        ),
        'avg_daily_sales', (
            WITH daily_sales AS (
                SELECT DATE(changed_at) as sale_date, SUM(ABS(stock_change_quantity)) as daily_total
                FROM stock_changes_competitors
                WHERE user_id = p_user_id
                  AND stock_change_quantity < 0
                  AND changed_at >= date_filter_start
                  AND changed_at <= date_filter_end
                  AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
                GROUP BY DATE(changed_at)
            )
            SELECT COALESCE(AVG(daily_total), 0) FROM daily_sales
        )
    ) INTO result;

RETURN result;

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

END;

$$;

END;

$$;

processed_count INTEGER;

error_count INTEGER;

pending_count INTEGER;

price_changes_count INTEGER;

BEGIN
    -- Get counts from temp table
    SELECT 
        COUNT(*) FILTER (WHERE status = 'processed'),
        COUNT(*) FILTER (WHERE status = 'error'),
        COUNT(*) FILTER (WHERE status = 'pending')
    INTO processed_count, error_count, pending_count
    FROM temp_integrations_scraped_data
    WHERE integration_run_id = run_id;

-- Get count of price changes created for this integration run
    SELECT COUNT(*)
    INTO price_changes_count
    FROM price_changes_competitors pc
    JOIN integration_runs ir ON pc.integration_id = ir.integration_id
    WHERE ir.id = run_id
    AND pc.changed_at >= ir.started_at;

-- Build stats object
    SELECT jsonb_build_object(
        'processed', COALESCE(processed_count, 0),
        'created', COALESCE(price_changes_count, 0),
        'updated', 0, -- We'll count all as created for simplicity
        'errors', COALESCE(error_count, 0),
        'pending', COALESCE(pending_count, 0)
    ) INTO stats;

RETURN stats;

END;

$$;

END;

$$;

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

BEGIN
  -- Check if the user already has settings
  SELECT id INTO v_settings_id
  FROM public.user_settings
  WHERE user_id = p_user_id
  LIMIT 1;

-- If not, create new user settings
  IF v_settings_id IS NULL THEN
    INSERT INTO public.user_settings (
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
    RETURNING id INTO v_settings_id;

END IF;

RETURN v_settings_id;

END;

$$;

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    RETURN QUERY
    WITH price_ranges AS (
        SELECT 
            CASE 
                WHEN pc.new_competitor_price <= 500 THEN '1-500'
                WHEN pc.new_competitor_price <= 1000 THEN '501-1000'
                WHEN pc.new_competitor_price <= 1500 THEN '1001-1500'
                WHEN pc.new_competitor_price <= 2000 THEN '1501-2000'
                WHEN pc.new_competitor_price <= 3000 THEN '2001-3000'
                ELSE '3000+'
            END as price_range,
            CASE 
                WHEN pc.new_competitor_price <= 500 THEN 1
                WHEN pc.new_competitor_price <= 1000 THEN 2
                WHEN pc.new_competitor_price <= 1500 THEN 3
                WHEN pc.new_competitor_price <= 2000 THEN 4
                WHEN pc.new_competitor_price <= 3000 THEN 5
                ELSE 6
            END as range_order,
            pc.new_competitor_price,
            p.name,
            p.brand,
            ABS(sc.stock_change_quantity) as units_sold,
            ABS(sc.stock_change_quantity) * pc.new_competitor_price as revenue
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        JOIN price_changes_competitors pc ON pc.product_id = p.id
        WHERE sc.stock_change_quantity < 0 
          AND sc.user_id = p_user_id
          AND pc.user_id = p_user_id
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
          AND (p_competitor_id IS NULL OR pc.competitor_id = p_competitor_id)
          -- Match price change to stock change timing
          AND pc.changed_at <= sc.changed_at
          AND pc.changed_at = (
              SELECT MAX(pc2.changed_at)
              FROM price_changes_competitors pc2
              WHERE pc2.product_id = pc.product_id
                AND pc2.user_id = pc.user_id
                AND pc2.changed_at <= sc.changed_at
                AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
          )
    ),
    range_analysis AS (
        SELECT 
            price_range,
            range_order,
            COUNT(DISTINCT name) as unique_products,
            SUM(units_sold) as total_units_sold,
            SUM(revenue) as total_revenue,
            AVG(new_competitor_price) as avg_price_in_range
        FROM price_ranges
        GROUP BY price_range, range_order
    ),
    totals AS (
        SELECT SUM(total_revenue) as grand_total_revenue FROM range_analysis
    )
    SELECT 
        ra.price_range,
        ra.unique_products,
        ra.total_units_sold,
        ra.total_revenue,
        ra.avg_price_in_range,
        CASE 
            WHEN t.grand_total_revenue > 0 THEN (ra.total_revenue / t.grand_total_revenue * 100)
            ELSE 0 
        END as revenue_percentage,
        ra.range_order
    FROM range_analysis ra
    CROSS JOIN totals t
    ORDER BY ra.range_order;

END;

$$;

_limit integer;

_sort_direction text;

_total_count integer;

_result json;

_safe_sort_by text;

_products_data json;

BEGIN
    -- First ensure the user exists
    PERFORM ensure_user_exists_simple(p_user_id);

-- Calculate offset and limit
    _offset := (p_page - 1) * p_page_size;

_limit := p_page_size;

-- Validate and sanitize sort direction
    _sort_direction := CASE WHEN UPPER(p_sort_order) = 'ASC' THEN 'ASC' ELSE 'DESC' END;

-- Validate and sanitize sort column
    _safe_sort_by := CASE 
        WHEN p_sort_by IN ('name', 'created_at', 'updated_at', 'our_retail_price', 'our_wholesale_price', 'sku', 'ean') THEN p_sort_by
        ELSE 'created_at'
    END;

-- Get total count using a CTE approach
    WITH filtered_products AS (
        SELECT p.id
        FROM products p 
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.user_id = p_user_id
        AND (p_brand IS NULL OR p_brand = '' OR p.brand_id = p_brand::uuid)
        AND (p_category IS NULL OR p_category = '' OR p.category = p_category)
        AND (p_search IS NULL OR p_search = '' OR (
            p.name ILIKE '%' || p_search || '%' OR 
            p.sku ILIKE '%' || p_search || '%' OR 
            p.ean ILIKE '%' || p_search || '%'
        ))
        AND (p_is_active IS NULL OR p.is_active = p_is_active)
        AND (p_has_price IS NULL OR p_has_price = false OR p.our_retail_price IS NOT NULL)
        AND (p_competitor_ids IS NULL OR array_length(p_competitor_ids, 1) IS NULL OR p.id IN (
            SELECT DISTINCT product_id 
            FROM price_changes_competitors 
            WHERE user_id = p_user_id 
            AND competitor_id = ANY(p_competitor_ids)
        ))
        -- Add price comparison filters - only apply if the filter is true
        AND (
            (p_price_lower_than_competitors IS NULL OR p_price_lower_than_competitors = false) AND
            (p_price_higher_than_competitors IS NULL OR p_price_higher_than_competitors = false)
            OR
            (
                p_price_lower_than_competitors = true AND p.our_retail_price IS NOT NULL AND p.id IN (
                    SELECT DISTINCT pcc.product_id
                    FROM price_changes_competitors pcc
                    WHERE pcc.user_id = p_user_id
                    AND pcc.product_id = p.id
                    AND pcc.new_competitor_price IS NOT NULL
                    AND p.our_retail_price < pcc.new_competitor_price
                )
            )
            OR
            (
                p_price_higher_than_competitors = true AND p.our_retail_price IS NOT NULL AND p.id IN (
                    SELECT DISTINCT pcc.product_id
                    FROM price_changes_competitors pcc
                    WHERE pcc.user_id = p_user_id
                    AND pcc.product_id = p.id
                    AND pcc.new_competitor_price IS NOT NULL
                    AND p.our_retail_price > pcc.new_competitor_price
                )
            )
        )
    )
    SELECT COUNT(*) INTO _total_count FROM filtered_products;

-- Get the actual data with competitor prices
    WITH filtered_products AS (
        SELECT p.*, b.name as brand_name
        FROM products p 
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.user_id = p_user_id
        AND (p_brand IS NULL OR p_brand = '' OR p.brand_id = p_brand::uuid)
        AND (p_category IS NULL OR p_category = '' OR p.category = p_category)
        AND (p_search IS NULL OR p_search = '' OR (
            p.name ILIKE '%' || p_search || '%' OR 
            p.sku ILIKE '%' || p_search || '%' OR 
            p.ean ILIKE '%' || p_search || '%'
        ))
        AND (p_is_active IS NULL OR p.is_active = p_is_active)
        AND (p_has_price IS NULL OR p_has_price = false OR p.our_retail_price IS NOT NULL)
        AND (p_competitor_ids IS NULL OR array_length(p_competitor_ids, 1) IS NULL OR p.id IN (
            SELECT DISTINCT product_id 
            FROM price_changes_competitors 
            WHERE user_id = p_user_id 
            AND competitor_id = ANY(p_competitor_ids)
        ))
        -- Add price comparison filters (same logic as count query)
        AND (
            (p_price_lower_than_competitors IS NULL OR p_price_lower_than_competitors = false) AND
            (p_price_higher_than_competitors IS NULL OR p_price_higher_than_competitors = false)
            OR
            (
                p_price_lower_than_competitors = true AND p.our_retail_price IS NOT NULL AND p.id IN (
                    SELECT DISTINCT pcc.product_id
                    FROM price_changes_competitors pcc
                    WHERE pcc.user_id = p_user_id
                    AND pcc.product_id = p.id
                    AND pcc.new_competitor_price IS NOT NULL
                    AND p.our_retail_price < pcc.new_competitor_price
                )
            )
            OR
            (
                p_price_higher_than_competitors = true AND p.our_retail_price IS NOT NULL AND p.id IN (
                    SELECT DISTINCT pcc.product_id
                    FROM price_changes_competitors pcc
                    WHERE pcc.user_id = p_user_id
                    AND pcc.product_id = p.id
                    AND pcc.new_competitor_price IS NOT NULL
                    AND p.our_retail_price > pcc.new_competitor_price
                )
            )
        )
        ORDER BY 
            CASE WHEN _safe_sort_by = 'name' AND _sort_direction = 'ASC' THEN p.name END ASC,
            CASE WHEN _safe_sort_by = 'name' AND _sort_direction = 'DESC' THEN p.name END DESC,
            CASE WHEN _safe_sort_by = 'created_at' AND _sort_direction = 'ASC' THEN p.created_at END ASC,
            CASE WHEN _safe_sort_by = 'created_at' AND _sort_direction = 'DESC' THEN p.created_at END DESC,
            CASE WHEN _safe_sort_by = 'updated_at' AND _sort_direction = 'ASC' THEN p.updated_at END ASC,
            CASE WHEN _safe_sort_by = 'updated_at' AND _sort_direction = 'DESC' THEN p.updated_at END DESC,
            CASE WHEN _safe_sort_by = 'our_retail_price' AND _sort_direction = 'ASC' THEN p.our_retail_price END ASC,
            CASE WHEN _safe_sort_by = 'our_retail_price' AND _sort_direction = 'DESC' THEN p.our_retail_price END DESC,
            CASE WHEN _safe_sort_by = 'our_wholesale_price' AND _sort_direction = 'ASC' THEN p.our_wholesale_price END ASC,
            CASE WHEN _safe_sort_by = 'our_wholesale_price' AND _sort_direction = 'DESC' THEN p.our_wholesale_price END DESC,
            CASE WHEN _safe_sort_by = 'sku' AND _sort_direction = 'ASC' THEN p.sku END ASC,
            CASE WHEN _safe_sort_by = 'sku' AND _sort_direction = 'DESC' THEN p.sku END DESC,
            CASE WHEN _safe_sort_by = 'ean' AND _sort_direction = 'ASC' THEN p.ean END ASC,
            CASE WHEN _safe_sort_by = 'ean' AND _sort_direction = 'DESC' THEN p.ean END DESC,
            p.id ASC
        LIMIT _limit OFFSET _offset
    ),
    -- Get latest competitor prices
    latest_competitor_prices AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id,
            competitor_id,
            new_competitor_price,
            c.name as competitor_name
        FROM price_changes_competitors pcc
        JOIN competitors c ON pcc.competitor_id = c.id
        WHERE pcc.user_id = p_user_id
        AND pcc.competitor_id IS NOT NULL
        AND pcc.product_id IN (SELECT id FROM filtered_products)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    -- Get latest integration prices
    latest_integration_prices AS (
        SELECT DISTINCT ON (product_id, integration_id)
            product_id,
            integration_id,
            new_competitor_price,
            i.name as integration_name
        FROM price_changes_competitors pcc
        JOIN integrations i ON pcc.integration_id = i.id
        WHERE pcc.user_id = p_user_id
        AND pcc.integration_id IS NOT NULL
        AND pcc.product_id IN (SELECT id FROM filtered_products)
        ORDER BY product_id, integration_id, changed_at DESC
    )
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'id', fp.id,
                'user_id', fp.user_id,
                'name', fp.name,
                'sku', fp.sku,
                'ean', fp.ean,
                'brand', fp.brand,
                'brand_id', fp.brand_id,
                'brand_name', fp.brand_name,
                'category', fp.category,
                'description', fp.description,
                'image_url', fp.image_url,
                'our_retail_price', fp.our_retail_price,
                'our_wholesale_price', fp.our_wholesale_price,
                'is_active', fp.is_active,
                'created_at', fp.created_at,
                'updated_at', fp.updated_at,
                'currency_code', fp.currency_code,
                'url', fp.url,
                'competitor_prices', COALESCE(
                    (
                        SELECT json_object_agg(lcp.competitor_id::text, lcp.new_competitor_price)
                        FROM latest_competitor_prices lcp
                        WHERE lcp.product_id = fp.id
                    ),
                    '{}'
                ),
                'source_prices', COALESCE(
                    (
                        WITH combined_sources AS (
                            SELECT 
                                lcp.competitor_id as source_id,
                                lcp.new_competitor_price as price,
                                'competitor' as source_type,
                                lcp.competitor_name as source_name
                            FROM latest_competitor_prices lcp
                            WHERE lcp.product_id = fp.id
                            
                            UNION ALL
                            
                            SELECT 
                                lip.integration_id as source_id,
                                lip.new_competitor_price as price,
                                'integration' as source_type,
                                lip.integration_name as source_name
                            FROM latest_integration_prices lip
                            WHERE lip.product_id = fp.id
                        )
                        SELECT json_object_agg(
                            source_id::text,
                            json_build_object(
                                'price', price,
                                'source_type', source_type,
                                'source_name', source_name
                            )
                        )
                        FROM combined_sources
                    ),
                    '{}'
                )
            )
        ), 
        '[]'
    ) INTO _products_data 
    FROM filtered_products fp;

-- Construct the final result
    SELECT json_build_object(
        'data', _products_data,
        'totalCount', _total_count
    ) INTO _result;

RETURN _result;

END;

$$;

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    RETURN QUERY
    WITH sales_data AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            SUM(ABS(sc.stock_change_quantity)) as total_sold,
            AVG(pc.new_competitor_price) as avg_price,
            SUM(ABS(sc.stock_change_quantity) * COALESCE(pc.new_competitor_price, 0)) as total_revenue,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_days
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT new_competitor_price
            FROM price_changes_competitors pc2
            WHERE pc2.product_id = p.id 
              AND pc2.user_id = p_user_id
              AND pc2.changed_at <= sc.changed_at
              AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
            ORDER BY pc2.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0  -- Only sales (decreases)
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
          AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
        GROUP BY p.id, p.name, p.brand, p.sku
    ),
    totals AS (
        SELECT 
            SUM(total_revenue) as grand_total_revenue
        FROM sales_data
    )
    SELECT 
        sd.id,
        sd.name,
        sd.brand,
        sd.sku,
        sd.total_sold,
        sd.avg_price,
        sd.total_revenue,
        sd.active_days,
        CASE 
            WHEN t.grand_total_revenue > 0 THEN (sd.total_revenue / t.grand_total_revenue * 100)
            ELSE 0 
        END as revenue_percentage,
        CASE 
            WHEN sd.active_days > 0 THEN (sd.total_sold::NUMERIC / sd.active_days)
            ELSE 0 
        END as avg_daily_sales,
        CASE 
            WHEN sd.active_days > 0 THEN (sd.total_revenue / sd.active_days)
            ELSE 0 
        END as avg_daily_revenue
    FROM sales_data sd
    CROSS JOIN totals t
    ORDER BY sd.total_sold DESC;

END;

$$;

END;

$$;

BEGIN
    SELECT json_build_object(
        'total_products_tracked', (
            SELECT COUNT(DISTINCT product_id)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
        ),
        'total_competitors', (
            SELECT COUNT(DISTINCT competitor_id)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND competitor_id IS NOT NULL
        ),
        'products_in_stock', (
            SELECT COUNT(DISTINCT product_id)
            FROM stock_changes_competitors sc1
            WHERE user_id = p_user_id
              AND new_stock_quantity > 0
              AND id IN (
                  SELECT DISTINCT ON (product_id, competitor_id) id
                  FROM stock_changes_competitors sc2
                  WHERE sc2.user_id = p_user_id
                    AND sc2.product_id = sc1.product_id
                    AND sc2.competitor_id = sc1.competitor_id
                  ORDER BY product_id, competitor_id, changed_at DESC
              )
        ),
        'products_out_of_stock', (
            SELECT COUNT(DISTINCT product_id)
            FROM stock_changes_competitors sc1
            WHERE user_id = p_user_id
              AND new_stock_quantity = 0
              AND id IN (
                  SELECT DISTINCT ON (product_id, competitor_id) id
                  FROM stock_changes_competitors sc2
                  WHERE sc2.user_id = p_user_id
                    AND sc2.product_id = sc1.product_id
                    AND sc2.competitor_id = sc1.competitor_id
                  ORDER BY product_id, competitor_id, changed_at DESC
              )
        ),
        'total_stock_changes', (
            SELECT COUNT(*)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND changed_at >= NOW() - INTERVAL '30 days'
        ),
        'avg_daily_sales', (
            SELECT COALESCE(AVG(ABS(stock_change_quantity)), 0)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND stock_change_quantity < 0
              AND changed_at >= NOW() - INTERVAL '30 days'
        )
    ) INTO result;

RETURN result;

END;

$$;

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id, 
            competitor_id, 
            new_stock_quantity, 
            changed_at
        FROM stock_changes_competitors
        WHERE user_id = p_user_id 
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    sales_data AS (
        SELECT 
            product_id,
            SUM(ABS(sc.stock_change_quantity)) as total_sales,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_sales_days,
            MIN(sc.changed_at) as first_sale,
            MAX(sc.changed_at) as last_sale
        FROM stock_changes_competitors sc
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        GROUP BY product_id
    ),
    stock_history AS (
        SELECT 
            product_id,
            AVG(new_stock_quantity) as avg_stock_level
        FROM stock_changes_competitors
        WHERE user_id = p_user_id 
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
          AND changed_at >= date_filter_start
          AND changed_at <= date_filter_end
        GROUP BY product_id
    ),
    turnover_analysis AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            COALESCE(sd.total_sales, 0) as total_sales,
            COALESCE(sh.avg_stock_level, 0) as avg_stock_level,
            COALESCE(cs.new_stock_quantity, 0) as current_stock,
            -- Stock Turnover Ratio = Total Sales / Average Stock
            CASE 
                WHEN sh.avg_stock_level > 0 THEN sd.total_sales / sh.avg_stock_level 
                ELSE 0 
            END as stock_turnover_ratio,
            -- Dead Stock Indicator
            CASE 
                WHEN sd.last_sale < NOW() - INTERVAL '1 day' * p_dead_stock_days OR sd.last_sale IS NULL 
                THEN 'Dead Stock' 
                ELSE 'Active' 
            END as stock_status,
            COALESCE(EXTRACT(DAYS FROM (NOW() - sd.last_sale))::INTEGER, 999) as days_since_last_sale,
            -- Velocity categories
            CASE 
                WHEN COALESCE(sd.total_sales, 0) / NULLIF(sd.active_sales_days, 0) > 10 THEN 'Fast Mover'
                WHEN COALESCE(sd.total_sales, 0) / NULLIF(sd.active_sales_days, 0) > 3 THEN 'Medium Mover'
                ELSE 'Slow Mover'
            END as velocity_category,
            sd.last_sale
        FROM products p
        LEFT JOIN sales_data sd ON p.id = sd.product_id
        LEFT JOIN stock_history sh ON p.id = sh.product_id
        LEFT JOIN current_stock cs ON p.id = cs.product_id
        WHERE p.user_id = p_user_id
          AND (cs.product_id IS NOT NULL OR sd.product_id IS NOT NULL)
    )
    SELECT 
        ta.id,
        ta.name,
        ta.brand,
        ta.sku,
        ta.total_sales,
        ta.avg_stock_level,
        ta.current_stock,
        ta.stock_turnover_ratio,
        ta.stock_status,
        ta.days_since_last_sale,
        ta.velocity_category,
        ta.last_sale
    FROM turnover_analysis ta
    ORDER BY ta.stock_turnover_ratio DESC NULLS LAST;

END;

$$;

$$;

$$;

END;

$$;

END;

$$;

BEGIN
    SELECT matching_rules INTO settings
    FROM user_settings
    WHERE user_id = p_user_id;

-- Return default settings if none found
    RETURN COALESCE(settings, '{"ean_priority": true, "sku_brand_fallback": true, "fuzzy_name_matching": false, "min_similarity_score": 80}'::jsonb);

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

END IF;

-- Clean the EAN code by trimming whitespace
    ean_code := trim(ean_code);

-- Check if it contains only digits
    IF ean_code !~ '^[0-9]+$' THEN
        RETURN FALSE;

END IF;

-- Check length - valid EAN codes are 8, 10, 11, 12, or 13 digits
    -- EAN-8: 8 digits
    -- UPC-A: 12 digits  
    -- EAN-13: 13 digits
    -- Some systems also accept 10 and 11 digit codes
    IF length(ean_code) < 8 OR length(ean_code) > 13 THEN
        RETURN FALSE;

END IF;

-- Additional check: reject obviously invalid codes like single digits repeated
    -- Reject codes like "11111111" or "00000000" for 8-digit codes
    IF length(ean_code) = 8 AND ean_code ~ '^(.)\1{7}$' THEN
        RETURN FALSE;

END IF;

-- Reject codes like "111111111111" or "1111111111111" for 12-13 digit codes
    IF length(ean_code) >= 12 AND ean_code ~ '^(.)\1{11,12}$' THEN
        RETURN FALSE;

END IF;

RETURN TRUE;

END;

$_$;

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

target_integration_id UUID;

merged_competitors_count INTEGER := 0;

merged_suppliers_count INTEGER := 0;

updated_products_count INTEGER := 0;

result JSONB;

BEGIN
    -- Get integration IDs
    SELECT id INTO source_integration_id FROM integrations WHERE name = source_integration_name;

SELECT id INTO target_integration_id FROM integrations WHERE name = target_integration_name;

IF source_integration_id IS NULL THEN
        RAISE EXCEPTION 'Source integration not found: %', source_integration_name;

END IF;

IF target_integration_id IS NULL THEN
        RAISE EXCEPTION 'Target integration not found: %', target_integration_name;

END IF;

-- Update existing price_changes_competitors records from source to target integration
    UPDATE price_changes_competitors 
    SET integration_id = target_integration_id
    WHERE integration_id = source_integration_id;

GET DIAGNOSTICS merged_competitors_count = ROW_COUNT;

-- Update existing price_changes_suppliers records from source to target integration
    UPDATE price_changes_suppliers 
    SET integration_id = target_integration_id
    WHERE integration_id = source_integration_id;

GET DIAGNOSTICS merged_suppliers_count = ROW_COUNT;

-- Update products.our_retail_price to match the latest price from the merged records
    -- This ensures consistency between products table and price_changes_competitors table
    WITH latest_prices AS (
        SELECT 
            product_id,
            new_our_retail_price,
            ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY changed_at DESC) as rn
        FROM price_changes_competitors 
        WHERE integration_id = target_integration_id 
          AND new_our_retail_price IS NOT NULL
    )
    UPDATE products 
    SET our_retail_price = latest_prices.new_our_retail_price,
        updated_at = NOW()
    FROM latest_prices 
    WHERE products.id = latest_prices.product_id 
      AND latest_prices.rn = 1
      AND products.our_retail_price IS DISTINCT FROM latest_prices.new_our_retail_price;

GET DIAGNOSTICS updated_products_count = ROW_COUNT;

-- Return summary
    result := jsonb_build_object(
        'source_integration', source_integration_name,
        'target_integration', target_integration_name,
        'merged_competitor_price_changes', merged_competitors_count,
        'merged_supplier_price_changes', merged_suppliers_count,
        'updated_products', updated_products_count,
        'success', true
    );

RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );

END;

$$;

END;

$$;

duplicate_record RECORD;

result JSONB;

price_changes_count INT := 0;

supplier_changes_count INT := 0;

custom_fields_count INT := 0;

dismissed_duplicates_count INT := 0;

temp_data_count INT := 0;

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

-- Use intelligent data merging (prefer more complete data)
    UPDATE products
    SET
        name = CASE 
            WHEN duplicate_record.name IS NOT NULL AND LENGTH(TRIM(duplicate_record.name)) > LENGTH(COALESCE(TRIM(primary_record.name), '')) 
            THEN duplicate_record.name 
            ELSE COALESCE(primary_record.name, duplicate_record.name) 
        END,
        sku = COALESCE(primary_record.sku, duplicate_record.sku),
        ean = COALESCE(primary_record.ean, duplicate_record.ean),
        brand_id = COALESCE(primary_record.brand_id, duplicate_record.brand_id),
        brand = COALESCE(primary_record.brand, duplicate_record.brand),
        category = COALESCE(primary_record.category, duplicate_record.category),
        description = CASE 
            WHEN duplicate_record.description IS NOT NULL AND LENGTH(TRIM(duplicate_record.description)) > LENGTH(COALESCE(TRIM(primary_record.description), '')) 
            THEN duplicate_record.description 
            ELSE COALESCE(primary_record.description, duplicate_record.description) 
        END,
        image_url = CASE 
            WHEN duplicate_record.image_url IS NOT NULL AND LENGTH(TRIM(duplicate_record.image_url)) > 0 
            THEN duplicate_record.image_url 
            ELSE primary_record.image_url 
        END,
        our_retail_price = COALESCE(primary_record.our_retail_price, duplicate_record.our_retail_price),
        our_wholesale_price = COALESCE(primary_record.our_wholesale_price, duplicate_record.our_wholesale_price),
        currency_code = COALESCE(primary_record.currency_code, duplicate_record.currency_code),
        url = CASE 
            WHEN duplicate_record.url IS NOT NULL AND LENGTH(TRIM(duplicate_record.url)) > 0 
            THEN duplicate_record.url 
            ELSE primary_record.url 
        END,
        updated_at = NOW()
    WHERE id = primary_id;

-- Update references in price_changes_competitors table
    -- First, delete any duplicate price records that would be created by the merge
    DELETE FROM price_changes_competitors pc1
    WHERE pc1.product_id = duplicate_id
    AND EXISTS (
        SELECT 1 FROM price_changes_competitors pc2
        WHERE pc2.product_id = primary_id
        AND pc2.competitor_id = pc1.competitor_id
        AND pc2.new_competitor_price = pc1.new_competitor_price
        AND pc2.changed_at::date = pc1.changed_at::date
    );

-- Then update remaining records to point to primary product
    UPDATE price_changes_competitors
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

GET DIAGNOSTICS price_changes_count = ROW_COUNT;

-- Update references in price_changes_suppliers table
    UPDATE price_changes_suppliers
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

GET DIAGNOSTICS supplier_changes_count = ROW_COUNT;

-- Update references in temp_competitors_scraped_data table
    UPDATE temp_competitors_scraped_data
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

GET DIAGNOSTICS temp_data_count = ROW_COUNT;

-- Handle products_dismissed_duplicates table
    -- Update both product_id_1 and product_id_2 references
    UPDATE products_dismissed_duplicates
    SET product_id_1 = primary_id
    WHERE product_id_1 = duplicate_id;

UPDATE products_dismissed_duplicates
    SET product_id_2 = primary_id
    WHERE product_id_2 = duplicate_id;

-- Remove any dismissed duplicate entries where both products are now the same
    DELETE FROM products_dismissed_duplicates
    WHERE product_id_1 = product_id_2;

GET DIAGNOSTICS dismissed_duplicates_count = ROW_COUNT;

-- Handle custom field values: merge duplicate's custom fields into primary
    -- For fields that exist in both products, keep the primary's values
    -- For fields that only exist in duplicate, move them to primary
    INSERT INTO product_custom_field_values (
        product_id, custom_field_id, value, source_type, source_id, 
        last_updated_by, confidence_score, created_by_source, created_at, updated_at
    )
    SELECT 
        primary_id, 
        pcfv.custom_field_id, 
        pcfv.value, 
        pcfv.source_type, 
        pcfv.source_id,
        pcfv.last_updated_by, 
        pcfv.confidence_score, 
        pcfv.created_by_source, 
        pcfv.created_at, 
        NOW()
    FROM product_custom_field_values pcfv
    WHERE pcfv.product_id = duplicate_id
    AND NOT EXISTS (
        -- Only insert if primary doesn't already have this custom field
        SELECT 1 FROM product_custom_field_values existing
        WHERE existing.product_id = primary_id 
        AND existing.custom_field_id = pcfv.custom_field_id
    )
    ON CONFLICT (product_id, custom_field_id) DO NOTHING;

GET DIAGNOSTICS custom_fields_count = ROW_COUNT;

-- Delete custom field values for the duplicate product
    DELETE FROM product_custom_field_values WHERE product_id = duplicate_id;

-- Check if there are any remaining references to the duplicate product
    SELECT EXISTS (
        SELECT 1 FROM price_changes_competitors WHERE product_id = duplicate_id
        UNION ALL
        SELECT 1 FROM price_changes_suppliers WHERE product_id = duplicate_id
        UNION ALL
        SELECT 1 FROM product_custom_field_values WHERE product_id = duplicate_id
        UNION ALL
        SELECT 1 FROM products_dismissed_duplicates WHERE product_id_1 = duplicate_id OR product_id_2 = duplicate_id
        UNION ALL
        SELECT 1 FROM temp_competitors_scraped_data WHERE product_id = duplicate_id
        LIMIT 1
    ) INTO remaining_refs;

IF remaining_refs THEN
        -- There are still references to the duplicate product
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cannot delete product: still has references in related tables',
            'primary_id', primary_id,
            'duplicate_id', duplicate_id,
            'stats', jsonb_build_object(
                'price_changes_updated', price_changes_count,
                'supplier_changes_updated', supplier_changes_count,
                'custom_fields_merged', custom_fields_count,
                'dismissed_duplicates_updated', dismissed_duplicates_count,
                'temp_data_updated', temp_data_count
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
                'supplier_changes_updated', supplier_changes_count,
                'custom_fields_merged', custom_fields_count,
                'dismissed_duplicates_updated', dismissed_duplicates_count,
                'temp_data_updated', temp_data_count
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
                'supplier_changes_updated', supplier_changes_count,
                'custom_fields_merged', custom_fields_count,
                'dismissed_duplicates_updated', dismissed_duplicates_count,
                'temp_data_updated', temp_data_count
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

END IF;

-- Remove common separators and normalize to uppercase
  RETURN REGEXP_REPLACE(UPPER(TRIM(sku)), '[^A-Z0-9]', '', 'g');

END;

$$;

field_value TEXT;

field_type TEXT;

v_custom_field_id UUID;

fields_processed INTEGER := 0;

fields_created INTEGER := 0;

standard_fields TEXT[] := ARRAY[
        'id', 'user_id', 'name', 'sku', 'ean', 'brand', 'brand_id', 'category',
        'description', 'image_url', 'url', 'price', 'our_retail_price', 'our_wholesale_price',
        'currency_code', 'currency', 'is_active', 'created_at', 'updated_at',
        'scraped_at', 'competitor_id', 'integration_id', 'scraper_id', 'status',
        'error_message', 'processed_at', 'product_id', 'prestashop_product_id',
        'raw_data', 'integration_run_id', 'competitor_price', 'raw_price', 'is_available',
        'stock_status'
    ];

BEGIN
    -- Return early if no raw_data
    IF p_raw_data IS NULL THEN
        RETURN jsonb_build_object('fields_processed', 0, 'fields_created', 0);

END IF;

-- Process each field in raw_data
    FOR field_key, field_value IN SELECT * FROM jsonb_each_text(p_raw_data)
    LOOP
        -- Skip if field is a standard field or empty
        IF field_key = ANY(standard_fields) OR field_value IS NULL OR field_value = '' THEN
            CONTINUE;

END IF;

-- Validate field name format
        IF NOT (field_key ~ '^[a-zA-Z][a-zA-Z0-9_]*$') THEN
            CONTINUE;

END IF;

-- Detect field type
        field_type := 'text'; -- Default
        IF field_value ~ '^[0-9]+\.?[0-9]*$' THEN
            field_type := 'number';

ELSIF field_value IN ('true', 'false') THEN
            field_type := 'boolean';

ELSIF field_value ~ '^https?://' THEN
            field_type := 'url';

ELSIF field_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
            field_type := 'date';

END IF;

-- Check if custom field already exists
        SELECT ucf.id INTO v_custom_field_id
        FROM user_custom_fields ucf
        WHERE ucf.user_id = p_user_id AND ucf.field_name = field_key;

-- Create custom field if it doesn't exist
        IF v_custom_field_id IS NULL THEN
            INSERT INTO user_custom_fields (
                user_id, field_name, field_type, is_required, default_value, validation_rules
            ) VALUES (
                p_user_id, field_key, field_type, false, NULL, NULL
            ) RETURNING id INTO v_custom_field_id;

fields_created := fields_created + 1;

END IF;

-- Delete existing value for this field and product (to avoid duplicates)
        DELETE FROM product_custom_field_values
        WHERE product_id = p_product_id AND custom_field_id = v_custom_field_id;

-- Insert new custom field value
        INSERT INTO product_custom_field_values (
            product_id, custom_field_id, value
        ) VALUES (
            p_product_id, v_custom_field_id, field_value
        );

fields_processed := fields_processed + 1;

END LOOP;

RETURN jsonb_build_object(
        'fields_processed', fields_processed,
        'fields_created', fields_created
    );

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the main process
    RAISE WARNING 'Error processing custom fields for product %: %', p_product_id, SQLERRM;

RETURN jsonb_build_object(
        'fields_processed', 0,
        'fields_created', 0,
        'error', SQLERRM
    );

END;

$_$;

field_value TEXT;

field_type TEXT;

normalized_field_key TEXT;

v_custom_field_id UUID;

fields_processed INTEGER := 0;

fields_created INTEGER := 0;

fields_skipped INTEGER := 0;

existing_source_type VARCHAR(20);

existing_confidence INTEGER;

user_update_strategy VARCHAR(20);

field_update_strategy VARCHAR(20);

source_priority_map JSONB;

current_priority INTEGER;

existing_priority INTEGER;

should_update BOOLEAN;

auto_create_enabled BOOLEAN;

standard_fields TEXT[] := ARRAY[
        'id', 'user_id', 'name', 'sku', 'ean', 'brand', 'brand_id', 'category',
        'description', 'image_url', 'url', 'price', 'our_retail_price', 'our_wholesale_price',
        'currency_code', 'currency', 'is_active', 'created_at', 'updated_at',
        'scraped_at', 'competitor_id', 'integration_id', 'scraper_id', 'status',
        'error_message', 'processed_at', 'product_id', 'prestashop_product_id',
        'raw_data', 'integration_run_id', 'competitor_price', 'raw_price', 'is_available',
        'stock_status'
    ];

BEGIN
    -- Return early if no raw_data
    IF p_raw_data IS NULL THEN
        RETURN jsonb_build_object('fields_processed', 0, 'fields_created', 0, 'fields_skipped', 0);

END IF;

-- Get user's global custom fields settings
    SELECT 
        COALESCE(custom_fields_update_strategy, 'source_priority'),
        COALESCE(custom_fields_source_priority, '{"manual": 100, "integration": 80, "supplier": 60, "competitor": 40}'),
        COALESCE(auto_create_custom_fields, true)
    INTO user_update_strategy, source_priority_map, auto_create_enabled
    FROM user_settings 
    WHERE user_id = p_user_id;

-- If no user settings found, use defaults
    IF user_update_strategy IS NULL THEN
        user_update_strategy := 'source_priority';

source_priority_map := '{"manual": 100, "integration": 80, "supplier": 60, "competitor": 40}';

auto_create_enabled := true;

END IF;

-- Get current source priority
    current_priority := COALESCE((source_priority_map->>p_source_type)::INTEGER, 0);

-- Process each field in raw_data
    FOR field_key, field_value IN SELECT * FROM jsonb_each_text(p_raw_data)
    LOOP
        -- Skip if field is a standard field or empty
        IF field_key = ANY(standard_fields) OR field_value IS NULL OR field_value = '' THEN
            CONTINUE;

END IF;

-- Normalize field name: capitalize first letter and trim whitespace
        normalized_field_key := TRIM(field_key);

IF LENGTH(normalized_field_key) > 0 THEN
            normalized_field_key := UPPER(LEFT(normalized_field_key, 1)) || SUBSTRING(normalized_field_key FROM 2);

END IF;

-- Updated field name validation to support Swedish characters (åäöÅÄÖ) and parentheses ()
        -- Allow letters (including Swedish), numbers, underscores, spaces, and parentheses
        -- Must start with a letter
        IF NOT (normalized_field_key ~ '^[a-zA-ZåäöÅÄÖ][a-zA-ZåäöÅÄÖ0-9_ ()]*$') THEN
            CONTINUE;

END IF;

-- Detect field type
        field_type := 'text'; -- Default
        IF field_value ~ '^[0-9]+\.?[0-9]*$' THEN
            field_type := 'number';

ELSIF field_value IN ('true', 'false') THEN
            field_type := 'boolean';

ELSIF field_value ~ '^https?://' THEN
            field_type := 'url';

ELSIF field_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
            field_type := 'date';

END IF;

-- Check if custom field already exists (using normalized field name)
        SELECT ucf.id, ucf.update_strategy INTO v_custom_field_id, field_update_strategy
        FROM user_custom_fields ucf
        WHERE ucf.user_id = p_user_id AND ucf.field_name = normalized_field_key;

-- Create custom field if it doesn't exist AND auto-create is enabled
        IF v_custom_field_id IS NULL THEN
            IF auto_create_enabled THEN
                INSERT INTO user_custom_fields (
                    user_id, field_name, field_type, is_required, default_value, validation_rules,
                    update_strategy, source_priority, allow_auto_update
                ) VALUES (
                    p_user_id, normalized_field_key, field_type, false, NULL, NULL,
                    user_update_strategy, source_priority_map, true
                ) RETURNING id INTO v_custom_field_id;

fields_created := fields_created + 1;

field_update_strategy := user_update_strategy;

ELSE
                -- Auto-create is disabled, skip this field
                fields_skipped := fields_skipped + 1;

CONTINUE;

END IF;

END IF;

-- Check if field value already exists and determine if we should update
        SELECT source_type, confidence_score 
        INTO existing_source_type, existing_confidence
        FROM product_custom_field_values
        WHERE product_id = p_product_id AND custom_field_id = v_custom_field_id;

should_update := false;

IF existing_source_type IS NULL THEN
            -- No existing value, always create
            should_update := true;

ELSE
            -- Existing value found, check update strategy
            existing_priority := COALESCE((source_priority_map->>existing_source_type)::INTEGER, 0);

CASE COALESCE(field_update_strategy, user_update_strategy)
                WHEN 'always_update' THEN
                    should_update := true;

WHEN 'never_update' THEN
                    should_update := false;

WHEN 'source_priority' THEN
                    should_update := current_priority > existing_priority;

WHEN 'manual_approval' THEN
                    -- For now, treat as source_priority. Later we can add approval queue
                    should_update := current_priority > existing_priority;

ELSE
                    -- Default to source_priority
                    should_update := current_priority > existing_priority;

END CASE;

END IF;

IF should_update THEN
            -- Delete existing value (if any)
            DELETE FROM product_custom_field_values
            WHERE product_id = p_product_id AND custom_field_id = v_custom_field_id;

-- Insert new custom field value with source information
            INSERT INTO product_custom_field_values (
                product_id, custom_field_id, value, source_type, source_id, 
                last_updated_by, confidence_score, created_by_source
            ) VALUES (
                p_product_id, v_custom_field_id, field_value, p_source_type, p_source_id,
                p_source_type, 100, p_source_type
            );

fields_processed := fields_processed + 1;

ELSE
            fields_skipped := fields_skipped + 1;

END IF;

END LOOP;

RETURN jsonb_build_object(
        'fields_processed', fields_processed,
        'fields_created', fields_created,
        'fields_skipped', fields_skipped,
        'source_type', p_source_type,
        'source_priority', current_priority,
        'auto_create_enabled', auto_create_enabled
    );

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the main process
    RAISE WARNING 'Error processing custom fields for product %: %', p_product_id, SQLERRM;

RETURN jsonb_build_object(
        'fields_processed', 0,
        'fields_created', 0,
        'fields_skipped', 0,
        'error', SQLERRM
    );

END;

$_$;

processed_count integer := 0;

error_count integer := 0;

existing_product_id UUID;

v_brand_id UUID;

current_retail_price NUMERIC(10,2);

current_wholesale_price NUMERIC(10,2);

custom_fields_result JSONB;

BEGIN
    -- Process each processing record (changed from pending to processing)
    FOR temp_record IN 
        SELECT * FROM temp_integrations_scraped_data WHERE status = 'processing' LIMIT 100
    LOOP
        BEGIN
            -- Find or create brand if we have brand name
            v_brand_id := NULL;

IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;

END IF;

-- Try to find existing product by EAN first
            existing_product_id := NULL;

IF temp_record.ean IS NOT NULL AND temp_record.ean != '' THEN
                SELECT id INTO existing_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;

END IF;

-- If no match by EAN, try by SKU and brand
            IF existing_product_id IS NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' AND temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT id INTO existing_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND sku = temp_record.sku
                  AND brand = temp_record.brand
                LIMIT 1;

END IF;

current_retail_price := NULL;

current_wholesale_price := NULL;

IF existing_product_id IS NOT NULL THEN
                -- Get current prices for comparison
                SELECT our_retail_price, our_wholesale_price
                INTO current_retail_price, current_wholesale_price
                FROM products
                WHERE id = existing_product_id;

-- Update existing product
                UPDATE products SET
                    name = COALESCE(temp_record.name, name),
                    sku = COALESCE(temp_record.sku, sku),
                    ean = COALESCE(temp_record.ean, ean),
                    brand = COALESCE(temp_record.brand, brand),
                    brand_id = COALESCE(v_brand_id, brand_id),
                    our_retail_price = temp_record.our_retail_price,
                    our_wholesale_price = temp_record.our_wholesale_price,
                    image_url = COALESCE(temp_record.image_url, image_url),
                    url = COALESCE(temp_record.url, url),
                    currency_code = COALESCE(temp_record.currency_code, currency_code),
                    updated_at = NOW()
                WHERE id = existing_product_id;

ELSE
                -- Create new product
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id,
                    our_retail_price, our_wholesale_price, image_url, currency_code, url
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean, temp_record.brand, v_brand_id,
                    temp_record.our_retail_price, temp_record.our_wholesale_price, temp_record.image_url, temp_record.currency_code, temp_record.url
                ) RETURNING id INTO existing_product_id;

END IF;

-- Create price change records if needed
            IF temp_record.our_retail_price IS NOT NULL AND (current_retail_price IS NULL OR current_retail_price != temp_record.our_retail_price) THEN
                INSERT INTO price_changes_competitors (
                    user_id, product_id, integration_id, old_our_retail_price, new_our_retail_price,
                    price_change_percentage, changed_at, currency_code, url
                ) VALUES (
                    temp_record.user_id, existing_product_id, temp_record.integration_id,
                    COALESCE(current_retail_price, temp_record.our_retail_price), temp_record.our_retail_price,
                    CASE WHEN current_retail_price IS NULL OR current_retail_price = 0 THEN 0
                         ELSE ROUND(((temp_record.our_retail_price - current_retail_price) / current_retail_price * 100)::numeric, 2) END,
                    NOW(), temp_record.currency_code, temp_record.url
                );

END IF;

IF temp_record.our_wholesale_price IS NOT NULL AND (current_wholesale_price IS NULL OR current_wholesale_price != temp_record.our_wholesale_price) THEN
                INSERT INTO price_changes_suppliers (
                    user_id, product_id, integration_id, old_our_wholesale_price, new_our_wholesale_price,
                    price_change_percentage, changed_at, currency_code, url
                ) VALUES (
                    temp_record.user_id, existing_product_id, temp_record.integration_id,
                    COALESCE(current_wholesale_price, temp_record.our_wholesale_price), temp_record.our_wholesale_price,
                    CASE WHEN current_wholesale_price IS NULL OR current_wholesale_price = 0 THEN 0
                         ELSE ROUND(((temp_record.our_wholesale_price - current_wholesale_price) / current_wholesale_price * 100)::numeric, 2) END,
                    NOW(), temp_record.currency_code, temp_record.url
                );

END IF;

-- Delete the processed record
            DELETE FROM temp_integrations_scraped_data WHERE id = temp_record.id;

processed_count := processed_count + 1;

EXCEPTION WHEN OTHERS THEN
            -- Mark as error
            UPDATE temp_integrations_scraped_data 
            SET status = 'error', error_message = SQLERRM, processed_at = NOW() 
            WHERE id = temp_record.id;

error_count := error_count + 1;

END;

END LOOP;

RETURN QUERY SELECT processed_count, error_count;

END;

$$;

batch_size INTEGER := 100;

processed_count INTEGER := 0;

total_pending INTEGER;

batch_ids UUID[];

BEGIN
    -- Get total pending count
    SELECT COUNT(*) INTO total_pending
    FROM temp_integrations_scraped_data
    WHERE integration_run_id = run_id AND status = 'pending';

-- Process in batches to avoid timeouts
    WHILE total_pending > 0 LOOP
        -- Get a batch of IDs to process
        SELECT ARRAY(
            SELECT id
            FROM temp_integrations_scraped_data
            WHERE integration_run_id = run_id AND status = 'pending'
            ORDER BY created_at ASC
            LIMIT batch_size
        ) INTO batch_ids;

-- Exit if no more records to process
        IF array_length(batch_ids, 1) IS NULL THEN
            EXIT;

END IF;

-- Process this batch by triggering the UPDATE trigger
        UPDATE temp_integrations_scraped_data
        SET status = status  -- This is a no-op update that will trigger the BEFORE UPDATE trigger
        WHERE id = ANY(batch_ids);

-- Update counters
        processed_count := processed_count + array_length(batch_ids, 1);

-- Check remaining count
        SELECT COUNT(*) INTO total_pending
        FROM temp_integrations_scraped_data
        WHERE integration_run_id = run_id AND status = 'pending';

-- Add a small delay to prevent overwhelming the database
        PERFORM pg_sleep(0.1);

END LOOP;

-- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

-- Update the run status
    PERFORM update_integration_run_status(run_id);

RETURN stats;

END;

$$;

current_competitor_price NUMERIC(10,2);

v_brand_id UUID;

custom_fields_result JSONB;

user_matching_rules JSONB;

has_ean BOOLEAN := FALSE;

has_brand_sku BOOLEAN := FALSE;

has_name BOOLEAN := FALSE;

fuzzy_name_enabled BOOLEAN := FALSE;

-- Stock processing variables
    current_stock_quantity INTEGER;

current_stock_status TEXT;

current_availability_date DATE;

standardized_status TEXT;

BEGIN
    -- Get user's matching rules settings
    SELECT matching_rules INTO user_matching_rules
    FROM user_settings
    WHERE user_id = NEW.user_id;

-- Default to empty JSONB if no settings found
    user_matching_rules := COALESCE(user_matching_rules, '{}');

-- Check what data we have (with EAN validation)
    has_ean := (NEW.ean IS NOT NULL AND NEW.ean != '' AND NEW.ean != '-' AND is_valid_ean(NEW.ean));

has_brand_sku := (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '' AND NEW.sku != '-');

has_name := (NEW.name IS NOT NULL AND NEW.name != '');

fuzzy_name_enabled := (user_matching_rules->>'fuzzy_name_matching')::boolean;

-- If EAN is provided but invalid, set it to NULL and log the issue
    IF NEW.ean IS NOT NULL AND NEW.ean != '' AND NEW.ean != '-' AND NOT is_valid_ean(NEW.ean) THEN
        RAISE NOTICE 'Invalid EAN code rejected: % for product: %', NEW.ean, NEW.name;

NEW.ean := NULL;

END IF;

-- Validate that the record has sufficient data for processing
    -- Must have either valid EAN OR both brand+sku OR (name if fuzzy matching is enabled)
    IF NOT has_ean AND NOT has_brand_sku AND NOT (fuzzy_name_enabled AND has_name) THEN
        -- Delete records that don't meet any matching criteria
        DELETE FROM temp_competitors_scraped_data WHERE id = NEW.id;

RETURN NULL;

END IF;

-- If product_id is already provided, use it
    IF NEW.product_id IS NOT NULL THEN
        matched_product_id := NEW.product_id;

ELSE
        -- Find or create brand if we have brand name (needed for fuzzy matching)
        IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
            SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;

END IF;

-- Use the enhanced fuzzy matching function
        SELECT find_product_with_fuzzy_matching(
            NEW.user_id,
            NEW.ean,
            NEW.brand,
            NEW.sku,
            NEW.name,
            v_brand_id
        ) INTO matched_product_id;

-- If no match found, create new product (we have sufficient data)
        IF matched_product_id IS NULL THEN
            -- Create new product
            INSERT INTO products (
                user_id,
                name,
                sku,
                ean,
                brand,
                brand_id,
                image_url,
                currency_code,
                url
            ) VALUES (
                NEW.user_id,
                NEW.name,
                NEW.sku,
                NEW.ean,  -- This will be NULL if it was invalid
                NEW.brand,
                v_brand_id,
                NEW.image_url,
                NEW.currency_code,
                NEW.url
            ) RETURNING id INTO matched_product_id;

END IF;

END IF;

-- Process custom fields if present
    IF NEW.raw_data IS NOT NULL THEN
        SELECT process_custom_fields(NEW.user_id, matched_product_id, NEW.raw_data) INTO custom_fields_result;

END IF;

-- Get current competitor price for comparison
    SELECT new_competitor_price INTO current_competitor_price
    FROM price_changes_competitors
    WHERE user_id = NEW.user_id
      AND product_id = matched_product_id
      AND competitor_id = NEW.competitor_id
    ORDER BY changed_at DESC
    LIMIT 1;

-- Only insert price change if price has actually changed
    IF current_competitor_price IS NULL OR current_competitor_price != NEW.competitor_price THEN
        INSERT INTO price_changes_competitors (
            user_id,
            product_id,
            competitor_id,
            old_competitor_price,
            new_competitor_price,
            changed_at
        ) VALUES (
            NEW.user_id,
            matched_product_id,
            NEW.competitor_id,
            current_competitor_price,
            NEW.competitor_price,
            NOW()
        );

END IF;

-- Process stock data if present
    IF NEW.stock_quantity IS NOT NULL OR NEW.stock_status IS NOT NULL OR NEW.availability_date IS NOT NULL THEN
        -- Get current stock data for comparison
        SELECT 
            new_stock_quantity,
            new_stock_status,
            new_availability_date
        INTO 
            current_stock_quantity,
            current_stock_status,
            current_availability_date
        FROM stock_changes_competitors
        WHERE user_id = NEW.user_id
          AND product_id = matched_product_id
          AND competitor_id = NEW.competitor_id
        ORDER BY changed_at DESC
        LIMIT 1;

-- Standardize stock status
        standardized_status := standardize_stock_status(NEW.stock_status);

-- Only insert stock change if stock data has actually changed
        IF (current_stock_quantity IS DISTINCT FROM NEW.stock_quantity) OR 
           (current_stock_status IS DISTINCT FROM standardized_status) OR 
           (current_availability_date IS DISTINCT FROM NEW.availability_date) THEN
            
            INSERT INTO stock_changes_competitors (
                user_id,
                product_id,
                competitor_id,
                old_stock_quantity,
                new_stock_quantity,
                old_stock_status,
                new_stock_status,
                old_availability_date,
                new_availability_date,
                stock_change_quantity,
                changed_at,
                raw_stock_data
            ) VALUES (
                NEW.user_id,
                matched_product_id,
                NEW.competitor_id,
                current_stock_quantity,
                NEW.stock_quantity,
                current_stock_status,
                standardized_status,
                current_availability_date,
                NEW.availability_date,
                COALESCE(NEW.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                NOW(),
                NEW.raw_stock_data
            );

END IF;

END IF;

-- Delete the processed temp record
    DELETE FROM temp_competitors_scraped_data WHERE id = NEW.id;

RETURN NEW;

END;

$$;

v_brand_id UUID;

current_retail_price NUMERIC(10,2);

current_wholesale_price NUMERIC(10,2);

custom_fields_result JSONB;

rounded_retail_price NUMERIC(10,2);

rounded_wholesale_price NUMERIC(10,2);

integration_config JSONB;

selective_import_enabled BOOLEAN := FALSE;

field_config JSONB;

BEGIN
    -- Validate that the record has minimum required data
    -- Products must have either an EAN or both SKU and brand to be imported
    IF (NEW.ean IS NULL OR NEW.ean = '') AND 
       (NEW.sku IS NULL OR NEW.sku = '' OR NEW.brand IS NULL OR NEW.brand = '') THEN
        -- Delete unprocessable records immediately
        DELETE FROM temp_integrations_scraped_data WHERE id = NEW.id;

RETURN NEW;

END IF;

-- Get integration configuration
    SELECT configuration INTO integration_config
    FROM integrations 
    WHERE id = NEW.integration_id;

-- Check if selective import is enabled
    IF integration_config IS NOT NULL AND 
       integration_config->'selectiveImport'->>'enabled' = 'true' THEN
        selective_import_enabled := TRUE;

field_config := integration_config->'selectiveImport'->'fields';

END IF;

-- Round integration prices to whole numbers (no decimals)
    rounded_retail_price := ROUND(NEW.our_retail_price);

rounded_wholesale_price := ROUND(NEW.our_wholesale_price);

-- Find or create brand if we have brand name and brand field is selected
    v_brand_id := NULL;

IF NEW.brand IS NOT NULL AND NEW.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        SELECT id INTO v_brand_id FROM brands WHERE name = NEW.brand;

IF v_brand_id IS NULL THEN
            INSERT INTO brands (name) VALUES (NEW.brand) RETURNING id INTO v_brand_id;

END IF;

END IF;

-- Try to find existing product by EAN first, then by SKU+brand
    SELECT id INTO existing_product_id FROM products 
    WHERE user_id = NEW.user_id 
      AND ((NEW.ean IS NOT NULL AND NEW.ean != '' AND ean = NEW.ean)
           OR (NEW.sku IS NOT NULL AND NEW.sku != '' AND NEW.brand IS NOT NULL AND NEW.brand != '' 
               AND sku = NEW.sku AND brand = NEW.brand));

-- Get current prices for price change tracking
    IF existing_product_id IS NOT NULL THEN
        SELECT our_retail_price, our_wholesale_price 
        INTO current_retail_price, current_wholesale_price
        FROM products WHERE id = existing_product_id;

END IF;

IF existing_product_id IS NULL THEN
        -- Create new product with only selected fields
        INSERT INTO products (
            user_id,
            name,
            sku,
            ean,
            brand,
            brand_id,
            our_retail_price,
            our_wholesale_price,
            image_url,
            url,
            currency_code,
            stock_quantity,
            stock_status,
            availability_date
        ) VALUES (
            NEW.user_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN NEW.name ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN NEW.sku ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN NEW.ean ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN NEW.brand ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN v_brand_id ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN NEW.image_url ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'url' != 'false' THEN NEW.url ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN NEW.currency_code ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'stock_status' != 'false' THEN NEW.stock_quantity ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'stock_status' != 'false' THEN NEW.stock_status ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'availability_date' != 'false' THEN NEW.availability_date ELSE NULL END
        ) RETURNING id INTO existing_product_id;

ELSE
        -- Update existing product with integration data (overwrite selected fields only)
        UPDATE products SET
            name = CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN COALESCE(NEW.name, name) ELSE name END,
            sku = CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN COALESCE(NEW.sku, sku) ELSE sku END,
            ean = CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN COALESCE(NEW.ean, ean) ELSE ean END,
            brand = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(NEW.brand, brand) ELSE brand END,
            brand_id = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(v_brand_id, brand_id) ELSE brand_id END,
            our_retail_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE our_retail_price END,
            our_wholesale_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE our_wholesale_price END,
            image_url = CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN COALESCE(NEW.image_url, image_url) ELSE image_url END,
            url = CASE WHEN NOT selective_import_enabled OR field_config->>'url' != 'false' THEN COALESCE(NEW.url, url) ELSE url END,
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(NEW.currency_code, currency_code) ELSE currency_code END,
            stock_quantity = CASE WHEN NOT selective_import_enabled OR field_config->>'stock_status' != 'false' THEN COALESCE(NEW.stock_quantity, stock_quantity) ELSE stock_quantity END,
            stock_status = CASE WHEN NOT selective_import_enabled OR field_config->>'stock_status' != 'false' THEN COALESCE(NEW.stock_status, stock_status) ELSE stock_status END,
            availability_date = CASE WHEN NOT selective_import_enabled OR field_config->>'availability_date' != 'false' THEN COALESCE(NEW.availability_date, availability_date) ELSE availability_date END,
            updated_at = NOW()
        WHERE id = existing_product_id;

END IF;

-- Process custom fields if raw_data field is selected (or if selective import is disabled)
    IF (NOT selective_import_enabled OR field_config->>'raw_data' != 'false') AND NEW.raw_data IS NOT NULL THEN
        SELECT process_custom_fields(existing_product_id, NEW.raw_data) INTO custom_fields_result;

END IF;

-- Record price changes only if price fields are selected
    IF (NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' OR field_config->>'our_wholesale_price' != 'false') AND
       (rounded_retail_price IS NOT NULL OR rounded_wholesale_price IS NOT NULL) AND
       (current_retail_price IS DISTINCT FROM rounded_retail_price OR current_wholesale_price IS DISTINCT FROM rounded_wholesale_price) THEN
        
        INSERT INTO price_changes_competitors (
            user_id,
            product_id,
            integration_id,
            old_our_retail_price,
            new_our_retail_price,
            old_our_wholesale_price,
            new_our_wholesale_price,
            price_change_percentage,
            changed_at,
            currency_code,
            url
        ) VALUES (
            NEW.user_id,
            existing_product_id,
            NEW.integration_id,
            current_retail_price,
            rounded_retail_price,
            current_wholesale_price,
            rounded_wholesale_price,
            CASE 
                WHEN current_retail_price IS NULL OR current_retail_price = 0 THEN 0
                ELSE ROUND(((rounded_retail_price - current_retail_price) / current_retail_price * 100)::numeric, 2)
            END,
            NOW(),
            NEW.currency_code,
            NEW.url
        );

END IF;

-- Mark as processed and set processed_at
    UPDATE temp_integrations_scraped_data 
    SET status = 'processed', 
        processed_at = NOW() 
    WHERE id = NEW.id;

-- Delete from temp table (cleanup after processing)
    DELETE FROM temp_integrations_scraped_data WHERE id = NEW.id;

-- Return NEW for INSERT trigger
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- For any other errors, mark as error and store error message
    UPDATE temp_integrations_scraped_data 
    SET status = 'error', 
        error_message = SQLERRM, 
        processed_at = NOW() 
    WHERE id = NEW.id;

-- Re-raise the exception
    RAISE;

END;

$$;

v_brand_id UUID;

last_supplier_price DECIMAL(10, 2);

last_our_wholesale_price DECIMAL(10, 2);

last_supplier_recommended_price DECIMAL(10, 2);

price_change_pct DECIMAL(10, 2);

existing_product RECORD;

custom_fields_result JSONB;

price_changed BOOLEAN := FALSE;

-- Stock processing variables
    current_stock_quantity INTEGER;

current_stock_status TEXT;

current_availability_date DATE;

standardized_status TEXT;

BEGIN
    -- Find or create brand if we have brand name
    IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
        SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;

END IF;

-- Use enhanced fuzzy matching to find existing product
    SELECT find_product_with_fuzzy_matching(
        NEW.user_id,
        NEW.ean,
        NEW.brand,
        NEW.sku,
        NEW.name,
        v_brand_id
    ) INTO matched_product_id;

IF matched_product_id IS NOT NULL THEN
        -- Product exists, get current data for comparison
        SELECT * INTO existing_product
        FROM products
        WHERE id = matched_product_id;

-- Update existing product with supplier data (only fill missing fields)
        UPDATE products SET
            name = CASE WHEN (name IS NULL OR name = '') AND NEW.name IS NOT NULL AND NEW.name != '' THEN NEW.name ELSE name END,
            sku = CASE WHEN (sku IS NULL OR sku = '') AND NEW.sku IS NOT NULL AND NEW.sku != '' THEN NEW.sku ELSE sku END,
            ean = CASE WHEN (ean IS NULL OR ean = '') AND NEW.ean IS NOT NULL AND NEW.ean != '' THEN NEW.ean ELSE ean END,
            brand = CASE WHEN (brand IS NULL OR brand = '') AND NEW.brand IS NOT NULL AND NEW.brand != '' THEN NEW.brand ELSE brand END,
            brand_id = CASE WHEN brand_id IS NULL AND v_brand_id IS NOT NULL THEN v_brand_id ELSE brand_id END,
            image_url = CASE WHEN (image_url IS NULL OR image_url = '') AND NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN NEW.image_url ELSE image_url END,
            url = CASE WHEN (url IS NULL OR url = '') AND NEW.url IS NOT NULL AND NEW.url != '' THEN NEW.url ELSE url END,
            currency_code = CASE WHEN (currency_code IS NULL OR currency_code = '') AND NEW.currency_code IS NOT NULL AND NEW.currency_code != '' THEN NEW.currency_code ELSE currency_code END,
            updated_at = NOW()
        WHERE id = matched_product_id;

ELSE
        -- Create new product
        INSERT INTO products (
            user_id,
            name,
            sku,
            ean,
            brand,
            brand_id,
            image_url,
            currency_code,
            url
        ) VALUES (
            NEW.user_id,
            NEW.name,
            NEW.sku,
            NEW.ean,
            NEW.brand,
            v_brand_id,
            NEW.image_url,
            NEW.currency_code,
            NEW.url
        ) RETURNING id INTO matched_product_id;

END IF;

-- Process custom fields from raw_data if we have a product
    -- Pass source information: 'supplier' as source_type and supplier_id as source_id
    IF matched_product_id IS NOT NULL AND NEW.raw_data IS NOT NULL THEN
        SELECT process_custom_fields_from_raw_data(
            NEW.user_id,
            matched_product_id,
            NEW.raw_data,
            'supplier',
            NEW.supplier_id
        ) INTO custom_fields_result;

END IF;

-- PRICE PROCESSING (existing logic)
    -- Get last supplier prices for comparison
    SELECT 
        new_supplier_price,
        new_our_wholesale_price,
        new_supplier_recommended_price
    INTO 
        last_supplier_price,
        last_our_wholesale_price,
        last_supplier_recommended_price
    FROM price_changes_suppliers
    WHERE product_id = matched_product_id
      AND supplier_id = NEW.supplier_id
      AND user_id = NEW.user_id
    ORDER BY changed_at DESC
    LIMIT 1;

-- Check if any price has changed
    IF (last_supplier_price IS NULL AND NEW.supplier_price IS NOT NULL) OR
       (last_supplier_price IS NOT NULL AND NEW.supplier_price IS NOT NULL AND last_supplier_price != NEW.supplier_price) OR
       (last_supplier_recommended_price IS NULL AND NEW.supplier_recommended_price IS NOT NULL) OR
       (last_supplier_recommended_price IS NOT NULL AND NEW.supplier_recommended_price IS NOT NULL AND last_supplier_recommended_price != NEW.supplier_recommended_price) THEN
        price_changed := TRUE;

END IF;

-- Calculate price change percentage for supplier price
    IF last_supplier_price IS NOT NULL AND last_supplier_price > 0 AND NEW.supplier_price IS NOT NULL THEN
        price_change_pct := ROUND(((NEW.supplier_price - last_supplier_price) / last_supplier_price * 100)::numeric, 2);

ELSE
        price_change_pct := 0;

END IF;

-- Insert supplier price change record ONLY if price has changed
    IF price_changed AND (NEW.supplier_price IS NOT NULL OR NEW.supplier_recommended_price IS NOT NULL) THEN
        INSERT INTO price_changes_suppliers (
            user_id,
            product_id,
            supplier_id,
            old_supplier_price,
            new_supplier_price,
            old_supplier_recommended_price,
            new_supplier_recommended_price,
            price_change_percentage,
            changed_at,
            currency_code,
            url
        ) VALUES (
            NEW.user_id,
            matched_product_id,
            NEW.supplier_id,
            COALESCE(last_supplier_price, NEW.supplier_price),
            NEW.supplier_price,
            COALESCE(last_supplier_recommended_price, NEW.supplier_recommended_price),
            NEW.supplier_recommended_price,
            price_change_pct,
            NOW(),
            NEW.currency_code,
            NEW.url
        );

END IF;

-- STOCK PROCESSING (new logic)
    -- Only process stock if we have stock data
    IF NEW.stock_quantity IS NOT NULL OR NEW.stock_status IS NOT NULL THEN
        -- Get current stock data for this product/supplier combination
        SELECT 
            new_stock_quantity,
            new_stock_status,
            new_availability_date
        INTO 
            current_stock_quantity,
            current_stock_status,
            current_availability_date
        FROM stock_changes_suppliers
        WHERE user_id = NEW.user_id 
          AND product_id = matched_product_id 
          AND supplier_id = NEW.supplier_id
        ORDER BY changed_at DESC
        LIMIT 1;

-- Standardize the new stock status
        standardized_status := standardize_stock_status(NEW.stock_status);

-- Only insert if stock has changed
        IF (current_stock_quantity IS DISTINCT FROM NEW.stock_quantity) OR
           (current_stock_status IS DISTINCT FROM standardized_status) OR
           (current_availability_date IS DISTINCT FROM NEW.availability_date) THEN
            
            INSERT INTO stock_changes_suppliers (
                user_id,
                product_id,
                supplier_id,
                old_stock_quantity,
                new_stock_quantity,
                old_stock_status,
                new_stock_status,
                old_availability_date,
                new_availability_date,
                stock_change_quantity,
                changed_at,
                url,
                raw_stock_data
            ) VALUES (
                NEW.user_id,
                matched_product_id,
                NEW.supplier_id,
                current_stock_quantity,
                NEW.stock_quantity,
                current_stock_status,
                standardized_status,
                current_availability_date,
                NEW.availability_date,
                COALESCE(NEW.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                NOW(),
                NEW.url,
                NEW.raw_stock_data
            );

END IF;

END IF;

-- IMMEDIATE CLEANUP: Delete the processed record from temp table
    DELETE FROM temp_suppliers_scraped_data WHERE id = NEW.id;

-- Return NULL to prevent the INSERT (since we deleted the record)
    RETURN NULL;

END;

$$;

BEGIN
    -- Reset error products to pending status
    UPDATE temp_integrations_scraped_data
    SET
        status = 'pending',
        error_message = NULL
    WHERE integration_run_id = run_id AND status = 'error';

-- Force processing of these products
    UPDATE temp_integrations_scraped_data
    SET status = status  -- This is a no-op update that will trigger the BEFORE UPDATE trigger
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

END;

$$;

END IF;

-- Convert to lowercase for comparison
    raw_status := lower(trim(raw_status));

-- In stock variations (Swedish and English)
    IF raw_status IN ('i lager', 'finns i lager', 'in stock', 'available', 'tillgänglig', 'på lager') THEN
        RETURN 'in_stock';

END IF;

-- Out of stock variations
    IF raw_status IN ('ej i lager', 'slut i lager', 'utgången produkt', 'out of stock', 'sold out', 'slutsåld') THEN
        RETURN 'out_of_stock';

END IF;

-- Limited stock
    IF raw_status LIKE '%få kvar%' OR raw_status LIKE '%limited%' OR raw_status LIKE '%begränsad%' OR raw_status LIKE '%få st%' THEN
        RETURN 'limited_stock';

END IF;

-- Coming soon / future availability
    IF raw_status LIKE '%snart%' OR raw_status LIKE '%kommer%' OR raw_status LIKE '%coming soon%' OR raw_status LIKE '%inkommer%' THEN
        RETURN 'coming_soon';

END IF;

-- Back order / restocking
    IF raw_status LIKE '%beställningsvara%' OR raw_status LIKE '%back order%' OR raw_status LIKE '%restocking%' THEN
        RETURN 'back_order';

END IF;

-- Discontinued
    IF raw_status LIKE '%utgången%' OR raw_status LIKE '%discontinued%' OR raw_status LIKE '%upphörd%' THEN
        RETURN 'discontinued';

END IF;

-- Default to original status if no match
    RETURN raw_status;

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

ordered_id_2 UUID;

deleted_count INTEGER;

BEGIN
    -- Ensure consistent ordering (smaller UUID first)
    IF p_product_id_1 < p_product_id_2 THEN
        ordered_id_1 := p_product_id_1;

ordered_id_2 := p_product_id_2;

ELSE
        ordered_id_1 := p_product_id_2;

ordered_id_2 := p_product_id_1;

END IF;

-- Delete dismissal record
    DELETE FROM products_dismissed_duplicates
    WHERE user_id = p_user_id 
      AND product_id_1 = ordered_id_1 
      AND product_id_2 = ordered_id_2;

GET DIAGNOSTICS deleted_count = ROW_COUNT;

IF deleted_count > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Product duplicate undismissed successfully',
            'product_id_1', ordered_id_1,
            'product_id_2', ordered_id_2
        );

ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No dismissed duplicate found for these products',
            'product_id_1', ordered_id_1,
            'product_id_2', ordered_id_2
        );

END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Error undismissing product duplicate: ' || SQLERRM,
        'product_id_1', p_product_id_1,
        'product_id_2', p_product_id_2
    );

END;

$$;

RETURN NEW;

END;

$$;

ELSE
            -- For failed runs, update last_sync_status but keep it active for retry
            UPDATE public.integrations
            SET 
                last_sync_at = NEW.completed_at,
                last_sync_status = 'failed',
                status = 'active',  -- Reset to active so it can be scheduled again
                updated_at = now()
            WHERE id = NEW.integration_id;

END IF;

-- Calculate and set the next run time for both completed and failed runs
        PERFORM public.update_integration_next_run_time(NEW.integration_id, NEW.completed_at);

END IF;

RETURN NEW;

END;

$$;

next_run timestamp with time zone;

base_time timestamp with time zone;

BEGIN
    -- Get integration details
    SELECT id, sync_frequency, last_sync_at
    INTO integration_record
    FROM public.integrations
    WHERE id = integration_id;

IF NOT FOUND THEN
        RAISE EXCEPTION 'Integration not found: %', integration_id;

END IF;

-- Use completed_at as base time
    base_time := completed_at;

-- Calculate next run time based on frequency
    CASE integration_record.sync_frequency
        WHEN 'hourly' THEN
            next_run := base_time + interval '1 hour';

WHEN 'daily' THEN
            -- Schedule for 5:00 AM the next day
            next_run := date_trunc('day', base_time) + interval '1 day' + interval '5 hours';

WHEN 'weekly' THEN
            next_run := base_time + interval '7 days';

WHEN 'monthly' THEN
            next_run := base_time + interval '1 month';

ELSE
            -- Default to daily if frequency is unknown
            next_run := date_trunc('day', base_time) + interval '1 day' + interval '5 hours';

END CASE;

-- Update the integration with the new next run time
    UPDATE public.integrations
    SET next_run_time = next_run,
        updated_at = now()
    WHERE id = integration_id;

RETURN next_run;

END;

$$;

END IF;

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

-- Calculate and set the next run time
        PERFORM public.update_scraper_next_run_time(NEW.scraper_id, NEW.completed_at);

END IF;

RETURN NEW;

END;

$$;

next_run timestamp with time zone;

base_time timestamp with time zone;

schedule_time text;

schedule_hours integer;

schedule_minutes integer;

BEGIN
    -- Get scraper details
    SELECT id, schedule, last_run
    INTO scraper_record
    FROM public.scrapers
    WHERE id = scraper_id;

IF NOT FOUND THEN
        RAISE EXCEPTION 'Scraper not found: %', scraper_id;

END IF;

-- Use completed_at as base time
    base_time := completed_at;

-- Get schedule time (default to 02:00 if not specified)
    schedule_time := COALESCE(scraper_record.schedule->>'time', '02:00');

-- Parse hours and minutes
    schedule_hours := split_part(schedule_time, ':', 1)::integer;

schedule_minutes := split_part(schedule_time, ':', 2)::integer;

-- Calculate next run time based on frequency
    CASE scraper_record.schedule->>'frequency'
        WHEN 'hourly' THEN
            next_run := base_time + interval '1 hour';

WHEN 'daily' THEN
            -- Schedule for the specified time the next day
            next_run := date_trunc('day', base_time) + interval '1 day' + 
                       make_interval(hours => schedule_hours, mins => schedule_minutes);

WHEN 'weekly' THEN
            -- Schedule for the same day next week at the specified time
            next_run := date_trunc('day', base_time) + interval '7 days' + 
                       make_interval(hours => schedule_hours, mins => schedule_minutes);

WHEN 'monthly' THEN
            -- Schedule for the same day next month at the specified time
            next_run := date_trunc('day', base_time) + interval '1 month' + 
                       make_interval(hours => schedule_hours, mins => schedule_minutes);

ELSE
            -- Default to daily if frequency is unknown
            next_run := date_trunc('day', base_time) + interval '1 day' + 
                       make_interval(hours => schedule_hours, mins => schedule_minutes);

END CASE;

-- Update the scraper with the new next run time
    UPDATE public.scrapers
    SET next_run_time = next_run,
        updated_at = now()
    WHERE id = scraper_id;

RETURN next_run;

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
-- Name: idx_price_changes_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_analysis ON public.price_changes_competitors USING btree (user_id, product_id, competitor_id, changed_at DESC, new_competitor_price);

--
-- Name: idx_price_changes_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_competitor_id ON public.price_changes_competitors USING btree (competitor_id);

--
-- Name: idx_price_changes_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_integration_id ON public.price_changes_competitors USING btree (integration_id);

--
-- Name: idx_price_changes_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_product_date ON public.price_changes_competitors USING btree (product_id, changed_at DESC);

--
-- Name: idx_price_changes_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_product_id ON public.price_changes_competitors USING btree (product_id);

--
-- Name: idx_price_changes_product_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_product_user_time ON public.price_changes_competitors USING btree (product_id, user_id, changed_at DESC);

--
-- Name: idx_price_changes_suppliers_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_changed_at ON public.price_changes_suppliers USING btree (changed_at);

--
-- Name: idx_price_changes_suppliers_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_product_id ON public.price_changes_suppliers USING btree (product_id);

--
-- Name: idx_price_changes_suppliers_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_supplier_id ON public.price_changes_suppliers USING btree (supplier_id);

--
-- Name: idx_price_changes_suppliers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_user_id ON public.price_changes_suppliers USING btree (user_id);

--
-- Name: idx_price_changes_user_competitor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_competitor_date ON public.price_changes_competitors USING btree (user_id, competitor_id, changed_at DESC);

--
-- Name: idx_price_changes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id ON public.price_changes_competitors USING btree (user_id);

--
-- Name: INDEX idx_price_changes_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id IS 'Optimizes user-based price_changes queries';

--
-- Name: idx_price_changes_user_id_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_changed_at ON public.price_changes_competitors USING btree (user_id, changed_at DESC);

--
-- Name: INDEX idx_price_changes_user_id_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_changed_at IS 'Optimizes time-based price change queries';

--
-- Name: idx_price_changes_user_id_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_competitor_id ON public.price_changes_competitors USING btree (user_id, competitor_id) WHERE (competitor_id IS NOT NULL);

--
-- Name: INDEX idx_price_changes_user_id_competitor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_competitor_id IS 'Optimizes competitor-based price queries';

--
-- Name: idx_price_changes_user_id_integration_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_integration_id ON public.price_changes_competitors USING btree (user_id, integration_id) WHERE (integration_id IS NOT NULL);

--
-- Name: INDEX idx_price_changes_user_id_integration_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_integration_id IS 'Optimizes integration-based price queries';

--
-- Name: idx_price_changes_user_id_percentage_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_percentage_changed_at ON public.price_changes_competitors USING btree (user_id, price_change_percentage, changed_at DESC);

--
-- Name: INDEX idx_price_changes_user_id_percentage_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_percentage_changed_at IS 'Optimizes dashboard price drop queries';

--
-- Name: idx_price_changes_user_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_user_id_product_id ON public.price_changes_competitors USING btree (user_id, product_id);

--
-- Name: INDEX idx_price_changes_user_id_product_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_price_changes_user_id_product_id IS 'Optimizes get_brand_analytics function joins';

--
-- Name: idx_product_custom_field_values_custom_field_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_custom_field_id ON public.product_custom_field_values USING btree (custom_field_id);

--
-- Name: idx_product_custom_field_values_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_product_id ON public.product_custom_field_values USING btree (product_id);

--
-- Name: idx_product_custom_field_values_product_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_product_source ON public.product_custom_field_values USING btree (product_id, source_type);

--
-- Name: idx_product_custom_field_values_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_source_id ON public.product_custom_field_values USING btree (source_id);

--
-- Name: idx_product_custom_field_values_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_source_type ON public.product_custom_field_values USING btree (source_type);

--
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand ON public.products USING btree (brand);

--
-- Name: idx_products_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand_id ON public.products USING btree (brand_id);

--
-- Name: idx_products_brand_id_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand_id_name ON public.products USING btree (user_id, brand_id, name);

--
-- Name: idx_products_brand_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_brand_sku ON public.products USING btree (brand, sku);

--
-- Name: idx_products_dismissed_duplicates_products; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_dismissed_duplicates_products ON public.products_dismissed_duplicates USING btree (product_id_1, product_id_2);

--
-- Name: idx_products_dismissed_duplicates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_dismissed_duplicates_user_id ON public.products_dismissed_duplicates USING btree (user_id);

--
-- Name: idx_products_dismissed_duplicates_user_products; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_dismissed_duplicates_user_products ON public.products_dismissed_duplicates USING btree (user_id, product_id_1, product_id_2);

--
-- Name: idx_products_ean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_ean ON public.products USING btree (ean);

--
-- Name: idx_products_ean_nonempty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_ean_nonempty ON public.products USING btree (user_id, ean) WHERE ((ean IS NOT NULL) AND (ean <> ''::text));

--
-- Name: idx_products_name_length; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name_length ON public.products USING btree (user_id, length(name));

--
-- Name: idx_products_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_user_active ON public.products USING btree (user_id, is_active) WHERE (is_active = true);

--
-- Name: idx_products_user_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_user_brand ON public.products USING btree (user_id, brand);

--
-- Name: idx_products_user_brand_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_user_brand_sku ON public.products USING btree (user_id, brand_id, sku) WHERE ((brand_id IS NOT NULL) AND (sku IS NOT NULL) AND (sku <> ''::text));

--
-- Name: idx_products_user_ean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_user_ean ON public.products USING btree (user_id, ean) WHERE ((ean IS NOT NULL) AND (ean <> ''::text));

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
-- Name: idx_scraper_run_timeouts_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_run_timeouts_run_id ON public.scraper_run_timeouts USING btree (run_id);

--
-- Name: idx_scraper_run_timeouts_timeout_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraper_run_timeouts_timeout_at ON public.scraper_run_timeouts USING btree (timeout_at) WHERE (processed = false);

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
-- Name: idx_stock_changes_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_analysis ON public.stock_changes_competitors USING btree (user_id, product_id, competitor_id, changed_at DESC, stock_change_quantity);

--
-- Name: idx_stock_changes_competitors_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_competitors_changed_at ON public.stock_changes_competitors USING btree (changed_at DESC);

--
-- Name: idx_stock_changes_competitors_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_competitors_product_id ON public.stock_changes_competitors USING btree (product_id);

--
-- Name: idx_stock_changes_competitors_user_competitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_competitors_user_competitor ON public.stock_changes_competitors USING btree (user_id, competitor_id) WHERE (competitor_id IS NOT NULL);

--
-- Name: INDEX idx_stock_changes_competitors_user_competitor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_competitors_user_competitor IS 'Optimizes competitor-based stock queries';

--
-- Name: idx_stock_changes_competitors_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_competitors_user_id ON public.stock_changes_competitors USING btree (user_id);

--
-- Name: INDEX idx_stock_changes_competitors_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_competitors_user_id IS 'Optimizes user-based stock queries';

--
-- Name: idx_stock_changes_competitors_user_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_competitors_user_integration ON public.stock_changes_competitors USING btree (user_id, integration_id) WHERE (integration_id IS NOT NULL);

--
-- Name: INDEX idx_stock_changes_competitors_user_integration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_competitors_user_integration IS 'Optimizes integration-based stock queries';

--
-- Name: idx_stock_changes_competitors_user_product_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_competitors_user_product_time ON public.stock_changes_competitors USING btree (user_id, product_id, changed_at DESC);

--
-- Name: INDEX idx_stock_changes_competitors_user_product_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_competitors_user_product_time IS 'Optimizes product stock history queries';

--
-- Name: idx_stock_changes_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_product_date ON public.stock_changes_competitors USING btree (product_id, changed_at DESC);

--
-- Name: idx_stock_changes_suppliers_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_suppliers_changed_at ON public.stock_changes_suppliers USING btree (changed_at DESC);

--
-- Name: idx_stock_changes_suppliers_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_suppliers_product_id ON public.stock_changes_suppliers USING btree (product_id);

--
-- Name: idx_stock_changes_suppliers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_suppliers_user_id ON public.stock_changes_suppliers USING btree (user_id);

--
-- Name: INDEX idx_stock_changes_suppliers_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_suppliers_user_id IS 'Optimizes user-based supplier stock queries';

--
-- Name: idx_stock_changes_suppliers_user_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_suppliers_user_integration ON public.stock_changes_suppliers USING btree (user_id, integration_id) WHERE (integration_id IS NOT NULL);

--
-- Name: INDEX idx_stock_changes_suppliers_user_integration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_suppliers_user_integration IS 'Optimizes integration-based supplier stock queries';

--
-- Name: idx_stock_changes_suppliers_user_product_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_suppliers_user_product_time ON public.stock_changes_suppliers USING btree (user_id, product_id, changed_at DESC);

--
-- Name: INDEX idx_stock_changes_suppliers_user_product_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_suppliers_user_product_time IS 'Optimizes product supplier stock history queries';

--
-- Name: idx_stock_changes_suppliers_user_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_suppliers_user_supplier ON public.stock_changes_suppliers USING btree (user_id, supplier_id) WHERE (supplier_id IS NOT NULL);

--
-- Name: INDEX idx_stock_changes_suppliers_user_supplier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_stock_changes_suppliers_user_supplier IS 'Optimizes supplier-based stock queries';

--
-- Name: idx_stock_changes_user_competitor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_user_competitor_date ON public.stock_changes_competitors USING btree (user_id, competitor_id, changed_at DESC);

--
-- Name: idx_stock_changes_user_quantity_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_changes_user_quantity_date ON public.stock_changes_competitors USING btree (user_id, stock_change_quantity, changed_at) WHERE (stock_change_quantity < 0);

--
-- Name: idx_suppliers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_is_active ON public.suppliers USING btree (is_active);

--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);

--
-- Name: idx_suppliers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_user_id ON public.suppliers USING btree (user_id);

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
-- Name: idx_temp_competitors_scraped_data_competitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_competitors_scraped_data_competitor_id ON public.temp_competitors_scraped_data USING btree (competitor_id);

--
-- Name: idx_temp_competitors_scraped_data_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_competitors_scraped_data_product_id ON public.temp_competitors_scraped_data USING btree (product_id);

--
-- Name: idx_temp_competitors_scraped_data_scraped_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_competitors_scraped_data_scraped_at ON public.temp_competitors_scraped_data USING btree (scraped_at);

--
-- Name: idx_temp_competitors_scraped_data_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_competitors_scraped_data_user_id ON public.temp_competitors_scraped_data USING btree (user_id);

--
-- Name: idx_temp_integrations_scraped_data_integration_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_integrations_scraped_data_integration_run_id ON public.temp_integrations_scraped_data USING btree (integration_run_id);

--
-- Name: idx_temp_integrations_scraped_data_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_integrations_scraped_data_status ON public.temp_integrations_scraped_data USING btree (status);

--
-- Name: idx_temp_suppliers_scraped_data_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_suppliers_scraped_data_processed ON public.temp_suppliers_scraped_data USING btree (processed);

--
-- Name: idx_temp_suppliers_scraped_data_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_suppliers_scraped_data_run_id ON public.temp_suppliers_scraped_data USING btree (run_id);

--
-- Name: idx_temp_suppliers_scraped_data_scraper_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_suppliers_scraped_data_scraper_id ON public.temp_suppliers_scraped_data USING btree (scraper_id);

--
-- Name: idx_temp_suppliers_scraped_data_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_suppliers_scraped_data_supplier_id ON public.temp_suppliers_scraped_data USING btree (supplier_id);

--
-- Name: idx_temp_suppliers_scraped_data_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_suppliers_scraped_data_user_id ON public.temp_suppliers_scraped_data USING btree (user_id);

--
-- Name: idx_user_custom_fields_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_custom_fields_user_id ON public.user_custom_fields USING btree (user_id);

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

