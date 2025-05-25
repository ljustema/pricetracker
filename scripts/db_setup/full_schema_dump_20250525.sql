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
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


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
-- Name: next_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA next_auth;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: pgsodium; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgsodium;


--
-- Name: pgsodium; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;


--
-- Name: EXTENSION pgsodium; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgsodium IS 'Pgsodium is a modern cryptography library for Postgres.';


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
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: EXTENSION pgjwt; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for Postgresql';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


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
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


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
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
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


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

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


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: uid(); Type: FUNCTION; Schema: next_auth; Owner: -
--

CREATE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::uuid
$$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

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
END;
$$;


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
END;
$$;


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


--
-- Name: calculate_next_scraper_run_time(jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_next_scraper_run_time(schedule_config jsonb, last_run timestamp with time zone) RETURNS timestamp with time zone
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: integration_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    products_processed integer DEFAULT 0,
    products_updated integer DEFAULT 0,
    products_created integer DEFAULT 0,
    error_message text,
    log_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    test_products jsonb,
    configuration jsonb
);


--
-- Name: claim_next_integration_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_next_integration_job() RETURNS SETOF public.integration_runs
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
    SET
      status = 'running',
      started_at = NOW(),
      claimed_by_worker_at = NOW() -- Set the claimed_by_worker_at timestamp
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
    s.competitor_id AS fetched_competitor_id -- Alias to match the RETURNS TABLE definition
  FROM scraper_runs sr
  JOIN scrapers s ON sr.scraper_id = s.id
  WHERE sr.id = claimed_job_id_val; -- Select the specific job that was claimed
END;
$$;


--
-- Name: FUNCTION claim_next_scraper_job(worker_type_filter text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_next_scraper_job(worker_type_filter text) IS 'Atomically claims the next pending scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';


--
-- Name: cleanup_old_debug_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_debug_logs() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.debug_logs
    WHERE created_at < now() - interval '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_old_scraper_runs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_scraper_runs() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.scraper_runs
    WHERE created_at < now() - interval '30 days'
      AND status IN ('completed', 'failed');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    INSERT INTO public.debug_logs (level, message, details)
    VALUES ('INFO', 'Cleaned up old scraper runs',
            jsonb_build_object('deleted_count', deleted_count));

    RETURN deleted_count;
END;
$$;


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
$$;


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
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;


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


--
-- Name: create_scheduled_scraper_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_scheduled_scraper_jobs() RETURNS TABLE(jobs_created integer, message text)
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


--
-- Name: create_user_for_nextauth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_for_nextauth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Create a user in the next_auth schema when a user is created in auth.users
  INSERT INTO next_auth.users (id, name, email, "emailVerified", image)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NOW(),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;


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
  
  -- The trigger create_profile_for_user will automatically create a profile
END;
$$;


--
-- Name: create_utility_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_utility_jobs() RETURNS TABLE(jobs_created integer, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    job_count integer := 0;
    current_time timestamp with time zone := now();
    last_cleanup_check timestamp with time zone;
BEGIN
    -- Check when we last ran cleanup tasks
    SELECT COALESCE(MAX(created_at), '1970-01-01'::timestamp with time zone)
    INTO last_cleanup_check
    FROM public.debug_logs
    WHERE message LIKE '%cleanup_utility_job%'
      AND created_at > current_time - interval '1 day';

    -- Run cleanup tasks once per day
    IF last_cleanup_check < current_time - interval '23 hours' THEN
        -- Log that we're running cleanup (this serves as our utility job queue for now)
        INSERT INTO public.debug_logs (
            user_id,
            level,
            message,
            details,
            created_at
        ) VALUES (
            NULL, -- System job
            'INFO',
            'cleanup_utility_job',
            jsonb_build_object(
                'task_type', 'daily_cleanup',
                'scheduled_at', current_time
            ),
            current_time
        );

        job_count := job_count + 1;

        -- Perform actual cleanup tasks
        PERFORM cleanup_old_scraper_runs();
        PERFORM cleanup_old_debug_logs();
        PERFORM process_scraper_timeouts();

        RAISE NOTICE 'Created utility cleanup job at %', current_time;
    END IF;

    RETURN QUERY SELECT job_count, format('Created %s utility jobs', job_count);
END;
$$;


--
-- Name: debug_create_scheduled_scraper_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_create_scheduled_scraper_jobs() RETURNS TABLE(scraper_id uuid, scraper_name text, should_run boolean, has_pending_job boolean, job_created boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    scraper_record record;
    current_time timestamp with time zone := now();
    should_run_flag boolean;
    has_pending_job_flag boolean;
    job_created_flag boolean;
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
        
        -- Check if there's already a pending job
        SELECT EXISTS (
            SELECT 1 FROM public.scraper_runs sr
            WHERE sr.scraper_id = scraper_record.id
              AND sr.status IN ('pending', 'initializing', 'running')
        ) INTO has_pending_job_flag;
        
        job_created_flag := false;
        
        IF should_run_flag AND NOT has_pending_job_flag THEN
            job_created_flag := true;
        END IF;
        
        RETURN QUERY SELECT scraper_record.id, scraper_record.name, should_run_flag, has_pending_job_flag, job_created_flag;
    END LOOP;
END;
$$;


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
  END IF;
  RETURN NEW;
END;
$$;


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
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail
  RAISE WARNING 'Error ensuring user exists: %', SQLERRM;
END;
$$;


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


--
-- Name: find_or_create_brand(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_or_create_brand(p_user_id uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_brand_id UUID;
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
END;
$$;


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
END;
$$;


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
END;
$$;


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
END;
$$;


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
END;
$$;


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
END;
$$;


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
END;
$$;


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
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs, return empty result
        RETURN;
END;
$$;


--
-- Name: get_integration_run_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_integration_run_stats(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;
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
END;$$;


--
-- Name: get_or_create_company(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_company(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_company_id UUID;
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


--
-- Name: get_or_create_unknown_brand(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_unknown_brand(user_id_param uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    brand_id_result UUID;
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
END;
$$;


--
-- Name: get_products_filtered(uuid, integer, integer, text, text, text, text, text, boolean, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_id uuid DEFAULT NULL::uuid, p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _query text;
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


--
-- Name: get_products_filtered_with_user_check(uuid, integer, integer, text, text, text, text, text, boolean, uuid, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered_with_user_check(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_id uuid DEFAULT NULL::uuid, p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result json;
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
END;
$$;


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
$$;


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
$$;


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
END;
$$;


--
-- Name: FUNCTION get_user_growth_stats(period_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_growth_stats(period_days integer) IS 'Returns user growth statistics over a specified period in days.';


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
END;
$$;


--
-- Name: get_user_workload_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_workload_stats() RETURNS TABLE(user_id uuid, user_name text, user_email text, active_scrapers bigint, active_integrations bigint, jobs_today bigint, avg_execution_time_ms numeric)
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
        COALESCE(j.avg_execution_time, 0) as avg_execution_time_ms
    FROM public.user_profiles u
    LEFT JOIN (
        SELECT scrapers.user_id, COUNT(*) as scraper_count
        FROM public.scrapers
        WHERE is_active = true AND is_approved = true
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
            AVG(execution_time_ms) as avg_execution_time
        FROM public.scraper_runs
        WHERE created_at >= date_trunc('day', now())
        GROUP BY scraper_runs.user_id
    ) j ON u.id = j.user_id
    ORDER BY u.id;
END;
$$;


--
-- Name: FUNCTION get_user_workload_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_workload_stats() IS 'Returns user workload distribution with active scrapers, integrations, and job statistics. Fixed ambiguous column references.';


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
END;
$$;


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

    RETURN NULL;
END;
$$;


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


--
-- Name: FUNCTION merge_products_api(primary_id uuid, duplicate_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.merge_products_api(primary_id uuid, duplicate_id uuid) IS 'Merges two products by updating the primary product with data from the duplicate, updating all foreign key references, and deleting the duplicate.';


--
-- Name: optimize_scraper_schedules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimize_scraper_schedules() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    scraper_record record;
    update_count integer := 0;
    time_slot integer := 0;
    total_scrapers integer;
    minutes_per_slot integer;
BEGIN
    -- Count total active scrapers
    SELECT COUNT(*) INTO total_scrapers
    FROM public.scrapers
    WHERE is_active = true;

    -- Calculate minutes per slot to spread across 24 hours
    -- Leave some buffer time between jobs
    minutes_per_slot := GREATEST(5, (24 * 60) / GREATEST(total_scrapers, 1));

    -- Update scraper schedules to distribute load
    FOR scraper_record IN
        SELECT id, schedule, user_id
        FROM public.scrapers
        WHERE is_active = true
        ORDER BY user_id, id -- Group by user to keep their scrapers together
    LOOP
        -- Calculate new time slot (distribute across 24 hours)
        DECLARE
            new_hour integer := (time_slot * minutes_per_slot) / 60;
            new_minute integer := (time_slot * minutes_per_slot) % 60;
            new_time text := format('%02d:%02d', new_hour % 24, new_minute);
            updated_schedule jsonb;
        BEGIN
            -- Update the schedule with new time
            updated_schedule := jsonb_set(
                scraper_record.schedule,
                '{time}',
                to_jsonb(new_time)
            );

            UPDATE public.scrapers
            SET
                schedule = updated_schedule,
                updated_at = now()
            WHERE id = scraper_record.id;

            update_count := update_count + 1;
            time_slot := time_slot + 1;
        END;
    END LOOP;

    INSERT INTO public.debug_logs (level, message, details)
    VALUES ('INFO', 'Optimized scraper schedules',
            jsonb_build_object(
                'updated_scrapers', update_count,
                'total_scrapers', total_scrapers,
                'minutes_per_slot', minutes_per_slot
            ));

    RETURN update_count;
END;
$$;


--
-- Name: process_pending_integration_products(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_pending_integration_products(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    stats JSONB;
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


--
-- Name: process_scraper_timeouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_scraper_timeouts() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    timeout_count integer := 0;
    timeout_record record;
BEGIN
    -- Find scraper runs that have been running for more than 2 hours
    FOR timeout_record IN
        SELECT sr.id, sr.scraper_id, sr.started_at
        FROM public.scraper_runs sr
        WHERE sr.status = 'running'
          AND sr.started_at < now() - interval '2 hours'
    LOOP
        -- Mark as failed due to timeout
        UPDATE public.scraper_runs
        SET
            status = 'failed',
            completed_at = now(),
            error_message = 'Job timed out after 2 hours'
        WHERE id = timeout_record.id;

        timeout_count := timeout_count + 1;

        -- Log the timeout
        INSERT INTO public.debug_logs (level, message, details)
        VALUES ('WARN', 'Scraper run timed out',
                jsonb_build_object(
                    'run_id', timeout_record.id,
                    'scraper_id', timeout_record.scraper_id,
                    'started_at', timeout_record.started_at
                ));
    END LOOP;

    RETURN timeout_count;
END;
$$;


--
-- Name: process_staged_integration_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_staged_integration_product() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    existing_product_id UUID;
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


--
-- Name: retry_fetch_failed_runs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_fetch_failed_runs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  retry_count INTEGER;
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
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_brand_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_brand_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_brand_id UUID;
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
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: trim_progress_messages(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_progress_messages(p_run_id uuid, p_max_messages integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_messages text[];
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
END;
$$;


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


--
-- Name: FUNCTION update_scraper_status_from_run(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_scraper_status_from_run() IS 'Modified to remove debug logging to debug_logs table';


--
-- Name: update_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update the user_profile when next_auth.users is updated
  UPDATE public.user_profiles
  SET 
    name = NEW.name,
    avatar_url = NEW.image,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

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


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
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
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


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
    $_$;


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
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


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
END
$$;


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
END;
$_$;


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
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
  v_order_by text;
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


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
		RETURN new;
		END;
		$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: accounts; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.accounts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid
);


--
-- Name: sessions; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid
);


--
-- Name: users; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    language text,
    notification_preferences jsonb,
    timezone text
);


--
-- Name: verification_tokens; Type: TABLE; Schema: next_auth; Owner: -
--

CREATE TABLE next_auth.verification_tokens (
    identifier text,
    token text NOT NULL,
    expires timestamp with time zone NOT NULL
);


--
-- Name: admin_communication_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_communication_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    admin_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    communication_type text DEFAULT 'email'::text NOT NULL,
    subject text,
    message_content text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'sent'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE admin_communication_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_communication_log IS 'Logs communications sent by admins to users.';


--
-- Name: COLUMN admin_communication_log.admin_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_communication_log.admin_user_id IS 'The ID of the admin who sent the communication.';


--
-- Name: COLUMN admin_communication_log.target_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_communication_log.target_user_id IS 'The ID of the user who received the communication.';


--
-- Name: brand_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_aliases (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    alias_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    needs_review boolean DEFAULT false NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text,
    address text,
    org_number text,
    primary_currency text,
    secondary_currencies text[],
    currency_format text,
    matching_rules jsonb,
    price_thresholds jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT companies_primary_currency_check CHECK ((char_length(primary_currency) = 3))
);


--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    website text NOT NULL,
    logo_url text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: csv_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csv_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    filename text NOT NULL,
    file_content text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text
);


--
-- Name: debug_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_logs (
    id integer NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: debug_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.debug_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: debug_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.debug_logs_id_seq OWNED BY public.debug_logs.id;


--
-- Name: dismissed_duplicates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_duplicates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brand_id_1 uuid NOT NULL,
    brand_id_2 uuid NOT NULL,
    dismissal_key text NOT NULL,
    dismissed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brand_id_order CHECK ((brand_id_1 < brand_id_2))
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    name text NOT NULL,
    api_url text NOT NULL,
    api_key text NOT NULL,
    status text DEFAULT 'pending_setup'::text NOT NULL,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    sync_frequency text DEFAULT 'daily'::text,
    configuration jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: price_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    old_price numeric(10,2) NOT NULL,
    new_price numeric(10,2) NOT NULL,
    price_change_percentage numeric(10,2) NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    integration_id uuid,
    currency_code text,
    url text,
    CONSTRAINT price_changes_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code)))),
    CONSTRAINT price_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);


--
-- Name: COLUMN price_changes.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.price_changes.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    category text,
    description text,
    image_url text,
    our_price numeric(10,2),
    wholesale_price numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brand_id uuid NOT NULL,
    currency_code text,
    url text,
    CONSTRAINT products_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);


--
-- Name: COLUMN products.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';


--
-- Name: COLUMN products.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.url IS 'URL to the product on the source platform';


--
-- Name: scraped_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraped_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scraper_id uuid,
    competitor_id uuid NOT NULL,
    product_id uuid,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    url text,
    image_url text,
    sku text,
    brand text,
    scraped_at timestamp with time zone DEFAULT now(),
    ean text,
    currency_code text,
    CONSTRAINT scraped_products_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);


--
-- Name: COLUMN scraped_products.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraped_products.currency_code IS 'ISO 4217 currency code determined by the scraper';


--
-- Name: scraper_ai_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_ai_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_phase text NOT NULL,
    analysis_data jsonb DEFAULT '{}'::jsonb,
    url_collection_data jsonb DEFAULT '{}'::jsonb,
    data_extraction_data jsonb DEFAULT '{}'::jsonb,
    assembly_data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT scraper_ai_sessions_current_phase_check CHECK ((current_phase = ANY (ARRAY['analysis'::text, 'data-validation'::text, 'assembly'::text, 'complete'::text])))
);


--
-- Name: TABLE scraper_ai_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scraper_ai_sessions IS 'AI scraper sessions with phases: analysis, data-validation, assembly, complete';


--
-- Name: COLUMN scraper_ai_sessions.current_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.current_phase IS 'Current phase of the AI scraper generation process: analysis, data-validation, assembly, complete';


--
-- Name: COLUMN scraper_ai_sessions.analysis_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.analysis_data IS 'Data from the site analysis phase';


--
-- Name: COLUMN scraper_ai_sessions.url_collection_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.url_collection_data IS 'Legacy: Data from the URL collection phase (now part of data-validation)';


--
-- Name: COLUMN scraper_ai_sessions.data_extraction_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.data_extraction_data IS 'Data from the data validation phase (previously data-extraction)';


--
-- Name: COLUMN scraper_ai_sessions.assembly_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.assembly_data IS 'Data from the script assembly phase';


--
-- Name: scraper_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_runs (
    id uuid NOT NULL,
    scraper_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'initializing'::text,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    is_test_run boolean DEFAULT false,
    product_count integer DEFAULT 0,
    current_batch integer DEFAULT 0,
    total_batches integer,
    error_message text,
    progress_messages text[],
    created_at timestamp with time zone DEFAULT now(),
    execution_time_ms bigint,
    products_per_second numeric(10,2),
    scraper_type text,
    error_details text,
    claimed_by_worker_at timestamp with time zone,
    current_phase integer
);


--
-- Name: scrapers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrapers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    schedule jsonb NOT NULL,
    is_active boolean DEFAULT false,
    status text DEFAULT 'idle'::text,
    error_message text,
    last_run timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scraper_type character varying(20) DEFAULT 'ai'::character varying NOT NULL,
    python_script text,
    script_metadata jsonb,
    test_results jsonb,
    execution_time bigint,
    last_products_per_second numeric(10,2),
    typescript_script text,
    scrape_only_own_products boolean DEFAULT false NOT NULL,
    filter_by_active_brands boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE scrapers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scrapers IS 'Stores scraper configurations for different types: AI, Python, and CSV';


--
-- Name: COLUMN scrapers.execution_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.execution_time IS 'Time in milliseconds it took to run the scraper';


--
-- Name: COLUMN scrapers.last_products_per_second; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.last_products_per_second IS 'Products per second metric from the most recently completed successful run.';


--
-- Name: COLUMN scrapers.scrape_only_own_products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.scrape_only_own_products IS 'Flag to only scrape products matching the user''s own product catalog (based on EAN/SKU/Brand matching)';


--
-- Name: staged_integration_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staged_integration_products (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    integration_run_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prestashop_product_id text,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    price numeric(10,2),
    wholesale_price numeric(10,2),
    image_url text,
    raw_data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    product_id uuid,
    currency_code text,
    url text,
    CONSTRAINT staged_integration_products_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);


--
-- Name: COLUMN staged_integration_products.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staged_integration_products.currency_code IS 'ISO 4217 currency code from the integration source';


--
-- Name: COLUMN staged_integration_products.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staged_integration_products.url IS 'URL to the product on the integration platform';


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    avatar_url text,
    subscription_tier text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    admin_role text,
    is_suspended boolean DEFAULT false
);


--
-- Name: COLUMN user_profiles.admin_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.admin_role IS 'Defines the admin role for the user, if any (e.g., super_admin, support_admin).';


--
-- Name: COLUMN user_profiles.is_suspended; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.is_suspended IS 'Indicates if the user account is currently suspended by an admin.';


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    price_id text,
    status text DEFAULT 'inactive'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


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
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: debug_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_logs ALTER COLUMN id SET DEFAULT nextval('public.debug_logs_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: users email_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.users
    ADD CONSTRAINT email_unique UNIQUE (email);


--
-- Name: accounts provider_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId");


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessiontoken_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessiontoken_unique UNIQUE ("sessionToken");


--
-- Name: verification_tokens token_identifier_unique; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.verification_tokens
    ADD CONSTRAINT token_identifier_unique UNIQUE (token, identifier);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (token);


--
-- Name: admin_communication_log admin_communication_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_pkey PRIMARY KEY (id);


--
-- Name: brand_aliases brand_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);


--
-- Name: csv_uploads csv_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_pkey PRIMARY KEY (id);


--
-- Name: debug_logs debug_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_logs
    ADD CONSTRAINT debug_logs_pkey PRIMARY KEY (id);


--
-- Name: dismissed_duplicates dismissed_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_pkey PRIMARY KEY (id);


--
-- Name: integration_runs integration_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: price_changes price_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes
    ADD CONSTRAINT price_changes_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: scraped_products scraped_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_products
    ADD CONSTRAINT scraped_products_pkey PRIMARY KEY (id);


--
-- Name: scraper_ai_sessions scraper_ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_pkey PRIMARY KEY (id);


--
-- Name: scraper_runs scraper_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_pkey PRIMARY KEY (id);


--
-- Name: scrapers scrapers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_pkey PRIMARY KEY (id);


--
-- Name: staged_integration_products staged_integration_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staged_integration_products
    ADD CONSTRAINT staged_integration_products_pkey PRIMARY KEY (id);


--
-- Name: brand_aliases unique_brand_alias; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT unique_brand_alias UNIQUE (user_id, brand_id, alias_name);


--
-- Name: dismissed_duplicates unique_dismissed_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT unique_dismissed_pair UNIQUE (user_id, brand_id_1, brand_id_2);


--
-- Name: brands unique_user_brand; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT unique_user_brand UNIQUE (user_id, name);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


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
-- Name: users create_nextauth_user_trigger; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER create_nextauth_user_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_for_nextauth();


--
-- Name: users create_profile_trigger; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER create_profile_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_user();


--
-- Name: users update_user_profile_trigger; Type: TRIGGER; Schema: next_auth; Owner: -
--

CREATE TRIGGER update_user_profile_trigger AFTER UPDATE ON next_auth.users FOR EACH ROW EXECUTE FUNCTION public.update_user_profile();


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
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_userId_fkey; Type: FK CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES next_auth.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: next_auth; Owner: -
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES next_auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_communication_log admin_communication_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES next_auth.users(id);


--
-- Name: admin_communication_log admin_communication_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES next_auth.users(id);


--
-- Name: brand_aliases brand_aliases_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: brand_aliases brand_aliases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: brands brands_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: companies companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES next_auth.users(id);


--
-- Name: competitors competitors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: csv_uploads csv_uploads_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: csv_uploads csv_uploads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: dismissed_duplicates dismissed_duplicates_brand_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_brand_id_1_fkey FOREIGN KEY (brand_id_1) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: dismissed_duplicates dismissed_duplicates_brand_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_brand_id_2_fkey FOREIGN KEY (brand_id_2) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: dismissed_duplicates dismissed_duplicates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: integration_runs integration_runs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: integration_runs integration_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: price_changes price_changes_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes
    ADD CONSTRAINT price_changes_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: price_changes price_changes_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes
    ADD CONSTRAINT price_changes_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: price_changes price_changes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes
    ADD CONSTRAINT price_changes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: price_changes price_changes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes
    ADD CONSTRAINT price_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: scraped_products scraped_products_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_products
    ADD CONSTRAINT scraped_products_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: scraped_products scraped_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_products
    ADD CONSTRAINT scraped_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: scraped_products scraped_products_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_products
    ADD CONSTRAINT scraped_products_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);


--
-- Name: scraped_products scraped_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_products
    ADD CONSTRAINT scraped_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: scraper_ai_sessions scraper_ai_sessions_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: scraper_ai_sessions scraper_ai_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: scraper_runs scraper_runs_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);


--
-- Name: scraper_runs scraper_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: scrapers scrapers_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: scrapers scrapers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: staged_integration_products staged_integration_products_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staged_integration_products
    ADD CONSTRAINT staged_integration_products_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: staged_integration_products staged_integration_products_integration_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staged_integration_products
    ADD CONSTRAINT staged_integration_products_integration_run_id_fkey FOREIGN KEY (integration_run_id) REFERENCES public.integration_runs(id) ON DELETE CASCADE;


--
-- Name: staged_integration_products staged_integration_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staged_integration_products
    ADD CONSTRAINT staged_integration_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: staged_integration_products staged_integration_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staged_integration_products
    ADD CONSTRAINT staged_integration_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: csv_uploads Users can delete their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own CSV uploads" ON public.csv_uploads FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: brand_aliases Users can delete their own brand aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own brand aliases" ON public.brand_aliases FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: brands Users can delete their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own brands" ON public.brands FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: companies Users can delete their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own company" ON public.companies FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: competitors Users can delete their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own competitors" ON public.competitors FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: dismissed_duplicates Users can delete their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own dismissed duplicates" ON public.dismissed_duplicates FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: integrations Users can delete their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own integrations" ON public.integrations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: products Users can delete their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own products" ON public.products FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: scraper_ai_sessions Users can delete their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scraper AI sessions" ON public.scraper_ai_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: scrapers Users can delete their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scrapers" ON public.scrapers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: staged_integration_products Users can delete their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own staged integration products" ON public.staged_integration_products FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: csv_uploads Users can insert their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own CSV uploads" ON public.csv_uploads FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: brand_aliases Users can insert their own brand aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own brand aliases" ON public.brand_aliases FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: brands Users can insert their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own brands" ON public.brands FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: companies Users can insert their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own company" ON public.companies FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: competitors Users can insert their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own competitors" ON public.competitors FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: dismissed_duplicates Users can insert their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own dismissed duplicates" ON public.dismissed_duplicates FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: integration_runs Users can insert their own integration runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own integration runs" ON public.integration_runs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: integrations Users can insert their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own integrations" ON public.integrations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: price_changes Users can insert their own price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own price changes" ON public.price_changes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: products Users can insert their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own products" ON public.products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scraped_products Users can insert their own scraped products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraped products" ON public.scraped_products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scraper_ai_sessions Users can insert their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper AI sessions" ON public.scraper_ai_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scrapers Users can insert their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scrapers" ON public.scrapers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: staged_integration_products Users can insert their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own staged integration products" ON public.staged_integration_products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: csv_uploads Users can update their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own CSV uploads" ON public.csv_uploads FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: brands Users can update their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own brands" ON public.brands FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: companies Users can update their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own company" ON public.companies FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: competitors Users can update their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own competitors" ON public.competitors FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: integration_runs Users can update their own integration runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own integration runs" ON public.integration_runs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: integrations Users can update their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own integrations" ON public.integrations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: products Users can update their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own products" ON public.products FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: scraper_ai_sessions Users can update their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scraper AI sessions" ON public.scraper_ai_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: scrapers Users can update their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scrapers" ON public.scrapers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: staged_integration_products Users can update their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own staged integration products" ON public.staged_integration_products FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: csv_uploads Users can view their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own CSV uploads" ON public.csv_uploads FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: brand_aliases Users can view their own brand aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own brand aliases" ON public.brand_aliases FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: brands Users can view their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own brands" ON public.brands FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: companies Users can view their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own company" ON public.companies FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: competitors Users can view their own competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own competitors" ON public.competitors FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: dismissed_duplicates Users can view their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own dismissed duplicates" ON public.dismissed_duplicates FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: integration_runs Users can view their own integration runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own integration runs" ON public.integration_runs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: integrations Users can view their own integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own integrations" ON public.integrations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: price_changes Users can view their own price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own price changes" ON public.price_changes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: products Users can view their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own products" ON public.products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: scraped_products Users can view their own scraped products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraped products" ON public.scraped_products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: scraper_ai_sessions Users can view their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper AI sessions" ON public.scraper_ai_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: scrapers Users can view their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scrapers" ON public.scrapers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: staged_integration_products Users can view their own staged integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own staged integration products" ON public.staged_integration_products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_communication_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_communication_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_communication_log admin_communication_log_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_communication_log_insert_policy ON public.admin_communication_log FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.admin_role = ANY (ARRAY['super_admin'::text, 'support_admin'::text]))))));


--
-- Name: admin_communication_log admin_communication_log_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_communication_log_select_policy ON public.admin_communication_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.admin_role = ANY (ARRAY['super_admin'::text, 'support_admin'::text]))))));


--
-- Name: brand_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: csv_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: debug_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: dismissed_duplicates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dismissed_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: scraped_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraped_products ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_ai_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_ai_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: scrapers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrapers ENABLE ROW LEVEL SECURITY;

--
-- Name: staged_integration_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staged_integration_products ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

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
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


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
--

