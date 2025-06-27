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
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


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
    SET search_path TO 'next_auth'
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
begin
    raise debug 'PgBouncer auth request: %', p_usename;

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


--
-- Name: append_log_to_scraper_run(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_log_to_scraper_run(p_run_id uuid, p_log_entry jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    configuration jsonb,
    last_progress_update timestamp with time zone
);


--
-- Name: claim_next_integration_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_next_integration_job() RETURNS SETOF public.integration_runs
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
    AS $$
DECLARE
  claimed_job_id_val UUID;
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
$$;


--
-- Name: FUNCTION claim_next_scraper_job(worker_type_filter text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_next_scraper_job(worker_type_filter text) IS 'Atomically claims the next pending or initializing scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';


--
-- Name: cleanup_old_debug_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_debug_logs() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
    AS $$ DECLARE deleted_count integer; BEGIN DELETE FROM public.scraper_runs WHERE created_at < now() - interval '30 days' AND status IN ('completed', 'failed'); GET DIAGNOSTICS deleted_count = ROW_COUNT; INSERT INTO public.debug_logs (message, created_at) VALUES ('Cleaned up ' || deleted_count || ' old scraper runs', now()); RETURN deleted_count; END; $$;


--
-- Name: cleanup_rate_limit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_rate_limit_logs() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM rate_limit_log 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;


--
-- Name: cleanup_stalled_integration_runs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_stalled_integration_runs() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    timeout_record record;
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


--
-- Name: cleanup_temp_competitors_scraped_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_temp_competitors_scraped_data() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Remove all records in temp_competitors_scraped_data that are older than 30 days
  DELETE FROM temp_competitors_scraped_data
  WHERE scraped_at < NOW() - INTERVAL '30 days';

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


--
-- Name: count_distinct_competitors_for_brand(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_distinct_competitors_for_brand(p_user_id uuid, p_brand_id uuid) RETURNS integer
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(DISTINCT pc.competitor_id)
  FROM price_changes_competitors pc
  JOIN products p ON pc.product_id = p.id
  WHERE p.user_id = p_user_id
    AND p.brand_id = p_brand_id;
$$;


--
-- Name: create_profile_for_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_for_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
        RETURN;
    END IF;

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
        END IF;

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
        END IF;
    END LOOP;

    RETURN QUERY SELECT job_count, format('Created %s scheduled integration jobs (%s/%s)',
        job_count, current_integration_jobs, max_integration_jobs);
END;
$$;


--
-- Name: create_scheduled_scraper_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_scheduled_scraper_jobs() RETURNS TABLE(jobs_created integer, message text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    scraper_record record;
    job_count integer := 0;
    new_job_id uuid;
    current_timestamp timestamp with time zone := now();

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
        RETURN;
    END IF;

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
            EXIT;
        END IF;

        -- Check worker capacity by type
        IF scraper_record.scraper_type = 'python' AND current_python_jobs >= max_python_jobs THEN
            CONTINUE;
        END IF;

        IF scraper_record.scraper_type = 'typescript' AND current_typescript_jobs >= max_typescript_jobs THEN
            CONTINUE;
        END IF;

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
            END IF;

            -- Log the job creation
            RAISE NOTICE 'Created scheduled job % for scraper % (%) - Due at: %',
                new_job_id, scraper_record.name, scraper_record.scraper_type,
                scraper_record.next_run_time;
        END IF;
    END LOOP;

    RETURN QUERY SELECT job_count, 'Created ' || job_count || ' scheduled scraper jobs (Python: ' || current_python_jobs || '/' || max_python_jobs || ', TypeScript: ' || current_typescript_jobs || '/' || max_typescript_jobs || ')';
END;
$$;


--
-- Name: create_user_for_nextauth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_for_nextauth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
    AS $$ DECLARE job_count integer := 0; last_cleanup_check timestamp with time zone; BEGIN SELECT COALESCE(MAX(dl.created_at), '1970-01-01'::timestamp with time zone) INTO last_cleanup_check FROM public.debug_logs dl WHERE dl.message LIKE '%cleanup_utility_job%' AND dl.created_at > now() - interval '1 day'; IF last_cleanup_check < now() - interval '23 hours' THEN INSERT INTO public.debug_logs (message, created_at) VALUES ('cleanup_utility_job - daily_cleanup at ' || now(), now()); job_count := job_count + 1; PERFORM cleanup_old_scraper_runs(); PERFORM cleanup_old_debug_logs(); PERFORM process_scraper_timeouts(); RAISE NOTICE 'Created utility cleanup job at %', now(); END IF; RETURN QUERY SELECT job_count, 'Created ' || job_count || ' utility jobs'; END; $$;


--
-- Name: debug_create_scheduled_scraper_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_create_scheduled_scraper_jobs() RETURNS TABLE(scraper_id uuid, scraper_name text, should_run boolean, has_pending_job boolean, job_created boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
-- Name: delete_user_product_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_product_data(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Delete custom field values for products owned by the user
  BEGIN
    DELETE FROM product_custom_field_values 
    WHERE product_id IN (
      SELECT id FROM products WHERE user_id = target_user_id
    );
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


--
-- Name: detect_and_process_integration_conflicts(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_and_process_integration_conflicts(p_user_id uuid, p_integration_run_id uuid, p_batch_ids uuid[]) RETURNS TABLE(processed_count integer, conflict_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    record_data RECORD;
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


--
-- Name: detect_custom_field_type(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_custom_field_type(field_value text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Always return text to avoid type detection issues
    -- This is simpler and more reliable than trying to detect types
    RETURN 'text';
END;
$$;


--
-- Name: detect_ean_conflicts_and_create_reviews(uuid, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_ean_conflicts_and_create_reviews(p_user_id uuid, p_source_table text, p_batch_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(conflicts_count integer, reviews_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    conflict_record RECORD;
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


--
-- Name: dismiss_product_duplicates(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    ordered_id_1 UUID;
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


--
-- Name: FUNCTION dismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.dismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) IS 'Dismisses product duplicates to prevent them from appearing in future duplicate detection';


--
-- Name: ensure_one_active_scraper_per_competitor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_one_active_scraper_per_competitor() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
    SET search_path TO 'public'
    AS $$
DECLARE
    settings JSONB;
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


--
-- Name: FUNCTION find_potential_duplicates(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_potential_duplicates(p_user_id uuid) IS 'Enhanced duplicate detection with user settings support, fuzzy matching, and dismissed duplicates exclusion';


--
-- Name: find_potential_duplicates(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_potential_duplicates(p_user_id uuid, p_limit integer DEFAULT NULL::integer) RETURNS TABLE(group_id text, product_id uuid, name text, sku text, ean text, brand text, brand_id uuid, match_reason text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    settings JSONB;
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


--
-- Name: find_product_by_url(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_product_by_url(p_user_id uuid, p_url text, p_source_type text DEFAULT 'any'::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_product_id UUID;
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


--
-- Name: find_product_with_fuzzy_matching(uuid, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_product_with_fuzzy_matching(p_user_id uuid, p_ean text, p_brand text, p_sku text, p_name text, p_brand_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    settings JSONB;
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


--
-- Name: FUNCTION find_product_with_fuzzy_matching(p_user_id uuid, p_ean text, p_brand text, p_sku text, p_name text, p_brand_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_product_with_fuzzy_matching(p_user_id uuid, p_ean text, p_brand text, p_sku text, p_name text, p_brand_id uuid) IS 'Enhanced product matching with user settings support and fuzzy matching';


--
-- Name: get_admin_user_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_user_stats() RETURNS TABLE(total_users bigint, active_users_last_30_days bigint, new_users_last_30_days bigint, free_users bigint, premium_users bigint, enterprise_users bigint, suspended_users bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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

CREATE FUNCTION public.get_brand_analytics(p_user_id uuid, p_brand_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, is_active boolean, needs_review boolean, created_at timestamp with time zone, updated_at timestamp with time zone, product_count bigint, our_products_count bigint, competitor_count bigint)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH product_counts AS (
    SELECT
      b.id AS brand_id,
      COUNT(p.id) AS product_count,
      COUNT(CASE WHEN p.our_retail_price IS NOT NULL THEN 1 END) AS our_products_count
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
      price_changes_competitors pc ON p.id = pc.product_id AND pc.user_id = b.user_id
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
END;
$$;


--
-- Name: FUNCTION get_brand_analytics(p_user_id uuid, p_brand_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_brand_analytics(p_user_id uuid, p_brand_id uuid) IS 'Enhanced brand analytics function that includes our_products_count (products with our_retail_price IS NOT NULL)';


--
-- Name: get_brand_performance_data(uuid, uuid, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brand_performance_data(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid, p_start_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE(brand text, products_tracked bigint, total_sold bigint, total_revenue numeric, avg_sales_per_product numeric, active_days bigint, revenue_percentage numeric, avg_daily_sales numeric, avg_daily_revenue numeric)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
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


--
-- Name: FUNCTION get_brand_performance_data(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_brand_performance_data(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone) IS 'Returns brand-level sales performance metrics including revenue percentages and daily averages';


--
-- Name: get_brand_stock_availability(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brand_stock_availability(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid) RETURNS TABLE(brand text, total_products bigint, in_stock_products bigint, out_of_stock_products bigint, in_stock_percentage numeric, out_of_stock_percentage numeric)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id, 
            competitor_id, 
            new_stock_quantity, 
            new_stock_status
        FROM stock_changes_competitors
        WHERE user_id = p_user_id 
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    brand_availability AS (
        SELECT 
            p.brand,
            COUNT(*) as total_products,
            COUNT(CASE WHEN cs.new_stock_quantity > 0 THEN 1 END) as in_stock_products,
            COUNT(CASE WHEN cs.new_stock_quantity = 0 OR cs.new_stock_quantity IS NULL THEN 1 END) as out_of_stock_products
        FROM current_stock cs
        JOIN products p ON cs.product_id = p.id
        GROUP BY p.brand
    )
    SELECT 
        ba.brand,
        ba.total_products,
        ba.in_stock_products,
        ba.out_of_stock_products,
        CASE 
            WHEN ba.total_products > 0 THEN (ba.in_stock_products::NUMERIC / ba.total_products * 100)
            ELSE 0 
        END as in_stock_percentage,
        CASE 
            WHEN ba.total_products > 0 THEN (ba.out_of_stock_products::NUMERIC / ba.total_products * 100)
            ELSE 0 
        END as out_of_stock_percentage
    FROM brand_availability ba
    ORDER BY ba.in_stock_percentage DESC;
END;
$$;


--
-- Name: FUNCTION get_brand_stock_availability(p_user_id uuid, p_competitor_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_brand_stock_availability(p_user_id uuid, p_competitor_id uuid) IS 'Returns stock availability percentages by brand for inventory strategy analysis';


--
-- Name: get_brands_for_competitor(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brands_for_competitor(p_user_id uuid, p_competitor_id uuid) RETURNS TABLE(brand_id uuid)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.brand_id
  FROM
    price_changes_competitors pc
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
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ARRAY_AGG(DISTINCT c.name) AS competitor_names
  FROM
    price_changes_competitors pc
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
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH competitor_products AS (
    -- Get distinct product IDs for each competitor
    SELECT DISTINCT
      pc.competitor_id,
      pc.product_id
    FROM
      price_changes_competitors pc
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
-- Name: get_comprehensive_analysis_summary(uuid, uuid, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_comprehensive_analysis_summary(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid, p_start_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    result JSON;
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


--
-- Name: FUNCTION get_comprehensive_analysis_summary(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_comprehensive_analysis_summary(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone) IS 'Returns comprehensive summary statistics for all stock analysis modules';


--
-- Name: get_conversation_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_conversation_summary(user_uuid uuid) RETURNS TABLE(conversation_id uuid, subject text, status text, category text, priority text, created_at timestamp with time zone, updated_at timestamp with time zone, total_messages bigint, unread_messages bigint, last_message_content text, last_message_sender text, last_message_time timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
END;
$$;


--
-- Name: get_cron_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cron_jobs() RETURNS TABLE(jobid bigint, schedule text, command text, nodename text, nodeport integer, database text, username text, active boolean, jobname text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
-- Name: get_current_stock_analysis(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_stock_analysis(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid, p_brand_filter text DEFAULT NULL::text) RETURNS TABLE(product_id uuid, product_name text, brand text, sku text, current_stock integer, current_price numeric, inventory_value numeric, in_stock_flag integer, total_products bigint, products_in_stock bigint, in_stock_percentage numeric, total_inventory_value numeric)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id, 
            competitor_id, 
            new_stock_quantity, 
            new_stock_status
        FROM stock_changes_competitors
        WHERE user_id = p_user_id 
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    stock_analysis AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            cs.new_stock_quantity as current_stock,
            pc.new_competitor_price as current_price,
            (COALESCE(cs.new_stock_quantity, 0) * COALESCE(pc.new_competitor_price, 0)) as inventory_value,
            CASE WHEN cs.new_stock_quantity > 0 THEN 1 ELSE 0 END as in_stock_flag
        FROM current_stock cs
        JOIN products p ON cs.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT new_competitor_price
            FROM price_changes_competitors pc2
            WHERE pc2.product_id = p.id 
              AND pc2.user_id = p_user_id
              AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
            ORDER BY pc2.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
    ),
    totals AS (
        SELECT 
            COUNT(*) as total_products,
            SUM(in_stock_flag) as products_in_stock,
            SUM(inventory_value) as total_inventory_value
        FROM stock_analysis
    )
    SELECT 
        sa.id,
        sa.name,
        sa.brand,
        sa.sku,
        sa.current_stock,
        sa.current_price,
        sa.inventory_value,
        sa.in_stock_flag,
        t.total_products,
        t.products_in_stock,
        CASE 
            WHEN t.total_products > 0 THEN (t.products_in_stock::NUMERIC / t.total_products * 100)
            ELSE 0 
        END as in_stock_percentage,
        t.total_inventory_value
    FROM stock_analysis sa
    CROSS JOIN totals t
    ORDER BY sa.current_stock DESC NULLS LAST;
END;
$$;


--
-- Name: FUNCTION get_current_stock_analysis(p_user_id uuid, p_competitor_id uuid, p_brand_filter text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_current_stock_analysis(p_user_id uuid, p_competitor_id uuid, p_brand_filter text) IS 'Returns current stock levels, inventory values, and stock distribution analysis';


--
-- Name: get_dismissed_product_duplicates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dismissed_product_duplicates(p_user_id uuid) RETURNS TABLE(id uuid, product_id_1 uuid, product_id_2 uuid, product_name_1 text, product_name_2 text, dismissal_key text, dismissed_at timestamp without time zone)
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
END;
$$;


--
-- Name: FUNCTION get_dismissed_product_duplicates(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dismissed_product_duplicates(p_user_id uuid) IS 'Gets all dismissed product duplicates for a user';


--
-- Name: get_integration_run_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_integration_run_stats(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    stats JSONB;
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


--
-- Name: get_latest_competitor_prices(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_competitor_prices(p_user_id uuid, p_product_id uuid) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_competitor_price numeric, new_competitor_price numeric, old_our_retail_price numeric, new_our_retail_price numeric, price_change_percentage numeric, currency_code text, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_platform text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH AllPrices AS (
        SELECT 
            pc.id,
            pc.product_id,
            pc.competitor_id,
            pc.integration_id,
            pc.old_competitor_price,
            pc.new_competitor_price,
            pc.old_our_retail_price,
            pc.new_our_retail_price,
            pc.price_change_percentage,
            pc.currency_code,
            pc.changed_at,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN 'competitor'::TEXT 
                ELSE 'integration'::TEXT 
            END AS source_type,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN c.name 
                ELSE i.name 
            END AS source_name,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN c.website 
                ELSE NULL::TEXT 
            END AS source_website,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN NULL::TEXT 
                ELSE i.platform 
            END AS source_platform,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN pc.competitor_id 
                ELSE pc.integration_id 
            END AS source_id,
            COALESCE(pc.competitor_url, pc.our_url, p.our_url) AS url, -- Updated to use new field names
            ROW_NUMBER() OVER(
                PARTITION BY 
                COALESCE(pc.competitor_id, pc.integration_id), 
                CASE WHEN pc.competitor_id IS NOT NULL THEN 'competitor' ELSE 'integration' END 
                ORDER BY pc.changed_at DESC
            ) as rn
        FROM price_changes_competitors pc
        LEFT JOIN competitors c ON pc.competitor_id = c.id
        LEFT JOIN integrations i ON pc.integration_id = i.id
        LEFT JOIN products p ON pc.product_id = p.id
        WHERE pc.user_id = p_user_id
          AND pc.product_id = p_product_id
    )
    SELECT 
        ap.id,
        ap.product_id,
        ap.competitor_id,
        ap.integration_id,
        ap.old_competitor_price,
        ap.new_competitor_price,
        ap.old_our_retail_price,
        ap.new_our_retail_price,
        ap.price_change_percentage,
        ap.currency_code,
        ap.changed_at,
        ap.source_type,
        ap.source_name,
        ap.source_website,
        ap.source_platform,
        ap.source_id,
        ap.url
    FROM AllPrices ap
    WHERE ap.rn = 1
    ORDER BY COALESCE(ap.new_competitor_price, ap.new_our_retail_price) ASC;
END;
$$;


--
-- Name: get_latest_competitor_prices_batch(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_competitor_prices_batch(p_user_id uuid, p_product_ids uuid[]) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_competitor_price numeric, new_competitor_price numeric, old_our_retail_price numeric, new_our_retail_price numeric, price_change_percentage numeric, currency_code text, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_platform text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH AllPrices AS (
        SELECT 
            pc.id,
            pc.product_id,
            pc.competitor_id,
            pc.integration_id,
            pc.old_competitor_price,
            pc.new_competitor_price,
            pc.old_our_retail_price,
            pc.new_our_retail_price,
            pc.price_change_percentage,
            pc.currency_code,
            pc.changed_at,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN 'competitor'::TEXT 
                ELSE 'integration'::TEXT 
            END AS source_type,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN c.name 
                ELSE i.name 
            END AS source_name,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN c.website 
                ELSE NULL::TEXT 
            END AS source_website,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN NULL::TEXT 
                ELSE i.platform 
            END AS source_platform,
            CASE 
                WHEN pc.competitor_id IS NOT NULL THEN pc.competitor_id 
                ELSE pc.integration_id 
            END AS source_id,
            COALESCE(pc.competitor_url, pc.our_url, p.our_url) AS url, -- Updated to use new field names
            ROW_NUMBER() OVER(
                PARTITION BY pc.product_id, 
                COALESCE(pc.competitor_id, pc.integration_id), 
                CASE WHEN pc.competitor_id IS NOT NULL THEN 'competitor' ELSE 'integration' END 
                ORDER BY pc.changed_at DESC
            ) as rn
        FROM price_changes_competitors pc
        LEFT JOIN competitors c ON pc.competitor_id = c.id
        LEFT JOIN integrations i ON pc.integration_id = i.id
        LEFT JOIN products p ON pc.product_id = p.id
        WHERE pc.user_id = p_user_id
          AND pc.product_id = ANY(p_product_ids)
    )
    SELECT 
        ap.id,
        ap.product_id,
        ap.competitor_id,
        ap.integration_id,
        ap.old_competitor_price,
        ap.new_competitor_price,
        ap.old_our_retail_price,
        ap.new_our_retail_price,
        ap.price_change_percentage,
        ap.currency_code,
        ap.changed_at,
        ap.source_type,
        ap.source_name,
        ap.source_website,
        ap.source_platform,
        ap.source_id,
        ap.url
    FROM AllPrices ap
    WHERE ap.rn = 1
    ORDER BY COALESCE(ap.new_competitor_price, ap.new_our_retail_price) ASC;
END;
$$;


--
-- Name: get_latest_competitor_stock(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_competitor_stock(p_user_id uuid, p_product_id uuid) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, current_stock_quantity integer, current_stock_status text, current_availability_date date, last_stock_change integer, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.product_id,
        sc.competitor_id,
        sc.integration_id,
        sc.new_stock_quantity as current_stock_quantity,
        sc.new_stock_status as current_stock_status,
        sc.new_availability_date as current_availability_date,
        sc.stock_change_quantity as last_stock_change,
        sc.changed_at,
        CASE 
            WHEN sc.competitor_id IS NOT NULL THEN 'competitor'
            WHEN sc.integration_id IS NOT NULL THEN 'integration'
            ELSE 'unknown'
        END as source_type,
        COALESCE(c.name, i.name, 'Unknown') as source_name,
        COALESCE(c.website, '') as source_website,
        COALESCE(sc.competitor_id, sc.integration_id) as source_id,
        COALESCE(pc.competitor_url, pc.our_url, '') as url  -- Updated to use new field names
    FROM stock_changes_competitors sc
    LEFT JOIN competitors c ON sc.competitor_id = c.id
    LEFT JOIN integrations i ON sc.integration_id = i.id
    LEFT JOIN LATERAL (
        SELECT pc.competitor_url, pc.our_url
        FROM price_changes_competitors pc
        WHERE pc.user_id = p_user_id
          AND pc.product_id = p_product_id
          AND COALESCE(pc.competitor_id, pc.integration_id) = COALESCE(sc.competitor_id, sc.integration_id)
        ORDER BY pc.changed_at DESC
        LIMIT 1
    ) pc ON true
    WHERE sc.user_id = p_user_id
      AND sc.product_id = p_product_id
      AND sc.id IN (
          -- Get the latest stock record for each competitor/integration
          SELECT DISTINCT ON (sc2.competitor_id, sc2.integration_id) sc2.id
          FROM stock_changes_competitors sc2
          WHERE sc2.user_id = p_user_id
            AND sc2.product_id = p_product_id
          ORDER BY sc2.competitor_id, sc2.integration_id, sc2.changed_at DESC
      )
    ORDER BY sc.changed_at DESC;
END;
$$;


--
-- Name: FUNCTION get_latest_competitor_stock(p_user_id uuid, p_product_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_latest_competitor_stock(p_user_id uuid, p_product_id uuid) IS 'Gets the latest stock levels for a product from all competitors and integrations';


--
-- Name: get_latest_competitor_stock_batch(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_competitor_stock_batch(p_user_id uuid, p_product_ids uuid[]) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, current_stock_quantity integer, current_stock_status text, current_availability_date date, last_stock_change integer, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.product_id,
        sc.competitor_id,
        sc.integration_id,
        sc.new_stock_quantity as current_stock_quantity,
        sc.new_stock_status as current_stock_status,
        sc.new_availability_date as current_availability_date,
        sc.stock_change_quantity as last_stock_change,
        sc.changed_at,
        CASE 
            WHEN sc.competitor_id IS NOT NULL THEN 'competitor'
            WHEN sc.integration_id IS NOT NULL THEN 'integration'
            ELSE 'unknown'
        END as source_type,
        COALESCE(c.name, i.name, 'Unknown') as source_name,
        COALESCE(c.website, '') as source_website,
        COALESCE(sc.competitor_id, sc.integration_id) as source_id,
        COALESCE(pc.competitor_url, pc.our_url, '') as url  -- Updated to use new field names
    FROM stock_changes_competitors sc
    LEFT JOIN competitors c ON sc.competitor_id = c.id
    LEFT JOIN integrations i ON sc.integration_id = i.id
    LEFT JOIN LATERAL (
        SELECT pc.competitor_url, pc.our_url
        FROM price_changes_competitors pc
        WHERE pc.user_id = p_user_id
          AND pc.product_id = sc.product_id
          AND COALESCE(pc.competitor_id, pc.integration_id) = COALESCE(sc.competitor_id, sc.integration_id)
        ORDER BY pc.changed_at DESC
        LIMIT 1
    ) pc ON true
    WHERE sc.user_id = p_user_id
      AND sc.product_id = ANY(p_product_ids)
      AND sc.id IN (
          -- Get the latest stock record for each product/competitor/integration combination
          SELECT DISTINCT ON (sc2.product_id, sc2.competitor_id, sc2.integration_id) sc2.id
          FROM stock_changes_competitors sc2
          WHERE sc2.user_id = p_user_id
            AND sc2.product_id = ANY(p_product_ids)
          ORDER BY sc2.product_id, sc2.competitor_id, sc2.integration_id, sc2.changed_at DESC
      )
    ORDER BY sc.product_id, sc.changed_at DESC;
END;
$$;


--
-- Name: FUNCTION get_latest_competitor_stock_batch(p_user_id uuid, p_product_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_latest_competitor_stock_batch(p_user_id uuid, p_product_ids uuid[]) IS 'Gets the latest stock levels for multiple products from all competitors and integrations in a single query';


--
-- Name: get_or_create_unknown_brand(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_unknown_brand(user_id_param uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
-- Name: get_or_create_user_settings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_user_settings(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_settings_id UUID;
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


--
-- Name: get_price_range_analysis(uuid, uuid, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_price_range_analysis(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid, p_start_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE(price_range text, unique_products bigint, total_units_sold bigint, total_revenue numeric, avg_price_in_range numeric, revenue_percentage numeric, range_order integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
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


--
-- Name: FUNCTION get_price_range_analysis(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_price_range_analysis(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone) IS 'Returns sales distribution analysis across different price segments';


--
-- Name: get_processing_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_processing_stats() RETURNS TABLE(table_name text, record_count bigint, avg_processing_time_ms numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 'temp_competitors_scraped_data'::TEXT, COUNT(*)::BIGINT, 0::NUMERIC
    FROM temp_competitors_scraped_data
    UNION ALL
    SELECT 'temp_suppliers_scraped_data'::TEXT, COUNT(*)::BIGINT, 0::NUMERIC
    FROM temp_suppliers_scraped_data
    UNION ALL
    SELECT 'temp_integrations_scraped_data'::TEXT, COUNT(*)::BIGINT, 0::NUMERIC
    FROM temp_integrations_scraped_data
    UNION ALL
    SELECT 'products'::TEXT, COUNT(*)::BIGINT, 0::NUMERIC
    FROM products
    UNION ALL
    SELECT 'custom_field_values'::TEXT, COUNT(*)::BIGINT, 0::NUMERIC
    FROM custom_field_values;
END;
$$;


--
-- Name: get_product_price_history(uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_product_price_history(p_user_id uuid, p_product_id uuid, p_source_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_competitor_price numeric, new_competitor_price numeric, old_our_retail_price numeric, new_our_retail_price numeric, price_change_percentage numeric, currency_code text, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_platform text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id,
        pc.product_id,
        pc.competitor_id,
        pc.integration_id,
        pc.old_competitor_price,
        pc.new_competitor_price,
        pc.old_our_retail_price,
        pc.new_our_retail_price,
        pc.price_change_percentage,
        pc.currency_code,
        pc.changed_at,
        CASE 
            WHEN pc.competitor_id IS NOT NULL THEN 'competitor'::TEXT 
            ELSE 'integration'::TEXT 
        END AS source_type,
        CASE 
            WHEN pc.competitor_id IS NOT NULL THEN c.name 
            ELSE i.name 
        END AS source_name,
        CASE 
            WHEN pc.competitor_id IS NOT NULL THEN c.website 
            ELSE NULL::TEXT 
        END AS source_website,
        CASE 
            WHEN pc.competitor_id IS NOT NULL THEN NULL::TEXT 
            ELSE i.platform 
        END AS source_platform,
        CASE 
            WHEN pc.competitor_id IS NOT NULL THEN pc.competitor_id 
            ELSE pc.integration_id 
        END AS source_id,
        COALESCE(pc.competitor_url, pc.our_url, p.our_url) AS url -- Updated to use new field names
    FROM price_changes_competitors pc
    LEFT JOIN competitors c ON pc.competitor_id = c.id
    LEFT JOIN integrations i ON pc.integration_id = i.id
    LEFT JOIN products p ON pc.product_id = p.id
    WHERE pc.user_id = p_user_id
      AND pc.product_id = p_product_id
      AND (p_source_id IS NULL OR pc.competitor_id = p_source_id OR pc.integration_id = p_source_id)
    ORDER BY pc.changed_at DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_product_stock_history(uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_product_stock_history(p_user_id uuid, p_product_id uuid, p_source_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, product_id uuid, competitor_id uuid, integration_id uuid, old_stock_quantity integer, new_stock_quantity integer, old_stock_status text, new_stock_status text, old_availability_date date, new_availability_date date, stock_change_quantity integer, changed_at timestamp with time zone, source_type text, source_name text, source_website text, source_id uuid, url text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.product_id,
        sc.competitor_id,
        sc.integration_id,
        sc.old_stock_quantity,
        sc.new_stock_quantity,
        sc.old_stock_status,
        sc.new_stock_status,
        sc.old_availability_date,
        sc.new_availability_date,
        sc.stock_change_quantity,
        sc.changed_at,
        CASE 
            WHEN sc.competitor_id IS NOT NULL THEN 'competitor'::TEXT 
            ELSE 'integration'::TEXT 
        END AS source_type,
        CASE 
            WHEN sc.competitor_id IS NOT NULL THEN c.name 
            ELSE i.name 
        END AS source_name,
        CASE 
            WHEN sc.competitor_id IS NOT NULL THEN c.website 
            ELSE NULL::TEXT 
        END AS source_website,
        CASE 
            WHEN sc.competitor_id IS NOT NULL THEN sc.competitor_id 
            ELSE sc.integration_id 
        END AS source_id,
        COALESCE(sc.competitor_url, sc.our_url) AS url
    FROM stock_changes_competitors sc
    LEFT JOIN competitors c ON sc.competitor_id = c.id
    LEFT JOIN integrations i ON sc.integration_id = i.id
    WHERE sc.user_id = p_user_id
      AND sc.product_id = p_product_id
      AND (p_source_id IS NULL OR COALESCE(sc.competitor_id, sc.integration_id) = p_source_id)
    ORDER BY sc.changed_at DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_products_filtered(uuid, integer, integer, text, text, text, text, text, boolean, uuid[], boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_filtered(p_user_id uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12, p_sort_by text DEFAULT 'created_at'::text, p_sort_order text DEFAULT 'desc'::text, p_brand text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_competitor_ids uuid[] DEFAULT NULL::uuid[], p_has_price boolean DEFAULT NULL::boolean, p_price_lower_than_competitors boolean DEFAULT NULL::boolean, p_price_higher_than_competitors boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _offset integer;
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
                'our_url', fp.our_url,
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


--
-- Name: get_sales_analysis_data(uuid, uuid, timestamp without time zone, timestamp without time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_analysis_data(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid, p_start_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_brand_filter text DEFAULT NULL::text) RETURNS TABLE(product_id uuid, product_name text, brand text, sku text, total_sold bigint, avg_price numeric, total_revenue numeric, active_days bigint, revenue_percentage numeric, avg_daily_sales numeric, avg_daily_revenue numeric)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
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
            SUM(sd.total_revenue) as grand_total_revenue
        FROM sales_data sd
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


--
-- Name: FUNCTION get_sales_analysis_data(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone, p_brand_filter text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_sales_analysis_data(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone, p_brand_filter text) IS 'Returns comprehensive sales analysis data for products based on stock decreases with revenue calculations and daily averages';


--
-- Name: get_scheduling_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_scheduling_stats() RETURNS TABLE(metric_name text, metric_value bigint, description text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
-- Name: get_stock_summary_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_stock_summary_stats(p_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    result JSON;
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


--
-- Name: FUNCTION get_stock_summary_stats(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_stock_summary_stats(p_user_id uuid) IS 'Returns summary statistics for stock tracking including product counts, stock levels, and sales velocity';


--
-- Name: get_stock_turnover_analysis(uuid, uuid, timestamp without time zone, timestamp without time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_stock_turnover_analysis(p_user_id uuid, p_competitor_id uuid DEFAULT NULL::uuid, p_start_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_dead_stock_days integer DEFAULT 30) RETURNS TABLE(product_id uuid, product_name text, brand text, sku text, total_sales bigint, avg_stock_level numeric, current_stock integer, stock_turnover_ratio numeric, stock_status text, days_since_last_sale integer, velocity_category text, last_sale_date timestamp without time zone)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '90 days');
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


--
-- Name: FUNCTION get_stock_turnover_analysis(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone, p_dead_stock_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_stock_turnover_analysis(p_user_id uuid, p_competitor_id uuid, p_start_date timestamp without time zone, p_end_date timestamp without time zone, p_dead_stock_days integer) IS 'Returns stock turnover ratios, dead stock detection, and velocity categorization';


--
-- Name: get_unique_competitor_products(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unique_competitor_products(p_user_id uuid, p_competitor_id uuid) RETURNS integer
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(DISTINCT pc1.product_id)
  FROM price_changes_competitors pc1
  WHERE pc1.user_id = p_user_id
    AND pc1.competitor_id = p_competitor_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_changes_competitors pc2
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
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(DISTINCT pc1.product_id)
  FROM price_changes_competitors pc1
  WHERE pc1.user_id = p_user_id
    AND pc1.integration_id = p_integration_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_changes_competitors pc2
      WHERE pc2.user_id = p_user_id
        AND pc2.product_id = pc1.product_id
        AND (
          (pc2.integration_id IS NOT NULL AND pc2.integration_id != p_integration_id)
          OR pc2.competitor_id IS NOT NULL
        )
    );
$$;


--
-- Name: get_unread_message_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unread_message_count(user_uuid uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
END;
$$;


--
-- Name: get_user_growth_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_growth_stats(period_days integer DEFAULT 30) RETURNS TABLE(date date, new_users bigint, cumulative_users bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
-- Name: get_user_matching_settings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_matching_settings(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    settings JSONB;
BEGIN
    SELECT matching_rules INTO settings
    FROM user_settings
    WHERE user_id = p_user_id;
    
    -- Return default settings if none found
    RETURN COALESCE(settings, '{"ean_priority": true, "sku_brand_fallback": true, "fuzzy_name_matching": false, "min_similarity_score": 80}'::jsonb);
END;
$$;


--
-- Name: FUNCTION get_user_matching_settings(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_matching_settings(p_user_id uuid) IS 'Gets user matching settings with defaults';


--
-- Name: get_user_primary_currency(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_primary_currency(p_user_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    user_currency TEXT;
BEGIN
    -- Get user's primary currency from user_settings
    SELECT primary_currency INTO user_currency
    FROM user_settings
    WHERE user_id = p_user_id;
    
    -- Return user's currency or default to SEK if not set
    RETURN COALESCE(user_currency, 'SEK');
END;
$$;


--
-- Name: get_user_workload(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_workload() RETURNS TABLE(user_id uuid, user_name text, user_email text, active_scrapers bigint, active_integrations bigint, jobs_today bigint, avg_execution_time_ms numeric)
    LANGUAGE plpgsql
    SET search_path TO 'public'
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

CREATE FUNCTION public.get_user_workload_stats() RETURNS TABLE(user_id uuid, user_name text, user_email text, active_scrapers bigint, active_integrations bigint, jobs_today bigint, jobs_this_week bigint, jobs_this_month bigint, avg_execution_time_ms numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
END;
$$;


--
-- Name: FUNCTION get_user_workload_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_workload_stats() IS 'Returns user workload distribution with active scrapers, integrations, and job statistics including daily, weekly, and monthly counts. Removed is_approved column reference.';


--
-- Name: get_worker_capacity_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_worker_capacity_config() RETURNS TABLE(worker_type text, max_concurrent_jobs integer, current_jobs integer, description text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
-- Name: is_valid_ean(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_ean(ean_code text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
BEGIN
    -- Return false if ean_code is null, empty, or just whitespace
    IF ean_code IS NULL OR trim(ean_code) = '' THEN
        RETURN FALSE;
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


--
-- Name: FUNCTION is_valid_ean(ean_code text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_valid_ean(ean_code text) IS 'Validates EAN codes to ensure they are 8-13 digits long, contain only numbers, and are not obviously invalid patterns like repeated single digits';


--
-- Name: mark_conversation_messages_read(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversation_messages_read(conversation_uuid uuid, reader_type text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  updated_count INTEGER;
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


--
-- Name: merge_integration_price_changes(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_integration_price_changes(source_integration_name text, target_integration_name text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    source_integration_id UUID;
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


--
-- Name: merge_product_data(text, text, text, text, text, text, text, text, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_product_data(existing_name text, new_name text, existing_sku text, new_sku text, existing_ean text, new_ean text, existing_brand text, new_brand text, existing_brand_id uuid, new_brand_id uuid, existing_image_url text, new_image_url text, existing_url text, new_url text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
END;
$$;


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


--
-- Name: FUNCTION merge_products_api(primary_id uuid, duplicate_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.merge_products_api(primary_id uuid, duplicate_id uuid) IS 'Enhanced product merging with intelligent data selection and no temp table updates';


--
-- Name: normalize_sku(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_sku(sku text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Return NULL if input is NULL or empty
  IF sku IS NULL OR TRIM(sku) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove common separators and normalize to uppercase
  RETURN REGEXP_REPLACE(UPPER(TRIM(sku)), '[^A-Z0-9]', '', 'g');
END;
$$;


--
-- Name: FUNCTION normalize_sku(sku text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_sku(sku text) IS 'Normalizes SKU by removing separators and converting to uppercase. Used for fuzzy SKU matching.';


--
-- Name: normalize_sku_for_matching(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_sku_for_matching(input_sku text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Return NULL if input is NULL or empty
    IF input_sku IS NULL OR trim(input_sku) = '' THEN
        RETURN NULL;
    END IF;
    
    -- Remove spaces, hyphens, equals signs and similar separators
    -- Keep only letters and numbers, convert to lowercase
    RETURN lower(regexp_replace(input_sku, '[^a-zA-Z0-9]', '', 'g'));
END;
$$;


--
-- Name: normalize_url(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_url(url_text text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF url_text IS NULL OR url_text = '' THEN
        RETURN NULL;
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


--
-- Name: optimize_scraper_schedules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimize_scraper_schedules() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ DECLARE scraper_record record; update_count integer := 0; time_slot integer := 0; total_scrapers integer; minutes_per_slot integer; new_hour integer; new_minute integer; new_time text; updated_schedule jsonb; BEGIN SELECT COUNT(*) INTO total_scrapers FROM public.scrapers WHERE is_active = true; minutes_per_slot := GREATEST(5, (24 * 60) / GREATEST(total_scrapers, 1)); FOR scraper_record IN SELECT id, schedule, user_id FROM public.scrapers WHERE is_active = true ORDER BY user_id, id LOOP new_hour := (time_slot * minutes_per_slot) / 60; new_minute := (time_slot * minutes_per_slot) % 60; new_time := LPAD((new_hour % 24)::text, 2, '0') || ':' || LPAD(new_minute::text, 2, '0'); updated_schedule := jsonb_set( scraper_record.schedule, '{time}', to_jsonb(new_time) ); UPDATE public.scrapers SET schedule = updated_schedule, updated_at = now() WHERE id = scraper_record.id; update_count := update_count + 1; time_slot := time_slot + 1; END LOOP; INSERT INTO public.debug_logs (message, created_at) VALUES ('Optimized scraper schedules - updated_scrapers: ' || update_count || ', total_scrapers: ' || total_scrapers || ', minutes_per_slot: ' || minutes_per_slot, now()); RETURN update_count; END; $$;


--
-- Name: populate_our_urls_in_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.populate_our_urls_in_changes() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    updated_count INTEGER := 0;
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


--
-- Name: process_all_pending_temp_integrations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_all_pending_temp_integrations() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    temp_record RECORD;
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


--
-- Name: process_all_temp_data(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_all_temp_data(batch_size integer DEFAULT 500, max_processing_time_minutes integer DEFAULT 30) RETURNS TABLE(processing_stage text, table_name text, processed integer, errors integer, new_products integer, changes integer, processing_time_ms numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
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


--
-- Name: process_custom_fields(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_custom_fields(p_user_id uuid, p_product_id uuid, p_raw_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ BEGIN RETURN process_custom_fields_from_raw_data(p_user_id, p_product_id, p_raw_data); END; $$;


--
-- Name: process_custom_fields_from_raw_data(uuid, uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_custom_fields_from_raw_data(p_user_id uuid, p_product_id uuid, p_raw_data jsonb, p_source_type text DEFAULT 'scraper'::text, p_source_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    field_record RECORD;
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


--
-- Name: process_custom_fields_from_raw_data(uuid, uuid, jsonb, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_custom_fields_from_raw_data(p_user_id uuid, p_product_id uuid, p_raw_data jsonb, p_source_type character varying, p_source_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    field_record RECORD;
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


--
-- Name: process_scraper_timeouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_scraper_timeouts() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ DECLARE timeout_count integer := 0; timeout_record record; BEGIN FOR timeout_record IN SELECT sr.id, sr.scraper_id, sr.started_at FROM public.scraper_runs sr WHERE sr.status = 'running' AND sr.started_at < now() - interval '2 hours' LOOP UPDATE public.scraper_runs SET status = 'failed', completed_at = now(), error_message = 'Job timed out after 2 hours' WHERE id = timeout_record.id; timeout_count := timeout_count + 1; INSERT INTO public.debug_logs (message, created_at) VALUES ('Scraper run timed out - run_id: ' || timeout_record.id || ', scraper_id: ' || timeout_record.scraper_id || ', started_at: ' || timeout_record.started_at, now()); END LOOP; RETURN timeout_count; END; $$;


--
-- Name: process_temp_competitors_batch(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_competitors_batch(p_competitor_id uuid DEFAULT NULL::uuid, batch_size integer DEFAULT 500) RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result_record RECORD;
BEGIN
    -- Call the new function with conflict detection
    SELECT * INTO result_record
    FROM process_temp_competitors_batch_with_conflict_detection(p_competitor_id, batch_size);
    
    -- Return only the original 4 columns for backward compatibility
    RETURN QUERY 
    SELECT result_record.processed, result_record.errors, result_record.new_products, result_record.price_changes;
END;
$$;


--
-- Name: process_temp_competitors_batch_with_conflict_detection(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_competitors_batch_with_conflict_detection(p_competitor_id uuid DEFAULT NULL::uuid, batch_size integer DEFAULT 100) RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer, conflicts integer, reviews integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    temp_record RECORD;
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
BEGIN
    start_time := clock_timestamp();
    RAISE NOTICE 'Starting batch processing with conflict detection for competitor % (batch size: %)', p_competitor_id, batch_size;
    
    -- Get batch IDs for conflict detection (fix array_agg with ORDER BY)
    SELECT array_agg(subq.id ORDER BY subq.scraped_at) INTO batch_ids
    FROM (
        SELECT temp_competitors_scraped_data.id, temp_competitors_scraped_data.scraped_at
        FROM temp_competitors_scraped_data 
        WHERE (p_competitor_id IS NULL OR temp_competitors_scraped_data.competitor_id = p_competitor_id)
          AND temp_competitors_scraped_data.processed = false
        ORDER BY temp_competitors_scraped_data.scraped_at
        LIMIT batch_size
    ) subq;
    
    -- Skip conflict detection if no records to process
    IF array_length(batch_ids, 1) IS NULL OR array_length(batch_ids, 1) = 0 THEN
        RAISE NOTICE 'No records to process';
        RETURN QUERY SELECT 0, 0, 0, 0, 0, 0;
        RETURN;
    END IF;
    
    -- Get user_id from first record
    SELECT temp_competitors_scraped_data.user_id INTO first_user_id
    FROM temp_competitors_scraped_data
    WHERE temp_competitors_scraped_data.id = batch_ids[1];
    
    -- Skip conflict detection for now to simplify processing
    total_conflicts := 0;
    total_reviews := 0;
    
    RAISE NOTICE 'Processing % records without conflict detection', array_length(batch_ids, 1);
    
    -- Process records (simplified without conflict detection)
    FOR temp_record IN 
        SELECT * FROM temp_competitors_scraped_data 
        WHERE (p_competitor_id IS NULL OR temp_competitors_scraped_data.competitor_id = p_competitor_id)
          AND temp_competitors_scraped_data.processed = false
        ORDER BY temp_competitors_scraped_data.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            -- Optimize brand lookup
            v_brand_id := NULL;
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT brands.id INTO v_brand_id 
                FROM brands 
                WHERE brands.user_id = temp_record.user_id 
                  AND LOWER(brands.name) = LOWER(temp_record.brand)
                LIMIT 1;
                
                IF v_brand_id IS NULL THEN
                    SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
                END IF;
            END IF;
            
            -- Optimize product matching
            matched_product_id := NULL;
            
            -- Try EAN match first (fastest)
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT products.id INTO matched_product_id
                FROM products
                WHERE products.user_id = temp_record.user_id
                  AND products.ean = temp_record.ean
                LIMIT 1;
            END IF;
            
            -- Try brand + SKU match if no EAN match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
                SELECT products.id INTO matched_product_id
                FROM products
                WHERE products.user_id = temp_record.user_id
                  AND products.brand_id = v_brand_id
                  AND normalize_sku_for_matching(products.sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;
            END IF;
            
            -- Only use expensive fuzzy matching as last resort
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
            
            -- Create new product if no match found
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, image_url, currency_code
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id, temp_record.image_url, 
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                ) RETURNING products.id INTO matched_product_id;
                
                total_new_products := total_new_products + 1;
            END IF;
            
            -- Process custom fields from raw_data if we have a product and raw_data
            IF matched_product_id IS NOT NULL AND temp_record.raw_data IS NOT NULL THEN
                SELECT process_custom_fields_from_raw_data(
                    temp_record.user_id,
                    matched_product_id,
                    temp_record.raw_data,
                    'competitor',
                    temp_record.competitor_id
                ) INTO custom_fields_processed;
                
                IF custom_fields_processed > 0 THEN
                    RAISE NOTICE 'Processed % custom fields for product %', custom_fields_processed, matched_product_id;
                END IF;
            END IF;
            
            -- Price change detection
            SELECT price_changes_competitors.new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE price_changes_competitors.user_id = temp_record.user_id
              AND price_changes_competitors.product_id = matched_product_id
              AND price_changes_competitors.competitor_id = temp_record.competitor_id
            ORDER BY price_changes_competitors.changed_at DESC
            LIMIT 1;
            
            -- Only insert if price changed
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
            
            -- Stock processing
            IF temp_record.stock_quantity IS NOT NULL OR temp_record.stock_status IS NOT NULL THEN
                SELECT stock_changes_competitors.new_stock_quantity, stock_changes_competitors.new_stock_status, stock_changes_competitors.new_availability_date
                INTO current_stock_quantity, current_stock_status, current_availability_date
                FROM stock_changes_competitors
                WHERE stock_changes_competitors.user_id = temp_record.user_id
                  AND stock_changes_competitors.product_id = matched_product_id
                  AND stock_changes_competitors.competitor_id = temp_record.competitor_id
                ORDER BY stock_changes_competitors.changed_at DESC
                LIMIT 1;
                
                standardized_status := standardize_stock_status(temp_record.stock_status);
                
                IF (current_stock_quantity IS DISTINCT FROM temp_record.stock_quantity) OR 
                   (current_stock_status IS DISTINCT FROM standardized_status) THEN
                    
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
                END IF;
            END IF;
            
            -- Mark as processed and delete
            UPDATE temp_competitors_scraped_data SET processed = true WHERE temp_competitors_scraped_data.id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE temp_competitors_scraped_data.id = temp_record.id;
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
            UPDATE temp_competitors_scraped_data SET processed = true WHERE temp_competitors_scraped_data.id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE temp_competitors_scraped_data.id = temp_record.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'Batch complete! Processed: %, Errors: %, New products: %, Price changes: %, Conflicts: %, Reviews: % (Total time: %.2f ms)', 
                 total_processed, total_errors, total_new_products, total_price_changes, total_conflicts, total_reviews,
                 EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_conflicts, total_reviews;
END;
$$;


--
-- Name: process_temp_competitors_scraped_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_competitors_scraped_data() RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer, conflicts_detected integer, reviews_created integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- This function now uses the conflict detection version
    RAISE NOTICE 'Processing all competitor data using optimized batch function with conflict detection';
    
    RETURN QUERY 
    SELECT * FROM process_temp_competitors_batch_with_conflict_detection(NULL, 500);
END;
$$;


--
-- Name: process_temp_competitors_scraped_data_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_competitors_scraped_data_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only process records that are not marked as processed
    IF NEW.processed = false THEN
        -- Call the batch processing function for this specific record
        -- We'll process it immediately in small batches
        PERFORM process_temp_competitors_batch(NEW.competitor_id, 1);
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: process_temp_integrations_scraped_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_integrations_scraped_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    existing_product_id UUID;
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

    -- Find or create brand if we have brand name and brand field is selected
    v_brand_id := NULL;
    IF NEW.brand IS NOT NULL AND NEW.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        SELECT id INTO v_brand_id FROM brands WHERE user_id = NEW.user_id AND name = NEW.brand;
        IF v_brand_id IS NULL THEN
            INSERT INTO brands (user_id, name, needs_review) VALUES (NEW.user_id, NEW.brand, false) RETURNING id INTO v_brand_id;
        END IF;
    END IF;

    -- Try to find existing product by EAN first, then by SKU+brand
    SELECT id INTO existing_product_id FROM products 
    WHERE user_id = NEW.user_id 
      AND ((NEW.ean IS NOT NULL AND NEW.ean != '' AND ean = NEW.ean)
           OR (NEW.sku IS NOT NULL AND NEW.sku != '' AND NEW.brand IS NOT NULL AND NEW.brand != '' 
               AND sku = NEW.sku AND brand = NEW.brand));

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


--
-- Name: temp_integrations_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_integrations_scraped_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    integration_run_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prestashop_product_id text,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    our_retail_price numeric(10,2),
    our_wholesale_price numeric(10,2),
    image_url text,
    raw_data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    currency_code text,
    our_url text,
    stock_quantity integer,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb,
    CONSTRAINT temp_integrations_scraped_data_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);


--
-- Name: COLUMN temp_integrations_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.stock_quantity IS 'Numeric stock quantity from integration';


--
-- Name: COLUMN temp_integrations_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.stock_status IS 'Text stock status from integration';


--
-- Name: COLUMN temp_integrations_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.availability_date IS 'Future availability date if product is out of stock';


--
-- Name: COLUMN temp_integrations_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.raw_stock_data IS 'Raw stock data from integration including detailed stock information';


--
-- Name: process_temp_integrations_scraped_data_logic(public.temp_integrations_scraped_data); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_integrations_scraped_data_logic(record_data public.temp_integrations_scraped_data) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    existing_product_id UUID;
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

    -- Find or create brand
    v_brand_id := NULL;
    IF record_data.brand IS NOT NULL AND record_data.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        SELECT id INTO v_brand_id FROM brands WHERE user_id = record_data.user_id AND name = record_data.brand;
        IF v_brand_id IS NULL THEN
            INSERT INTO brands (user_id, name, needs_review) VALUES (record_data.user_id, record_data.brand, false) RETURNING id INTO v_brand_id;
        END IF;
    END IF;

    -- Try to find existing product by EAN first, then by SKU+brand
    SELECT id INTO existing_product_id FROM products 
    WHERE user_id = record_data.user_id 
      AND ((record_data.ean IS NOT NULL AND record_data.ean != '' AND ean = record_data.ean)
           OR (record_data.sku IS NOT NULL AND record_data.sku != '' AND record_data.brand IS NOT NULL AND record_data.brand != '' 
               AND sku = record_data.sku AND brand = record_data.brand));

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


--
-- Name: process_temp_integrations_scraped_data_manual(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_integrations_scraped_data_manual(p_record_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    record_data temp_integrations_scraped_data%ROWTYPE;
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


--
-- Name: process_temp_suppliers_batch(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_suppliers_batch(p_supplier_id uuid DEFAULT NULL::uuid, batch_size integer DEFAULT 500) RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    total_price_changes INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
    current_wholesale_price NUMERIC(10,2);
    start_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    RAISE NOTICE 'Starting batch processing for suppliers (batch size: %)', batch_size;
    
    FOR temp_record IN 
        SELECT * FROM temp_suppliers_scraped_data 
        WHERE (p_supplier_id IS NULL OR supplier_id = p_supplier_id)
        ORDER BY scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            -- Brand lookup
            v_brand_id := NULL;
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT id INTO v_brand_id 
                FROM brands 
                WHERE user_id = temp_record.user_id 
                  AND LOWER(name) = LOWER(temp_record.brand)
                LIMIT 1;
                
                IF v_brand_id IS NULL THEN
                    SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
                END IF;
            END IF;
            
            -- Product matching
            matched_product_id := NULL;
            
            -- Try EAN match first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            
            -- Try brand + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND brand_id = v_brand_id
                  AND normalize_sku_for_matching(sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;
            END IF;
            
            -- Fuzzy matching as last resort
            IF matched_product_id IS NULL THEN
                SELECT find_product_with_fuzzy_matching(
                    temp_record.user_id, temp_record.ean, temp_record.brand,
                    temp_record.sku, temp_record.name, v_brand_id
                ) INTO matched_product_id;
            END IF;
            
            -- Create new product if needed (suppliers can create products without our_url)
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, image_url, currency_code,
                    our_wholesale_price
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id, temp_record.image_url, temp_record.currency_code,
                    temp_record.supplier_price
                ) RETURNING id INTO matched_product_id;
                
                total_new_products := total_new_products + 1;
            ELSE
                -- Update existing product with supplier data
                UPDATE products SET
                    our_wholesale_price = COALESCE(temp_record.supplier_price, our_wholesale_price),
                    image_url = COALESCE(temp_record.image_url, image_url),
                    updated_at = NOW()
                WHERE id = matched_product_id;
            END IF;
            
            -- Handle price changes
            SELECT new_our_wholesale_price INTO current_wholesale_price
            FROM price_changes_suppliers
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND (supplier_id = temp_record.supplier_id OR supplier_id IS NULL)
            ORDER BY changed_at DESC
            LIMIT 1;
            
            IF current_wholesale_price IS NULL OR ABS(current_wholesale_price - temp_record.supplier_price) > 0.01 THEN
                INSERT INTO price_changes_suppliers (
                    user_id, product_id, supplier_id, old_our_wholesale_price, new_our_wholesale_price,
                    changed_at, supplier_url, our_url, change_source
                ) VALUES (
                    temp_record.user_id, matched_product_id, temp_record.supplier_id,
                    current_wholesale_price, temp_record.supplier_price, NOW(),
                    temp_record.supplier_url,
                    (SELECT our_url FROM products WHERE id = matched_product_id), -- Get our_url from products
                    'supplier'
                );
                
                total_price_changes := total_price_changes + 1;
            END IF;
            
            DELETE FROM temp_suppliers_scraped_data WHERE id = temp_record.id;
            total_processed := total_processed + 1;
            
            IF total_processed % 50 = 0 THEN
                RAISE NOTICE 'Processed % supplier records', total_processed;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error processing supplier record %: %', temp_record.id, SQLERRM;
            DELETE FROM temp_suppliers_scraped_data WHERE id = temp_record.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'Supplier batch complete! Processed: %, Errors: %, New: %, Changes: % (%.2f ms)', 
                 total_processed, total_errors, total_new_products, total_price_changes,
                 EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes;
END;
$$;


--
-- Name: process_temp_suppliers_scraped_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_temp_suppliers_scraped_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    matched_product_id UUID;
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
            our_url = CASE WHEN (our_url IS NULL OR our_url = '') AND NEW.supplier_url IS NOT NULL AND NEW.supplier_url != '' THEN NEW.supplier_url ELSE our_url END,
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
            our_url
        ) VALUES (
            NEW.user_id,
            NEW.name,
            NEW.sku,
            NEW.ean,
            NEW.brand,
            v_brand_id,
            NEW.image_url,
            NEW.currency_code,
            NEW.supplier_url
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
            supplier_url,
            our_url
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
            NEW.supplier_url,
            (SELECT our_url FROM products WHERE id = matched_product_id)
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
                supplier_url,
                our_url,
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
                NEW.supplier_url,
                (SELECT our_url FROM products WHERE id = matched_product_id),
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


--
-- Name: retry_error_integration_products(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_error_integration_products(run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    stats JSONB;
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


--
-- Name: retry_fetch_failed_runs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retry_fetch_failed_runs() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.brand_id IS NULL AND NEW.brand IS NOT NULL THEN
    SELECT id INTO NEW.brand_id FROM brands WHERE name = NEW.brand LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_statement_timeout(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_statement_timeout(p_milliseconds integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  EXECUTE format('SET statement_timeout = %s', p_milliseconds);
END;
$$;


--
-- Name: standardize_stock_status(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.standardize_stock_status(raw_status text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF raw_status IS NULL OR raw_status = '' THEN
        RETURN 'unknown';
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


--
-- Name: FUNCTION standardize_stock_status(raw_status text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.standardize_stock_status(raw_status text) IS 'Standardizes various stock status formats into consistent categories';


--
-- Name: store_custom_field_optimized(uuid, uuid, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_custom_field_optimized(p_product_id uuid, p_custom_field_id uuid, p_field_name text, p_field_value text, p_source_type text DEFAULT 'scraper'::text, p_source_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_value_hash TEXT;
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


--
-- Name: sync_brand_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_brand_id() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
    SET search_path TO 'public'
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
-- Name: sync_our_urls_from_products(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_our_urls_from_products(p_user_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid) RETURNS TABLE(table_name text, updated_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_updated_count INTEGER;
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


--
-- Name: trigger_sync_our_url_on_product_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_sync_our_url_on_product_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only sync if our_url was actually changed
    IF OLD.our_url IS DISTINCT FROM NEW.our_url AND NEW.our_url IS NOT NULL THEN
        -- Sync the our_url to all related price and stock changes
        PERFORM sync_our_urls_from_products(NEW.user_id, NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: trim_progress_messages(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_progress_messages(p_run_id uuid, p_max_messages integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
-- Name: undismiss_product_duplicates(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.undismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    ordered_id_1 UUID;
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


--
-- Name: FUNCTION undismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.undismiss_product_duplicates(p_user_id uuid, p_product_id_1 uuid, p_product_id_2 uuid) IS 'Undismisses product duplicates to allow them to appear in duplicate detection again';


--
-- Name: update_conversation_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE support_conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_integration_next_run_on_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_next_run_on_completion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Update next_run_time when status changes to 'completed' or 'failed'
    IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
       (NEW.status = 'failed' AND OLD.status != 'failed') THEN
        
        IF NEW.status = 'completed' THEN
            -- Update the integration's last_sync_at and next_run_time for successful runs
            UPDATE public.integrations
            SET 
                last_sync_at = NEW.completed_at,
                last_sync_status = 'success',
                status = 'active',  -- Ensure it stays active
                updated_at = now()
            WHERE id = NEW.integration_id;
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


--
-- Name: update_integration_next_run_time(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_next_run_time(integration_id uuid, completed_at timestamp with time zone DEFAULT now()) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    integration_record record;
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


--
-- Name: update_integration_progress_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_progress_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Only update last_progress_update if products_processed actually changed
    -- and the status is 'processing'
    IF NEW.status = 'processing' AND 
       (OLD.products_processed IS NULL OR NEW.products_processed != OLD.products_processed) THEN
        NEW.last_progress_update = now();
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_integration_run_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_run_status(run_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
-- Name: update_product_match_reviews_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_match_reviews_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_scheduling_config(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_scheduling_config(p_max_python_workers integer DEFAULT 1, p_max_typescript_workers integer DEFAULT 1, p_max_integration_workers integer DEFAULT 1, p_max_jobs_per_run integer DEFAULT 2) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
-- Name: update_scraper_next_run_on_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_scraper_next_run_on_completion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Only update next_run_time when status changes to 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Update the scraper's last_run and calculate next_run_time
        UPDATE public.scrapers
        SET 
            last_run = NEW.completed_at,
            updated_at = now()
        WHERE id = NEW.scraper_id;
        
        -- Calculate and set the next run time
        PERFORM public.update_scraper_next_run_time(NEW.scraper_id, NEW.completed_at);
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_scraper_next_run_time(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_scraper_next_run_time(scraper_id uuid, completed_at timestamp with time zone DEFAULT now()) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    scraper_record record;
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


--
-- Name: update_scraper_status_from_run(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_scraper_status_from_run() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
-- Name: validate_temp_competitors_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_temp_competitors_data() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    user_matching_rules JSONB;
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


--
-- Name: validate_temp_integrations_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_temp_integrations_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Basic validation only - keep it simple and fast
    IF (NEW.our_retail_price IS NULL OR NEW.our_retail_price <= 0) AND
       (NEW.our_wholesale_price IS NULL OR NEW.our_wholesale_price <= 0) THEN
        RAISE EXCEPTION 'Either our_retail_price or our_wholesale_price must be provided and greater than 0';
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


--
-- Name: validate_temp_suppliers_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_temp_suppliers_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Basic validation only - keep it simple and fast
    IF NEW.supplier_price IS NOT NULL AND NEW.supplier_price <= 0 THEN
        RAISE EXCEPTION 'supplier_price must be greater than 0, got: %', NEW.supplier_price;
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


--
-- Name: validate_url(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_url(url_text text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Basic URL validation
    IF url_text IS NULL OR url_text = '' THEN
        RETURN FALSE;
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
    updated_at timestamp with time zone DEFAULT now(),
    next_run_time timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN integrations.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.integrations.is_active IS 'Whether the integration is active and should run on schedule';


--
-- Name: marketing_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    message text NOT NULL,
    contact_type text DEFAULT 'general'::text,
    status text DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketing_contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['general'::text, 'sales'::text, 'support'::text, 'partnership'::text]))),
    CONSTRAINT marketing_contacts_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'resolved'::text])))
);


--
-- Name: newsletter_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    subscribed_at timestamp with time zone DEFAULT now(),
    unsubscribed_at timestamp with time zone,
    is_active boolean DEFAULT true
);


--
-- Name: price_changes_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    old_competitor_price numeric(10,2),
    new_competitor_price numeric(10,2),
    price_change_percentage numeric(10,2),
    changed_at timestamp with time zone DEFAULT now(),
    integration_id uuid,
    currency_code text,
    competitor_url text,
    old_our_retail_price numeric(10,2),
    new_our_retail_price numeric(10,2),
    our_url text,
    CONSTRAINT check_at_least_one_price CHECK (((new_competitor_price IS NOT NULL) OR (new_our_retail_price IS NOT NULL))),
    CONSTRAINT check_competitor_price_has_competitor_id CHECK ((((old_competitor_price IS NULL) AND (new_competitor_price IS NULL)) OR ((competitor_id IS NOT NULL) AND (integration_id IS NULL)))),
    CONSTRAINT check_our_retail_price_has_integration_id CHECK ((((old_our_retail_price IS NULL) AND (new_our_retail_price IS NULL)) OR ((integration_id IS NOT NULL) AND (competitor_id IS NULL)))),
    CONSTRAINT check_price_consistency CHECK ((((old_competitor_price IS NULL) = (new_competitor_price IS NULL)) OR ((old_our_retail_price IS NULL) = (new_our_retail_price IS NULL)))),
    CONSTRAINT check_price_type_consistency CHECK ((((old_competitor_price IS NULL) AND (old_our_retail_price IS NULL)) OR ((old_competitor_price IS NOT NULL) AND (old_our_retail_price IS NULL)) OR ((old_competitor_price IS NULL) AND (old_our_retail_price IS NOT NULL)))),
    CONSTRAINT price_changes_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code)))),
    CONSTRAINT price_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);


--
-- Name: COLUMN price_changes_competitors.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.price_changes_competitors.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';


--
-- Name: price_changes_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    old_our_wholesale_price numeric(10,2),
    new_our_wholesale_price numeric(10,2),
    price_change_percentage numeric(10,2),
    currency_code text DEFAULT 'SEK'::text,
    supplier_url text,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    changed_at timestamp with time zone DEFAULT now(),
    change_source text DEFAULT 'manual'::text,
    old_supplier_price numeric(10,2),
    new_supplier_price numeric(10,2),
    old_supplier_recommended_price numeric(10,2),
    new_supplier_recommended_price numeric(10,2),
    integration_id uuid,
    our_url text,
    CONSTRAINT check_exactly_one_source CHECK ((((supplier_id IS NOT NULL) AND (integration_id IS NULL)) OR ((supplier_id IS NULL) AND (integration_id IS NOT NULL)))),
    CONSTRAINT check_our_wholesale_price_has_integration_id CHECK ((((old_our_wholesale_price IS NULL) AND (new_our_wholesale_price IS NULL)) OR ((integration_id IS NOT NULL) AND (supplier_id IS NULL)))),
    CONSTRAINT check_supplier_price_consistency CHECK (((old_supplier_price IS NULL) = (new_supplier_price IS NULL))),
    CONSTRAINT check_supplier_price_has_supplier_id CHECK ((((old_supplier_price IS NULL) AND (new_supplier_price IS NULL)) OR ((supplier_id IS NOT NULL) AND (integration_id IS NULL)))),
    CONSTRAINT price_changes_suppliers_change_source_check CHECK ((change_source = ANY (ARRAY['manual'::text, 'csv'::text, 'scraper'::text, 'integration'::text])))
);


--
-- Name: product_custom_field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_field_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    custom_field_id uuid NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_type character varying(20),
    source_id uuid,
    last_updated_by character varying(20),
    confidence_score integer DEFAULT 100,
    created_by_source character varying(20),
    value_hash text
);


--
-- Name: product_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    field_name text NOT NULL,
    field_type text NOT NULL,
    is_required boolean DEFAULT false,
    default_value text,
    validation_rules jsonb,
    created_at timestamp with time zone DEFAULT now(),
    update_strategy character varying(20) DEFAULT 'source_priority'::character varying,
    source_priority jsonb DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::jsonb,
    allow_auto_update boolean DEFAULT true,
    CONSTRAINT user_custom_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'url'::text, 'date'::text])))
);


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
    our_retail_price numeric(10,2),
    our_wholesale_price numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brand_id uuid NOT NULL,
    currency_code text,
    our_url text,
    CONSTRAINT products_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);


--
-- Name: COLUMN products.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';


--
-- Name: COLUMN products.our_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.our_url IS 'URL to the product on the source platform';


--
-- Name: products_dismissed_duplicates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products_dismissed_duplicates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id_1 uuid NOT NULL,
    product_id_2 uuid NOT NULL,
    dismissal_key text NOT NULL,
    dismissed_at timestamp without time zone DEFAULT now(),
    CONSTRAINT product_id_order CHECK ((product_id_1 < product_id_2))
);


--
-- Name: professional_scraper_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professional_scraper_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    competitor_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    website text NOT NULL,
    requirements text NOT NULL,
    additional_info text,
    status text DEFAULT 'submitted'::text,
    quoted_price numeric(10,2),
    estimated_delivery_days integer,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT professional_scraper_requests_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'quoted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: rate_limit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet NOT NULL,
    endpoint text NOT NULL,
    attempts integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


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
-- Name: scraper_run_timeouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_run_timeouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    timeout_at timestamp with time zone NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


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
    filter_by_active_brands boolean DEFAULT false NOT NULL,
    supplier_id uuid,
    next_run_time timestamp with time zone,
    CONSTRAINT scrapers_target_check CHECK ((((competitor_id IS NOT NULL) AND (supplier_id IS NULL)) OR ((competitor_id IS NULL) AND (supplier_id IS NOT NULL))))
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
-- Name: stock_changes_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_changes_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    integration_id uuid,
    old_stock_quantity integer,
    new_stock_quantity integer,
    old_stock_status text,
    new_stock_status text,
    old_availability_date date,
    new_availability_date date,
    stock_change_quantity integer,
    changed_at timestamp with time zone DEFAULT now(),
    raw_stock_data jsonb,
    competitor_url text,
    our_url text,
    CONSTRAINT stock_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);


--
-- Name: TABLE stock_changes_competitors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_changes_competitors IS 'Tracks stock level changes for competitor products over time';


--
-- Name: COLUMN stock_changes_competitors.stock_change_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_competitors.stock_change_quantity IS 'Calculated field: new_stock_quantity - old_stock_quantity';


--
-- Name: COLUMN stock_changes_competitors.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_competitors.raw_stock_data IS 'JSON data containing detailed stock information like product combinations/variants';


--
-- Name: stock_changes_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_changes_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    integration_id uuid,
    old_stock_quantity integer,
    new_stock_quantity integer,
    old_stock_status text,
    new_stock_status text,
    old_availability_date date,
    new_availability_date date,
    stock_change_quantity integer,
    changed_at timestamp with time zone DEFAULT now(),
    raw_stock_data jsonb,
    supplier_url text,
    our_url text,
    CONSTRAINT stock_changes_suppliers_source_check CHECK (((supplier_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);


--
-- Name: TABLE stock_changes_suppliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_changes_suppliers IS 'Tracks stock level changes for supplier products over time';


--
-- Name: COLUMN stock_changes_suppliers.stock_change_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_suppliers.stock_change_quantity IS 'Calculated field: new_stock_quantity - old_stock_quantity';


--
-- Name: COLUMN stock_changes_suppliers.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_suppliers.raw_stock_data IS 'JSON data containing detailed stock information';


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    website text,
    contact_email text,
    contact_phone text,
    logo_url text,
    notes text,
    login_username text,
    login_password text,
    api_key text,
    api_url text,
    login_url text,
    price_file_url text,
    scraping_config jsonb,
    sync_frequency text DEFAULT 'weekly'::text,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suppliers_sync_frequency_check CHECK ((sync_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'manual'::text])))
);


--
-- Name: support_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    admin_user_id uuid,
    subject text NOT NULL,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'medium'::text,
    category text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    last_read_by_user timestamp with time zone,
    last_read_by_admin timestamp with time zone,
    CONSTRAINT support_conversations_category_check CHECK ((category = ANY (ARRAY['general'::text, 'technical'::text, 'billing'::text, 'scraper_request'::text, 'feature_request'::text]))),
    CONSTRAINT support_conversations_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    sender_id uuid,
    sender_type text NOT NULL,
    message_content text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_by_recipient boolean DEFAULT false,
    CONSTRAINT support_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['user'::text, 'admin'::text])))
);


--
-- Name: temp_competitors_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_competitors_scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scraper_id uuid,
    competitor_id uuid NOT NULL,
    product_id uuid,
    name text NOT NULL,
    competitor_price numeric(10,2) NOT NULL,
    competitor_url text,
    image_url text,
    sku text,
    brand text,
    scraped_at timestamp with time zone DEFAULT now(),
    ean text,
    currency_code text,
    raw_data jsonb,
    stock_quantity integer,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb,
    processed boolean DEFAULT false,
    CONSTRAINT temp_competitors_scraped_data_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);


--
-- Name: COLUMN temp_competitors_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.stock_quantity IS 'Numeric stock quantity extracted from competitor site';


--
-- Name: COLUMN temp_competitors_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.stock_status IS 'Text stock status (e.g., "I lager", "Ej i lager")';


--
-- Name: COLUMN temp_competitors_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.availability_date IS 'Future availability date if product is out of stock';


--
-- Name: COLUMN temp_competitors_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.raw_stock_data IS 'Raw stock data from scraper including combinations and metadata';


--
-- Name: temp_suppliers_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_suppliers_scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    scraper_id uuid NOT NULL,
    run_id text NOT NULL,
    name text,
    sku text,
    brand text,
    ean text,
    supplier_price numeric(10,2),
    currency_code text DEFAULT 'SEK'::text,
    supplier_url text,
    image_url text,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    stock_quantity integer,
    product_description text,
    category text,
    scraped_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    supplier_recommended_price numeric(10,2),
    raw_data jsonb,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb
);


--
-- Name: COLUMN temp_suppliers_scraped_data.supplier_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.supplier_price IS 'Supplier cost price (what they charge us)';


--
-- Name: COLUMN temp_suppliers_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.stock_quantity IS 'Numeric stock quantity from supplier (renamed from stock_level)';


--
-- Name: COLUMN temp_suppliers_scraped_data.supplier_recommended_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.supplier_recommended_price IS 'Supplier recommended retail price (what they suggest we charge customers)';


--
-- Name: COLUMN temp_suppliers_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.stock_status IS 'Text stock status from supplier';


--
-- Name: COLUMN temp_suppliers_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.availability_date IS 'Future availability date if product is out of stock';


--
-- Name: COLUMN temp_suppliers_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.raw_stock_data IS 'Raw stock data from supplier including detailed stock information';


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
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
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
    auto_create_custom_fields boolean DEFAULT true,
    custom_fields_update_strategy character varying(20) DEFAULT 'source_priority'::character varying,
    custom_fields_source_priority jsonb DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::jsonb,
    CONSTRAINT companies_primary_currency_check CHECK ((char_length(primary_currency) = 3))
);


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
-- Name: user_settings companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
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
-- Name: marketing_contacts marketing_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_pkey PRIMARY KEY (id);


--
-- Name: newsletter_subscriptions newsletter_subscriptions_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_email_key UNIQUE (email);


--
-- Name: newsletter_subscriptions newsletter_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: price_changes_competitors price_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_pkey PRIMARY KEY (id);


--
-- Name: price_changes_suppliers price_changes_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_pkey PRIMARY KEY (id);


--
-- Name: product_custom_field_values product_custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_pkey PRIMARY KEY (id);


--
-- Name: product_custom_field_values product_custom_field_values_product_id_custom_field_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_product_id_custom_field_id_key UNIQUE (product_id, custom_field_id);


--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: professional_scraper_requests professional_scraper_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_log rate_limit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_log
    ADD CONSTRAINT rate_limit_log_pkey PRIMARY KEY (id);


--
-- Name: scraper_ai_sessions scraper_ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_pkey PRIMARY KEY (id);


--
-- Name: scraper_run_timeouts scraper_run_timeouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_run_timeouts
    ADD CONSTRAINT scraper_run_timeouts_pkey PRIMARY KEY (id);


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
-- Name: stock_changes_competitors stock_changes_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT stock_changes_competitors_pkey PRIMARY KEY (id);


--
-- Name: stock_changes_suppliers stock_changes_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT stock_changes_suppliers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: support_conversations support_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_pkey PRIMARY KEY (id);


--
-- Name: temp_integrations_scraped_data temp_integrations_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_integrations_scraped_data
    ADD CONSTRAINT temp_integrations_scraped_data_pkey PRIMARY KEY (id);


--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_pkey PRIMARY KEY (id);


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
-- Name: products_dismissed_duplicates unique_dismissed_product_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT unique_dismissed_product_pair UNIQUE (user_id, product_id_1, product_id_2);


--
-- Name: brands unique_user_brand; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT unique_user_brand UNIQUE (user_id, name);


--
-- Name: product_custom_fields user_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: product_custom_fields user_custom_fields_user_id_field_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_user_id_field_name_key UNIQUE (user_id, field_name);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);


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
-- Name: temp_competitors_scraped_data auto_process_temp_competitors_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_process_temp_competitors_trigger AFTER INSERT ON public.temp_competitors_scraped_data FOR EACH ROW EXECUTE FUNCTION public.process_temp_competitors_scraped_data_trigger();


--
-- Name: temp_integrations_scraped_data auto_process_temp_integrations_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_process_temp_integrations_trigger AFTER INSERT ON public.temp_integrations_scraped_data FOR EACH ROW EXECUTE FUNCTION public.process_temp_integrations_scraped_data();


--
-- Name: integration_runs integration_runs_progress_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER integration_runs_progress_update_trigger BEFORE UPDATE ON public.integration_runs FOR EACH ROW EXECUTE FUNCTION public.update_integration_progress_timestamp();


--
-- Name: scrapers one_active_scraper_per_competitor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER one_active_scraper_per_competitor BEFORE INSERT OR UPDATE ON public.scrapers FOR EACH ROW EXECUTE FUNCTION public.ensure_one_active_scraper_per_competitor();


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
-- Name: products sync_our_url_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_our_url_trigger AFTER UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_our_url_on_product_update();


--
-- Name: support_messages trigger_update_conversation_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_timestamp AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();


--
-- Name: integration_runs trigger_update_integration_next_run; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_integration_next_run AFTER UPDATE ON public.integration_runs FOR EACH ROW EXECUTE FUNCTION public.update_integration_next_run_on_completion();


--
-- Name: scraper_runs trigger_update_scraper_next_run; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_scraper_next_run AFTER UPDATE ON public.scraper_runs FOR EACH ROW EXECUTE FUNCTION public.update_scraper_next_run_on_completion();


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
-- Name: temp_competitors_scraped_data validate_temp_competitors_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_temp_competitors_trigger BEFORE INSERT ON public.temp_competitors_scraped_data FOR EACH ROW EXECUTE FUNCTION public.validate_temp_competitors_data();


--
-- Name: temp_integrations_scraped_data validate_temp_integrations_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_temp_integrations_trigger BEFORE INSERT ON public.temp_integrations_scraped_data FOR EACH ROW EXECUTE FUNCTION public.validate_temp_integrations_data();


--
-- Name: temp_suppliers_scraped_data validate_temp_suppliers_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_temp_suppliers_trigger BEFORE INSERT ON public.temp_suppliers_scraped_data FOR EACH ROW EXECUTE FUNCTION public.validate_temp_suppliers_data();


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
-- Name: stock_changes_competitors fk_stock_competitors_competitor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_competitor FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;


--
-- Name: stock_changes_competitors fk_stock_competitors_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_integration FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: stock_changes_competitors fk_stock_competitors_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_changes_competitors fk_stock_competitors_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stock_changes_suppliers fk_stock_suppliers_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_integration FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: stock_changes_suppliers fk_stock_suppliers_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_changes_suppliers fk_stock_suppliers_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: stock_changes_suppliers fk_stock_suppliers_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: integration_runs integration_runs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: integration_runs integration_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: price_changes_competitors price_changes_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: price_changes_competitors price_changes_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: price_changes_competitors price_changes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: price_changes_suppliers price_changes_suppliers_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: price_changes_suppliers price_changes_suppliers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: price_changes_suppliers price_changes_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: price_changes_suppliers price_changes_suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: price_changes_competitors price_changes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: product_custom_field_values product_custom_field_values_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.product_custom_fields(id);


--
-- Name: product_custom_field_values product_custom_field_values_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_product_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_product_id_1_fkey FOREIGN KEY (product_id_1) REFERENCES public.products(id);


--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_product_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_product_id_2_fkey FOREIGN KEY (product_id_2) REFERENCES public.products(id);


--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: professional_scraper_requests professional_scraper_requests_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);


--
-- Name: professional_scraper_requests professional_scraper_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


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
-- Name: scraper_run_timeouts scraper_run_timeouts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_run_timeouts
    ADD CONSTRAINT scraper_run_timeouts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.scraper_runs(id) ON DELETE CASCADE;


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
-- Name: scrapers scrapers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: scrapers scrapers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: suppliers suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: support_conversations support_conversations_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.user_profiles(id);


--
-- Name: support_conversations support_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: support_messages support_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id);


--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;


--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);


--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: temp_integrations_scraped_data temp_integrations_scraped_data_integration_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_integrations_scraped_data
    ADD CONSTRAINT temp_integrations_scraped_data_integration_run_id_fkey FOREIGN KEY (integration_run_id) REFERENCES public.integration_runs(id) ON DELETE CASCADE;


--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);


--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: product_custom_fields user_custom_fields_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


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
-- Name: accounts; Type: ROW SECURITY; Schema: next_auth; Owner: -
--

ALTER TABLE next_auth.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts service_role_all_accounts; Type: POLICY; Schema: next_auth; Owner: -
--

CREATE POLICY service_role_all_accounts ON next_auth.accounts TO service_role USING (true) WITH CHECK (true);


--
-- Name: sessions service_role_all_sessions; Type: POLICY; Schema: next_auth; Owner: -
--

CREATE POLICY service_role_all_sessions ON next_auth.sessions TO service_role USING (true) WITH CHECK (true);


--
-- Name: users service_role_all_users; Type: POLICY; Schema: next_auth; Owner: -
--

CREATE POLICY service_role_all_users ON next_auth.users TO service_role USING (true) WITH CHECK (true);


--
-- Name: verification_tokens service_role_all_verification_tokens; Type: POLICY; Schema: next_auth; Owner: -
--

CREATE POLICY service_role_all_verification_tokens ON next_auth.verification_tokens TO service_role USING (true) WITH CHECK (true);


--
-- Name: sessions; Type: ROW SECURITY; Schema: next_auth; Owner: -
--

ALTER TABLE next_auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: next_auth; Owner: -
--

ALTER TABLE next_auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: verification_tokens; Type: ROW SECURITY; Schema: next_auth; Owner: -
--

ALTER TABLE next_auth.verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: debug_logs Authenticated users can access debug logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access debug logs" ON public.debug_logs USING ((auth.uid() IS NOT NULL));


--
-- Name: marketing_contacts Authenticated users can access marketing contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access marketing contacts" ON public.marketing_contacts USING ((auth.uid() IS NOT NULL));


--
-- Name: newsletter_subscriptions Authenticated users can access newsletter subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access newsletter subscriptions" ON public.newsletter_subscriptions USING ((auth.uid() IS NOT NULL));


--
-- Name: rate_limit_log Authenticated users can access rate limit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access rate limit logs" ON public.rate_limit_log USING ((auth.uid() IS NOT NULL));


--
-- Name: stock_changes_competitors Users can access their own competitor stock changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own competitor stock changes" ON public.stock_changes_competitors USING ((user_id = auth.uid()));


--
-- Name: product_custom_fields Users can access their own custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own custom fields" ON public.product_custom_fields USING ((user_id = auth.uid()));


--
-- Name: products_dismissed_duplicates Users can access their own dismissed duplicates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own dismissed duplicates" ON public.products_dismissed_duplicates USING ((user_id = auth.uid()));


--
-- Name: product_custom_field_values Users can access their own product custom field values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own product custom field values" ON public.product_custom_field_values USING ((EXISTS ( SELECT 1
   FROM public.product_custom_fields ucf
  WHERE ((ucf.id = product_custom_field_values.custom_field_id) AND (ucf.user_id = auth.uid())))));


--
-- Name: scraper_runs Users can access their own scraper runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own scraper runs" ON public.scraper_runs USING ((user_id = auth.uid()));


--
-- Name: stock_changes_suppliers Users can access their own supplier stock changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own supplier stock changes" ON public.stock_changes_suppliers USING ((user_id = auth.uid()));


--
-- Name: support_messages Users can add messages to own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add messages to own conversations" ON public.support_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.support_conversations
  WHERE ((support_conversations.id = support_messages.conversation_id) AND (support_conversations.user_id = auth.uid()))))));


--
-- Name: support_conversations Users can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create conversations" ON public.support_conversations FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: professional_scraper_requests Users can create scraper requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create scraper requests" ON public.professional_scraper_requests FOR INSERT WITH CHECK ((user_id = auth.uid()));


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
-- Name: user_settings Users can delete their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own company" ON public.user_settings FOR DELETE USING ((auth.uid() = user_id));


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
-- Name: price_changes_suppliers Users can delete their own supplier price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own supplier price changes" ON public.price_changes_suppliers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: temp_suppliers_scraped_data Users can delete their own supplier scraped data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own supplier scraped data" ON public.temp_suppliers_scraped_data FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: suppliers Users can delete their own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own suppliers" ON public.suppliers FOR DELETE USING ((auth.uid() = user_id));


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
-- Name: user_settings Users can insert their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own company" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


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
-- Name: price_changes_competitors Users can insert their own price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own price changes" ON public.price_changes_competitors FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: products Users can insert their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own products" ON public.products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scraper_ai_sessions Users can insert their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scraper AI sessions" ON public.scraper_ai_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scrapers Users can insert their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own scrapers" ON public.scrapers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: price_changes_suppliers Users can insert their own supplier price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own supplier price changes" ON public.price_changes_suppliers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: temp_suppliers_scraped_data Users can insert their own supplier scraped data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own supplier scraped data" ON public.temp_suppliers_scraped_data FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: suppliers Users can insert their own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own suppliers" ON public.suppliers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scraper_run_timeouts Users can manage their own scraper run timeouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own scraper run timeouts" ON public.scraper_run_timeouts USING ((run_id IN ( SELECT sr.id
   FROM public.scraper_runs sr
  WHERE (sr.user_id = auth.uid()))));


--
-- Name: temp_integrations_scraped_data Users can only access their own integration products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only access their own integration products" ON public.temp_integrations_scraped_data USING ((auth.uid() = user_id));


--
-- Name: temp_competitors_scraped_data Users can only access their own scraped products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only access their own scraped products" ON public.temp_competitors_scraped_data USING ((auth.uid() = user_id));


--
-- Name: support_conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own conversations" ON public.support_conversations FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: csv_uploads Users can update their own CSV uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own CSV uploads" ON public.csv_uploads FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: brands Users can update their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own brands" ON public.brands FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can update their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own company" ON public.user_settings FOR UPDATE USING ((auth.uid() = user_id));


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
-- Name: price_changes_suppliers Users can update their own supplier price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own supplier price changes" ON public.price_changes_suppliers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: temp_suppliers_scraped_data Users can update their own supplier scraped data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own supplier scraped data" ON public.temp_suppliers_scraped_data FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: suppliers Users can update their own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own suppliers" ON public.suppliers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: support_messages Users can view messages in own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in own conversations" ON public.support_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.support_conversations
  WHERE ((support_conversations.id = support_messages.conversation_id) AND (support_conversations.user_id = auth.uid())))));


--
-- Name: support_conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own conversations" ON public.support_conversations FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: professional_scraper_requests Users can view own scraper requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own scraper requests" ON public.professional_scraper_requests FOR SELECT USING ((user_id = auth.uid()));


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
-- Name: user_settings Users can view their own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own company" ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


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
-- Name: price_changes_competitors Users can view their own price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own price changes" ON public.price_changes_competitors FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: products Users can view their own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own products" ON public.products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: scraper_ai_sessions Users can view their own scraper AI sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scraper AI sessions" ON public.scraper_ai_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: scrapers Users can view their own scrapers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scrapers" ON public.scrapers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: price_changes_suppliers Users can view their own supplier price changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own supplier price changes" ON public.price_changes_suppliers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: temp_suppliers_scraped_data Users can view their own supplier scraped data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own supplier scraped data" ON public.temp_suppliers_scraped_data FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: suppliers Users can view their own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own suppliers" ON public.suppliers FOR SELECT USING ((auth.uid() = user_id));


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
-- Name: marketing_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: product_custom_field_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_custom_field_values ENABLE ROW LEVEL SECURITY;

--
-- Name: product_custom_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_custom_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products_dismissed_duplicates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products_dismissed_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: professional_scraper_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professional_scraper_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_ai_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_ai_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_run_timeouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_run_timeouts ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: scrapers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrapers ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_changes_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_changes_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_changes_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_changes_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: support_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_competitors_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_competitors_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_integrations_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_integrations_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_suppliers_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_suppliers_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

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

