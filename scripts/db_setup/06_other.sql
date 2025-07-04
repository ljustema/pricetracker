-- =========================================================================
-- Other database objects
-- =========================================================================
-- Generated: 2025-07-04 18:09:17
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

-- Calculate percentage for our retail price changes (integration changes)
    ELSIF NEW.integration_id IS NOT NULL AND NEW.old_our_retail_price IS NOT NULL AND NEW.new_our_retail_price IS NOT NULL AND NEW.old_our_retail_price > 0 THEN
        NEW.price_change_percentage = ((NEW.new_our_retail_price - NEW.old_our_retail_price) / NEW.old_our_retail_price) * 100;

-- If neither condition is met, set to NULL
    ELSE
        NEW.price_change_percentage = NULL;

END IF;

RETURN NEW;

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

EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'product_custom_field_values table does not exist, skipping';

END;

-- Delete temp competitors data
  BEGIN
    DELETE FROM temp_competitors_scraped_data 
    WHERE user_id = target_user_id;

EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'temp_competitors_scraped_data table does not exist, skipping';

END;

-- Delete dismissed duplicates
  BEGIN
    DELETE FROM products_dismissed_duplicates 
    WHERE user_id = target_user_id;

EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'products_dismissed_duplicates table does not exist, skipping';

END;

END;

$$;

existing_product RECORD;

conflict_reason TEXT;

price_diff_percent NUMERIC;

processed_count INTEGER := 0;

conflict_count INTEGER := 0;

ean_count_in_run INTEGER;

BEGIN
    -- Process each record in the batch
    FOR record_data IN
        SELECT t.id, t.user_id, t.ean, t.name, t.sku, t.brand, t.our_retail_price, t.our_url
        FROM temp_integrations_scraped_data t
        WHERE t.user_id = p_user_id 
          AND t.integration_run_id = p_integration_run_id
          AND t.status = 'integration_pending'
          AND (p_batch_ids IS NULL OR t.id = ANY(p_batch_ids))
    LOOP
        processed_count := processed_count + 1;

conflict_reason := NULL;

price_diff_percent := NULL;

-- Check for duplicate EANs in the same integration run
        IF record_data.ean IS NOT NULL AND record_data.ean != '' THEN
            SELECT COUNT(*) INTO ean_count_in_run
            FROM temp_integrations_scraped_data t2 
            WHERE t2.ean = record_data.ean 
              AND t2.user_id = p_user_id 
              AND t2.integration_run_id = p_integration_run_id;

IF ean_count_in_run > 1 THEN
                conflict_reason := 'multiple_ean_in_batch';

END IF;

END IF;

-- Check for conflicts with existing products
        IF record_data.ean IS NOT NULL AND record_data.ean != '' THEN
            SELECT p.id, p.name, p.sku, p.brand, p.our_retail_price
            INTO existing_product
            FROM products p
            WHERE p.user_id = p_user_id AND p.ean = record_data.ean
            LIMIT 1;

IF existing_product.id IS NOT NULL THEN
                -- Check for large price difference (>50%)
                IF existing_product.our_retail_price IS NOT NULL AND record_data.our_retail_price IS NOT NULL THEN
                    price_diff_percent := ABS(record_data.our_retail_price - existing_product.our_retail_price) / existing_product.our_retail_price * 100;

IF price_diff_percent > 50 AND conflict_reason IS NULL THEN
                        conflict_reason := 'large_price_difference';

END IF;

END IF;

-- Check for name mismatch (very different names)
                IF conflict_reason IS NULL AND 
                   similarity(LOWER(record_data.name), LOWER(existing_product.name)) < 0.3 THEN
                    conflict_reason := 'name_mismatch';

END IF;

END IF;

END IF;

-- If conflict detected, create review and mark as conflict_review
        IF conflict_reason IS NOT NULL THEN
            INSERT INTO product_match_reviews (
                user_id, ean, existing_product_id, existing_product_name, 
                existing_product_sku, existing_product_brand, existing_product_price,
                new_product_name, new_product_sku, new_product_brand, new_product_price,
                new_product_data, source_table, source_record_id, 
                conflict_reason, price_difference_percent
            ) VALUES (
                p_user_id, record_data.ean, existing_product.id, existing_product.name,
                existing_product.sku, existing_product.brand, existing_product.our_retail_price,
                record_data.name, record_data.sku, record_data.brand, record_data.our_retail_price,
                row_to_json(record_data), 'temp_integrations_scraped_data', record_data.id,
                conflict_reason, price_diff_percent
            );

-- Mark as conflict_review
            UPDATE temp_integrations_scraped_data 
            SET status = 'conflict_review' 
            WHERE id = record_data.id;

conflict_count := conflict_count + 1;

ELSE
            -- No conflict, mark as pending for processing
            UPDATE temp_integrations_scraped_data 
            SET status = 'pending' 
            WHERE id = record_data.id;

END IF;

END LOOP;

RETURN QUERY SELECT processed_count, conflict_count;

END;

$$;

END;

$$;

existing_product RECORD;

price_diff_percent NUMERIC;

conflict_reason TEXT;

reviews_count INTEGER := 0;

conflicts_count INTEGER := 0;

BEGIN
    -- Detect conflicts in temp_competitors_scraped_data
    IF p_source_table = 'temp_competitors_scraped_data' THEN
        FOR conflict_record IN
            SELECT t.id, t.user_id, t.ean, t.name, t.sku, t.brand, t.competitor_price,
                   -- Check for multiple EANs in same batch
                   (SELECT COUNT(*) FROM temp_competitors_scraped_data t2 
                    WHERE t2.ean = t.ean AND t2.user_id = t.user_id AND t2.ean IS NOT NULL 
                    AND (p_batch_ids IS NULL OR t2.id = ANY(p_batch_ids))) as ean_count_in_batch
            FROM temp_competitors_scraped_data t
            WHERE t.user_id = p_user_id 
              AND t.ean IS NOT NULL 
              AND t.ean != ''
              AND t.processed = false
              AND (p_batch_ids IS NULL OR t.id = ANY(p_batch_ids))
        LOOP
            conflicts_count := conflicts_count + 1;

-- Find existing product with same EAN
            SELECT p.id, p.name, p.sku, p.brand, p.our_retail_price
            INTO existing_product
            FROM products p
            WHERE p.user_id = p_user_id AND p.ean = conflict_record.ean
            LIMIT 1;

IF existing_product.id IS NOT NULL THEN
                conflict_reason := NULL;

price_diff_percent := NULL;

-- Check for multiple EANs in batch
                IF conflict_record.ean_count_in_batch > 1 THEN
                    conflict_reason := 'multiple_ean_in_batch';

END IF;

-- Check for large price difference (>50%)
                IF existing_product.our_retail_price IS NOT NULL AND conflict_record.competitor_price IS NOT NULL THEN
                    price_diff_percent := ABS(conflict_record.competitor_price - existing_product.our_retail_price) / existing_product.our_retail_price * 100;

IF price_diff_percent > 50 AND conflict_reason IS NULL THEN
                        conflict_reason := 'large_price_difference';

END IF;

END IF;

-- Check for name mismatch (very different names)
                IF conflict_reason IS NULL AND 
                   similarity(LOWER(conflict_record.name), LOWER(existing_product.name)) < 0.3 THEN
                    conflict_reason := 'name_mismatch';

END IF;

-- Create review record if conflict detected
                IF conflict_reason IS NOT NULL THEN
                    INSERT INTO product_match_reviews (
                        user_id, ean, existing_product_id, existing_product_name, 
                        existing_product_sku, existing_product_brand, existing_product_price,
                        new_product_name, new_product_sku, new_product_brand, new_product_price,
                        new_product_data, source_table, source_record_id, 
                        conflict_reason, price_difference_percent
                    ) VALUES (
                        p_user_id, conflict_record.ean, existing_product.id, existing_product.name,
                        existing_product.sku, existing_product.brand, existing_product.our_retail_price,
                        conflict_record.name, conflict_record.sku, conflict_record.brand, conflict_record.competitor_price,
                        row_to_json(conflict_record), p_source_table, conflict_record.id,
                        conflict_reason, price_diff_percent
                    );

reviews_count := reviews_count + 1;

-- Mark temp record as processed to prevent auto-matching
                    UPDATE temp_competitors_scraped_data 
                    SET processed = true 
                    WHERE id = conflict_record.id;

END IF;

END IF;

END LOOP;

END IF;

-- Similar logic for temp_suppliers_scraped_data
    IF p_source_table = 'temp_suppliers_scraped_data' THEN
        FOR conflict_record IN
            SELECT t.id, t.user_id, t.ean, t.name, t.sku, t.brand, t.supplier_price,
                   (SELECT COUNT(*) FROM temp_suppliers_scraped_data t2 
                    WHERE t2.ean = t.ean AND t2.user_id = t.user_id AND t2.ean IS NOT NULL 
                    AND (p_batch_ids IS NULL OR t2.id = ANY(p_batch_ids))) as ean_count_in_batch
            FROM temp_suppliers_scraped_data t
            WHERE t.user_id = p_user_id 
              AND t.ean IS NOT NULL 
              AND t.ean != ''
              AND t.processed = false
              AND (p_batch_ids IS NULL OR t.id = ANY(p_batch_ids))
        LOOP
            conflicts_count := conflicts_count + 1;

SELECT p.id, p.name, p.sku, p.brand, p.our_wholesale_price
            INTO existing_product
            FROM products p
            WHERE p.user_id = p_user_id AND p.ean = conflict_record.ean
            LIMIT 1;

IF existing_product.id IS NOT NULL THEN
                conflict_reason := NULL;

price_diff_percent := NULL;

IF conflict_record.ean_count_in_batch > 1 THEN
                    conflict_reason := 'multiple_ean_in_batch';

END IF;

IF existing_product.our_wholesale_price IS NOT NULL AND conflict_record.supplier_price IS NOT NULL THEN
                    price_diff_percent := ABS(conflict_record.supplier_price - existing_product.our_wholesale_price) / existing_product.our_wholesale_price * 100;

IF price_diff_percent > 50 AND conflict_reason IS NULL THEN
                        conflict_reason := 'large_price_difference';

END IF;

END IF;

IF conflict_reason IS NULL AND 
                   similarity(LOWER(conflict_record.name), LOWER(existing_product.name)) < 0.3 THEN
                    conflict_reason := 'name_mismatch';

END IF;

IF conflict_reason IS NOT NULL THEN
                    INSERT INTO product_match_reviews (
                        user_id, ean, existing_product_id, existing_product_name, 
                        existing_product_sku, existing_product_brand, existing_product_price,
                        new_product_name, new_product_sku, new_product_brand, new_product_price,
                        new_product_data, source_table, source_record_id, 
                        conflict_reason, price_difference_percent
                    ) VALUES (
                        p_user_id, conflict_record.ean, existing_product.id, existing_product.name,
                        existing_product.sku, existing_product.brand, existing_product.our_wholesale_price,
                        conflict_record.name, conflict_record.sku, conflict_record.brand, conflict_record.supplier_price,
                        row_to_json(conflict_record), p_source_table, conflict_record.id,
                        conflict_reason, price_diff_percent
                    );

reviews_count := reviews_count + 1;

UPDATE temp_suppliers_scraped_data 
                    SET processed = true 
                    WHERE id = conflict_record.id;

END IF;

END IF;

END LOOP;

END IF;

-- Logic for temp_integrations_scraped_data - FIXED to include integration_pending status
    IF p_source_table = 'temp_integrations_scraped_data' THEN
        FOR conflict_record IN
            SELECT t.id, t.user_id, t.ean, t.name, t.sku, t.brand, t.our_retail_price,
                   (SELECT COUNT(*) FROM temp_integrations_scraped_data t2 
                    WHERE t2.ean = t.ean AND t2.user_id = t.user_id AND t2.ean IS NOT NULL 
                    AND (p_batch_ids IS NULL OR t2.id = ANY(p_batch_ids))) as ean_count_in_batch
            FROM temp_integrations_scraped_data t
            WHERE t.user_id = p_user_id 
              AND t.ean IS NOT NULL 
              AND t.ean != ''
              AND (t.status = 'pending' OR t.status = 'conflict_check' OR t.status = 'integration_pending')
              AND (p_batch_ids IS NULL OR t.id = ANY(p_batch_ids))
        LOOP
            conflicts_count := conflicts_count + 1;

SELECT p.id, p.name, p.sku, p.brand, p.our_retail_price
            INTO existing_product
            FROM products p
            WHERE p.user_id = p_user_id AND p.ean = conflict_record.ean
            LIMIT 1;

-- ALWAYS check for multiple EANs in batch, even if no existing product
            conflict_reason := NULL;

price_diff_percent := NULL;

IF conflict_record.ean_count_in_batch > 1 THEN
                conflict_reason := 'multiple_ean_in_batch';

END IF;

-- Only check price/name conflicts if there's an existing product
            IF existing_product.id IS NOT NULL THEN
                IF existing_product.our_retail_price IS NOT NULL AND conflict_record.our_retail_price IS NOT NULL THEN
                    price_diff_percent := ABS(conflict_record.our_retail_price - existing_product.our_retail_price) / existing_product.our_retail_price * 100;

IF price_diff_percent > 50 AND conflict_reason IS NULL THEN
                        conflict_reason := 'large_price_difference';

END IF;

END IF;

IF conflict_reason IS NULL AND 
                   similarity(LOWER(conflict_record.name), LOWER(existing_product.name)) < 0.3 THEN
                    conflict_reason := 'name_mismatch';

END IF;

END IF;

IF conflict_reason IS NOT NULL THEN
                INSERT INTO product_match_reviews (
                    user_id, ean, existing_product_id, existing_product_name, 
                    existing_product_sku, existing_product_brand, existing_product_price,
                    new_product_name, new_product_sku, new_product_brand, new_product_price,
                    new_product_data, source_table, source_record_id, 
                    conflict_reason, price_difference_percent
                ) VALUES (
                    p_user_id, conflict_record.ean, existing_product.id, existing_product.name,
                    existing_product.sku, existing_product.brand, existing_product.our_retail_price,
                    conflict_record.name, conflict_record.sku, conflict_record.brand, conflict_record.our_retail_price,
                    row_to_json(conflict_record), p_source_table, conflict_record.id,
                    conflict_reason, price_diff_percent
                );

reviews_count := reviews_count + 1;

UPDATE temp_integrations_scraped_data 
                SET status = 'conflict_review' 
                WHERE id = conflict_record.id;

END IF;

END LOOP;

END IF;

RETURN QUERY SELECT conflicts_count, reviews_count;

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

normalized_url TEXT;

BEGIN
    IF p_url IS NULL OR p_url = '' THEN
        RETURN NULL;

END IF;

normalized_url := normalize_url(p_url);

-- Try exact match first
    IF p_source_type IN ('our', 'any') THEN
        SELECT id INTO v_product_id
        FROM products
        WHERE user_id = p_user_id
          AND normalize_url(our_url) = normalized_url
        LIMIT 1;

IF v_product_id IS NOT NULL THEN
            RETURN v_product_id;

END IF;

END IF;

-- Try competitor price changes
    IF p_source_type IN ('competitor', 'any') THEN
        SELECT DISTINCT product_id INTO v_product_id
        FROM price_changes_competitors
        WHERE user_id = p_user_id
          AND (normalize_url(competitor_url) = normalized_url OR normalize_url(our_url) = normalized_url)
        LIMIT 1;

IF v_product_id IS NOT NULL THEN
            RETURN v_product_id;

END IF;

END IF;

-- Try supplier price changes
    IF p_source_type IN ('supplier', 'any') THEN
        SELECT DISTINCT product_id INTO v_product_id
        FROM price_changes_suppliers
        WHERE user_id = p_user_id
          AND (normalize_url(supplier_url) = normalized_url OR normalize_url(our_url) = normalized_url)
        LIMIT 1;

IF v_product_id IS NOT NULL THEN
            RETURN v_product_id;

END IF;

END IF;

RETURN NULL;

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
        SELECT SUM(brand_sales.total_revenue) as grand_total_revenue FROM brand_sales
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

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    RETURN QUERY
    WITH product_sales AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            p.image_url,
            SUM(ABS(sc.stock_change_quantity)) as total_sold,
            MAX(sc.changed_at) as last_sale_date,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_days,
            -- Get the most recent competitor URL
            (SELECT sc2.competitor_url 
             FROM stock_changes_competitors sc2 
             WHERE sc2.product_id = p.id 
               AND sc2.user_id = p_user_id
               AND (p_competitor_id IS NULL OR sc2.competitor_id = p_competitor_id)
               AND sc2.competitor_url IS NOT NULL
             ORDER BY sc2.changed_at DESC 
             LIMIT 1) as competitor_url
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        WHERE sc.user_id = p_user_id
          AND p.brand = p_brand_name
          AND sc.stock_change_quantity < 0
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        GROUP BY p.id, p.name, p.brand, p.sku, p.image_url
    ),
    products_with_prices AS (
        SELECT 
            ps.*,
            -- Get the most recent price for revenue calculation
            COALESCE((
                SELECT pc.new_competitor_price
                FROM price_changes_competitors pc
                WHERE pc.product_id = ps.id 
                  AND pc.user_id = p_user_id
                  AND pc.changed_at <= date_filter_end
                  AND (p_competitor_id IS NULL OR pc.competitor_id = p_competitor_id)
                  AND pc.new_competitor_price IS NOT NULL
                  AND pc.new_competitor_price > 0
                ORDER BY pc.changed_at DESC
                LIMIT 1
            ), 0) as current_price
        FROM product_sales ps
    )
    SELECT 
        pwp.id as product_id,
        pwp.name as product_name,
        pwp.brand,
        pwp.sku,
        pwp.total_sold,
        pwp.total_sold * pwp.current_price as total_revenue,
        pwp.total_sold::NUMERIC / NULLIF(pwp.active_days, 0) as avg_daily_sales,
        (pwp.total_sold * pwp.current_price) / NULLIF(pwp.active_days, 0) as avg_daily_revenue,
        pwp.current_price,
        pwp.image_url,
        COALESCE(pwp.competitor_url, '') as competitor_url,
        pwp.last_sale_date
    FROM products_with_prices pwp
    WHERE pwp.total_sold > 0
    ORDER BY pwp.total_sold DESC;

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
            SELECT COALESCE(SUM(ABS(sc.stock_change_quantity) * pc_latest.new_competitor_price), 0)
            FROM stock_changes_competitors sc
            LEFT JOIN LATERAL (
                SELECT new_competitor_price
                FROM price_changes_competitors pc2
                WHERE pc2.product_id = sc.product_id
                  AND pc2.user_id = p_user_id
                  AND pc2.changed_at <= sc.changed_at
                  AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
                ORDER BY pc2.changed_at DESC
                LIMIT 1
            ) pc_latest ON true
            WHERE sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND sc.changed_at >= date_filter_start
              AND sc.changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
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
            SELECT COALESCE(SUM(cs.new_stock_quantity * pc_latest.new_competitor_price), 0)
            FROM current_stock cs
            LEFT JOIN LATERAL (
                SELECT new_competitor_price
                FROM price_changes_competitors pc2
                WHERE pc2.product_id = cs.product_id 
                  AND pc2.user_id = p_user_id
                  AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
                ORDER BY pc2.changed_at DESC
                LIMIT 1
            ) pc_latest ON true
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

END;

$$;

END;

$$;

END;

$$;

_limit integer;

_sort_direction text;

_total_count integer;

_result json;

_safe_sort_by text;

_order_clause text;

_products_data json;

_brand_uuid uuid;

BEGIN
    -- Calculate offset and limit
    _offset := (p_page - 1) * p_page_size;

_limit := p_page_size;

-- Validate and set sort direction
    _sort_direction := CASE 
        WHEN LOWER(p_sort_order) = 'asc' THEN 'ASC'
        ELSE 'DESC'
    END;

-- Validate sort column and set safe sort by
    _safe_sort_by := CASE 
        WHEN p_sort_by IN ('name', 'sku', 'ean', 'created_at', 'updated_at', 'our_retail_price') THEN p_sort_by
        ELSE 'created_at'
    END;

-- Build order clause
    _order_clause := format('ORDER BY p.%I %s', _safe_sort_by, _sort_direction);

-- Try to convert brand to UUID if it looks like one, otherwise keep as text for name search
    BEGIN
        _brand_uuid := p_brand::uuid;

EXCEPTION WHEN invalid_text_representation THEN
        _brand_uuid := NULL;

END;

-- Get total count using a CTE approach
    WITH product_stock AS (
        SELECT 
            p.id as product_id,
            COALESCE(MAX(sc.new_stock_quantity), 0) as max_stock_quantity,
            BOOL_OR(sc.new_stock_status = 'in_stock' OR sc.new_stock_quantity > 0) as has_stock
        FROM products p
        LEFT JOIN stock_changes_competitors sc ON sc.product_id = p.id 
            AND sc.user_id = p_user_id
            AND sc.new_stock_quantity IS NOT NULL
            AND sc.changed_at = (
                SELECT MAX(sc2.changed_at) 
                FROM stock_changes_competitors sc2 
                WHERE sc2.product_id = p.id 
                AND sc2.user_id = p_user_id
                AND sc2.new_stock_quantity IS NOT NULL
                AND COALESCE(sc2.competitor_id, sc2.integration_id) = COALESCE(sc.competitor_id, sc.integration_id)
            )
        WHERE p.user_id = p_user_id
        GROUP BY p.id
    ),
    filtered_products AS (
        SELECT p.id
        FROM products p 
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN product_stock ps ON p.id = ps.product_id
        WHERE p.user_id = p_user_id
        AND (
            p_brand IS NULL OR 
            (_brand_uuid IS NOT NULL AND p.brand_id = _brand_uuid) OR
            (_brand_uuid IS NULL AND b.name ILIKE '%' || p_brand || '%')
        )
        AND (p_category IS NULL OR p.category ILIKE '%' || p_category || '%')
        AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%' OR p.ean ILIKE '%' || p_search || '%')
        AND (p_is_active IS NULL OR p.is_active = p_is_active)
        AND (p_competitor_ids IS NULL OR p.id IN (
            SELECT DISTINCT pcc.product_id
            FROM price_changes_competitors pcc
            WHERE pcc.user_id = p_user_id
            AND (pcc.competitor_id = ANY(p_competitor_ids) OR pcc.integration_id = ANY(p_competitor_ids))
        ))
        -- Add supplier filter
        AND (p_supplier_ids IS NULL OR p.id IN (
            SELECT DISTINCT pcs.product_id
            FROM price_changes_suppliers pcs
            WHERE pcs.user_id = p_user_id
            AND (pcs.supplier_id = ANY(p_supplier_ids) OR pcs.integration_id = ANY(p_supplier_ids))
        ))
        -- Updated price filter logic to handle both has_price and not_our_products
        AND (
            (p_has_price IS NULL AND p_not_our_products IS NULL) OR  -- No price filter
            (p_has_price = true AND p_not_our_products IS NULL AND p.our_retail_price IS NOT NULL) OR  -- Our products only
            (p_has_price IS NULL AND p_not_our_products = true AND p.our_retail_price IS NULL) OR  -- Not our products only
            (p_has_price = false AND p_not_our_products = false)  -- All products (both false)
        )
        -- Add stock filtering
        AND (p_in_stock_only IS NULL OR p_in_stock_only = false OR ps.has_stock = true)
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

-- Get the actual products data with all the complex joins and aggregations
    EXECUTE format('
        WITH product_stock AS (
            SELECT 
                p.id as product_id,
                COALESCE(MAX(sc.new_stock_quantity), 0) as max_stock_quantity,
                BOOL_OR(sc.new_stock_status = ''in_stock'' OR sc.new_stock_quantity > 0) as has_stock
            FROM products p
            LEFT JOIN stock_changes_competitors sc ON sc.product_id = p.id 
                AND sc.user_id = $1
                AND sc.new_stock_quantity IS NOT NULL
                AND sc.changed_at = (
                    SELECT MAX(sc2.changed_at) 
                    FROM stock_changes_competitors sc2 
                    WHERE sc2.product_id = p.id 
                    AND sc2.user_id = $1
                    AND sc2.new_stock_quantity IS NOT NULL
                    AND COALESCE(sc2.competitor_id, sc2.integration_id) = COALESCE(sc.competitor_id, sc.integration_id)
                )
            WHERE p.user_id = $1
            GROUP BY p.id
        ),
        products_with_prices AS (
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.ean,
                p.brand_id,
                p.category,
                p.our_retail_price,
                p.image_url,
                p.our_url,
                p.is_active,
                p.created_at,
                p.updated_at,
                b.name as brand_name,
                ps.has_stock,
                ps.max_stock_quantity as stock_quantity,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            ''competitor_id'', pcc.competitor_id,
                            ''integration_id'', pcc.integration_id,
                            ''competitor_name'', COALESCE(c.name, i.name),
                            ''competitor_price'', pcc.new_competitor_price,
                            ''competitor_url'', pcc.competitor_url,
                            ''changed_at'', pcc.changed_at
                        )
                    ) FILTER (WHERE pcc.id IS NOT NULL), 
                    ''[]''::json
                ) as competitor_prices
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN product_stock ps ON p.id = ps.product_id
            LEFT JOIN LATERAL (
                SELECT DISTINCT ON (COALESCE(pcc_inner.competitor_id, pcc_inner.integration_id)) 
                    pcc_inner.id,
                    pcc_inner.competitor_id,
                    pcc_inner.integration_id,
                    pcc_inner.new_competitor_price,
                    pcc_inner.competitor_url,
                    pcc_inner.changed_at
                FROM price_changes_competitors pcc_inner
                WHERE pcc_inner.product_id = p.id 
                AND pcc_inner.user_id = $1
                AND pcc_inner.new_competitor_price IS NOT NULL
                ORDER BY COALESCE(pcc_inner.competitor_id, pcc_inner.integration_id), pcc_inner.changed_at DESC
            ) pcc ON true
            LEFT JOIN competitors c ON pcc.competitor_id = c.id
            LEFT JOIN integrations i ON pcc.integration_id = i.id
            WHERE p.user_id = $1
            AND (
                $2 IS NULL OR 
                ($9 IS NOT NULL AND p.brand_id = $9) OR
                ($9 IS NULL AND b.name ILIKE ''%%'' || $2 || ''%%'')
            )
            AND ($3 IS NULL OR p.category ILIKE ''%%'' || $3 || ''%%'')
            AND ($4 IS NULL OR p.name ILIKE ''%%'' || $4 || ''%%'' OR p.sku ILIKE ''%%'' || $4 || ''%%'' OR p.ean ILIKE ''%%'' || $4 || ''%%'')
            AND ($5 IS NULL OR p.is_active = $5)
            AND ($6 IS NULL OR p.id IN (
                SELECT DISTINCT pcc.product_id
                FROM price_changes_competitors pcc
                WHERE pcc.user_id = $1
                AND (pcc.competitor_id = ANY($6) OR pcc.integration_id = ANY($6))
            ))
            -- Add supplier filter
            AND ($13 IS NULL OR p.id IN (
                SELECT DISTINCT pcs.product_id
                FROM price_changes_suppliers pcs
                WHERE pcs.user_id = $1
                AND (pcs.supplier_id = ANY($13) OR pcs.integration_id = ANY($13))
            ))
            -- Updated price filter logic to handle both has_price and not_our_products
            AND (
                ($7 IS NULL AND $12 IS NULL) OR  -- No price filter
                ($7 = true AND $12 IS NULL AND p.our_retail_price IS NOT NULL) OR  -- Our products only
                ($7 IS NULL AND $12 = true AND p.our_retail_price IS NULL) OR  -- Not our products only
                ($7 = false AND $12 = false)  -- All products (both false)
            )
            AND ($8 IS NULL OR $8 = false OR ps.has_stock = true)
            GROUP BY p.id, p.name, p.sku, p.ean, p.brand_id, p.category, p.our_retail_price, p.image_url, p.our_url, p.is_active, p.created_at, p.updated_at, b.name, ps.has_stock, ps.max_stock_quantity
            %s
            LIMIT $10 OFFSET $11
        )
        SELECT COALESCE(json_agg(
            json_build_object(
                ''id'', pwp.id,
                ''name'', pwp.name,
                ''sku'', pwp.sku,
                ''ean'', pwp.ean,
                ''brand_id'', pwp.brand_id,
                ''brand_name'', pwp.brand_name,
                ''category'', pwp.category,
                ''our_retail_price'', pwp.our_retail_price,
                ''image_url'', pwp.image_url,
                ''our_url'', pwp.our_url,
                ''is_active'', pwp.is_active,
                ''created_at'', pwp.created_at,
                ''updated_at'', pwp.updated_at,
                ''competitor_prices'', pwp.competitor_prices,
                ''has_stock'', pwp.has_stock,
                ''stock_quantity'', pwp.stock_quantity
            )
        ), ''[]''::json) FROM products_with_prices pwp
    ', _order_clause)
    INTO _products_data
    USING p_user_id, p_brand, p_category, p_search, p_is_active, p_competitor_ids, p_has_price, p_in_stock_only, _brand_uuid, _limit, _offset, p_not_our_products, p_supplier_ids;

-- Build the final result
    _result := json_build_object(
        'data', COALESCE(_products_data, '[]'::json),
        'totalCount', _total_count
    );

RETURN _result;

END;

$_$;

date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());

BEGIN
    RETURN QUERY
    WITH sales_data AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            SUM(ABS(sc.stock_change_quantity))::NUMERIC as total_sold,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_days
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0  -- Only sales (decreases)
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
          AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
        GROUP BY p.id, p.name, p.brand, p.sku
    ),
    sales_with_prices AS (
        SELECT 
            sd.*,
            -- Get the most recent price available at or before the end of the sales period
            COALESCE((
                SELECT pc.new_competitor_price
                FROM price_changes_competitors pc
                WHERE pc.product_id = sd.id 
                  AND pc.user_id = p_user_id
                  AND pc.changed_at <= date_filter_end
                  AND (p_competitor_id IS NULL OR pc.competitor_id = p_competitor_id)
                  AND pc.new_competitor_price IS NOT NULL
                  AND pc.new_competitor_price > 0
                ORDER BY pc.changed_at DESC
                LIMIT 1
            ), 0) as avg_price,
            -- Get current price (most recent price for this product)
            COALESCE((
                SELECT pc_current.new_competitor_price
                FROM price_changes_competitors pc_current
                WHERE pc_current.product_id = sd.id 
                  AND pc_current.user_id = p_user_id
                  AND (p_competitor_id IS NULL OR pc_current.competitor_id = p_competitor_id)
                  AND pc_current.new_competitor_price IS NOT NULL
                  AND pc_current.new_competitor_price > 0
                ORDER BY pc_current.changed_at DESC
                LIMIT 1
            ), 0) as current_price
        FROM sales_data sd
    ),
    sales_with_revenue AS (
        SELECT 
            swp.*,
            swp.total_sold * swp.avg_price as total_revenue
        FROM sales_with_prices swp
    ),
    totals AS (
        SELECT 
            SUM(swr.total_revenue) as grand_total_revenue
        FROM sales_with_revenue swr
    )
    SELECT 
        swr.id as product_id,
        swr.name as product_name,
        swr.brand,
        swr.sku,
        swr.total_sold,
        swr.avg_price,
        swr.total_revenue,
        swr.active_days,
        CASE 
            WHEN t.grand_total_revenue > 0 THEN (swr.total_revenue / t.grand_total_revenue * 100)
            ELSE 0 
        END as revenue_percentage,
        CASE 
            WHEN swr.active_days > 0 THEN (swr.total_sold / swr.active_days)
            ELSE 0 
        END as avg_daily_sales,
        CASE 
            WHEN swr.active_days > 0 THEN (swr.total_revenue / swr.active_days)
            ELSE 0 
        END as avg_daily_revenue,
        swr.current_price,
        swr.active_days as days_tracked
    FROM sales_with_revenue swr
    CROSS JOIN totals t
    WHERE swr.total_sold > 0  -- Only include products with actual sales
    ORDER BY swr.total_sold DESC;

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

BEGIN
    -- Get user's primary currency from user_settings
    SELECT primary_currency INTO user_currency
    FROM user_settings
    WHERE user_id = p_user_id;

-- Return user's currency or default to SEK if not set
    RETURN COALESCE(user_currency, 'SEK');

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
        our_url = CASE 
            WHEN duplicate_record.our_url IS NOT NULL AND LENGTH(TRIM(duplicate_record.our_url)) > 0 
            THEN duplicate_record.our_url 
            ELSE primary_record.our_url 
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

END IF;

-- Remove spaces, hyphens, equals signs and similar separators
    -- Keep only letters and numbers, convert to lowercase
    RETURN lower(regexp_replace(input_sku, '[^a-zA-Z0-9]', '', 'g'));

END;

$$;

END IF;

-- Remove trailing slash
    url_text := rtrim(url_text, '/');

-- Convert to lowercase for consistency
    url_text := lower(url_text);

-- Remove common tracking parameters
    url_text := regexp_replace(url_text, '[?&](utm_[^&]*|gclid=[^&]*|fbclid=[^&]*)', '', 'g');

-- Clean up any remaining ? or & at the end
    url_text := rtrim(url_text, '?&');

RETURN url_text;

END;

$$;

BEGIN
    -- Update price_changes_competitors
    UPDATE price_changes_competitors pc
    SET our_url = p.our_url
    FROM products p
    WHERE pc.product_id = p.id 
      AND pc.our_url IS NULL 
      AND p.our_url IS NOT NULL;

GET DIAGNOSTICS updated_count = ROW_COUNT;

RAISE NOTICE 'Updated % competitor price change records with our_url', updated_count;

-- Update price_changes_suppliers
    UPDATE price_changes_suppliers ps
    SET our_url = p.our_url
    FROM products p
    WHERE ps.product_id = p.id 
      AND ps.our_url IS NULL 
      AND p.our_url IS NOT NULL;

GET DIAGNOSTICS updated_count = ROW_COUNT;

RAISE NOTICE 'Updated % supplier price change records with our_url', updated_count;

-- Update stock_changes_competitors
    UPDATE stock_changes_competitors sc
    SET our_url = p.our_url
    FROM products p
    WHERE sc.product_id = p.id 
      AND sc.our_url IS NULL 
      AND p.our_url IS NOT NULL;

GET DIAGNOSTICS updated_count = ROW_COUNT;

RAISE NOTICE 'Updated % competitor stock change records with our_url', updated_count;

-- Update stock_changes_suppliers
    UPDATE stock_changes_suppliers ss
    SET our_url = p.our_url
    FROM products p
    WHERE ss.product_id = p.id 
      AND ss.our_url IS NULL 
      AND p.our_url IS NOT NULL;

GET DIAGNOSTICS updated_count = ROW_COUNT;

RAISE NOTICE 'Updated % supplier stock change records with our_url', updated_count;

RETURN updated_count;

END;

$$;

processed_count INTEGER := 0;

BEGIN
    FOR temp_record IN 
        SELECT * FROM temp_integrations_scraped_data WHERE status = 'pending'
    LOOP
        -- Simulate the trigger by calling the processing logic
        BEGIN
            -- Call the same logic as the trigger function but adapted for manual processing
            PERFORM process_single_temp_integration(temp_record);

processed_count := processed_count + 1;

EXCEPTION WHEN OTHERS THEN
            -- Mark record as error
            UPDATE temp_integrations_scraped_data 
            SET status = 'error', error_message = SQLERRM 
            WHERE id = temp_record.id;

END;

END LOOP;

RETURN processed_count;

END;

$$;

stage_start_time TIMESTAMP;

processing_deadline TIMESTAMP;

result_record RECORD;

competitor_record RECORD;

supplier_record RECORD;

integration_record RECORD;

BEGIN
    start_time := clock_timestamp();

processing_deadline := start_time + (max_processing_time_minutes || ' minutes')::INTERVAL;

RAISE NOTICE 'Starting import orchestration (batch size: %, max time: % minutes)', batch_size, max_processing_time_minutes;

-- Stage 1: Process Integrations First (our products)
    stage_start_time := clock_timestamp();

FOR integration_record IN 
        SELECT DISTINCT user_id, integration_id
        FROM temp_integrations_scraped_data
        ORDER BY user_id, integration_id
    LOOP
        -- Check time limit
        IF clock_timestamp() > processing_deadline THEN
            RAISE NOTICE 'Processing time limit reached, stopping';

EXIT;

END IF;

-- Process integration batch (function to be created)
        SELECT * INTO result_record 
        FROM process_temp_integrations_batch(integration_record.integration_id, batch_size);

RETURN QUERY SELECT 
            'integrations'::TEXT,
            'temp_integrations_scraped_data'::TEXT,
            result_record.processed,
            result_record.errors,
            result_record.new_products,
            result_record.price_changes,
            EXTRACT(EPOCH FROM (clock_timestamp() - stage_start_time)) * 1000;

END LOOP;

-- Stage 2: Process Competitors (external products)
    stage_start_time := clock_timestamp();

FOR competitor_record IN 
        SELECT DISTINCT user_id, competitor_id
        FROM temp_competitors_scraped_data
        ORDER BY user_id, competitor_id
    LOOP
        -- Check time limit
        IF clock_timestamp() > processing_deadline THEN
            RAISE NOTICE 'Processing time limit reached, stopping';

EXIT;

END IF;

-- Process competitor batch
        SELECT * INTO result_record 
        FROM process_temp_competitors_batch(competitor_record.competitor_id, batch_size);

RETURN QUERY SELECT 
            'competitors'::TEXT,
            'temp_competitors_scraped_data'::TEXT,
            result_record.processed,
            result_record.errors,
            result_record.new_products,
            result_record.price_changes,
            EXTRACT(EPOCH FROM (clock_timestamp() - stage_start_time)) * 1000;

END LOOP;

-- Stage 3: Process Suppliers (wholesale products)
    stage_start_time := clock_timestamp();

FOR supplier_record IN 
        SELECT DISTINCT user_id, supplier_id
        FROM temp_suppliers_scraped_data
        WHERE supplier_id IS NOT NULL
        ORDER BY user_id, supplier_id
    LOOP
        -- Check time limit
        IF clock_timestamp() > processing_deadline THEN
            RAISE NOTICE 'Processing time limit reached, stopping';

EXIT;

END IF;

-- Process supplier batch
        SELECT * INTO result_record 
        FROM process_temp_suppliers_batch(supplier_record.supplier_id, batch_size);

RETURN QUERY SELECT 
            'suppliers'::TEXT,
            'temp_suppliers_scraped_data'::TEXT,
            result_record.processed,
            result_record.errors,
            result_record.new_products,
            result_record.price_changes,
            EXTRACT(EPOCH FROM (clock_timestamp() - stage_start_time)) * 1000;

END LOOP;

-- Stage 4: Sync URL cross-references
    stage_start_time := clock_timestamp();

PERFORM sync_our_urls_from_products();

RETURN QUERY SELECT 
        'url_sync'::TEXT,
        'all_tables'::TEXT,
        0, 0, 0, 0,
        EXTRACT(EPOCH FROM (clock_timestamp() - stage_start_time)) * 1000;

RAISE NOTICE 'Import orchestration complete! Total time: %.2f ms', 
                 EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;

END;

$$;

field_value TEXT;

processed_count INTEGER := 0;

v_custom_field_id UUID;

v_field_type TEXT;

auto_create_enabled BOOLEAN := TRUE; -- Default to enabled
BEGIN
    -- Early return if no data
    IF p_raw_data IS NULL OR p_raw_data = '{}' THEN
        RETURN 0;

END IF;

-- Process each field in the raw data
    FOR field_record IN 
        SELECT key, value 
        FROM jsonb_each_text(p_raw_data)
        WHERE value IS NOT NULL AND value != ''
    LOOP
        -- Check if this field is already configured for the user
        SELECT id INTO v_custom_field_id
        FROM product_custom_fields
        WHERE user_id = p_user_id 
          AND field_name = field_record.key
        LIMIT 1;

-- Auto-create field if it doesn't exist and auto-creation is enabled
        IF v_custom_field_id IS NULL AND auto_create_enabled THEN
            -- Detect field type based on value
            v_field_type := detect_custom_field_type(field_record.value);

-- Create the custom field
            INSERT INTO product_custom_fields (
                user_id, 
                field_name, 
                field_type, 
                is_required, 
                default_value,
                allow_auto_update,
                created_at
            ) VALUES (
                p_user_id,
                field_record.key,
                v_field_type,
                false, -- Auto-created fields are not required by default
                null,
                true, -- Allow auto-updates for scraped fields
                NOW()
            ) RETURNING id INTO v_custom_field_id;

RAISE NOTICE 'Auto-created custom field: % (type: %)', field_record.key, v_field_type;

END IF;

-- Process the field if we have a custom_field_id (either existing or newly created)
        IF v_custom_field_id IS NOT NULL THEN
            field_value := field_record.value;

-- Use the optimized storage function with deduplication
            PERFORM store_custom_field_optimized(
                p_product_id,
                v_custom_field_id,
                field_record.key,
                field_value,
                p_source_type,
                p_source_id
            );

processed_count := processed_count + 1;

END IF;

END LOOP;

RETURN processed_count;

END;

$$;

field_value TEXT;

processed_count INTEGER := 0;

v_custom_field_id UUID;

BEGIN
    -- Early return if no data
    IF p_raw_data IS NULL OR p_raw_data = '{}' THEN
        RETURN 0;

END IF;

-- Process each field in the raw data
    FOR field_record IN 
        SELECT key, value 
        FROM jsonb_each_text(p_raw_data)
        WHERE value IS NOT NULL AND value != ''
    LOOP
        -- Check if this field is configured for the user
        SELECT id INTO v_custom_field_id
        FROM user_custom_fields
        WHERE user_id = p_user_id 
          AND field_name = field_record.key
        LIMIT 1;

-- Only process if field is configured
        IF v_custom_field_id IS NOT NULL THEN
            field_value := field_record.value;

-- Use the optimized storage function
            PERFORM store_custom_field_optimized(
                p_product_id,
                v_custom_field_id,
                field_record.key,
                field_value,
                p_source_type,
                p_source_id
            );

processed_count := processed_count + 1;

END IF;

END LOOP;

RETURN processed_count;

END;

$$;

BEGIN
    -- Call the new function with conflict detection
    SELECT * INTO result_record
    FROM process_temp_competitors_batch_with_conflict_detection(p_competitor_id, batch_size);

-- Return only the original 4 columns for backward compatibility
    RETURN QUERY 
    SELECT result_record.processed, result_record.errors, result_record.new_products, result_record.price_changes;

END;

$$;

total_processed INTEGER := 0;

total_errors INTEGER := 0;

total_new_products INTEGER := 0;

total_price_changes INTEGER := 0;

total_conflicts INTEGER := 0;

total_reviews INTEGER := 0;

matched_product_id UUID;

v_brand_id UUID;

current_competitor_price NUMERIC(10,2);

current_stock_quantity INTEGER;

current_stock_status TEXT;

current_availability_date DATE;

standardized_status TEXT;

start_time TIMESTAMP;

batch_ids UUID[];

first_user_id UUID;

custom_fields_processed INTEGER;

old_category TEXT;

new_category TEXT;

BEGIN
    start_time := clock_timestamp();

RAISE NOTICE 'Starting batch processing with improved stock logic for competitor % (batch size: %)', p_competitor_id, batch_size;

-- Get batch IDs (FIX: qualify the processed column)
    SELECT array_agg(subq.id ORDER BY subq.scraped_at) INTO batch_ids
    FROM (
        SELECT t.id, t.scraped_at
        FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    ) subq;

-- Skip if no records
    IF array_length(batch_ids, 1) IS NULL OR array_length(batch_ids, 1) = 0 THEN
        RAISE NOTICE 'No records to process';

RETURN QUERY SELECT 0, 0, 0, 0, 0, 0;

RETURN;

END IF;

-- Get user_id from first record
    SELECT t.user_id INTO first_user_id
    FROM temp_competitors_scraped_data t
    WHERE t.id = batch_ids[1];

total_conflicts := 0;

total_reviews := 0;

RAISE NOTICE 'Processing % records with improved stock change detection', array_length(batch_ids, 1);

-- Process records (FIX: qualify the processed column)
    FOR temp_record IN 
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            -- STEP 1: Brand lookup using the proper function that respects aliases
            v_brand_id := NULL;

IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                -- Use the find_or_create_brand function that properly checks aliases
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;

END IF;

-- STEP 2: Product matching using resolved brand_id
            matched_product_id := NULL;

-- Try EAN match first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;

END IF;

-- Try brand_id + SKU match (using resolved brand_id)
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND brand_id = v_brand_id  -- Use resolved brand_id
                  AND normalize_sku_for_matching(sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;

END IF;

-- Fuzzy matching as last resort
            IF matched_product_id IS NULL THEN
                SELECT find_product_with_fuzzy_matching(
                    temp_record.user_id,
                    temp_record.ean,
                    temp_record.brand,
                    temp_record.sku,
                    temp_record.name,
                    v_brand_id
                ) INTO matched_product_id;

END IF;

-- Create new product if no match
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, image_url, currency_code
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id, temp_record.image_url, 
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                ) RETURNING id INTO matched_product_id;

total_new_products := total_new_products + 1;

END IF;

-- Process custom fields
            IF matched_product_id IS NOT NULL AND temp_record.raw_data IS NOT NULL THEN
                SELECT process_custom_fields_from_raw_data(
                    temp_record.user_id,
                    matched_product_id,
                    temp_record.raw_data,
                    'competitor',
                    temp_record.competitor_id
                ) INTO custom_fields_processed;

END IF;

-- Price change detection
            SELECT new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND competitor_id = temp_record.competitor_id
            ORDER BY changed_at DESC
            LIMIT 1;

-- Only insert if price actually changed
            IF current_competitor_price IS NULL OR ABS(current_competitor_price - temp_record.competitor_price) > 0.01 THEN
                INSERT INTO price_changes_competitors (
                    user_id, product_id, competitor_id, old_competitor_price, new_competitor_price,
                    changed_at, competitor_url, currency_code
                ) VALUES (
                    temp_record.user_id, matched_product_id, temp_record.competitor_id,
                    current_competitor_price, temp_record.competitor_price, NOW(),
                    temp_record.competitor_url, 
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                );

total_price_changes := total_price_changes + 1;

END IF;

-- IMPROVED Stock processing - only record meaningful changes
            IF temp_record.stock_quantity IS NOT NULL OR temp_record.stock_status IS NOT NULL THEN
                SELECT new_stock_quantity, new_stock_status, new_availability_date
                INTO current_stock_quantity, current_stock_status, current_availability_date
                FROM stock_changes_competitors
                WHERE user_id = temp_record.user_id
                  AND product_id = matched_product_id
                  AND competitor_id = temp_record.competitor_id
                ORDER BY changed_at DESC
                LIMIT 1;

standardized_status := standardize_stock_status(temp_record.stock_status);

-- Map statuses to major business categories
                old_category := CASE 
                    WHEN current_stock_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN current_stock_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN current_stock_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;

new_category := CASE 
                    WHEN standardized_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN standardized_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN standardized_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;

-- Only record stock changes if:
                -- 1) Stock quantity changed (always important)
                -- 2) First record for this product/competitor (current_stock_status IS NULL)
                -- 3) Major status category changed (available <-> unavailable <-> pre_order)
                IF (current_stock_quantity IS DISTINCT FROM temp_record.stock_quantity) OR 
                   (current_stock_status IS NULL) OR 
                   (old_category IS DISTINCT FROM new_category) THEN
                    
                    INSERT INTO stock_changes_competitors (
                        user_id, product_id, competitor_id,
                        old_stock_quantity, new_stock_quantity,
                        old_stock_status, new_stock_status,
                        old_availability_date, new_availability_date,
                        stock_change_quantity, changed_at, raw_stock_data,
                        competitor_url
                    ) VALUES (
                        temp_record.user_id, matched_product_id, temp_record.competitor_id,
                        current_stock_quantity, temp_record.stock_quantity,
                        current_stock_status, standardized_status,
                        current_availability_date, temp_record.availability_date,
                        COALESCE(temp_record.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                        NOW(), temp_record.raw_stock_data,
                        temp_record.competitor_url
                    );

RAISE NOTICE 'Stock change recorded: % -> % (category: % -> %)', 
                        current_stock_status, standardized_status, old_category, new_category;

END IF;

END IF;

-- Mark as processed and delete (FIX: qualify the processed column)
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;

DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;

total_processed := total_processed + 1;

IF total_processed % 50 = 0 THEN
                RAISE NOTICE 'Processed % records (%.2f ms avg per record)', 
                    total_processed, 
                    EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000 / total_processed;

END IF;

EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;

RAISE WARNING 'Error processing record % (SKU: %, Brand: %): %', 
                temp_record.id, temp_record.sku, temp_record.brand, SQLERRM;

UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;

DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;

END;

END LOOP;

RAISE NOTICE 'Batch complete! Processed: %, Errors: %, New products: %, Price changes: %, Total time: %.2f ms', 
                 total_processed, total_errors, total_new_products, total_price_changes,
                 EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;

RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_conflicts, total_reviews;

END;

$$;

RETURN QUERY 
    SELECT * FROM process_temp_competitors_batch_with_conflict_detection(NULL, 500);

END;

$$;

END IF;

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
    -- CRITICAL: Only process records with status 'pending'
    -- Skip all other statuses: integration_pending, conflict_review, conflict_check, processed, error
    IF NEW.status IS NULL OR NEW.status != 'pending' THEN
        -- Log the skip for debugging
        RAISE NOTICE 'Skipping processing for record % with status: %', NEW.id, COALESCE(NEW.status, 'NULL');

RETURN NEW;

END IF;

-- Log that we are processing this record
    RAISE NOTICE 'Processing record % with status: %', NEW.id, NEW.status;

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

-- Round integration prices to whole numbers (no decimals) - CONSISTENT ACROSS ALL PRICE TYPES
    rounded_retail_price := CASE WHEN NEW.our_retail_price IS NOT NULL THEN ROUND(NEW.our_retail_price) ELSE NULL END;

rounded_wholesale_price := CASE WHEN NEW.our_wholesale_price IS NOT NULL THEN ROUND(NEW.our_wholesale_price) ELSE NULL END;

-- STEP 1: Find or create brand using the proper function that respects aliases
    v_brand_id := NULL;

IF NEW.brand IS NOT NULL AND NEW.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        -- Use the find_or_create_brand function that properly checks aliases
        SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;

END IF;

-- STEP 2: Try to find existing product using RESOLVED brand_id for matching
    existing_product_id := NULL;

-- Try EAN match first (most reliable)
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
        SELECT id INTO existing_product_id FROM products 
        WHERE user_id = NEW.user_id AND ean = NEW.ean
        LIMIT 1;

END IF;

-- If no EAN match, try SKU + resolved brand_id match
    IF existing_product_id IS NULL AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL THEN
        SELECT id INTO existing_product_id FROM products 
        WHERE user_id = NEW.user_id 
          AND sku = NEW.sku 
          AND brand_id = v_brand_id  -- Use resolved brand_id instead of original brand text
        LIMIT 1;

END IF;

-- Get current prices for price change tracking - CONSISTENT RETRIEVAL
    IF existing_product_id IS NOT NULL THEN
        SELECT our_retail_price, our_wholesale_price 
        INTO current_retail_price, current_wholesale_price
        FROM products WHERE id = existing_product_id;

END IF;

IF existing_product_id IS NULL THEN
        -- Create new product with only fields that exist in products table
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
            our_url,
            currency_code
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
            NEW.our_url, -- ALWAYS populate our_url
            CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN NEW.currency_code ELSE NULL END
        ) RETURNING id INTO existing_product_id;

ELSE
        -- ALWAYS UPDATE ALL FIELDS for existing products (integration runs should update everything)
        UPDATE products SET
            name = CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN COALESCE(NEW.name, name) ELSE name END,
            sku = CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN COALESCE(NEW.sku, sku) ELSE sku END,
            ean = CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN COALESCE(NEW.ean, ean) ELSE ean END,
            brand = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(NEW.brand, brand) ELSE brand END,
            brand_id = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(v_brand_id, brand_id) ELSE brand_id END,
            our_retail_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE our_retail_price END,
            our_wholesale_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE our_wholesale_price END,
            image_url = CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN COALESCE(NEW.image_url, image_url) ELSE image_url END,
            our_url = COALESCE(NEW.our_url, our_url), -- ALWAYS update our_url
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(NEW.currency_code, currency_code) ELSE currency_code END,
            updated_at = NOW()
        WHERE id = existing_product_id;

END IF;

-- Skip custom fields processing for now to avoid any potential issues
    -- IF (NOT selective_import_enabled OR field_config->>'raw_data' != 'false') AND NEW.raw_data IS NOT NULL THEN
    --     SELECT process_custom_fields(NEW.user_id, existing_product_id, NEW.raw_data) INTO custom_fields_result;

-- END IF;

-- ONLY RECORD RETAIL PRICE CHANGES WHEN PRICE ACTUALLY CHANGES
    -- FIXED: Use NULL for old price on first price records (consistent with competitor function)
    IF (NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false') AND
       rounded_retail_price IS NOT NULL AND
       (current_retail_price IS NULL OR current_retail_price != rounded_retail_price) THEN
        
        INSERT INTO price_changes_competitors (
            user_id,
            product_id,
            integration_id,
            competitor_id,
            old_competitor_price,
            new_competitor_price,
            old_our_retail_price,
            new_our_retail_price,
            price_change_percentage,
            changed_at,
            currency_code,
            our_url
        ) VALUES (
            NEW.user_id,
            existing_product_id,
            NEW.integration_id,
            NULL,
            NULL,
            NULL,
            current_retail_price, -- FIXED: Use NULL for first prices instead of COALESCE
            rounded_retail_price,
            CASE 
                WHEN current_retail_price IS NULL THEN 0
                WHEN current_retail_price = 0 THEN 0
                ELSE ROUND(((rounded_retail_price - current_retail_price) / current_retail_price * 100)::numeric, 2)
            END,
            NOW(),
            NEW.currency_code,
            NEW.our_url
        );

END IF;

-- ONLY RECORD WHOLESALE PRICE CHANGES WHEN PRICE ACTUALLY CHANGES
    -- FIXED: Use NULL for old price on first price records (consistent with competitor function)
    IF (NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false') AND
       rounded_wholesale_price IS NOT NULL AND
       (current_wholesale_price IS NULL OR current_wholesale_price != rounded_wholesale_price) THEN
        
        INSERT INTO price_changes_suppliers (
            user_id,
            product_id,
            integration_id,
            supplier_id,
            old_supplier_price,
            new_supplier_price,
            old_supplier_recommended_price,
            new_supplier_recommended_price,
            old_our_wholesale_price,
            new_our_wholesale_price,
            price_change_percentage,
            changed_at,
            currency_code,
            our_url
        ) VALUES (
            NEW.user_id,
            existing_product_id,
            NEW.integration_id,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            current_wholesale_price, -- FIXED: Use NULL for first prices instead of COALESCE
            rounded_wholesale_price,
            CASE 
                WHEN current_wholesale_price IS NULL THEN 0
                WHEN current_wholesale_price = 0 THEN 0
                ELSE ROUND(((rounded_wholesale_price - current_wholesale_price) / current_wholesale_price * 100)::numeric, 2)
            END,
            NOW(),
            NEW.currency_code,
            NEW.our_url
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

current_retail_price NUMERIC(10,2);

current_wholesale_price NUMERIC(10,2);

custom_fields_result JSONB;

rounded_retail_price NUMERIC(10,2);

rounded_wholesale_price NUMERIC(10,2);

integration_config JSONB;

selective_import_enabled BOOLEAN := FALSE;

field_config JSONB;

user_currency TEXT;

BEGIN
    -- Get user's primary currency
    user_currency := get_user_primary_currency(record_data.user_id);

-- Validate that the record has minimum required data
    IF (record_data.ean IS NULL OR record_data.ean = '') AND 
       (record_data.sku IS NULL OR record_data.sku = '' OR record_data.brand IS NULL OR record_data.brand = '') THEN
        -- Delete unprocessable records immediately
        DELETE FROM temp_integrations_scraped_data WHERE id = record_data.id;

RETURN;

END IF;

-- Get integration configuration
    SELECT configuration INTO integration_config
    FROM integrations 
    WHERE id = record_data.integration_id;

-- Check if selective import is enabled
    IF integration_config IS NOT NULL AND 
       integration_config->'selectiveImport'->>'enabled' = 'true' THEN
        selective_import_enabled := TRUE;

field_config := integration_config->'selectiveImport'->'fields';

END IF;

-- Round integration prices to whole numbers (no decimals)
    rounded_retail_price := CASE WHEN record_data.our_retail_price IS NOT NULL THEN ROUND(record_data.our_retail_price) ELSE NULL END;

rounded_wholesale_price := CASE WHEN record_data.our_wholesale_price IS NOT NULL THEN ROUND(record_data.our_wholesale_price) ELSE NULL END;

-- STEP 1: Find or create brand using the proper function that respects aliases
    v_brand_id := NULL;

IF record_data.brand IS NOT NULL AND record_data.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        -- Use the find_or_create_brand function that properly checks aliases
        SELECT find_or_create_brand(record_data.user_id, record_data.brand) INTO v_brand_id;

END IF;

-- STEP 2: Try to find existing product using RESOLVED brand_id for matching
    existing_product_id := NULL;

-- Try EAN match first (most reliable)
    IF record_data.ean IS NOT NULL AND record_data.ean != '' THEN
        SELECT id INTO existing_product_id FROM products 
        WHERE user_id = record_data.user_id AND ean = record_data.ean
        LIMIT 1;

END IF;

-- If no EAN match, try SKU + resolved brand_id match
    IF existing_product_id IS NULL AND record_data.sku IS NOT NULL AND record_data.sku != '' AND v_brand_id IS NOT NULL THEN
        SELECT id INTO existing_product_id FROM products 
        WHERE user_id = record_data.user_id 
          AND sku = record_data.sku 
          AND brand_id = v_brand_id  -- Use resolved brand_id instead of original brand text
        LIMIT 1;

END IF;

-- Get current prices for price change tracking
    IF existing_product_id IS NOT NULL THEN
        SELECT our_retail_price, our_wholesale_price 
        INTO current_retail_price, current_wholesale_price
        FROM products WHERE id = existing_product_id;

END IF;

IF existing_product_id IS NULL THEN
        -- Create new product
        INSERT INTO products (
            user_id, name, sku, ean, brand, brand_id, our_retail_price, our_wholesale_price,
            image_url, our_url, currency_code
        ) VALUES (
            record_data.user_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN record_data.name ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN record_data.sku ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN record_data.ean ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN record_data.brand ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN v_brand_id ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN record_data.image_url ELSE NULL END,
            record_data.our_url,
            CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(record_data.currency_code, user_currency) ELSE NULL END
        ) RETURNING id INTO existing_product_id;

ELSE
        -- Update existing product
        UPDATE products SET
            name = CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN COALESCE(record_data.name, name) ELSE name END,
            sku = CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN COALESCE(record_data.sku, sku) ELSE sku END,
            ean = CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN COALESCE(record_data.ean, ean) ELSE ean END,
            brand = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(record_data.brand, brand) ELSE brand END,
            brand_id = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(v_brand_id, brand_id) ELSE brand_id END,
            our_retail_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE our_retail_price END,
            our_wholesale_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE our_wholesale_price END,
            image_url = CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN COALESCE(record_data.image_url, image_url) ELSE image_url END,
            our_url = COALESCE(record_data.our_url, our_url),
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(record_data.currency_code, user_currency, currency_code) ELSE currency_code END,
            updated_at = NOW()
        WHERE id = existing_product_id;

END IF;

-- Record price changes only when prices actually change
    IF (NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false') AND
       rounded_retail_price IS NOT NULL AND
       (current_retail_price IS NULL OR current_retail_price != rounded_retail_price) THEN
        
        INSERT INTO price_changes_competitors (
            user_id, product_id, integration_id, competitor_id, old_competitor_price, new_competitor_price,
            old_our_retail_price, new_our_retail_price, price_change_percentage, changed_at, currency_code, our_url
        ) VALUES (
            record_data.user_id, existing_product_id, record_data.integration_id, NULL, NULL, NULL,
            current_retail_price, rounded_retail_price,
            CASE 
                WHEN current_retail_price IS NULL THEN 0
                WHEN current_retail_price = 0 THEN 0
                ELSE ROUND(((rounded_retail_price - current_retail_price) / current_retail_price * 100)::numeric, 2)
            END,
            NOW(), COALESCE(record_data.currency_code, user_currency), record_data.our_url
        );

END IF;

IF (NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false') AND
       rounded_wholesale_price IS NOT NULL AND
       (current_wholesale_price IS NULL OR current_wholesale_price != rounded_wholesale_price) THEN
        
        INSERT INTO price_changes_suppliers (
            user_id, product_id, integration_id, supplier_id, old_supplier_price, new_supplier_price,
            old_supplier_recommended_price, new_supplier_recommended_price, old_our_wholesale_price, 
            new_our_wholesale_price, price_change_percentage, changed_at, currency_code, our_url
        ) VALUES (
            record_data.user_id, existing_product_id, record_data.integration_id, NULL, NULL, NULL, NULL, NULL,
            current_wholesale_price, rounded_wholesale_price,
            CASE 
                WHEN current_wholesale_price IS NULL THEN 0
                WHEN current_wholesale_price = 0 THEN 0
                ELSE ROUND(((rounded_wholesale_price - current_wholesale_price) / current_wholesale_price * 100)::numeric, 2)
            END,
            NOW(), COALESCE(record_data.currency_code, user_currency), record_data.our_url
        );

END IF;

-- Mark as processed and delete
    UPDATE temp_integrations_scraped_data 
    SET status = 'processed', processed_at = NOW() 
    WHERE id = record_data.id;

DELETE FROM temp_integrations_scraped_data WHERE id = record_data.id;

END;

$$;

BEGIN
    -- Get the record
    SELECT * INTO record_data FROM temp_integrations_scraped_data WHERE id = p_record_id;

IF NOT FOUND THEN
        RAISE EXCEPTION 'Record with id % not found', p_record_id;

END IF;

-- Only process if status is 'pending'
    IF record_data.status != 'pending' THEN
        RAISE NOTICE 'Skipping record % with status %', p_record_id, record_data.status;

RETURN;

END IF;

-- Call the main processing function logic
    PERFORM process_temp_integrations_scraped_data_logic(record_data);

END;

$$;

total_processed INTEGER := 0;

total_errors INTEGER := 0;

total_new_products INTEGER := 0;

total_price_changes INTEGER := 0;

total_stock_changes INTEGER := 0;

matched_product_id UUID;

v_brand_id UUID;

current_wholesale_price NUMERIC(10,2);

current_stock_quantity INTEGER;

current_stock_status TEXT;

current_availability_date DATE;

standardized_status TEXT;

start_time TIMESTAMP;

old_category TEXT;

new_category TEXT;

last_supplier_price NUMERIC(10,2);

last_supplier_recommended_price NUMERIC(10,2);

custom_fields_result JSONB;

BEGIN
    start_time := clock_timestamp();

-- Debug: Log start of batch processing
    INSERT INTO debug_logs (message, created_at) VALUES 
        ('SUPPLIER_BATCH: Starting batch processing for supplier_id: ' || COALESCE(p_supplier_id::text, 'ALL') || ', batch_size: ' || batch_size, NOW());

-- Process records in batches
    FOR temp_record IN 
        SELECT * FROM temp_suppliers_scraped_data t
        WHERE (p_supplier_id IS NULL OR t.supplier_id = p_supplier_id)
          AND t.processed = false
        ORDER BY t.created_at
        LIMIT batch_size
    LOOP
        BEGIN
            -- Debug: Log processing start for each record
            INSERT INTO debug_logs (message, created_at) VALUES 
                ('SUPPLIER_BATCH: Processing record ' || temp_record.id || ' - Name: ' || COALESCE(temp_record.name, 'NULL') || ', SKU: ' || COALESCE(temp_record.sku, 'NULL') || ', Has raw_data: ' || (temp_record.raw_data IS NOT NULL)::text, NOW());

-- Validate that the record has minimum required data
            IF (temp_record.ean IS NULL OR temp_record.ean = '') AND 
               (temp_record.sku IS NULL OR temp_record.sku = '' OR temp_record.brand IS NULL OR temp_record.brand = '') THEN
                INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Validation failed for record ' || temp_record.id || ' - Missing EAN and SKU+Brand', NOW());

-- Delete unprocessable records immediately
                DELETE FROM temp_suppliers_scraped_data WHERE id = temp_record.id;

total_errors := total_errors + 1;

CONTINUE;

END IF;

INSERT INTO debug_logs (message, created_at) VALUES 
                ('SUPPLIER_BATCH: Validation passed for record ' || temp_record.id, NOW());

-- Find or create brand if we have brand name
            v_brand_id := NULL;

IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;

INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Brand ID for "' || temp_record.brand || '": ' || COALESCE(v_brand_id::text, 'NULL'), NOW());

END IF;

-- Use enhanced fuzzy matching to find existing product
            SELECT find_product_with_fuzzy_matching(
                temp_record.user_id,
                temp_record.ean,
                temp_record.brand,
                temp_record.sku,
                temp_record.name,
                v_brand_id
            ) INTO matched_product_id;

INSERT INTO debug_logs (message, created_at) VALUES 
                ('SUPPLIER_BATCH: Fuzzy matching result: ' || COALESCE(matched_product_id::text, 'NULL'), NOW());

IF matched_product_id IS NOT NULL THEN
                INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Updating existing product ' || matched_product_id, NOW());

-- Update existing product with supplier data (only fill missing fields)
                -- REMOVED: our_url update - suppliers should not populate our_url
                UPDATE products SET
                    name = CASE WHEN (name IS NULL OR name = '') AND temp_record.name IS NOT NULL AND temp_record.name != '' THEN temp_record.name ELSE name END,
                    sku = CASE WHEN (sku IS NULL OR sku = '') AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN temp_record.sku ELSE sku END,
                    ean = CASE WHEN (ean IS NULL OR ean = '') AND temp_record.ean IS NOT NULL AND temp_record.ean != '' THEN temp_record.ean ELSE ean END,
                    brand = CASE WHEN (brand IS NULL OR brand = '') AND temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN temp_record.brand ELSE brand END,
                    brand_id = CASE WHEN brand_id IS NULL AND v_brand_id IS NOT NULL THEN v_brand_id ELSE brand_id END,
                    image_url = CASE WHEN (image_url IS NULL OR image_url = '') AND temp_record.image_url IS NOT NULL AND temp_record.image_url != '' THEN temp_record.image_url ELSE image_url END,
                    currency_code = CASE WHEN (currency_code IS NULL OR currency_code = '') AND temp_record.currency_code IS NOT NULL AND temp_record.currency_code != '' THEN temp_record.currency_code ELSE currency_code END,
                    updated_at = NOW()
                WHERE id = matched_product_id;

ELSE
                INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Creating new product', NOW());

-- Create new product
                -- REMOVED: our_url field - suppliers should not populate our_url
                INSERT INTO products (
                    user_id,
                    name,
                    sku,
                    ean,
                    brand,
                    brand_id,
                    image_url,
                    currency_code
                ) VALUES (
                    temp_record.user_id,
                    temp_record.name,
                    temp_record.sku,
                    temp_record.ean,
                    temp_record.brand,
                    v_brand_id,
                    temp_record.image_url,
                    temp_record.currency_code
                ) RETURNING id INTO matched_product_id;

INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Created new product with ID: ' || matched_product_id, NOW());

total_new_products := total_new_products + 1;

END IF;

-- PROCESS CUSTOM FIELDS from raw_data
            IF matched_product_id IS NOT NULL AND temp_record.raw_data IS NOT NULL THEN
                INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Processing custom fields from raw_data', NOW());

SELECT process_custom_fields_from_raw_data(
                    temp_record.user_id,
                    matched_product_id,
                    temp_record.raw_data,
                    'supplier',
                    temp_record.supplier_id
                ) INTO custom_fields_result;

INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: Custom fields result: ' || COALESCE(custom_fields_result::text, 'NULL'), NOW());

ELSE
                INSERT INTO debug_logs (message, created_at) VALUES 
                    ('SUPPLIER_BATCH: No custom fields to process - Product ID: ' || COALESCE(matched_product_id::text, 'NULL') || ', Has raw_data: ' || (temp_record.raw_data IS NOT NULL)::text, NOW());

END IF;

-- Process price changes if we have a product and price
            IF matched_product_id IS NOT NULL AND temp_record.supplier_price IS NOT NULL THEN
                -- Get last supplier price for comparison
                SELECT 
                    new_supplier_price,
                    new_supplier_recommended_price
                INTO 
                    last_supplier_price,
                    last_supplier_recommended_price
                FROM price_changes_suppliers 
                WHERE product_id = matched_product_id 
                  AND supplier_id = temp_record.supplier_id
                ORDER BY changed_at DESC 
                LIMIT 1;

-- Only create price change if price actually changed or this is the first price
                IF last_supplier_price IS NULL OR last_supplier_price != temp_record.supplier_price THEN
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
                        supplier_url
                    ) VALUES (
                        temp_record.user_id,
                        matched_product_id,
                        temp_record.supplier_id,
                        last_supplier_price,
                        temp_record.supplier_price,
                        last_supplier_recommended_price,
                        temp_record.supplier_recommended_price,
                        CASE 
                            WHEN last_supplier_price IS NULL OR last_supplier_price = 0 THEN 0
                            ELSE ROUND(((temp_record.supplier_price - last_supplier_price) / last_supplier_price * 100)::numeric, 2)
                        END,
                        NOW(),
                        temp_record.currency_code,
                        temp_record.supplier_url
                    );

total_price_changes := total_price_changes + 1;

END IF;

END IF;

-- STOCK PROCESSING
            IF matched_product_id IS NOT NULL AND (temp_record.stock_quantity IS NOT NULL OR temp_record.stock_status IS NOT NULL OR temp_record.availability_date IS NOT NULL) THEN
                -- Get current stock data for comparison
                SELECT 
                    new_stock_quantity,
                    new_stock_status,
                    new_availability_date
                INTO 
                    current_stock_quantity,
                    current_stock_status,
                    current_availability_date
                FROM stock_changes_suppliers 
                WHERE product_id = matched_product_id 
                  AND supplier_id = temp_record.supplier_id
                ORDER BY changed_at DESC 
                LIMIT 1;

-- Standardize stock status
                standardized_status := CASE 
                    WHEN temp_record.stock_status ILIKE '%in stock%' OR temp_record.stock_status ILIKE '%available%' THEN 'in_stock'
                    WHEN temp_record.stock_status ILIKE '%out of stock%' OR temp_record.stock_status ILIKE '%unavailable%' THEN 'out_of_stock'
                    WHEN temp_record.stock_status ILIKE '%pre%order%' OR temp_record.stock_status ILIKE '%backorder%' THEN 'pre_order'
                    WHEN temp_record.stock_status ILIKE '%discontinued%' THEN 'discontinued'
                    ELSE COALESCE(temp_record.stock_status, 'unknown')
                END;

-- Check if stock has changed (or this is the first stock entry)
                IF current_stock_quantity IS NULL OR 
                   (COALESCE(current_stock_quantity, -999) != COALESCE(temp_record.stock_quantity, -999)) OR
                   (COALESCE(current_stock_status, '') != COALESCE(standardized_status, '')) OR
                   (COALESCE(current_availability_date, '1900-01-01'::date) != COALESCE(temp_record.availability_date, '1900-01-01'::date)) THEN
                    
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
                        supplier_url,
                        raw_stock_data
                    ) VALUES (
                        temp_record.user_id,
                        matched_product_id,
                        temp_record.supplier_id,
                        current_stock_quantity,
                        temp_record.stock_quantity,
                        current_stock_status,
                        standardized_status,
                        current_availability_date,
                        temp_record.availability_date,
                        COALESCE(temp_record.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                        NOW(),
                        temp_record.supplier_url,
                        temp_record.raw_stock_data
                    );

total_stock_changes := total_stock_changes + 1;

END IF;

END IF;

-- CLEANUP: Delete the processed record from temp table
            DELETE FROM temp_suppliers_scraped_data WHERE id = temp_record.id;

total_processed := total_processed + 1;

INSERT INTO debug_logs (message, created_at) VALUES 
                ('SUPPLIER_BATCH: Completed processing and deleted record ' || temp_record.id, NOW());

EXCEPTION WHEN OTHERS THEN
            INSERT INTO debug_logs (message, created_at) VALUES 
                ('SUPPLIER_BATCH: Error processing record ' || temp_record.id || ': ' || SQLERRM, NOW());

total_errors := total_errors + 1;

-- Delete record even on error to avoid infinite loops
            DELETE FROM temp_suppliers_scraped_data WHERE id = temp_record.id;

END;

END LOOP;

-- Debug: Log completion
    INSERT INTO debug_logs (message, created_at) VALUES 
        ('SUPPLIER_BATCH: Completed batch processing - Processed: ' || total_processed || ', Errors: ' || total_errors || ', New products: ' || total_new_products || ', Price changes: ' || total_price_changes || ', Stock changes: ' || total_stock_changes, NOW());

RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes;

END;

$$;

END IF;

RETURN NEW;

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

BEGIN
    IF raw_status IS NULL OR raw_status = '' THEN
        RETURN 'unknown';

END IF;

-- Convert to lowercase for comparison
    raw_status := lower(trim(raw_status));

-- Handle numeric stock values (e.g., '1 st', '10 st', '0 st')
    IF raw_status ~ '^[0-9]+ st$' THEN
        BEGIN
            numeric_value := CAST(regexp_replace(raw_status, ' st$', '') AS INTEGER);

IF numeric_value > 0 THEN
                RETURN 'in_stock';

ELSE
                RETURN 'out_of_stock';

END IF;

EXCEPTION WHEN OTHERS THEN
            -- If conversion fails, continue with text matching
            NULL;

END;

END IF;

-- In stock variations (Swedish and English) - but check for delivery timeframes first
    IF (raw_status IN ('i lager', 'finns i lager', 'in stock', 'available', 'tillgänglig', 'på lager') 
       OR raw_status LIKE '%i lager%')
       AND NOT (raw_status LIKE '%leveranstid%' OR raw_status LIKE '%arbetsdagar%' OR raw_status LIKE '%leverans%') THEN
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

-- Back order / restocking / pre-order / delivery timeframes
    IF raw_status LIKE '%beställningsvara%' OR raw_status LIKE '%back order%' OR raw_status LIKE '%restocking%' 
       OR raw_status LIKE '%pre-order%' OR raw_status LIKE '%beräknas från%'
       OR raw_status LIKE '%leverans %' OR raw_status LIKE '%leveranstid%' OR raw_status LIKE '%arbetsdagar%'
       OR raw_status ~ 'leverans [0-9]+-[0-9]+ ?dag' OR raw_status ~ 'leverans [0-9]+-[0-9]+dgr'
       OR raw_status LIKE '%få hos leverantör%' THEN
        RETURN 'back_order';

END IF;

-- Discontinued
    IF raw_status LIKE '%utgången%' OR raw_status LIKE '%discontinued%' OR raw_status LIKE '%upphörd%' THEN
        RETURN 'discontinued';

END IF;

-- Physical store only
    IF raw_status LIKE '%endast för köp i fysisk butik%' OR raw_status LIKE '%only in store%' THEN
        RETURN 'limited_stock';

END IF;

-- Default to original status if no match
    RETURN raw_status;

END;

$_$;

v_record_id UUID;

BEGIN
    -- Create hash for deduplication (just the value, since field_name is in custom_field_id)
    v_value_hash := encode(sha256(p_field_value::bytea), 'hex');

-- Insert or update the custom field value
    INSERT INTO product_custom_field_values (
        product_id, 
        custom_field_id, 
        value, 
        value_hash,
        source_type, 
        source_id,
        created_at,
        updated_at
    )
    VALUES (
        p_product_id, 
        p_custom_field_id, 
        p_field_value, 
        v_value_hash,
        p_source_type, 
        p_source_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (product_id, custom_field_id)
    DO UPDATE SET
        value = EXCLUDED.value,
        value_hash = EXCLUDED.value_hash,
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id,
        updated_at = NOW()
    RETURNING id INTO v_record_id;

RETURN v_record_id;

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

where_clause TEXT := '';

BEGIN
    -- Build WHERE clause based on parameters
    IF p_user_id IS NOT NULL THEN
        where_clause := where_clause || ' AND pc_table.user_id = ''' || p_user_id || '''::UUID';

END IF;

IF p_product_id IS NOT NULL THEN
        where_clause := where_clause || ' AND pc_table.product_id = ''' || p_product_id || '''::UUID';

END IF;

-- Update price_changes_competitors
    EXECUTE 'UPDATE price_changes_competitors pc_table
             SET our_url = p.our_url
             FROM products p
             WHERE pc_table.product_id = p.id 
               AND pc_table.our_url IS NULL 
               AND p.our_url IS NOT NULL' || where_clause;

GET DIAGNOSTICS v_updated_count = ROW_COUNT;

RETURN QUERY SELECT 'price_changes_competitors'::TEXT, v_updated_count;

-- Update price_changes_suppliers
    EXECUTE 'UPDATE price_changes_suppliers ps_table
             SET our_url = p.our_url
             FROM products p
             WHERE ps_table.product_id = p.id 
               AND ps_table.our_url IS NULL 
               AND p.our_url IS NOT NULL' || REPLACE(where_clause, 'pc_table', 'ps_table');

GET DIAGNOSTICS v_updated_count = ROW_COUNT;

RETURN QUERY SELECT 'price_changes_suppliers'::TEXT, v_updated_count;

-- Update stock_changes_competitors
    EXECUTE 'UPDATE stock_changes_competitors sc_table
             SET our_url = p.our_url
             FROM products p
             WHERE sc_table.product_id = p.id 
               AND sc_table.our_url IS NULL 
               AND p.our_url IS NOT NULL' || REPLACE(where_clause, 'pc_table', 'sc_table');

GET DIAGNOSTICS v_updated_count = ROW_COUNT;

RETURN QUERY SELECT 'stock_changes_competitors'::TEXT, v_updated_count;

-- Update stock_changes_suppliers
    EXECUTE 'UPDATE stock_changes_suppliers ss_table
             SET our_url = p.our_url
             FROM products p
             WHERE ss_table.product_id = p.id 
               AND ss_table.our_url IS NULL 
               AND p.our_url IS NOT NULL' || REPLACE(where_clause, 'pc_table', 'ss_table');

GET DIAGNOSTICS v_updated_count = ROW_COUNT;

RETURN QUERY SELECT 'stock_changes_suppliers'::TEXT, v_updated_count;

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

RETURN NEW;

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

has_ean BOOLEAN := FALSE;

has_brand_sku BOOLEAN := FALSE;

has_name BOOLEAN := FALSE;

fuzzy_name_enabled BOOLEAN := FALSE;

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

-- If EAN is provided but invalid, set it to NULL
    IF NEW.ean IS NOT NULL AND NEW.ean != '' AND NEW.ean != '-' AND NOT is_valid_ean(NEW.ean) THEN
        NEW.ean := NULL;

END IF;

-- Validate that the record has sufficient data for processing
    -- Must have either valid EAN OR both brand+sku OR (name if fuzzy matching is enabled)
    IF NOT has_ean AND NOT has_brand_sku AND NOT (fuzzy_name_enabled AND has_name) THEN
        -- Reject records that don't meet any matching criteria
        RETURN NULL;

END IF;

-- Validate that competitor_price is provided and valid
    IF NEW.competitor_price IS NULL OR NEW.competitor_price <= 0 THEN
        RAISE EXCEPTION 'competitor_price must be provided and greater than 0, got: %', NEW.competitor_price;

END IF;

-- Set default currency_code using user's primary currency
    NEW.currency_code := COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id));

-- Just validate and insert, processing will be done in batches later
    RETURN NEW;

END;

$$;

END IF;

-- Validate required fields
    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';

END IF;

IF NEW.integration_id IS NULL THEN
        RAISE EXCEPTION 'integration_id is required';

END IF;

IF NEW.name IS NULL OR NEW.name = '' THEN
        RAISE EXCEPTION 'product name is required';

END IF;

-- Set defaults
    NEW.created_at := COALESCE(NEW.created_at, NOW());

NEW.currency_code := COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id));

RETURN NEW;

END;

$$;

END IF;

-- Validate required fields
    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';

END IF;

IF NEW.name IS NULL OR NEW.name = '' THEN
        RAISE EXCEPTION 'product name is required';

END IF;

-- Set defaults
    NEW.created_at := COALESCE(NEW.created_at, NOW());

NEW.currency_code := COALESCE(NEW.currency_code, 'SEK');

RETURN NEW;

END;

$$;

END IF;

-- Check if it starts with http:// or https://
    IF NOT (url_text ~* '^https?://') THEN
        RETURN FALSE;

END IF;

-- Check for basic URL structure
    IF NOT (url_text ~* '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}') THEN
        RETURN FALSE;

END IF;

RETURN TRUE;

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
-- Name: idx_price_changes_suppliers_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_analysis ON public.price_changes_suppliers USING btree (user_id, product_id, supplier_id, changed_at DESC, new_our_wholesale_price);

--
-- Name: idx_price_changes_suppliers_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_changed_at ON public.price_changes_suppliers USING btree (changed_at);

--
-- Name: idx_price_changes_suppliers_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_product_date ON public.price_changes_suppliers USING btree (product_id, changed_at DESC);

--
-- Name: idx_price_changes_suppliers_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_product_id ON public.price_changes_suppliers USING btree (product_id);

--
-- Name: idx_price_changes_suppliers_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_supplier_id ON public.price_changes_suppliers USING btree (supplier_id);

--
-- Name: idx_price_changes_suppliers_user_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_user_changed_at ON public.price_changes_suppliers USING btree (user_id, changed_at DESC);

--
-- Name: idx_price_changes_suppliers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_user_id ON public.price_changes_suppliers USING btree (user_id);

--
-- Name: idx_price_changes_suppliers_user_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_user_product ON public.price_changes_suppliers USING btree (user_id, product_id);

--
-- Name: idx_price_changes_suppliers_user_supplier_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_changes_suppliers_user_supplier_date ON public.price_changes_suppliers USING btree (user_id, supplier_id, changed_at DESC) WHERE (supplier_id IS NOT NULL);

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
-- Name: idx_product_custom_field_values_created_at_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_created_at_product ON public.product_custom_field_values USING btree (created_at DESC, product_id);

--
-- Name: idx_product_custom_field_values_custom_field_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_custom_field_id ON public.product_custom_field_values USING btree (custom_field_id);

--
-- Name: idx_product_custom_field_values_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_dedup ON public.product_custom_field_values USING btree (custom_field_id, value_hash);

--
-- Name: idx_product_custom_field_values_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_hash ON public.product_custom_field_values USING btree (value_hash);

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
-- Name: idx_product_custom_field_values_value_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_custom_field_values_value_hash ON public.product_custom_field_values USING btree (md5(value)) WHERE (value IS NOT NULL);

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

CREATE INDEX idx_user_custom_fields_user_id ON public.product_custom_fields USING btree (user_id);

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

