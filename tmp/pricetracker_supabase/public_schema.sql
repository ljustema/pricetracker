


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_list_unhealthy_scrapers"() RETURNS TABLE("scraper_id" "uuid", "scraper_name" "text", "competitor_id" "uuid", "competitor_name" "text", "user_id" "uuid", "user_email" "text", "status" "text", "reason_code" "text", "reason_text" "text", "last_run_at" timestamp with time zone, "last_run_count" integer, "baseline_median" numeric, "drop_rate" numeric, "rejection_count_last_run" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH all_scrapers AS (
        SELECT s.id, s.name AS sname, s.competitor_id, c.name AS cname,
               s.user_id AS uid, up.email AS uemail
        FROM scrapers s
        JOIN competitors c ON c.id = s.competitor_id
        LEFT JOIN user_profiles up ON up.id = s.user_id
        WHERE s.is_active = true
    ),
    last_runs AS (
        SELECT DISTINCT ON (sr.scraper_id)
               sr.scraper_id, sr.id AS run_id, sr.product_count, sr.started_at,
               sr.completed_at, sr.status
        FROM scraper_runs sr
        JOIN all_scrapers a ON a.id = sr.scraper_id
        WHERE COALESCE(sr.is_test_run, false) = false
        ORDER BY sr.scraper_id, COALESCE(sr.completed_at, sr.started_at) DESC NULLS LAST
    ),
    baselines AS (
        SELECT
            sr.scraper_id,
            percentile_cont(0.5) WITHIN GROUP (
                ORDER BY sr.product_count
            )::numeric AS median_count
        FROM (
            SELECT sr.scraper_id, sr.product_count,
                   ROW_NUMBER() OVER (
                       PARTITION BY sr.scraper_id
                       ORDER BY COALESCE(sr.completed_at, sr.started_at) DESC
                   ) AS rn
            FROM scraper_runs sr
            JOIN last_runs lr ON lr.scraper_id = sr.scraper_id
            WHERE sr.status = 'completed'
              AND COALESCE(sr.is_test_run, false) = false
              AND sr.id <> lr.run_id
              AND sr.product_count IS NOT NULL
        ) sr
        WHERE sr.rn <= 10
        GROUP BY sr.scraper_id
    ),
    rejections AS (
        SELECT lr.scraper_id, COUNT(*)::integer AS rej_count
        FROM last_runs lr
        JOIN scraper_run_rejections r ON r.scraper_id = lr.scraper_id
        WHERE r.rejected_at >= lr.started_at
          AND r.rejected_at <= COALESCE(lr.completed_at, now()) + interval '5 minutes'
        GROUP BY lr.scraper_id
    ),
    health AS (
        SELECT
            a.id AS sid,
            a.sname,
            a.competitor_id AS cid,
            a.cname,
            a.uid,
            a.uemail,
            lr.product_count AS last_count,
            COALESCE(lr.completed_at, lr.started_at) AS last_at,
            lr.status AS last_status,
            b.median_count,
            COALESCE(r.rej_count, 0) AS rej_count,
            -- product_count = rows SENT by worker; rejections is a subset of that.
            -- Use GREATEST as denominator to be robust against timing gaps.
            CASE
                WHEN GREATEST(COALESCE(lr.product_count,0), COALESCE(r.rej_count,0)) = 0 THEN 0::numeric
                ELSE LEAST(
                    COALESCE(r.rej_count,0)::numeric
                        / GREATEST(COALESCE(lr.product_count,0), COALESCE(r.rej_count,0))::numeric,
                    1::numeric
                )
            END AS dr
        FROM all_scrapers a
        LEFT JOIN last_runs lr ON lr.scraper_id = a.id
        LEFT JOIN baselines b ON b.scraper_id = a.id
        LEFT JOIN rejections r ON r.scraper_id = a.id
        WHERE lr.run_id IS NOT NULL
    ),
    classified AS (
        SELECT
            h.*,
            CASE
                WHEN h.last_status = 'failed' THEN 'critical'
                WHEN h.last_status = 'completed' AND COALESCE(h.last_count,0) = 0 THEN 'critical'
                WHEN h.dr >= 0.5 THEN 'critical'
                WHEN h.median_count IS NOT NULL AND h.median_count > 0
                     AND h.last_count::numeric < 0.5 * h.median_count THEN 'critical'
                WHEN h.dr >= 0.1 THEN 'warning'
                WHEN h.median_count IS NOT NULL AND h.median_count > 0
                     AND h.last_count::numeric < 0.8 * h.median_count THEN 'warning'
                ELSE 'ok'
            END AS st,
            CASE
                WHEN h.last_status = 'failed' THEN 'last_run_failed'
                WHEN h.last_status = 'completed' AND COALESCE(h.last_count,0) = 0 THEN 'zero_products'
                WHEN h.dr >= 0.5 THEN 'high_drop_rate'
                WHEN h.median_count IS NOT NULL AND h.median_count > 0
                     AND h.last_count::numeric < 0.5 * h.median_count THEN 'low_volume_critical'
                WHEN h.dr >= 0.1 THEN 'elevated_drop_rate'
                WHEN h.median_count IS NOT NULL AND h.median_count > 0
                     AND h.last_count::numeric < 0.8 * h.median_count THEN 'low_volume_warning'
                ELSE 'ok'
            END AS rcode
        FROM health h
    )
    SELECT
        c.sid, c.sname, c.cid, c.cname, c.uid, c.uemail,
        c.st, c.rcode,
        CASE c.rcode
            WHEN 'last_run_failed'       THEN 'Senaste körningen misslyckades'
            WHEN 'zero_products'         THEN 'Körningen lyckades men hittade 0 produkter'
            WHEN 'high_drop_rate'        THEN format('Drop-rate %s%% – rader avvisas (saknad brand/SKU)', round(c.dr*100))
            WHEN 'low_volume_critical'   THEN format('Endast %s produkter vs baseline %s (< 50%%)', c.last_count, round(c.median_count))
            WHEN 'elevated_drop_rate'    THEN format('Drop-rate %s%% – kontrollera extraktion', round(c.dr*100))
            WHEN 'low_volume_warning'    THEN format('Endast %s produkter vs baseline %s (< 80%%)', c.last_count, round(c.median_count))
            ELSE 'OK'
        END,
        c.last_at, c.last_count, c.median_count, round(c.dr,4), c.rej_count
    FROM classified c
    WHERE c.st IN ('warning','critical')
    ORDER BY
        CASE c.st WHEN 'critical' THEN 0 ELSE 1 END,
        c.last_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."admin_list_unhealthy_scrapers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_log_to_scraper_run"("p_run_id" "uuid", "p_log_entry" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE scraper_runs
  SET progress_messages = coalesce(progress_messages, '[]'::jsonb) || p_log_entry
  WHERE id = p_run_id;
END;
$$;


ALTER FUNCTION "public"."append_log_to_scraper_run"("p_run_id" "uuid", "p_log_entry" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_logs_to_scraper_run"("p_run_id" "uuid", "p_log_entries" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Use a single update to append all log entries at once
  UPDATE scraper_runs
  SET progress_messages = COALESCE(progress_messages, ARRAY[]::text[]) || p_log_entries
  WHERE id = p_run_id;
END;
$$;


ALTER FUNCTION "public"."append_logs_to_scraper_run"("p_run_id" "uuid", "p_log_entries" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."append_logs_to_scraper_run"("p_run_id" "uuid", "p_log_entries" "text"[]) IS 'Efficiently appends multiple log entries to a scraper run''s progress_messages in a single database operation';



CREATE OR REPLACE FUNCTION "public"."auto_trim_progress_messages"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."auto_trim_progress_messages"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_trim_progress_messages"() IS 'Automatically trims progress_messages when they exceed 200 entries';



CREATE OR REPLACE FUNCTION "public"."calculate_all_daily_snapshots"("p_user_id" "uuid", "p_snapshot_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("combination_type" "text", "competitor_name" "text", "brand_filter" "text", "total_products" integer, "success" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    competitor_record RECORD;
    brand_record RECORD;
    result_record RECORD;
BEGIN
    -- 1. Calculate snapshot for all competitors, all brands
    SELECT * INTO result_record
    FROM calculate_daily_price_competitiveness_snapshot(p_user_id, p_snapshot_date, NULL, NULL);

    RETURN QUERY SELECT
        'All Competitors, All Brands'::TEXT,
        'All Competitors'::TEXT,
        'All Brands'::TEXT,
        result_record.total_products,
        TRUE;

    -- 2. Calculate snapshots for each individual competitor (all brands)
    FOR competitor_record IN
        SELECT id, name FROM competitors WHERE user_id = p_user_id AND is_active = true
    LOOP
        SELECT * INTO result_record
        FROM calculate_daily_price_competitiveness_snapshot(p_user_id, p_snapshot_date, competitor_record.id, NULL);

        RETURN QUERY SELECT
            'Individual Competitor, All Brands'::TEXT,
            competitor_record.name,
            'All Brands'::TEXT,
            result_record.total_products,
            TRUE;
    END LOOP;

    -- 3. Calculate snapshots for each brand (all competitors)
    FOR brand_record IN
        SELECT DISTINCT brand FROM products
        WHERE user_id = p_user_id AND is_active = true AND brand IS NOT NULL AND brand != ''
        ORDER BY brand
    LOOP
        SELECT * INTO result_record
        FROM calculate_daily_price_competitiveness_snapshot(p_user_id, p_snapshot_date, NULL, brand_record.brand);

        RETURN QUERY SELECT
            'All Competitors, Individual Brand'::TEXT,
            'All Competitors'::TEXT,
            brand_record.brand,
            result_record.total_products,
            TRUE;
    END LOOP;

    -- Note: We could also add competitor+brand combinations, but that might be too many combinations
    -- for now. Can be added later if needed.
END;
$$;


ALTER FUNCTION "public"."calculate_all_daily_snapshots"("p_user_id" "uuid", "p_snapshot_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_all_daily_snapshots"("p_user_id" "uuid", "p_snapshot_date" "date") IS 'Calculates daily snapshots for all relevant combinations of competitors and brands.
This is useful for batch processing in cron jobs.
Parameters:
- p_user_id: The user ID to calculate snapshots for
- p_snapshot_date: The date for the snapshot (default: today)';



CREATE OR REPLACE FUNCTION "public"."calculate_daily_price_competitiveness_snapshot"("p_user_id" "uuid", "p_snapshot_date" "date" DEFAULT CURRENT_DATE, "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_brand_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("snapshot_id" "uuid", "total_products" integer, "cheapest_count" integer, "same_price_count" integer, "more_expensive_count" integer, "cheapest_percentage" numeric, "same_price_percentage" numeric, "more_expensive_percentage" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_snapshot_id UUID;
  v_total_products INTEGER := 0;
  v_cheapest_count INTEGER := 0;
  v_same_price_count INTEGER := 0;
  v_more_expensive_count INTEGER := 0;
  v_cheapest_percentage NUMERIC := 0;
  v_same_price_percentage NUMERIC := 0;
  v_more_expensive_percentage NUMERIC := 0;
  v_avg_diff_when_higher NUMERIC := 0;
  v_avg_diff_pct_when_higher NUMERIC := 0;
  v_total_potential_savings NUMERIC := 0;
  v_is_current_date BOOLEAN;
BEGIN
  -- Check if we're calculating for current date
  v_is_current_date := (p_snapshot_date = CURRENT_DATE);

  -- Use optimized path for current date, historical path for past dates
  IF v_is_current_date THEN
    -- OPTIMIZED PATH: Use materialized view for current date
    WITH competitor_price_data AS (
      SELECT 
        mv.id as product_id,
        mv.our_retail_price,
        elem->>'competitor_id' as comp_id_text,
        (elem->>'new_competitor_price')::NUMERIC as comp_price
      FROM latest_product_data_mv mv,
           jsonb_array_elements(mv.competitor_prices::jsonb) as elem
      WHERE mv.user_id = p_user_id
        AND mv.our_retail_price IS NOT NULL
        AND mv.is_active = true
        AND mv.competitor_count > 0
        AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
        AND (p_competitor_id IS NULL OR (elem->>'competitor_id')::UUID = p_competitor_id)
    ),
    product_min_prices AS (
      SELECT 
        cpd.product_id,
        MIN(cpd.comp_price) as min_competitor_price
      FROM competitor_price_data cpd
      GROUP BY cpd.product_id
    ),
    price_analysis AS (
      SELECT
        mv.id as product_id,
        mv.our_retail_price,
        pmp.min_competitor_price,
        CASE
          WHEN mv.our_retail_price < pmp.min_competitor_price THEN 'cheapest'
          WHEN mv.our_retail_price = pmp.min_competitor_price THEN 'same_price'
          ELSE 'more_expensive'
        END as price_status,
        CASE 
          WHEN mv.our_retail_price > pmp.min_competitor_price 
          THEN mv.our_retail_price - pmp.min_competitor_price 
          ELSE 0 
        END as price_difference,
        CASE 
          WHEN mv.our_retail_price > pmp.min_competitor_price 
          THEN ((mv.our_retail_price - pmp.min_competitor_price) / mv.our_retail_price * 100)
          ELSE 0 
        END as price_difference_percentage
      FROM latest_product_data_mv mv
      JOIN product_min_prices pmp ON mv.id = pmp.product_id
      WHERE mv.user_id = p_user_id
        AND mv.our_retail_price IS NOT NULL
        AND mv.is_active = true
        AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
    ),
    aggregated_stats AS (
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE price_status = 'cheapest') as cheapest_count,
        COUNT(*) FILTER (WHERE price_status = 'same_price') as same_price_count,
        COUNT(*) FILTER (WHERE price_status = 'more_expensive') as more_expensive_count,
        AVG(price_difference) FILTER (WHERE price_status = 'more_expensive') as avg_diff_when_higher,
        AVG(price_difference_percentage) FILTER (WHERE price_status = 'more_expensive') as avg_diff_pct_when_higher,
        SUM(price_difference) as total_potential_savings
      FROM price_analysis
    )
    SELECT 
      ast.total_products,
      ast.cheapest_count,
      ast.same_price_count,
      ast.more_expensive_count,
      ast.avg_diff_when_higher,
      ast.avg_diff_pct_when_higher,
      ast.total_potential_savings
    INTO 
      v_total_products,
      v_cheapest_count,
      v_same_price_count,
      v_more_expensive_count,
      v_avg_diff_when_higher,
      v_avg_diff_pct_when_higher,
      v_total_potential_savings
    FROM aggregated_stats ast;

  ELSE
    -- HISTORICAL PATH: Use price_changes_competitors for past dates
    WITH latest_competitor_prices AS (
      SELECT DISTINCT ON (pcc.product_id, pcc.competitor_id)
        pcc.product_id,
        pcc.competitor_id,
        pcc.new_competitor_price,
        pcc.changed_at
      FROM price_changes_competitors pcc
      WHERE pcc.user_id = p_user_id
        AND pcc.new_competitor_price IS NOT NULL
        AND pcc.competitor_id IS NOT NULL
        AND pcc.changed_at::date <= p_snapshot_date
        AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
      ORDER BY pcc.product_id, pcc.competitor_id, pcc.changed_at DESC
    ),
    product_min_prices AS (
      SELECT 
        lcp.product_id,
        MIN(lcp.new_competitor_price) as min_competitor_price
      FROM latest_competitor_prices lcp
      JOIN products p ON lcp.product_id = p.id
      WHERE p.user_id = p_user_id
        AND p.our_retail_price IS NOT NULL
        AND p.is_active = true
        AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
      GROUP BY lcp.product_id
    ),
    price_analysis AS (
      SELECT
        p.id as product_id,
        p.our_retail_price,
        pmp.min_competitor_price,
        CASE
          WHEN p.our_retail_price < pmp.min_competitor_price THEN 'cheapest'
          WHEN p.our_retail_price = pmp.min_competitor_price THEN 'same_price'
          ELSE 'more_expensive'
        END as price_status,
        CASE 
          WHEN p.our_retail_price > pmp.min_competitor_price 
          THEN p.our_retail_price - pmp.min_competitor_price 
          ELSE 0 
        END as price_difference,
        CASE 
          WHEN p.our_retail_price > pmp.min_competitor_price 
          THEN ((p.our_retail_price - pmp.min_competitor_price) / p.our_retail_price * 100)
          ELSE 0 
        END as price_difference_percentage
      FROM products p
      JOIN product_min_prices pmp ON p.id = pmp.product_id
      WHERE p.user_id = p_user_id
        AND p.our_retail_price IS NOT NULL
        AND p.is_active = true
        AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
    ),
    aggregated_stats AS (
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE price_status = 'cheapest') as cheapest_count,
        COUNT(*) FILTER (WHERE price_status = 'same_price') as same_price_count,
        COUNT(*) FILTER (WHERE price_status = 'more_expensive') as more_expensive_count,
        AVG(price_difference) FILTER (WHERE price_status = 'more_expensive') as avg_diff_when_higher,
        AVG(price_difference_percentage) FILTER (WHERE price_status = 'more_expensive') as avg_diff_pct_when_higher,
        SUM(price_difference) as total_potential_savings
      FROM price_analysis
    )
    SELECT 
      ast.total_products,
      ast.cheapest_count,
      ast.same_price_count,
      ast.more_expensive_count,
      ast.avg_diff_when_higher,
      ast.avg_diff_pct_when_higher,
      ast.total_potential_savings
    INTO 
      v_total_products,
      v_cheapest_count,
      v_same_price_count,
      v_more_expensive_count,
      v_avg_diff_when_higher,
      v_avg_diff_pct_when_higher,
      v_total_potential_savings
    FROM aggregated_stats ast;
  END IF;

  -- Calculate percentages
  IF v_total_products > 0 THEN
    v_cheapest_percentage := ROUND((v_cheapest_count::NUMERIC / v_total_products * 100), 2);
    v_same_price_percentage := ROUND((v_same_price_count::NUMERIC / v_total_products * 100), 2);
    v_more_expensive_percentage := ROUND((v_more_expensive_count::NUMERIC / v_total_products * 100), 2);
  END IF;

  -- Insert or update the snapshot
  INSERT INTO daily_price_competitiveness_snapshots (
    user_id,
    snapshot_date,
    competitor_id,
    brand_filter,
    total_products_analyzed,
    products_we_are_cheapest,
    products_we_are_same_price,
    products_we_are_more_expensive,
    cheapest_percentage,
    same_price_percentage,
    more_expensive_percentage,
    avg_price_difference_when_higher,
    avg_price_difference_percentage_when_higher,
    total_potential_savings
  ) VALUES (
    p_user_id,
    p_snapshot_date,
    p_competitor_id,
    p_brand_filter,
    v_total_products,
    v_cheapest_count,
    v_same_price_count,
    v_more_expensive_count,
    v_cheapest_percentage,
    v_same_price_percentage,
    v_more_expensive_percentage,
    ROUND(v_avg_diff_when_higher, 2),
    ROUND(v_avg_diff_pct_when_higher, 2),
    ROUND(v_total_potential_savings, 2)
  )
  ON CONFLICT (user_id, snapshot_date, COALESCE(competitor_id::text, 'ALL'), COALESCE(brand_filter, 'ALL'))
  DO UPDATE SET
    total_products_analyzed = EXCLUDED.total_products_analyzed,
    products_we_are_cheapest = EXCLUDED.products_we_are_cheapest,
    products_we_are_same_price = EXCLUDED.products_we_are_same_price,
    products_we_are_more_expensive = EXCLUDED.products_we_are_more_expensive,
    cheapest_percentage = EXCLUDED.cheapest_percentage,
    same_price_percentage = EXCLUDED.same_price_percentage,
    more_expensive_percentage = EXCLUDED.more_expensive_percentage,
    avg_price_difference_when_higher = EXCLUDED.avg_price_difference_when_higher,
    avg_price_difference_percentage_when_higher = EXCLUDED.avg_price_difference_percentage_when_higher,
    total_potential_savings = EXCLUDED.total_potential_savings,
    updated_at = NOW()
  RETURNING id INTO v_snapshot_id;

  -- Return the results
  RETURN QUERY
  SELECT 
    v_snapshot_id,
    v_total_products,
    v_cheapest_count,
    v_same_price_count,
    v_more_expensive_count,
    v_cheapest_percentage,
    v_same_price_percentage,
    v_more_expensive_percentage;
END;
$$;


ALTER FUNCTION "public"."calculate_daily_price_competitiveness_snapshot"("p_user_id" "uuid", "p_snapshot_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_daily_price_competitiveness_snapshot"("p_user_id" "uuid", "p_snapshot_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") IS 'Calculates and stores a daily snapshot of price competitiveness metrics for a user.
Parameters:
- p_user_id: The user ID to calculate snapshots for
- p_snapshot_date: The date for the snapshot (default: today)
- p_competitor_id: Specific competitor to analyze (NULL for all competitors)
- p_brand_filter: Brand filter to apply (NULL for all brands)';



CREATE OR REPLACE FUNCTION "public"."calculate_next_integration_run_time"("sync_frequency" "text", "last_sync_at" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."calculate_next_integration_run_time"("sync_frequency" "text", "last_sync_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_next_scraper_run_time"("schedule_config" "jsonb", "last_run" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."calculate_next_scraper_run_time"("schedule_config" "jsonb", "last_run" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_price_change_percentage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.competitor_id IS NOT NULL AND NEW.old_competitor_price IS NOT NULL AND NEW.new_competitor_price IS NOT NULL AND NEW.old_competitor_price > 0 THEN
        NEW.price_change_percentage = ((NEW.new_competitor_price - NEW.old_competitor_price) / NEW.old_competitor_price) * 100;
    ELSIF NEW.integration_id IS NOT NULL AND NEW.old_our_retail_price IS NOT NULL AND NEW.new_our_retail_price IS NOT NULL AND NEW.old_our_retail_price > 0 THEN
        NEW.price_change_percentage = ((NEW.new_our_retail_price - NEW.old_our_retail_price) / NEW.old_our_retail_price) * 100;
    ELSE
        NEW.price_change_percentage = NULL;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_price_change_percentage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_supplier_price_change_percentage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.supplier_id IS NOT NULL AND NEW.old_supplier_price IS NOT NULL AND NEW.new_supplier_price IS NOT NULL AND NEW.old_supplier_price > 0 THEN
        NEW.price_change_percentage = ((NEW.new_supplier_price - NEW.old_supplier_price) / NEW.old_supplier_price) * 100;
    ELSIF NEW.integration_id IS NOT NULL AND NEW.old_our_wholesale_price IS NOT NULL AND NEW.new_our_wholesale_price IS NOT NULL AND NEW.old_our_wholesale_price > 0 THEN
        NEW.price_change_percentage = ((NEW.new_our_wholesale_price - NEW.old_our_wholesale_price) / NEW.old_our_wholesale_price) * 100;
    ELSE
        NEW.price_change_percentage = NULL;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_supplier_price_change_percentage"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."integration_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "products_processed" integer DEFAULT 0,
    "products_updated" integer DEFAULT 0,
    "products_created" integer DEFAULT 0,
    "error_message" "text",
    "log_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "test_products" "jsonb",
    "configuration" "jsonb",
    "last_progress_update" timestamp with time zone
);


ALTER TABLE "public"."integration_runs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_next_integration_job"() RETURNS SETOF "public"."integration_runs"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claimed_job_id uuid;
BEGIN
  SELECT ir.id
  INTO claimed_job_id
  FROM public.integration_runs ir
  JOIN public.integrations i ON i.id = ir.integration_id
  WHERE ir.status = 'pending'
    AND i.is_active = true
  ORDER BY ir.created_at
  LIMIT 1
  FOR UPDATE OF ir SKIP LOCKED;

  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.integration_runs ir
  SET status = 'processing', started_at = now()
  WHERE ir.id = claimed_job_id
    AND ir.status = 'pending'
  RETURNING ir.*;
END;
$$;


ALTER FUNCTION "public"."claim_next_integration_job"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_next_integration_job"() IS 'Atomically claims the next pending integration job. It selects, locks, and updates the job status to "processing" in a single transaction, returning the claimed job. Uses FOR UPDATE SKIP LOCKED for concurrency.';



CREATE OR REPLACE FUNCTION "public"."claim_next_scraper_job"("worker_type_filter" "text") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "scraper_id" "uuid", "user_id" "uuid", "status" "text", "scraper_type" "text", "started_at" timestamp with time zone, "completed_at" timestamp with time zone, "error_message" "text", "error_details" "text", "product_count" integer, "is_test_run" boolean, "fetched_competitor_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."claim_next_scraper_job"("worker_type_filter" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_next_scraper_job"("worker_type_filter" "text") IS 'Atomically claims the next pending or initializing scraper job for a given worker type. It selects, locks, updates the job status, and then returns the claimed job''s details including the competitor_id from the associated scraper. Uses FOR UPDATE SKIP LOCKED for improved concurrency.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_data"() RETURNS TABLE("table_name" "text", "rows_deleted" bigint, "retention_days" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  stock_deleted BIGINT;
  price_deleted BIGINT;
  scraper_deleted BIGINT;
  custom_fields_deleted BIGINT;
BEGIN
  -- Delete stock_changes_competitors older than 2 years (730 days)
  DELETE FROM stock_changes_competitors
  WHERE changed_at < NOW() - INTERVAL '730 days';
  GET DIAGNOSTICS stock_deleted = ROW_COUNT;
  
  -- Delete price_changes_competitors older than 2 years (730 days)
  DELETE FROM price_changes_competitors
  WHERE changed_at < NOW() - INTERVAL '730 days';
  GET DIAGNOSTICS price_deleted = ROW_COUNT;
  
  -- Delete scraper_runs older than 90 days (keep recent logs for debugging)
  DELETE FROM scraper_runs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('completed', 'failed'); -- Keep running/pending runs
  GET DIAGNOSTICS scraper_deleted = ROW_COUNT;
  
  -- Delete orphaned product_custom_field_values older than 2 years
  DELETE FROM product_custom_field_values
  WHERE created_at < NOW() - INTERVAL '730 days';
  GET DIAGNOSTICS custom_fields_deleted = ROW_COUNT;
  
  -- Return summary
  RETURN QUERY
  SELECT 'stock_changes_competitors'::TEXT, stock_deleted, 730
  UNION ALL
  SELECT 'price_changes_competitors'::TEXT, price_deleted, 730
  UNION ALL
  SELECT 'scraper_runs'::TEXT, scraper_deleted, 90
  UNION ALL
  SELECT 'product_custom_field_values'::TEXT, custom_fields_deleted, 730;
  
  RAISE NOTICE 'Cleanup complete: stock_changes=%, price_changes=%, scraper_runs=%, custom_fields=%',
    stock_deleted, price_deleted, scraper_deleted, custom_fields_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_debug_logs"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."cleanup_old_debug_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_price_changes"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    price_comp_deleted integer;
    stock_comp_deleted integer;
    price_supp_deleted integer;
    total_deleted integer;
BEGIN
  -- Delete price_changes_competitors older than 4 weeks
  DELETE FROM price_changes_competitors
  WHERE changed_at < NOW() - INTERVAL '4 weeks';
  GET DIAGNOSTICS price_comp_deleted = ROW_COUNT;
  
  -- Delete stock_changes_competitors older than 4 weeks
  DELETE FROM stock_changes_competitors
  WHERE changed_at < NOW() - INTERVAL '4 weeks';
  GET DIAGNOSTICS stock_comp_deleted = ROW_COUNT;
  
  -- Delete price_changes_suppliers older than 4 weeks
  DELETE FROM price_changes_suppliers
  WHERE changed_at < NOW() - INTERVAL '4 weeks';
  GET DIAGNOSTICS price_supp_deleted = ROW_COUNT;
  
  total_deleted := price_comp_deleted + stock_comp_deleted + price_supp_deleted;
  
  -- Log the cleanup operation
  INSERT INTO public.debug_logs (message, created_at) 
  VALUES (
    'Daily cleanup (4 weeks): price_changes_competitors=' || price_comp_deleted || 
    ', stock_changes_competitors=' || stock_comp_deleted || 
    ', price_changes_suppliers=' || price_supp_deleted || 
    ', total=' || total_deleted,
    NOW()
  );
  
  RETURN total_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_price_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_scraper_run_rejections"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_deleted integer;
BEGIN
    DELETE FROM public.scraper_run_rejections
    WHERE rejected_at < now() - interval '14 days';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_scraper_run_rejections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_scraper_runs"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ DECLARE deleted_count integer; BEGIN DELETE FROM public.scraper_runs WHERE created_at < now() - interval '30 days' AND status IN ('completed', 'failed'); GET DIAGNOSTICS deleted_count = ROW_COUNT; INSERT INTO public.debug_logs (message, created_at) VALUES ('Cleaned up ' || deleted_count || ' old scraper runs', now()); RETURN deleted_count; END; $$;


ALTER FUNCTION "public"."cleanup_old_scraper_runs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_rate_limit_logs"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM rate_limit_log 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION "public"."cleanup_rate_limit_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_removed_integration_products"("p_integration_run_id" "uuid") RETURNS TABLE("cleaned_count" integer, "cleaned_product_ids" "uuid"[], "deleted_temp_records" integer, "updated_timestamps" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id UUID;
  v_run_started_at TIMESTAMPTZ;
  v_cleaned_ids UUID[];
  v_cleaned_count INTEGER;
  v_deleted_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  PERFORM set_config('statement_timeout', '300000', true);
  PERFORM set_config('lock_timeout', '10000', true);

  SELECT user_id, started_at INTO v_user_id, v_run_started_at
  FROM integration_runs
  WHERE id = p_integration_run_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Integration run not found: %', p_integration_run_id;
  END IF;

  WITH synced_products AS (
    SELECT DISTINCT p.id
    FROM temp_integrations_scraped_data t
    JOIN products p ON p.user_id = t.user_id
      AND t.ean IS NOT NULL
      AND t.ean != ''
      AND p.ean = t.ean
    WHERE t.integration_run_id = p_integration_run_id
      AND t.status = 'processed'

    UNION

    SELECT DISTINCT p.id
    FROM temp_integrations_scraped_data t
    JOIN products p ON p.user_id = t.user_id
      AND t.sku IS NOT NULL
      AND t.sku != ''
      AND p.sku = t.sku
      AND p.brand_id IS NOT NULL
    JOIN brands b ON b.id = p.brand_id
      AND lower(trim(b.name)) = lower(trim(t.brand))
    WHERE t.integration_run_id = p_integration_run_id
      AND t.status = 'processed'
      AND (t.ean IS NULL OR t.ean = '')
  )
  UPDATE products p
  SET last_integration_sync_at = v_run_started_at
  FROM synced_products sp
  WHERE p.id = sp.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  WITH products_to_clean AS (
    SELECT p.id
    FROM products p
    WHERE p.user_id = v_user_id
      AND (p.our_retail_price IS NOT NULL OR p.our_wholesale_price IS NOT NULL)
      AND p.last_integration_sync_at IS NOT NULL
      AND p.last_integration_sync_at < v_run_started_at
  ),
  cleaned AS (
    UPDATE products p
    SET
      our_retail_price = NULL,
      our_wholesale_price = NULL,
      our_url = NULL,
      image_url = CASE
        WHEN image_url LIKE '%ljustema%' OR image_url LIKE '%prestashop%' THEN NULL
        ELSE image_url
      END,
      updated_at = now()
    FROM products_to_clean ptc
    WHERE p.id = ptc.id
    RETURNING p.id
  )
  SELECT array_agg(id), count(*) INTO v_cleaned_ids, v_cleaned_count
  FROM cleaned;

  DELETE FROM temp_integrations_scraped_data
  WHERE integration_run_id = p_integration_run_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT
    coalesce(v_cleaned_count, 0)::integer,
    coalesce(v_cleaned_ids, ARRAY[]::uuid[]),
    v_deleted_count::integer,
    v_updated_count::integer;
END;
$$;


ALTER FUNCTION "public"."cleanup_removed_integration_products"("p_integration_run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_stalled_integration_runs"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."cleanup_stalled_integration_runs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_temp_competitors_scraped_data"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."cleanup_temp_competitors_scraped_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_temp_integrations_scraped_data"("p_older_than" interval DEFAULT '1 day'::interval, "p_batch_size" integer DEFAULT 50000, "p_max_batches" integer DEFAULT 10) RETURNS TABLE("rows_deleted" bigint, "batches_run" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  PERFORM set_config('statement_timeout', '300000', true);
  PERFORM set_config('lock_timeout', '10000', true);

  rows_deleted := 0;
  batches_run := 0;

  LOOP
    EXIT WHEN batches_run >= p_max_batches;

    WITH candidates AS (
      SELECT t.ctid
      FROM temp_integrations_scraped_data t
      LEFT JOIN integration_runs ir ON ir.id = t.integration_run_id
      WHERE t.status IN ('processed', 'error')
        AND (
          (ir.completed_at IS NOT NULL AND ir.completed_at < now() - p_older_than)
          OR (ir.id IS NULL AND t.created_at < now() - p_older_than)
        )
      LIMIT p_batch_size
    )
    DELETE FROM temp_integrations_scraped_data t
    USING candidates c
    WHERE t.ctid = c.ctid;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    EXIT WHEN v_deleted = 0;

    rows_deleted := rows_deleted + v_deleted;
    batches_run := batches_run + 1;
  END LOOP;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."cleanup_temp_integrations_scraped_data"("p_older_than" interval, "p_batch_size" integer, "p_max_batches" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_distinct_competitors_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(DISTINCT pc.competitor_id)
  FROM price_changes_competitors pc
  JOIN products p ON pc.product_id = p.id
  WHERE p.user_id = p_user_id
    AND p.brand_id = p_brand_id;
$$;


ALTER FUNCTION "public"."count_distinct_competitors_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile_for_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_profile_for_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_profile_for_user"() IS 'Creates a user profile when a user is created in auth.users. Includes error handling to prevent failures during user creation.';



CREATE OR REPLACE FUNCTION "public"."create_scheduled_integration_jobs"() RETURNS TABLE("jobs_created" integer, "message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_scheduled_integration_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_scheduled_scraper_jobs"() RETURNS TABLE("jobs_created" integer, "message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_scheduled_scraper_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_for_nextauth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_user_for_nextauth"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_user_for_nextauth"() IS 'Creates a user in the next_auth schema when a user is created in auth.users. Uses the correct column name "emailVerified" (camelCase) instead of "email_verified" (snake_case).';



CREATE OR REPLACE FUNCTION "public"."create_user_for_nextauth"("user_id" "uuid", "email" "text", "name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_user_for_nextauth"("user_id" "uuid", "email" "text", "name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_utility_jobs"() RETURNS TABLE("jobs_created" integer, "message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ DECLARE job_count integer := 0; last_cleanup_check timestamp with time zone; BEGIN SELECT COALESCE(MAX(dl.created_at), '1970-01-01'::timestamp with time zone) INTO last_cleanup_check FROM public.debug_logs dl WHERE dl.message LIKE '%cleanup_utility_job%' AND dl.created_at > now() - interval '1 day'; IF last_cleanup_check < now() - interval '23 hours' THEN INSERT INTO public.debug_logs (message, created_at) VALUES ('cleanup_utility_job - daily_cleanup at ' || now(), now()); job_count := job_count + 1; PERFORM cleanup_old_scraper_runs(); PERFORM cleanup_old_debug_logs(); PERFORM process_scraper_timeouts(); RAISE NOTICE 'Created utility cleanup job at %', now(); END IF; RETURN QUERY SELECT job_count, 'Created ' || job_count || ' utility jobs'; END; $$;


ALTER FUNCTION "public"."create_utility_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."db_now"() RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ SELECT NOW(); $$;


ALTER FUNCTION "public"."db_now"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_create_scheduled_scraper_jobs"() RETURNS TABLE("scraper_id" "uuid", "scraper_name" "text", "should_run" boolean, "has_pending_job" boolean, "job_created" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."debug_create_scheduled_scraper_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_product_data"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."delete_user_product_data"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_and_process_integration_conflicts"("p_user_id" "uuid", "p_integration_run_id" "uuid", "p_batch_ids" "uuid"[]) RETURNS TABLE("processed_count" integer, "conflict_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."detect_and_process_integration_conflicts"("p_user_id" "uuid", "p_integration_run_id" "uuid", "p_batch_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_custom_field_type"("p_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(trim(p_value), '');

  IF v_value IS NULL THEN
    RETURN 'text';
  END IF;

  IF lower(v_value) IN ('true', 'false', 'yes', 'no') THEN
    RETURN 'boolean';
  END IF;

  IF v_value ~* '^https?://' THEN
    RETURN 'url';
  END IF;

  IF v_value ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN
    RETURN 'number';
  END IF;

  IF v_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR v_value ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN
    RETURN 'date';
  END IF;

  RETURN 'text';
END;
$_$;


ALTER FUNCTION "public"."detect_custom_field_type"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_ean_conflicts_and_create_reviews"("p_user_id" "uuid", "p_source_table" "text", "p_batch_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("conflicts_count" integer, "reviews_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."detect_ean_conflicts_and_create_reviews"("p_user_id" "uuid", "p_source_table" "text", "p_batch_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."dismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."dismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") IS 'Dismisses product duplicates to prevent them from appearing in future duplicate detection';



CREATE OR REPLACE FUNCTION "public"."ensure_one_active_scraper_per_competitor"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Ensure only one active scraper per competitor or supplier
  IF NEW.is_active THEN
    IF NEW.competitor_id IS NOT NULL THEN
      -- Deactivate other scrapers for the same competitor
      UPDATE scrapers
      SET is_active = FALSE
      WHERE competitor_id = NEW.competitor_id AND id <> NEW.id;
    ELSIF NEW.supplier_id IS NOT NULL THEN
      -- Deactivate other scrapers for the same supplier
      UPDATE scrapers
      SET is_active = FALSE
      WHERE supplier_id = NEW.supplier_id AND id <> NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_one_active_scraper_per_competitor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_user_exists_simple"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."ensure_user_exists_simple"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_user_exists_simple"("p_user_id" "uuid") IS 'Ensures a user exists in all necessary tables by calling create_user_for_nextauth with minimal data.';



CREATE OR REPLACE FUNCTION "public"."find_brand_by_name_or_alias"("p_user_id" "uuid", "p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."find_brand_by_name_or_alias"("p_user_id" "uuid", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_or_create_brand"("p_user_id" "uuid", "p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."find_or_create_brand"("p_user_id" "uuid", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid") RETURNS TABLE("group_id" "text", "product_id" "uuid", "name" "text", "sku" "text", "ean" "text", "brand" "text", "brand_id" "uuid", "match_reason" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid") IS 'Enhanced duplicate detection with user settings support, fuzzy matching, and dismissed duplicates exclusion';



CREATE OR REPLACE FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid", "p_limit" integer DEFAULT NULL::integer) RETURNS TABLE("group_id" "text", "product_id" "uuid", "name" "text", "sku" "text", "ean" "text", "brand" "text", "brand_id" "uuid", "match_reason" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_product_by_url"("p_url" "text") RETURNS TABLE("product_id" "uuid", "user_id" "uuid", "product_name" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.user_id, p.name
    FROM products p
    WHERE p.our_url = p_url
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_product_by_url"("p_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_product_by_url"("p_user_id" "uuid", "p_url" "text", "p_source_type" "text" DEFAULT 'any'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."find_product_by_url"("p_user_id" "uuid", "p_url" "text", "p_source_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_product_with_fuzzy_matching"("p_user_id" "uuid", "p_ean" "text", "p_brand" "text", "p_sku" "text", "p_name" "text", "p_brand_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."find_product_with_fuzzy_matching"("p_user_id" "uuid", "p_ean" "text", "p_brand" "text", "p_sku" "text", "p_name" "text", "p_brand_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_product_with_fuzzy_matching"("p_user_id" "uuid", "p_ean" "text", "p_brand" "text", "p_sku" "text", "p_name" "text", "p_brand_id" "uuid") IS 'Enhanced product matching with user settings support and fuzzy matching';



CREATE OR REPLACE FUNCTION "public"."get_admin_user_stats"() RETURNS TABLE("total_users" bigint, "active_users_last_30_days" bigint, "new_users_last_30_days" bigint, "free_users" bigint, "premium_users" bigint, "enterprise_users" bigint, "suspended_users" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_admin_user_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_admin_user_stats"() IS 'Returns overview statistics for admin dashboard including user counts by subscription tier and activity.';



CREATE OR REPLACE FUNCTION "public"."get_brand_aliases"("p_user_id" "uuid") RETURNS TABLE("brand_id" "uuid", "aliases" "text"[])
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_brand_aliases"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_analytics"("p_user_id" "uuid", "p_brand_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "is_active" boolean, "needs_review" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "product_count" bigint, "our_products_count" bigint, "competitor_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- OPTIMIZED: Use materialized view for much faster queries
  -- Note: brand_statistics is a secure view that wraps brand_statistics_mv
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.is_active,
    b.needs_review,
    b.created_at,
    b.updated_at,
    COALESCE(bs.product_count, 0) AS product_count,
    COALESCE(bs.our_products_count, 0) AS our_products_count,
    COALESCE(bs.competitor_count, 0) AS competitor_count
  FROM
    brands b
  LEFT JOIN
    brand_statistics_mv bs ON b.id = bs.brand_id AND b.user_id = bs.user_id
  WHERE
    b.user_id = p_user_id
    AND (p_brand_id IS NULL OR b.id = p_brand_id)
  ORDER BY
    b.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_brand_analytics"("p_user_id" "uuid", "p_brand_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brand_analytics"("p_user_id" "uuid", "p_brand_id" "uuid") IS 'Enhanced brand analytics function that includes our_products_count (products with our_retail_price IS NOT NULL)';



CREATE OR REPLACE FUNCTION "public"."get_brand_market_positioning"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("brand_name" "text", "total_products" bigint, "market_position_score" numeric, "competitive_strength" "text", "cheapest_percentage" numeric, "same_price_percentage" numeric, "more_expensive_percentage" numeric, "avg_competitor_count" numeric, "positioning_category" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_our_prices AS (
        SELECT DISTINCT ON (pcc.product_id)
            pcc.product_id,
            pcc.new_our_retail_price as our_price
        FROM price_changes_competitors pcc
        WHERE pcc.user_id = p_user_id
            AND pcc.integration_id IS NOT NULL
            AND pcc.new_our_retail_price IS NOT NULL
        ORDER BY pcc.product_id, pcc.changed_at DESC
    ),
    latest_competitor_prices AS (
        SELECT DISTINCT ON (pcc.product_id, pcc.competitor_id)
            pcc.product_id,
            pcc.competitor_id,
            pcc.new_competitor_price as competitor_price
        FROM price_changes_competitors pcc
        WHERE pcc.user_id = p_user_id
            AND pcc.competitor_id IS NOT NULL
            AND pcc.new_competitor_price IS NOT NULL
            AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
        ORDER BY pcc.product_id, pcc.competitor_id, pcc.changed_at DESC
    ),
    product_price_analysis AS (
        SELECT 
            p.brand,
            lop.product_id,
            lop.our_price,
            MIN(lcp.competitor_price) as min_competitor_price,
            COUNT(DISTINCT lcp.competitor_id) as competitor_count,
            CASE 
                WHEN lop.our_price < MIN(lcp.competitor_price) THEN 'cheaper'
                WHEN lop.our_price = MIN(lcp.competitor_price) THEN 'same'
                ELSE 'more_expensive'
            END as price_comparison
        FROM latest_our_prices lop
        JOIN latest_competitor_prices lcp ON lop.product_id = lcp.product_id
        JOIN products p ON lop.product_id = p.id
        WHERE p.brand IS NOT NULL
            AND lop.our_price > 0
            AND lcp.competitor_price > 0
        GROUP BY p.brand, lop.product_id, lop.our_price
    ),
    brand_stats AS (
        SELECT 
            ppa.brand,
            COUNT(*) as total_products,
            COUNT(CASE WHEN ppa.price_comparison = 'cheaper' THEN 1 END) as products_we_are_cheapest,
            COUNT(CASE WHEN ppa.price_comparison = 'same' THEN 1 END) as products_we_are_same_price,
            COUNT(CASE WHEN ppa.price_comparison = 'more_expensive' THEN 1 END) as products_we_are_more_expensive,
            AVG(ppa.competitor_count) as avg_competitor_count
        FROM product_price_analysis ppa
        GROUP BY ppa.brand
    )
    SELECT 
        bs.brand::TEXT as brand_name,
        bs.total_products,
        ROUND(
            (bs.products_we_are_cheapest::NUMERIC * 3 + bs.products_we_are_same_price::NUMERIC * 2) / 
            (bs.total_products::NUMERIC * 3) * 100, 2
        ) as market_position_score,
        CASE 
            WHEN (bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) >= 0.7 THEN 'Dominant'
            WHEN (bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) >= 0.5 THEN 'Strong'
            WHEN (bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) >= 0.3 THEN 'Competitive'
            ELSE 'Weak'
        END as competitive_strength,
        ROUND((bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) * 100, 2) as cheapest_percentage,
        ROUND((bs.products_we_are_same_price::NUMERIC / bs.total_products::NUMERIC) * 100, 2) as same_price_percentage,
        ROUND((bs.products_we_are_more_expensive::NUMERIC / bs.total_products::NUMERIC) * 100, 2) as more_expensive_percentage,
        ROUND(COALESCE(bs.avg_competitor_count, 0), 1) as avg_competitor_count,
        CASE 
            WHEN bs.total_products >= 100 AND (bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) >= 0.6 THEN 'Market Leader'
            WHEN bs.total_products >= 50 AND (bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) >= 0.4 THEN 'Strong Player'
            WHEN bs.total_products >= 20 AND (bs.products_we_are_cheapest::NUMERIC / bs.total_products::NUMERIC) >= 0.3 THEN 'Niche Player'
            ELSE 'Emerging'
        END as positioning_category
    FROM brand_stats bs
    WHERE bs.total_products > 0
    ORDER BY market_position_score DESC, bs.total_products DESC;
END;
$$;


ALTER FUNCTION "public"."get_brand_market_positioning"("p_user_id" "uuid", "p_competitor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_performance_data"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("brand" "text", "products_tracked" bigint, "total_sold" bigint, "total_revenue" numeric, "avg_sales_per_product" numeric, "active_days" bigint, "revenue_percentage" numeric, "avg_daily_sales" numeric, "avg_daily_revenue" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_brand_performance_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brand_performance_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) IS 'Returns brand-level sales performance metrics including revenue percentages and daily averages';



CREATE OR REPLACE FUNCTION "public"."get_brand_price_competitiveness"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("brand_name" "text", "total_products_with_prices" bigint, "products_we_are_cheapest" bigint, "products_we_are_same_price" bigint, "products_we_are_more_expensive" bigint, "cheapest_percentage" numeric, "same_price_percentage" numeric, "more_expensive_percentage" numeric, "avg_price_difference_when_higher" numeric, "avg_price_difference_percentage_when_higher" numeric, "market_dominance_percentage" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_our_prices AS (
        SELECT DISTINCT ON (pcc.product_id)
            pcc.product_id,
            pcc.new_our_retail_price as our_price
        FROM price_changes_competitors pcc
        WHERE pcc.user_id = p_user_id
            AND pcc.integration_id IS NOT NULL
            AND pcc.new_our_retail_price IS NOT NULL
        ORDER BY pcc.product_id, pcc.changed_at DESC
    ),
    latest_competitor_prices AS (
        SELECT DISTINCT ON (pcc.product_id, pcc.competitor_id)
            pcc.product_id,
            pcc.competitor_id,
            pcc.new_competitor_price as competitor_price
        FROM price_changes_competitors pcc
        WHERE pcc.user_id = p_user_id
            AND pcc.competitor_id IS NOT NULL
            AND pcc.new_competitor_price IS NOT NULL
            AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
        ORDER BY pcc.product_id, pcc.competitor_id, pcc.changed_at DESC
    ),
    product_price_analysis AS (
        -- For each product, determine if we are cheapest, same, or more expensive
        SELECT 
            p.brand,
            lop.product_id,
            lop.our_price,
            MIN(lcp.competitor_price) as min_competitor_price,
            MAX(lcp.competitor_price) as max_competitor_price,
            AVG(lcp.competitor_price) as avg_competitor_price,
            CASE 
                WHEN lop.our_price < MIN(lcp.competitor_price) THEN 'cheaper'
                WHEN lop.our_price = MIN(lcp.competitor_price) THEN 'same'
                ELSE 'more_expensive'
            END as price_comparison,
            CASE 
                WHEN lop.our_price > MIN(lcp.competitor_price) 
                THEN lop.our_price - MIN(lcp.competitor_price)
                ELSE 0 
            END as price_difference,
            CASE 
                WHEN lop.our_price > MIN(lcp.competitor_price) AND MIN(lcp.competitor_price) > 0
                THEN ((lop.our_price - MIN(lcp.competitor_price)) / MIN(lcp.competitor_price)) * 100
                ELSE 0 
            END as price_difference_percentage
        FROM latest_our_prices lop
        JOIN latest_competitor_prices lcp ON lop.product_id = lcp.product_id
        JOIN products p ON lop.product_id = p.id
        WHERE p.brand IS NOT NULL
            AND lop.our_price > 0
            AND lcp.competitor_price > 0
        GROUP BY p.brand, lop.product_id, lop.our_price
    ),
    brand_stats AS (
        SELECT 
            ppa.brand,
            COUNT(*) as total_products_with_prices,
            COUNT(CASE WHEN ppa.price_comparison = 'cheaper' THEN 1 END) as products_we_are_cheapest,
            COUNT(CASE WHEN ppa.price_comparison = 'same' THEN 1 END) as products_we_are_same_price,
            COUNT(CASE WHEN ppa.price_comparison = 'more_expensive' THEN 1 END) as products_we_are_more_expensive,
            AVG(CASE WHEN ppa.price_comparison = 'more_expensive' THEN ppa.price_difference END) as avg_price_difference_when_higher,
            AVG(CASE WHEN ppa.price_comparison = 'more_expensive' THEN ppa.price_difference_percentage END) as avg_price_difference_percentage_when_higher
        FROM product_price_analysis ppa
        GROUP BY ppa.brand
    )
    SELECT 
        bs.brand::TEXT as brand_name,
        bs.total_products_with_prices,
        bs.products_we_are_cheapest,
        bs.products_we_are_same_price,
        bs.products_we_are_more_expensive,
        ROUND((bs.products_we_are_cheapest::NUMERIC / bs.total_products_with_prices::NUMERIC) * 100, 2) as cheapest_percentage,
        ROUND((bs.products_we_are_same_price::NUMERIC / bs.total_products_with_prices::NUMERIC) * 100, 2) as same_price_percentage,
        ROUND((bs.products_we_are_more_expensive::NUMERIC / bs.total_products_with_prices::NUMERIC) * 100, 2) as more_expensive_percentage,
        ROUND(COALESCE(bs.avg_price_difference_when_higher, 0), 2) as avg_price_difference_when_higher,
        ROUND(COALESCE(bs.avg_price_difference_percentage_when_higher, 0), 2) as avg_price_difference_percentage_when_higher,
        ROUND((bs.products_we_are_cheapest::NUMERIC / bs.total_products_with_prices::NUMERIC) * 100, 2) as market_dominance_percentage
    FROM brand_stats bs
    ORDER BY bs.total_products_with_prices DESC, bs.products_we_are_cheapest DESC;
END;
$$;


ALTER FUNCTION "public"."get_brand_price_competitiveness"("p_user_id" "uuid", "p_competitor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_price_pressure_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_days_back" integer DEFAULT 30) RETURNS TABLE("brand_name" "text", "total_products" integer, "total_price_changes" integer, "avg_price_changes_per_product" numeric, "price_change_frequency_score" numeric, "avg_price_change_percentage" numeric, "price_increases" integer, "price_decreases" integer, "net_price_direction" "text", "most_volatile_product_name" "text", "most_volatile_product_changes" integer, "pressure_level" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_start_date DATE := CURRENT_DATE - (p_days_back || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH price_changes_analysis AS (
        SELECT 
            p.brand,
            pcc.product_id,
            p.name as product_name,
            COUNT(*) as change_count,
            AVG(ABS(pcc.price_change_percentage)) as avg_abs_change_pct,
            SUM(CASE WHEN pcc.price_change_percentage > 0 THEN 1 ELSE 0 END) as increases,
            SUM(CASE WHEN pcc.price_change_percentage < 0 THEN 1 ELSE 0 END) as decreases,
            AVG(pcc.price_change_percentage) as avg_change_pct
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
            AND p.brand IS NOT NULL
            AND pcc.changed_at >= v_start_date
            AND pcc.price_change_percentage IS NOT NULL
            AND ABS(pcc.price_change_percentage) > 0.1  -- Filter out tiny changes
        GROUP BY p.brand, pcc.product_id, p.name
    ),
    brand_pressure_metrics AS (
        SELECT 
            pca.brand,
            COUNT(DISTINCT pca.product_id) as total_products,
            SUM(pca.change_count) as total_changes,
            AVG(pca.change_count) as avg_changes_per_product,
            AVG(pca.avg_abs_change_pct) as avg_price_change_percentage,
            SUM(pca.increases) as total_increases,
            SUM(pca.decreases) as total_decreases,
            AVG(pca.avg_change_pct) as net_avg_change_pct,
            -- Find most volatile product
            (SELECT pca2.product_name 
             FROM price_changes_analysis pca2 
             WHERE pca2.brand = pca.brand 
             ORDER BY pca2.change_count DESC, pca2.avg_abs_change_pct DESC 
             LIMIT 1) as most_volatile_product,
            (SELECT MAX(pca2.change_count) 
             FROM price_changes_analysis pca2 
             WHERE pca2.brand = pca.brand) as max_product_changes
        FROM price_changes_analysis pca
        GROUP BY pca.brand
    )
    SELECT 
        bpm.brand::TEXT,
        bpm.total_products::INTEGER,
        bpm.total_changes::INTEGER,
        ROUND(COALESCE(bpm.avg_changes_per_product, 0), 2) as avg_price_changes_per_product,
        -- Frequency score: changes per product per day, normalized to 0-100 scale
        ROUND(LEAST(100, (bpm.avg_changes_per_product / p_days_back * 30 * 10)), 2) as price_change_frequency_score,
        ROUND(COALESCE(bpm.avg_price_change_percentage, 0), 2) as avg_price_change_percentage,
        bpm.total_increases::INTEGER,
        bpm.total_decreases::INTEGER,
        
        -- Net price direction
        CASE 
            WHEN bpm.total_increases > bpm.total_decreases * 1.2 THEN 'Increasing'
            WHEN bpm.total_decreases > bpm.total_increases * 1.2 THEN 'Decreasing'
            ELSE 'Mixed'
        END::TEXT as net_price_direction,
        
        COALESCE(bpm.most_volatile_product, 'N/A')::TEXT as most_volatile_product_name,
        COALESCE(bpm.max_product_changes, 0)::INTEGER as most_volatile_product_changes,
        
        -- Pressure level assessment
        CASE 
            WHEN bpm.avg_changes_per_product >= 3 AND bpm.avg_price_change_percentage >= 5 THEN 'Very High'
            WHEN bpm.avg_changes_per_product >= 2 AND bpm.avg_price_change_percentage >= 3 THEN 'High'
            WHEN bpm.avg_changes_per_product >= 1 AND bpm.avg_price_change_percentage >= 2 THEN 'Moderate'
            WHEN bpm.avg_changes_per_product >= 0.5 THEN 'Low'
            ELSE 'Very Low'
        END::TEXT as pressure_level
        
    FROM brand_pressure_metrics bpm
    WHERE bpm.total_products >= 3  -- Only include brands with meaningful product count
    ORDER BY bpm.avg_changes_per_product DESC, bpm.avg_price_change_percentage DESC;
END;
$$;


ALTER FUNCTION "public"."get_brand_price_pressure_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brand_price_pressure_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_days_back" integer) IS 'Analyzes price pressure and volatility per brand, identifying brands under competitive pressure';



CREATE OR REPLACE FUNCTION "public"."get_brand_price_spread_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("brand_name" "text", "total_products" integer, "avg_price_spread_amount" numeric, "avg_price_spread_percentage" numeric, "max_price_spread_amount" numeric, "max_price_spread_percentage" numeric, "min_competitor_price" numeric, "max_competitor_price" numeric, "avg_our_price" numeric, "avg_competitor_price" numeric, "price_volatility_score" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_prices AS (
        -- Get latest competitor prices per product
        SELECT DISTINCT ON (pcc.product_id, pcc.competitor_id)
            pcc.product_id,
            pcc.competitor_id,
            pcc.new_competitor_price,
            pcc.new_our_retail_price,
            p.brand
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
            AND pcc.new_competitor_price IS NOT NULL
            AND pcc.new_our_retail_price IS NOT NULL
            AND p.brand IS NOT NULL
            AND pcc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY pcc.product_id, pcc.competitor_id, pcc.changed_at DESC
    ),
    price_spreads AS (
        SELECT 
            lp.brand,
            lp.product_id,
            lp.new_our_retail_price as our_price,
            MIN(lp.new_competitor_price) as min_competitor_price,
            MAX(lp.new_competitor_price) as max_competitor_price,
            AVG(lp.new_competitor_price) as avg_competitor_price,
            COUNT(DISTINCT lp.competitor_id) as competitor_count,
            -- Price spread calculations
            (MAX(lp.new_competitor_price) - MIN(lp.new_competitor_price)) as price_spread_amount,
            CASE 
                WHEN MIN(lp.new_competitor_price) > 0 THEN
                    ((MAX(lp.new_competitor_price) - MIN(lp.new_competitor_price)) / MIN(lp.new_competitor_price) * 100)
                ELSE 0
            END as price_spread_percentage
        FROM latest_prices lp
        GROUP BY lp.brand, lp.product_id, lp.new_our_retail_price
        HAVING COUNT(DISTINCT lp.competitor_id) >= 2  -- Need at least 2 competitors for meaningful spread
    ),
    price_volatility AS (
        -- Calculate price change frequency for volatility score
        SELECT 
            p.brand,
            COUNT(*) as total_price_changes,
            COUNT(DISTINCT pcc.product_id) as products_with_changes,
            AVG(ABS(pcc.price_change_percentage)) as avg_price_change_percentage
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
            AND p.brand IS NOT NULL
            AND pcc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
            AND pcc.price_change_percentage IS NOT NULL
        GROUP BY p.brand
    ),
    brand_spreads AS (
        SELECT 
            ps.brand,
            COUNT(*) as total_products,
            AVG(ps.price_spread_amount) as avg_spread_amount,
            AVG(ps.price_spread_percentage) as avg_spread_percentage,
            MAX(ps.price_spread_amount) as max_spread_amount,
            MAX(ps.price_spread_percentage) as max_spread_percentage,
            MIN(ps.min_competitor_price) as overall_min_competitor_price,
            MAX(ps.max_competitor_price) as overall_max_competitor_price,
            AVG(ps.our_price) as avg_our_price,
            AVG(ps.avg_competitor_price) as avg_competitor_price
        FROM price_spreads ps
        GROUP BY ps.brand
    )
    SELECT 
        bs.brand::TEXT,
        bs.total_products::INTEGER,
        ROUND(COALESCE(bs.avg_spread_amount, 0), 2) as avg_price_spread_amount,
        ROUND(COALESCE(bs.avg_spread_percentage, 0), 2) as avg_price_spread_percentage,
        ROUND(COALESCE(bs.max_spread_amount, 0), 2) as max_price_spread_amount,
        ROUND(COALESCE(bs.max_spread_percentage, 0), 2) as max_price_spread_percentage,
        ROUND(COALESCE(bs.overall_min_competitor_price, 0), 2) as min_competitor_price,
        ROUND(COALESCE(bs.overall_max_competitor_price, 0), 2) as max_competitor_price,
        ROUND(COALESCE(bs.avg_our_price, 0), 2) as avg_our_price,
        ROUND(COALESCE(bs.avg_competitor_price, 0), 2) as avg_competitor_price,
        -- Volatility score: combination of price change frequency and average change percentage
        ROUND(COALESCE(
            (pv.total_price_changes::NUMERIC / GREATEST(pv.products_with_changes, 1)) * 
            (pv.avg_price_change_percentage / 100) * 100, 0
        ), 2) as price_volatility_score
    FROM brand_spreads bs
    LEFT JOIN price_volatility pv ON bs.brand = pv.brand
    WHERE bs.total_products >= 3  -- Only include brands with meaningful product count
    ORDER BY bs.avg_spread_percentage DESC, bs.total_products DESC;
END;
$$;


ALTER FUNCTION "public"."get_brand_price_spread_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brand_price_spread_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid") IS 'Analyzes price spreads and volatility per brand, showing market price ranges and competitive dynamics';



CREATE OR REPLACE FUNCTION "public"."get_brand_products_detail"("p_user_id" "uuid", "p_brand_name" "text", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("product_id" "uuid", "product_name" "text", "brand" "text", "sku" "text", "total_sold" bigint, "total_revenue" numeric, "avg_daily_sales" numeric, "avg_daily_revenue" numeric, "current_price" numeric, "image_url" "text", "competitor_url" "text", "last_sale_date" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
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


ALTER FUNCTION "public"."get_brand_products_detail"("p_user_id" "uuid", "p_brand_name" "text", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_products_with_stock"("p_user_id" "uuid", "p_brand" "text", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_stock_status" "text" DEFAULT 'all'::"text") RETURNS TABLE("product_id" "uuid", "product_name" "text", "brand" "text", "sku" "text", "current_stock" integer, "current_price" numeric, "competitor_name" "text", "in_stock_flag" boolean, "last_updated" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_stock AS (
        SELECT DISTINCT ON (sc.product_id, sc.competitor_id)
            sc.product_id,
            sc.competitor_id,
            sc.new_stock_quantity,
            sc.new_stock_status,
            sc.changed_at
        FROM stock_changes_competitors sc
        WHERE sc.user_id = p_user_id
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        ORDER BY sc.product_id, sc.competitor_id, sc.changed_at DESC
    ),
    latest_prices AS (
        SELECT DISTINCT ON (pc.product_id, pc.competitor_id)
            pc.product_id,
            pc.competitor_id,
            pc.new_competitor_price,
            pc.changed_at
        FROM price_changes_competitors pc
        WHERE pc.user_id = p_user_id
          AND (p_competitor_id IS NULL OR pc.competitor_id = p_competitor_id)
        ORDER BY pc.product_id, pc.competitor_id, pc.changed_at DESC
    )
    SELECT 
        p.id,
        p.name,
        p.brand,
        p.sku,
        COALESCE(ls.new_stock_quantity, 0)::integer,
        lp.new_competitor_price,
        c.name,
        CASE 
            WHEN ls.new_stock_quantity > 0 THEN true 
            ELSE false 
        END,
        GREATEST(ls.changed_at, lp.changed_at)
    FROM products p
    LEFT JOIN latest_stock ls ON p.id = ls.product_id
    LEFT JOIN latest_prices lp ON p.id = lp.product_id AND ls.competitor_id = lp.competitor_id
    LEFT JOIN competitors c ON ls.competitor_id = c.id
    WHERE p.user_id = p_user_id
      AND p.brand = p_brand
      AND (
          p_stock_status = 'all' OR
          (p_stock_status = 'in_stock' AND ls.new_stock_quantity > 0) OR
          (p_stock_status = 'out_of_stock' AND (ls.new_stock_quantity = 0 OR ls.new_stock_quantity IS NULL))
      )
    ORDER BY ls.new_stock_quantity DESC NULLS LAST, p.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_brand_products_with_stock"("p_user_id" "uuid", "p_brand" "text", "p_competitor_id" "uuid", "p_stock_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_statistics_secure"() RETURNS TABLE("brand_id" "uuid", "user_id" "uuid", "brand_name" "text", "product_count" bigint, "our_products_count" bigint, "competitor_count" bigint, "last_updated" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT 
    brand_id,
    user_id,
    brand_name,
    product_count,
    our_products_count,
    competitor_count,
    last_updated
  FROM brand_statistics_mv
  WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_brand_statistics_secure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_stock_availability"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("brand" "text", "total_products" bigint, "in_stock_products" bigint, "out_of_stock_products" bigint, "in_stock_percentage" numeric, "out_of_stock_percentage" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    ORDER BY 
        CASE 
            WHEN ba.total_products > 0 THEN (ba.in_stock_products::NUMERIC / ba.total_products * 100)
            ELSE 0 
        END DESC;
END;
$$;


ALTER FUNCTION "public"."get_brand_stock_availability"("p_user_id" "uuid", "p_competitor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brand_stock_availability"("p_user_id" "uuid", "p_competitor_id" "uuid") IS 'Returns stock availability percentages by brand for inventory strategy analysis';



CREATE OR REPLACE FUNCTION "public"."get_brands_for_competitor"("p_user_id" "uuid", "p_competitor_id" "uuid") RETURNS TABLE("brand_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_brands_for_competitor"("p_user_id" "uuid", "p_competitor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brands_without_our_prices"("p_user_id" "uuid", "p_min_products" integer DEFAULT 100) RETURNS TABLE("brand_name" "text", "competitor_product_count" integer, "competitor_count" integer, "avg_competitor_price" numeric, "min_competitor_price" numeric, "max_competitor_price" numeric, "avg_stock_level" numeric, "products_in_stock" integer, "products_out_of_stock" integer, "opportunity_score" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH brands_with_our_prices AS (
        -- Brands where we have prices (from price_changes_competitors with our integration_id)
        SELECT DISTINCT p.brand
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND pcc.integration_id IS NOT NULL  -- This indicates our prices
            AND pcc.new_our_retail_price IS NOT NULL
            AND p.brand IS NOT NULL
    ),
    competitor_brand_data AS (
        -- Get competitor data for brands we don't have prices for
        SELECT 
            p.brand,
            COUNT(DISTINCT pcc.product_id) as product_count,
            COUNT(DISTINCT pcc.competitor_id) as competitor_count,
            AVG(pcc.new_competitor_price) as avg_price,
            MIN(pcc.new_competitor_price) as min_price,
            MAX(pcc.new_competitor_price) as max_price
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND pcc.competitor_id IS NOT NULL  -- Only competitor prices
            AND pcc.new_competitor_price IS NOT NULL
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM brands_with_our_prices)
            AND pcc.changed_at >= CURRENT_DATE - INTERVAL '60 days'  -- Recent data
        GROUP BY p.brand
        HAVING COUNT(DISTINCT pcc.product_id) >= p_min_products
    ),
    stock_data AS (
        -- Get stock information for these brands
        SELECT 
            p.brand,
            AVG(CASE WHEN scc.new_stock_quantity IS NOT NULL THEN scc.new_stock_quantity ELSE 0 END) as avg_stock,
            SUM(CASE WHEN scc.new_stock_status = 'in_stock' OR scc.new_stock_quantity > 0 THEN 1 ELSE 0 END) as in_stock_count,
            SUM(CASE WHEN scc.new_stock_status = 'out_of_stock' OR scc.new_stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
        FROM stock_changes_competitors scc
        JOIN products p ON scc.product_id = p.id
        WHERE scc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM brands_with_our_prices)
            AND scc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.brand
    )
    SELECT 
        cbd.brand::TEXT,
        cbd.product_count::INTEGER,
        cbd.competitor_count::INTEGER,
        ROUND(COALESCE(cbd.avg_price, 0), 2) as avg_competitor_price,
        ROUND(COALESCE(cbd.min_price, 0), 2) as min_competitor_price,
        ROUND(COALESCE(cbd.max_price, 0), 2) as max_competitor_price,
        ROUND(COALESCE(sd.avg_stock, 0), 2) as avg_stock_level,
        COALESCE(sd.in_stock_count, 0)::INTEGER as products_in_stock,
        COALESCE(sd.out_of_stock_count, 0)::INTEGER as products_out_of_stock,
        
        -- Opportunity score: weighted by product count, competitor count, and reasonable stock levels
        ROUND(
            (LEAST(cbd.product_count / 100.0, 5) * 20) +  -- Product count factor (max 100 points)
            (LEAST(cbd.competitor_count, 5) * 10) +        -- Competitor count factor (max 50 points)
            (CASE WHEN COALESCE(sd.avg_stock, 0) BETWEEN 1 AND 50 THEN 30 ELSE 0 END) -- Stock level factor
        , 2) as opportunity_score
        
    FROM competitor_brand_data cbd
    LEFT JOIN stock_data sd ON cbd.brand = sd.brand
    ORDER BY opportunity_score DESC, cbd.product_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_brands_without_our_prices"("p_user_id" "uuid", "p_min_products" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brands_without_our_prices"("p_user_id" "uuid", "p_min_products" integer) IS 'Finds brands that competitors sell but we do not have prices for, with opportunity scoring';



CREATE OR REPLACE FUNCTION "public"."get_competitor_names_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") RETURNS TABLE("competitor_names" "text"[])
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_competitor_names_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_competitor_pressure_analysis"("p_user_id" "uuid", "p_brand_filter" "text" DEFAULT NULL::"text", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("competitor_id" "uuid", "competitor_name" "text", "products_where_lowest" integer, "total_products_tracked" integer, "lowest_price_percentage" numeric, "avg_price_when_lowest" numeric, "is_integration" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '7 days');
  date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
  -- If no date filter provided, use the materialized view for current state
  IF p_start_date IS NULL AND p_end_date IS NULL THEN
    RETURN QUERY
    WITH competitor_price_data AS (
      SELECT 
        mv.id as product_id,
        mv.our_retail_price,
        elem->>'competitor_id' as comp_id_text,
        (elem->>'new_competitor_price')::NUMERIC as comp_price,
        elem->>'competitor_name' as comp_name,
        'competitor' as price_source
      FROM latest_product_data_mv mv,
           jsonb_array_elements(mv.competitor_prices::jsonb) as elem
      WHERE mv.user_id = p_user_id
        AND mv.is_active = true
        AND mv.competitor_count > 0
        AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
      
      UNION ALL
      
      -- Add our own prices
      SELECT 
        mv.id as product_id,
        mv.our_retail_price,
        NULL as comp_id_text,
        mv.our_retail_price as comp_price,
        'Our Company' as comp_name,
        'integration' as price_source
      FROM latest_product_data_mv mv
      WHERE mv.user_id = p_user_id
        AND mv.our_retail_price IS NOT NULL
        AND mv.is_active = true
        AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
    ),
    products_with_competition AS (
      SELECT product_id
      FROM competitor_price_data
      GROUP BY product_id
      HAVING COUNT(DISTINCT COALESCE(comp_id_text, 'our_company')) >= 2
    ),
    product_min_prices AS (
      SELECT 
        cpd.product_id,
        MIN(cpd.comp_price) as min_price
      FROM competitor_price_data cpd
      JOIN products_with_competition pwc ON cpd.product_id = pwc.product_id
      GROUP BY cpd.product_id
    ),
    lowest_price_entities AS (
      SELECT 
        cpd.comp_id_text,
        cpd.comp_name,
        cpd.price_source,
        cpd.product_id,
        cpd.comp_price
      FROM competitor_price_data cpd
      JOIN product_min_prices pmp ON cpd.product_id = pmp.product_id AND cpd.comp_price = pmp.min_price
    ),
    entity_totals AS (
      SELECT 
        cpd.comp_id_text,
        cpd.comp_name,
        cpd.price_source,
        COUNT(DISTINCT cpd.product_id) as total_products_tracked
      FROM competitor_price_data cpd
      JOIN products_with_competition pwc ON cpd.product_id = pwc.product_id
      GROUP BY cpd.comp_id_text, cpd.comp_name, cpd.price_source
    )
    SELECT 
      CASE WHEN et.price_source = 'integration' THEN NULL ELSE et.comp_id_text::UUID END as out_competitor_id,
      et.comp_name as out_competitor_name,
      COALESCE(lpe_stats.lowest_count, 0)::INTEGER as out_products_where_lowest,
      et.total_products_tracked::INTEGER as out_total_products_tracked,
      ROUND(COALESCE(lpe_stats.lowest_count, 0)::NUMERIC / et.total_products_tracked * 100, 2) as out_lowest_price_percentage,
      ROUND(COALESCE(lpe_stats.avg_price, 0), 2) as out_avg_price_when_lowest,
      (et.price_source = 'integration') as out_is_integration
    FROM entity_totals et
    LEFT JOIN (
      SELECT 
        lpe.comp_id_text,
        lpe.comp_name,
        lpe.price_source,
        COUNT(*) as lowest_count,
        AVG(lpe.comp_price) as avg_price
      FROM lowest_price_entities lpe
      GROUP BY lpe.comp_id_text, lpe.comp_name, lpe.price_source
    ) lpe_stats ON et.comp_id_text IS NOT DISTINCT FROM lpe_stats.comp_id_text AND et.price_source = lpe_stats.price_source
    ORDER BY out_lowest_price_percentage DESC, out_products_where_lowest DESC;
  ELSE
    -- Use the original logic with date filtering (slower but necessary for historical data)
    RETURN QUERY
    WITH latest_competitor_prices AS (
      SELECT DISTINCT ON (pcc.product_id, pcc.competitor_id)
        pcc.product_id,
        pcc.competitor_id,
        pcc.new_competitor_price,
        pcc.changed_at
      FROM price_changes_competitors pcc
      WHERE pcc.user_id = p_user_id
        AND pcc.new_competitor_price IS NOT NULL
        AND pcc.competitor_id IS NOT NULL
        AND pcc.changed_at BETWEEN date_filter_start AND date_filter_end
      ORDER BY pcc.product_id, pcc.competitor_id, pcc.changed_at DESC
    ),
    latest_our_prices AS (
      SELECT DISTINCT ON (pcc.product_id)
        pcc.product_id,
        pcc.integration_id,
        pcc.new_our_retail_price,
        pcc.changed_at
      FROM price_changes_competitors pcc
      WHERE pcc.user_id = p_user_id
        AND pcc.new_our_retail_price IS NOT NULL
        AND pcc.integration_id IS NOT NULL
        AND pcc.changed_at BETWEEN date_filter_start AND date_filter_end
      ORDER BY pcc.product_id, pcc.changed_at DESC
    ),
    all_prices AS (
      SELECT 
        lcp.product_id,
        lcp.competitor_id::text as entity_id,
        lcp.new_competitor_price as price,
        'competitor' as price_source
      FROM latest_competitor_prices lcp
      JOIN products p ON lcp.product_id = p.id
      WHERE p.user_id = p_user_id
        AND p.is_active = true
        AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
      
      UNION ALL
      
      SELECT 
        lop.product_id,
        lop.integration_id::text as entity_id,
        lop.new_our_retail_price as price,
        'integration' as price_source
      FROM latest_our_prices lop
      JOIN products p ON lop.product_id = p.id
      WHERE p.user_id = p_user_id
        AND p.is_active = true
        AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
    ),
    products_with_competition AS (
      SELECT ap.product_id
      FROM all_prices ap
      GROUP BY ap.product_id
      HAVING COUNT(DISTINCT ap.entity_id) >= 2
    ),
    product_min_prices AS (
      SELECT 
        ap.product_id,
        MIN(ap.price) as min_price
      FROM all_prices ap
      JOIN products_with_competition pwc ON ap.product_id = pwc.product_id
      GROUP BY ap.product_id
    ),
    lowest_price_competitors AS (
      SELECT 
        ap.entity_id,
        ap.product_id,
        ap.price,
        ap.price_source
      FROM all_prices ap
      JOIN product_min_prices pmp ON ap.product_id = pmp.product_id AND ap.price = pmp.min_price
    ),
    competitor_totals AS (
      SELECT 
        ap.entity_id,
        ap.price_source,
        COUNT(DISTINCT ap.product_id) as total_products_tracked
      FROM all_prices ap
      JOIN products_with_competition pwc ON ap.product_id = pwc.product_id
      GROUP BY ap.entity_id, ap.price_source
    )
    SELECT 
      CASE 
        WHEN ct.price_source = 'integration' THEN NULL
        ELSE ct.entity_id::uuid
      END,
      CASE 
        WHEN ct.price_source = 'integration' THEN COALESCE(i.name, 'Our Company')
        ELSE c.name 
      END,
      COALESCE(lpc_stats.products_where_lowest, 0)::INTEGER,
      ct.total_products_tracked::INTEGER,
      ROUND(COALESCE(lpc_stats.products_where_lowest, 0)::NUMERIC / ct.total_products_tracked * 100, 2),
      ROUND(COALESCE(lpc_stats.avg_price_when_lowest, 0), 2),
      (ct.price_source = 'integration')
    FROM competitor_totals ct
    LEFT JOIN competitors c ON ct.entity_id = c.id::text AND ct.price_source = 'competitor'
    LEFT JOIN integrations i ON ct.entity_id = i.id::text AND ct.price_source = 'integration'
    LEFT JOIN (
      SELECT 
        lpc.entity_id,
        lpc.price_source,
        COUNT(*) as products_where_lowest,
        AVG(lpc.price) as avg_price_when_lowest
      FROM lowest_price_competitors lpc
      GROUP BY lpc.entity_id, lpc.price_source
    ) lpc_stats ON ct.entity_id = lpc_stats.entity_id AND ct.price_source = lpc_stats.price_source
    WHERE (c.user_id = p_user_id OR i.user_id = p_user_id)
    ORDER BY lowest_price_percentage DESC, products_where_lowest DESC;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_competitor_pressure_analysis"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_competitor_price_analysis"("p_user_id" "uuid", "p_competitor_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_brand_filter" "text" DEFAULT NULL::"text", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("competitor_id" "uuid", "competitor_name" "text", "competitor_website" "text", "total_matching_products" integer, "our_products_cheaper" integer, "our_products_more_expensive" integer, "our_products_same_price" integer, "avg_price_difference_percentage" numeric, "avg_our_price" numeric, "avg_competitor_price" numeric, "market_coverage_percentage" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  total_our_products INTEGER;
BEGIN
  -- Get total count of our products for market coverage calculation
  SELECT COUNT(*)
  INTO total_our_products
  FROM products p
  WHERE p.user_id = p_user_id
    AND p.our_retail_price IS NOT NULL
    AND p.is_active = true
    AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%');

  RETURN QUERY
  WITH competitor_price_data AS (
    -- Extract competitor prices from the materialized view's JSON array
    SELECT 
      mv.id as product_id,
      mv.our_retail_price,
      elem->>'competitor_id' as comp_id_text,
      (elem->>'new_competitor_price')::NUMERIC as comp_price,
      elem->>'competitor_name' as comp_name
    FROM latest_product_data_mv mv,
         jsonb_array_elements(mv.competitor_prices::jsonb) as elem
    WHERE mv.user_id = p_user_id
      AND mv.our_retail_price IS NOT NULL
      AND mv.is_active = true
      AND mv.competitor_count > 0
      AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
  ),
  filtered_competitor_data AS (
    -- Apply competitor filter after extraction
    SELECT *
    FROM competitor_price_data
    WHERE p_competitor_ids IS NULL OR comp_id_text::UUID = ANY(p_competitor_ids)
  ),
  product_comparisons AS (
    SELECT 
      fcd.comp_id_text::UUID as comp_id,
      fcd.comp_name,
      fcd.product_id,
      fcd.our_retail_price,
      fcd.comp_price,
      CASE 
        WHEN fcd.our_retail_price < fcd.comp_price THEN 'cheaper'
        WHEN fcd.our_retail_price > fcd.comp_price THEN 'more_expensive'
        ELSE 'same_price'
      END as price_comparison,
      ((fcd.comp_price - fcd.our_retail_price) / fcd.our_retail_price * 100) as price_diff_percentage
    FROM filtered_competitor_data fcd
  ),
  competitor_stats AS (
    SELECT 
      pc.comp_id,
      pc.comp_name,
      COUNT(*) as total_matching_products,
      COUNT(*) FILTER (WHERE pc.price_comparison = 'cheaper') as our_products_cheaper,
      COUNT(*) FILTER (WHERE pc.price_comparison = 'more_expensive') as our_products_more_expensive,
      COUNT(*) FILTER (WHERE pc.price_comparison = 'same_price') as our_products_same_price,
      AVG(pc.price_diff_percentage) as avg_price_difference_percentage,
      AVG(pc.our_retail_price) as avg_our_price,
      AVG(pc.comp_price) as avg_competitor_price,
      (COUNT(*)::NUMERIC / total_our_products * 100) as market_coverage_percentage
    FROM product_comparisons pc
    GROUP BY pc.comp_id, pc.comp_name
  )
  SELECT 
    cs.comp_id,
    cs.comp_name,
    c.website as competitor_website,
    cs.total_matching_products::INTEGER,
    cs.our_products_cheaper::INTEGER,
    cs.our_products_more_expensive::INTEGER,
    cs.our_products_same_price::INTEGER,
    ROUND(cs.avg_price_difference_percentage, 2),
    ROUND(cs.avg_our_price, 2),
    ROUND(cs.avg_competitor_price, 2),
    ROUND(cs.market_coverage_percentage, 2)
  FROM competitor_stats cs
  LEFT JOIN competitors c ON cs.comp_id = c.id
  ORDER BY cs.total_matching_products DESC;
END;
$$;


ALTER FUNCTION "public"."get_competitor_price_analysis"("p_user_id" "uuid", "p_competitor_ids" "uuid"[], "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_competitor_price_change_frequency"("p_user_id" "uuid", "p_days" integer DEFAULT 7, "p_competitor_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("competitor_id" "uuid", "competitor_name" "text", "total_price_changes" integer, "products_with_changes" integer, "avg_changes_per_product" numeric, "price_increases" integer, "price_decreases" integer, "avg_change_percentage" numeric, "most_active_day" "text", "is_integration" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH competitor_price_changes AS (
    SELECT
      pcc.competitor_id,
      pcc.product_id,
      pcc.old_competitor_price as old_price,
      pcc.new_competitor_price as new_price,
      pcc.price_change_percentage,
      pcc.changed_at,
      EXTRACT(DOW FROM pcc.changed_at) as day_of_week,
      'competitor' as price_source
    FROM price_changes_competitors pcc
    WHERE pcc.user_id = p_user_id
      AND pcc.competitor_id IS NOT NULL
      AND pcc.changed_at >= NOW() - (p_days || ' days')::INTERVAL
      AND (p_competitor_ids IS NULL OR pcc.competitor_id = ANY(p_competitor_ids))
      AND pcc.old_competitor_price IS NOT NULL
      AND pcc.new_competitor_price IS NOT NULL
      AND pcc.old_competitor_price != pcc.new_competitor_price
    
    UNION ALL
    
    SELECT
      pcc.integration_id as competitor_id,
      pcc.product_id,
      pcc.old_our_retail_price as old_price,
      pcc.new_our_retail_price as new_price,
      ((pcc.new_our_retail_price - pcc.old_our_retail_price) / pcc.old_our_retail_price * 100) as price_change_percentage,
      pcc.changed_at,
      EXTRACT(DOW FROM pcc.changed_at) as day_of_week,
      'integration' as price_source
    FROM price_changes_competitors pcc
    WHERE pcc.user_id = p_user_id
      AND pcc.integration_id IS NOT NULL
      AND pcc.changed_at >= NOW() - (p_days || ' days')::INTERVAL
      AND pcc.old_our_retail_price IS NOT NULL
      AND pcc.new_our_retail_price IS NOT NULL
      AND pcc.old_our_retail_price != pcc.new_our_retail_price
  ),
  day_counts AS (
    SELECT
      cpc.competitor_id,
      cpc.price_source,
      cpc.day_of_week,
      COUNT(*) as changes_count
    FROM competitor_price_changes cpc
    GROUP BY cpc.competitor_id, cpc.price_source, cpc.day_of_week
  ),
  most_active_days AS (
    SELECT DISTINCT ON (dc.competitor_id, dc.price_source)
      dc.competitor_id,
      dc.price_source,
      dc.day_of_week as most_active_day_num
    FROM day_counts dc
    ORDER BY dc.competitor_id, dc.price_source, dc.changes_count DESC, dc.day_of_week
  ),
  entity_stats AS (
    SELECT
      cpc.competitor_id,
      cpc.price_source,
      COUNT(*) as total_price_changes,
      COUNT(DISTINCT cpc.product_id) as products_with_changes,
      COUNT(*)::NUMERIC / COUNT(DISTINCT cpc.product_id) as avg_changes_per_product,
      COUNT(*) FILTER (WHERE cpc.new_price > cpc.old_price) as price_increases,
      COUNT(*) FILTER (WHERE cpc.new_price < cpc.old_price) as price_decreases,
      AVG(ABS(cpc.price_change_percentage)) as avg_change_percentage
    FROM competitor_price_changes cpc
    GROUP BY cpc.competitor_id, cpc.price_source
  )
  SELECT
    CASE 
      WHEN es.price_source = 'integration' THEN NULL
      ELSE es.competitor_id
    END,
    CASE 
      WHEN es.price_source = 'integration' THEN COALESCE(i.name, 'Our Company')
      ELSE c.name 
    END,
    es.total_price_changes::INTEGER,
    es.products_with_changes::INTEGER,
    ROUND(es.avg_changes_per_product, 2),
    es.price_increases::INTEGER,
    es.price_decreases::INTEGER,
    ROUND(es.avg_change_percentage, 2),
    CASE COALESCE(mad.most_active_day_num, -1)
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
      WHEN 0 THEN 'Sunday'
      ELSE 'Unknown'
    END,
    (es.price_source = 'integration')
  FROM entity_stats es
  LEFT JOIN competitors c ON es.competitor_id = c.id AND es.price_source = 'competitor'
  LEFT JOIN integrations i ON es.competitor_id = i.id AND es.price_source = 'integration'
  LEFT JOIN most_active_days mad ON es.competitor_id = mad.competitor_id AND es.price_source = mad.price_source
  WHERE (c.user_id = p_user_id OR i.user_id = p_user_id)
  ORDER BY es.total_price_changes DESC;
END;
$$;


ALTER FUNCTION "public"."get_competitor_price_change_frequency"("p_user_id" "uuid", "p_days" integer, "p_competitor_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_competitor_statistics"("p_user_id" "uuid") RETURNS TABLE("competitor_id" "uuid", "product_count" bigint, "brand_count" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_competitor_statistics"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_comprehensive_analysis_summary"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_comprehensive_analysis_summary"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_comprehensive_analysis_summary"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) IS 'Returns comprehensive summary statistics for all stock analysis modules';



CREATE OR REPLACE FUNCTION "public"."get_conversation_summary"("user_uuid" "uuid") RETURNS TABLE("conversation_id" "uuid", "subject" "text", "status" "text", "category" "text", "priority" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_messages" bigint, "unread_messages" bigint, "last_message_content" "text", "last_message_sender" "text", "last_message_time" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_conversation_summary"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cron_jobs"() RETURNS TABLE("jobid" bigint, "schedule" "text", "command" "text", "nodename" "text", "nodeport" integer, "database" "text", "username" "text", "active" boolean, "jobname" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_cron_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cross_docking_friendly_brands"("p_user_id" "uuid", "p_min_products" integer DEFAULT 100, "p_max_avg_stock" numeric DEFAULT 50.0) RETURNS TABLE("brand_name" "text", "total_products" integer, "competitor_count" integer, "avg_stock_level" numeric, "products_with_low_stock" integer, "low_stock_percentage" numeric, "avg_competitor_price" numeric, "stock_turnover_indicator" "text", "cross_docking_suitability_score" numeric, "suitability_reason" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH our_brands AS (
        -- Brands we already have products for
        SELECT DISTINCT brand
        FROM products 
        WHERE user_id = p_user_id
            AND brand IS NOT NULL
            AND (our_wholesale_price IS NOT NULL OR our_retail_price IS NOT NULL)
    ),
    recent_stock_data AS (
        -- Get recent stock data per brand (excluding brands we already have)
        SELECT DISTINCT ON (scc.product_id, scc.competitor_id)
            p.brand,
            scc.product_id,
            scc.competitor_id,
            scc.new_stock_quantity,
            scc.new_stock_status
        FROM stock_changes_competitors scc
        JOIN products p ON scc.product_id = p.id
        WHERE scc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND scc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY scc.product_id, scc.competitor_id, scc.changed_at DESC
    ),
    recent_price_data AS (
        -- Get recent price data for the same brands (excluding brands we already have)
        SELECT DISTINCT ON (pcc.product_id, pcc.competitor_id)
            p.brand,
            pcc.product_id,
            pcc.competitor_id,
            pcc.new_competitor_price
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND pcc.new_competitor_price IS NOT NULL
            AND pcc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY pcc.product_id, pcc.competitor_id, pcc.changed_at DESC
    ),
    brand_stock_analysis AS (
        SELECT 
            rsd.brand,
            COUNT(DISTINCT rsd.product_id) as total_products,
            COUNT(DISTINCT rsd.competitor_id) as competitor_count,
            AVG(COALESCE(rsd.new_stock_quantity, 0)) as avg_stock_level,
            SUM(CASE WHEN COALESCE(rsd.new_stock_quantity, 0) <= 10 THEN 1 ELSE 0 END) as low_stock_products,
            AVG(rpd.new_competitor_price) as avg_price
        FROM recent_stock_data rsd
        LEFT JOIN recent_price_data rpd ON rsd.brand = rpd.brand AND rsd.product_id = rpd.product_id AND rsd.competitor_id = rpd.competitor_id
        GROUP BY rsd.brand
        HAVING COUNT(DISTINCT rsd.product_id) >= p_min_products
    ),
    stock_turnover_analysis AS (
        -- Analyze stock changes to estimate turnover (excluding brands we already have)
        SELECT 
            p.brand,
            COUNT(*) as stock_change_events,
            COUNT(DISTINCT scc.product_id) as products_with_changes,
            AVG(ABS(COALESCE(scc.stock_change_quantity, 0))) as avg_stock_change
        FROM stock_changes_competitors scc
        JOIN products p ON scc.product_id = p.id
        WHERE scc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND scc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
            AND scc.stock_change_quantity IS NOT NULL
            AND ABS(scc.stock_change_quantity) > 0
        GROUP BY p.brand
    )
    SELECT 
        bsa.brand::TEXT,
        bsa.total_products::INTEGER,
        bsa.competitor_count::INTEGER,
        ROUND(bsa.avg_stock_level, 2) as avg_stock_level,
        bsa.low_stock_products::INTEGER,
        ROUND((bsa.low_stock_products::NUMERIC / bsa.total_products * 100), 2) as low_stock_percentage,
        ROUND(COALESCE(bsa.avg_price, 0), 2) as avg_competitor_price,
        
        -- Stock turnover indicator
        CASE 
            WHEN COALESCE(sta.stock_change_events, 0) >= bsa.total_products * 0.5 THEN 'High Turnover'
            WHEN COALESCE(sta.stock_change_events, 0) >= bsa.total_products * 0.2 THEN 'Medium Turnover'
            ELSE 'Low Turnover'
        END::TEXT as stock_turnover_indicator,
        
        -- Cross-docking suitability score (0-100)
        ROUND(
            -- Low average stock (40 points max)
            (CASE WHEN bsa.avg_stock_level <= p_max_avg_stock THEN 
                40 * (1 - (bsa.avg_stock_level / p_max_avg_stock))
            ELSE 0 END) +
            
            -- High percentage of low stock products (30 points max)
            (LEAST(30, (bsa.low_stock_products::NUMERIC / bsa.total_products * 100) * 0.3)) +
            
            -- Multiple competitors (indicates market demand) (20 points max)
            (LEAST(20, bsa.competitor_count * 4)) +
            
            -- Stock turnover activity (10 points max)
            (CASE WHEN COALESCE(sta.stock_change_events, 0) > 0 THEN
                LEAST(10, (sta.stock_change_events::NUMERIC / bsa.total_products * 10))
            ELSE 0 END)
        , 2) as cross_docking_suitability_score,
        
        -- Suitability reason
        CASE 
            WHEN bsa.avg_stock_level <= p_max_avg_stock AND (bsa.low_stock_products::NUMERIC / bsa.total_products) >= 0.6 THEN
                'Low stock levels indicate JIT/cross-docking model - NEW BRAND OPPORTUNITY'
            WHEN bsa.avg_stock_level <= p_max_avg_stock AND bsa.competitor_count >= 3 THEN
                'Low stock with multiple competitors suggests fast-moving products - NEW BRAND OPPORTUNITY'
            WHEN (bsa.low_stock_products::NUMERIC / bsa.total_products) >= 0.5 THEN
                'High percentage of low-stock products - NEW BRAND OPPORTUNITY'
            WHEN COALESCE(sta.stock_change_events, 0) >= bsa.total_products * 0.3 THEN
                'High stock turnover activity - NEW BRAND OPPORTUNITY'
            ELSE
                'Moderate suitability for cross-docking - NEW BRAND OPPORTUNITY'
        END::TEXT as suitability_reason
        
    FROM brand_stock_analysis bsa
    LEFT JOIN stock_turnover_analysis sta ON bsa.brand = sta.brand
    WHERE bsa.avg_stock_level <= p_max_avg_stock  -- Filter by max average stock
    ORDER BY cross_docking_suitability_score DESC, bsa.total_products DESC;
END;
$$;


ALTER FUNCTION "public"."get_cross_docking_friendly_brands"("p_user_id" "uuid", "p_min_products" integer, "p_max_avg_stock" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cross_docking_friendly_brands"("p_user_id" "uuid", "p_min_products" integer, "p_max_avg_stock" numeric) IS 'Finds brands suitable for cross-docking model based on low stock levels and turnover patterns';



CREATE OR REPLACE FUNCTION "public"."get_current_stock_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_brand_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("product_id" "uuid", "product_name" "text", "brand" "text", "sku" "text", "current_stock" integer, "current_price" numeric, "inventory_value" numeric, "in_stock_flag" integer, "total_products" bigint, "products_in_stock" bigint, "in_stock_percentage" numeric, "total_inventory_value" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (scc.product_id, scc.competitor_id)
            scc.product_id, 
            scc.competitor_id, 
            scc.new_stock_quantity, 
            scc.new_stock_status
        FROM stock_changes_competitors scc
        WHERE scc.user_id = p_user_id 
          AND (p_competitor_id IS NULL OR scc.competitor_id = p_competitor_id)
        ORDER BY scc.product_id, scc.competitor_id, scc.changed_at DESC
    ),
    stock_analysis AS (
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.brand,
            p.sku,
            cs.new_stock_quantity as current_stock,
            pc.new_competitor_price as current_price,
            (COALESCE(cs.new_stock_quantity, 0) * COALESCE(pc.new_competitor_price, 0)) as inventory_value,
            CASE WHEN cs.new_stock_quantity > 0 THEN 1 ELSE 0 END as in_stock_flag
        FROM current_stock cs
        JOIN products p ON cs.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT pcc.new_competitor_price
            FROM price_changes_competitors pcc
            WHERE pcc.product_id = cs.product_id 
              AND pcc.user_id = p_user_id
              AND (p_competitor_id IS NULL OR pcc.competitor_id = p_competitor_id)
            ORDER BY pcc.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
    ),
    totals AS (
        SELECT 
            COUNT(*) as total_products,
            SUM(sa.in_stock_flag) as products_in_stock,
            SUM(sa.inventory_value) as total_inventory_value
        FROM stock_analysis sa
    )
    SELECT 
        sa.product_id,
        sa.product_name,
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


ALTER FUNCTION "public"."get_current_stock_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_stock_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text") IS 'Returns current stock levels, inventory values, and stock distribution analysis - Fixed ambiguous column reference';



CREATE OR REPLACE FUNCTION "public"."get_dismissed_product_duplicates"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "product_id_1" "uuid", "product_id_2" "uuid", "product_name_1" "text", "product_name_2" "text", "dismissal_key" "text", "dismissed_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_dismissed_product_duplicates"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_dismissed_product_duplicates"("p_user_id" "uuid") IS 'Gets all dismissed product duplicates for a user';



CREATE OR REPLACE FUNCTION "public"."get_integration_run_stats"("run_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_integration_run_stats"("run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid") RETURNS TABLE("product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "new_competitor_price" numeric, "competitor_url" "text", "changed_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lcd.product_id,
        lcd.competitor_id,
        lcd.integration_id,
        lcd.new_competitor_price,
        lcd.competitor_url,
        lcd.price_changed_at
    FROM latest_competitor_data_mv lcd
    WHERE lcd.user_id = p_user_id
    AND lcd.new_competitor_price IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid", "p_product_id" "uuid") RETURNS TABLE("id" "uuid", "product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "old_competitor_price" numeric, "new_competitor_price" numeric, "old_our_retail_price" numeric, "new_our_retail_price" numeric, "price_change_percentage" numeric, "currency_code" "text", "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_platform" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid", "p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_competitor_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "old_competitor_price" numeric, "new_competitor_price" numeric, "old_our_retail_price" numeric, "new_our_retail_price" numeric, "price_change_percentage" numeric, "currency_code" "text", "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_platform" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_latest_competitor_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_competitor_prices_batch_filtered"("p_user_id" "uuid", "p_product_ids" "uuid"[], "p_competitor_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "old_competitor_price" numeric, "new_competitor_price" numeric, "old_our_retail_price" numeric, "new_our_retail_price" numeric, "price_change_percentage" numeric, "currency_code" "text", "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_platform" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
            COALESCE(pc.competitor_url, pc.our_url, p.our_url) AS url,
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
          AND (
            p_competitor_ids IS NULL OR 
            pc.competitor_id = ANY(p_competitor_ids) OR 
            pc.integration_id = ANY(p_competitor_ids)
          )
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


ALTER FUNCTION "public"."get_latest_competitor_prices_batch_filtered"("p_user_id" "uuid", "p_product_ids" "uuid"[], "p_competitor_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_competitor_prices_batch_filtered"("p_user_id" "uuid", "p_product_ids" "uuid"[], "p_competitor_ids" "uuid"[]) IS 'Gets the latest competitor prices for multiple products with optional competitor filtering';



CREATE OR REPLACE FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid") RETURNS TABLE("product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "new_stock_quantity" integer, "new_stock_status" "text", "changed_at" timestamp without time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lcd.product_id,
        lcd.competitor_id,
        lcd.integration_id,
        lcd.new_stock_quantity,
        lcd.new_stock_status,
        lcd.stock_changed_at
    FROM latest_competitor_data_mv lcd
    WHERE lcd.user_id = p_user_id
    AND lcd.new_stock_quantity IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid", "p_product_id" "uuid") RETURNS TABLE("id" "uuid", "product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "current_stock_quantity" integer, "current_stock_status" "text", "current_availability_date" "date", "last_stock_change" integer, "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid", "p_product_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid", "p_product_id" "uuid") IS 'Gets the latest stock levels for a product from all competitors and integrations';



CREATE OR REPLACE FUNCTION "public"."get_latest_supplier_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "product_id" "uuid", "supplier_id" "uuid", "integration_id" "uuid", "old_supplier_price" numeric, "new_supplier_price" numeric, "old_our_wholesale_price" numeric, "new_our_wholesale_price" numeric, "old_supplier_recommended_price" numeric, "new_supplier_recommended_price" numeric, "price_change_percentage" numeric, "currency_code" "text", "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_platform" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH AllPrices AS (
        SELECT 
            ps.id,
            ps.product_id,
            ps.supplier_id,
            ps.integration_id,
            ps.old_supplier_price,
            ps.new_supplier_price,
            ps.old_our_wholesale_price,
            ps.new_our_wholesale_price,
            ps.old_supplier_recommended_price,
            ps.new_supplier_recommended_price,
            ps.price_change_percentage,
            ps.currency_code,
            ps.changed_at,
            CASE 
                WHEN ps.supplier_id IS NOT NULL THEN 'supplier'::TEXT 
                ELSE 'integration'::TEXT 
            END AS source_type,
            CASE 
                WHEN ps.supplier_id IS NOT NULL THEN s.name 
                ELSE i.name 
            END AS source_name,
            CASE 
                WHEN ps.supplier_id IS NOT NULL THEN s.website 
                ELSE NULL::TEXT 
            END AS source_website,
            CASE 
                WHEN ps.supplier_id IS NOT NULL THEN NULL::TEXT 
                ELSE i.platform 
            END AS source_platform,
            CASE 
                WHEN ps.supplier_id IS NOT NULL THEN ps.supplier_id 
                ELSE ps.integration_id 
            END AS source_id,
            COALESCE(ps.supplier_url, ps.our_url, p.our_url) AS url,
            ROW_NUMBER() OVER(
                PARTITION BY ps.product_id, 
                COALESCE(ps.supplier_id, ps.integration_id), 
                CASE WHEN ps.supplier_id IS NOT NULL THEN 'supplier' ELSE 'integration' END 
                ORDER BY ps.changed_at DESC
            ) as rn
        FROM price_changes_suppliers ps
        LEFT JOIN suppliers s ON ps.supplier_id = s.id
        LEFT JOIN integrations i ON ps.integration_id = i.id
        LEFT JOIN products p ON ps.product_id = p.id
        WHERE ps.user_id = p_user_id
          AND ps.product_id = ANY(p_product_ids)
    )
    SELECT 
        ap.id,
        ap.product_id,
        ap.supplier_id,
        ap.integration_id,
        ap.old_supplier_price,
        ap.new_supplier_price,
        ap.old_our_wholesale_price,
        ap.new_our_wholesale_price,
        ap.old_supplier_recommended_price,
        ap.new_supplier_recommended_price,
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
    ORDER BY COALESCE(ap.new_supplier_price, ap.new_our_wholesale_price) ASC;
END;
$$;


ALTER FUNCTION "public"."get_latest_supplier_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_supplier_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) IS 'Gets the latest supplier prices for multiple products from all suppliers and integrations in a single query';



CREATE OR REPLACE FUNCTION "public"."get_latest_supplier_stock_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) RETURNS TABLE("product_id" "uuid", "supplier_id" "uuid", "integration_id" "uuid", "new_stock_quantity" integer, "new_stock_status" "text", "new_availability_date" "date", "changed_at" timestamp with time zone, "supplier_name" "text", "integration_name" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_stock AS (
        SELECT DISTINCT ON (scs.product_id, COALESCE(scs.supplier_id, scs.integration_id))
            scs.product_id,
            scs.supplier_id,
            scs.integration_id,
            scs.new_stock_quantity,
            scs.new_stock_status,
            scs.new_availability_date,
            scs.changed_at,
            s.name as supplier_name,
            i.name as integration_name
        FROM stock_changes_suppliers scs
        LEFT JOIN suppliers s ON scs.supplier_id = s.id
        LEFT JOIN integrations i ON scs.integration_id = i.id
        WHERE scs.user_id = p_user_id
        AND scs.product_id = ANY(p_product_ids)
        AND scs.new_stock_quantity IS NOT NULL
        ORDER BY scs.product_id, COALESCE(scs.supplier_id, scs.integration_id), scs.changed_at DESC
    )
    SELECT 
        ls.product_id,
        ls.supplier_id,
        ls.integration_id,
        ls.new_stock_quantity,
        ls.new_stock_status,
        ls.new_availability_date,
        ls.changed_at,
        ls.supplier_name,
        ls.integration_name
    FROM latest_stock ls
    ORDER BY ls.product_id, ls.changed_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_latest_supplier_stock_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_market_positioning_overview"("p_user_id" "uuid", "p_brand_filter" "text" DEFAULT NULL::"text", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("total_our_products" integer, "products_with_competitor_data" integer, "market_coverage_percentage" numeric, "competitive_products" integer, "overpriced_products" integer, "competitive_percentage" numeric, "avg_price_premium_percentage" numeric, "total_competitors" integer, "most_competitive_against" "text", "least_competitive_against" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH our_products AS (
    SELECT 
      mv.id,
      mv.name,
      mv.brand_name,
      mv.our_retail_price,
      mv.competitor_prices,
      mv.competitor_count
    FROM latest_product_data_mv mv
    WHERE mv.user_id = p_user_id
      AND mv.our_retail_price IS NOT NULL
      AND mv.is_active = true
      AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
  ),
  competitor_price_data AS (
    -- Extract all competitor prices
    SELECT 
      op.id,
      op.our_retail_price,
      elem->>'competitor_id' as comp_id_text,
      (elem->>'new_competitor_price')::NUMERIC as comp_price,
      elem->>'competitor_name' as comp_name
    FROM our_products op,
         jsonb_array_elements(op.competitor_prices::jsonb) as elem
    WHERE op.competitor_count > 0
  ),
  product_min_prices AS (
    SELECT
      cpd.id,
      MIN(cpd.comp_price) as min_competitor_price
    FROM competitor_price_data cpd
    GROUP BY cpd.id
  ),
  price_analysis AS (
    SELECT
      op.id,
      op.our_retail_price,
      pmp.min_competitor_price,
      CASE
        WHEN pmp.min_competitor_price IS NULL THEN NULL
        WHEN op.our_retail_price <= pmp.min_competitor_price THEN 'competitive'
        ELSE 'overpriced'
      END as price_status,
      CASE 
        WHEN pmp.min_competitor_price IS NOT NULL THEN
          ((op.our_retail_price - pmp.min_competitor_price) / op.our_retail_price * 100)
        ELSE NULL
      END as price_premium_percentage
    FROM our_products op
    LEFT JOIN product_min_prices pmp ON op.id = pmp.id
  ),
  competitor_performance AS (
    SELECT
      cpd.comp_name as competitor_name,
      COUNT(*) FILTER (WHERE op.our_retail_price <= cpd.comp_price) as products_we_beat,
      COUNT(*) as total_comparisons
    FROM our_products op
    JOIN competitor_price_data cpd ON op.id = cpd.id
    GROUP BY cpd.comp_name
  ),
  unique_competitors AS (
    SELECT COUNT(DISTINCT comp_id_text::UUID) as total_comp
    FROM competitor_price_data
  )
  SELECT
    (SELECT COUNT(*) FROM our_products)::INTEGER,
    (SELECT COUNT(*) FROM price_analysis WHERE min_competitor_price IS NOT NULL)::INTEGER,
    ROUND(
      (SELECT COUNT(*) FROM price_analysis WHERE min_competitor_price IS NOT NULL)::NUMERIC /
      NULLIF((SELECT COUNT(*) FROM our_products), 0) * 100,
      2
    ),
    (SELECT COUNT(*) FROM price_analysis WHERE price_status = 'competitive')::INTEGER,
    (SELECT COUNT(*) FROM price_analysis WHERE price_status = 'overpriced')::INTEGER,
    ROUND(
      (SELECT COUNT(*) FROM price_analysis WHERE price_status = 'competitive')::NUMERIC /
      NULLIF((SELECT COUNT(*) FROM price_analysis WHERE min_competitor_price IS NOT NULL), 0) * 100,
      2
    ),
    ROUND(
      (SELECT AVG(price_premium_percentage) FROM price_analysis WHERE price_premium_percentage > 0),
      2
    ),
    (SELECT total_comp FROM unique_competitors)::INTEGER,
    (SELECT competitor_name FROM competitor_performance ORDER BY (products_we_beat::NUMERIC / NULLIF(total_comparisons, 0)) DESC LIMIT 1),
    (SELECT competitor_name FROM competitor_performance ORDER BY (products_we_beat::NUMERIC / NULLIF(total_comparisons, 0)) ASC LIMIT 1);
END;
$$;


ALTER FUNCTION "public"."get_market_positioning_overview"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_unknown_brand"("user_id_param" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_or_create_unknown_brand"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_user_settings"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_or_create_user_settings"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_price_competitiveness_trends"("p_user_id" "uuid", "p_start_date" "date" DEFAULT (CURRENT_DATE - '30 days'::interval), "p_end_date" "date" DEFAULT CURRENT_DATE, "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_brand_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("snapshot_date" "date", "competitor_id" "uuid", "competitor_name" "text", "brand_filter" "text", "total_products" integer, "products_we_are_cheapest" integer, "products_we_are_same_price" integer, "products_we_are_more_expensive" integer, "cheapest_percentage" numeric, "same_price_percentage" numeric, "more_expensive_percentage" numeric, "avg_price_difference_when_higher" numeric, "total_potential_savings" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.snapshot_date,
        s.competitor_id,
        COALESCE(c.name, 'All Competitors') as competitor_name,
        s.brand_filter,
        s.total_products_analyzed,
        s.products_we_are_cheapest,
        s.products_we_are_same_price,
        s.products_we_are_more_expensive,
        s.cheapest_percentage,
        s.same_price_percentage,
        s.more_expensive_percentage,
        s.avg_price_difference_when_higher,
        s.total_potential_savings
    FROM daily_price_competitiveness_snapshots s
    LEFT JOIN competitors c ON s.competitor_id = c.id
    WHERE s.user_id = p_user_id
        AND s.snapshot_date BETWEEN p_start_date AND p_end_date
        AND (
            (p_competitor_id IS NULL AND s.competitor_id IS NULL) OR
            (p_competitor_id IS NOT NULL AND s.competitor_id = p_competitor_id)
        )
        AND (
            (p_brand_filter IS NULL AND s.brand_filter IS NULL) OR
            (p_brand_filter IS NOT NULL AND s.brand_filter = p_brand_filter)
        )
    ORDER BY s.snapshot_date ASC, COALESCE(c.name, 'All Competitors');
END;
$$;


ALTER FUNCTION "public"."get_price_competitiveness_trends"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_price_competitiveness_trends"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") IS 'Retrieves historical price competitiveness trends from stored snapshots.
Parameters:
- p_user_id: The user ID to retrieve data for
- p_start_date: Start date for the trend period (default: 30 days ago)
- p_end_date: End date for the trend period (default: today)
- p_competitor_id: Filter by specific competitor (NULL for all competitors)
- p_brand_filter: Filter by specific brand (NULL for all brands)';



CREATE OR REPLACE FUNCTION "public"."get_price_range_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS TABLE("price_range" "text", "unique_products" bigint, "total_units_sold" bigint, "total_revenue" numeric, "avg_price_in_range" numeric, "revenue_percentage" numeric, "range_order" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
            pr.price_range,
            pr.range_order,
            COUNT(DISTINCT pr.name) as unique_products,
            SUM(pr.units_sold) as total_units_sold,
            SUM(pr.revenue) as total_revenue,
            AVG(pr.new_competitor_price) as avg_price_in_range
        FROM price_ranges pr
        GROUP BY pr.price_range, pr.range_order
    ),
    totals AS (
        SELECT SUM(ra.total_revenue) as grand_total_revenue FROM range_analysis ra
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


ALTER FUNCTION "public"."get_price_range_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_price_range_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) IS 'Returns sales distribution analysis across different price segments';



CREATE OR REPLACE FUNCTION "public"."get_priority_products_for_repricing"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_brand_filter" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "product_name" "text", "product_sku" "text", "product_brand" "text", "product_ean" "text", "our_price" numeric, "lowest_competitor_price" numeric, "price_difference" numeric, "price_difference_percentage" numeric, "potential_savings" numeric, "competitor_count" integer, "most_competitive_competitor_name" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH competitor_price_data AS (
    -- Extract competitor prices from materialized view
    SELECT 
      mv.id as product_id,
      mv.name as product_name,
      mv.sku as product_sku,
      mv.brand_name as product_brand,
      mv.ean as product_ean,
      mv.our_retail_price,
      elem->>'competitor_id' as comp_id_text,
      (elem->>'new_competitor_price')::NUMERIC as comp_price,
      elem->>'competitor_name' as comp_name
    FROM latest_product_data_mv mv,
         jsonb_array_elements(mv.competitor_prices::jsonb) as elem
    WHERE mv.user_id = p_user_id
      AND mv.our_retail_price IS NOT NULL
      AND mv.is_active = true
      AND mv.competitor_count > 0
      AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
      AND (p_competitor_id IS NULL OR (elem->>'competitor_id')::UUID = p_competitor_id)
  ),
  product_analysis AS (
    -- Analyze each product against competitor prices
    SELECT 
      cpd.product_id,
      cpd.product_name,
      cpd.product_sku,
      cpd.product_brand,
      cpd.product_ean,
      cpd.our_retail_price,
      MIN(cpd.comp_price) as min_competitor_price,
      COUNT(DISTINCT cpd.comp_id_text::UUID) as competitor_count,
      -- Get the competitor name with the lowest price
      (ARRAY_AGG(cpd.comp_name ORDER BY cpd.comp_price ASC))[1] as lowest_price_competitor
    FROM competitor_price_data cpd
    GROUP BY 
      cpd.product_id,
      cpd.product_name,
      cpd.product_sku,
      cpd.product_brand,
      cpd.product_ean,
      cpd.our_retail_price
    HAVING cpd.our_retail_price > MIN(cpd.comp_price) -- Only where we're more expensive
  )
  SELECT 
    pa.product_id,
    pa.product_name,
    pa.product_sku,
    pa.product_brand,
    pa.product_ean,
    ROUND(pa.our_retail_price, 2) as our_price,
    ROUND(pa.min_competitor_price, 2) as lowest_competitor_price,
    ROUND(pa.our_retail_price - pa.min_competitor_price, 2) as price_difference,
    ROUND(((pa.our_retail_price - pa.min_competitor_price) / pa.our_retail_price * 100), 2) as price_difference_percentage,
    ROUND(pa.our_retail_price - pa.min_competitor_price, 2) as potential_savings,
    pa.competitor_count::INTEGER,
    COALESCE(pa.lowest_price_competitor, 'Unknown') as most_competitive_competitor_name
  FROM product_analysis pa
  ORDER BY (pa.our_retail_price - pa.min_competitor_price) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_priority_products_for_repricing"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_processing_stats"() RETURNS TABLE("table_name" "text", "record_count" bigint, "avg_processing_time_ms" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_processing_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_price_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "old_competitor_price" numeric, "new_competitor_price" numeric, "old_our_retail_price" numeric, "new_our_retail_price" numeric, "price_change_percentage" numeric, "currency_code" "text", "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_platform" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_product_price_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_stock_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "product_id" "uuid", "competitor_id" "uuid", "integration_id" "uuid", "old_stock_quantity" integer, "new_stock_quantity" integer, "old_stock_status" "text", "new_stock_status" "text", "old_availability_date" "date", "new_availability_date" "date", "stock_change_quantity" integer, "changed_at" timestamp with time zone, "source_type" "text", "source_name" "text", "source_website" "text", "source_id" "uuid", "url" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_product_stock_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) FROM products WHERE user_id = p_user_id
    );
END;
$$;


ALTER FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid", "p_brand" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_is_active" boolean DEFAULT NULL::boolean, "p_has_price" boolean DEFAULT NULL::boolean, "p_not_our_products" boolean DEFAULT NULL::boolean) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    _count integer;
    _brand_uuid uuid;
BEGIN
    -- Try to convert brand to UUID if it looks like one, otherwise keep as text for name search
    BEGIN
        _brand_uuid := p_brand::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        _brand_uuid := NULL;
    END;

    -- Simple count query without complex JOINs
    SELECT COUNT(*) INTO _count
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.user_id = p_user_id
    AND (
        p_brand IS NULL OR 
        (_brand_uuid IS NOT NULL AND p.brand_id = _brand_uuid) OR
        (_brand_uuid IS NULL AND b.name ILIKE '%' || p_brand || '%')
    )
    AND (p_category IS NULL OR p.category ILIKE '%' || p_category || '%')
    AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%' OR p.ean ILIKE '%' || p_search || '%')
    AND (p_is_active IS NULL OR p.is_active = p_is_active)
    AND (
        (p_has_price IS NULL AND p_not_our_products IS NULL) OR
        (p_has_price = true AND p.our_retail_price IS NOT NULL) OR
        (p_not_our_products = true AND p.our_retail_price IS NULL)
    );

    RETURN _count;
END;
$$;


ALTER FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_has_price" boolean, "p_not_our_products" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_products_filtered"("p_user_id" "uuid", "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 12, "p_sort_by" "text" DEFAULT 'created_at'::"text", "p_sort_order" "text" DEFAULT 'desc'::"text", "p_brand" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_is_active" boolean DEFAULT NULL::boolean, "p_competitor_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_has_price" boolean DEFAULT NULL::boolean, "p_in_stock_only" boolean DEFAULT NULL::boolean, "p_price_lower_than_competitors" boolean DEFAULT NULL::boolean, "p_price_higher_than_competitors" boolean DEFAULT NULL::boolean, "p_not_our_products" boolean DEFAULT NULL::boolean, "p_supplier_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_our_products_with_competitor_prices" boolean DEFAULT NULL::boolean, "p_our_products_with_supplier_prices" boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    _offset integer;
    _limit integer;
    _sort_direction text;
    _total_count integer;
    _result json;
    _safe_sort_by text;
    _products_data json;
    _brand_uuid uuid;
BEGIN
    _offset := (p_page - 1) * p_page_size;
    _limit := p_page_size;
    
    _sort_direction := CASE WHEN LOWER(p_sort_order) = 'asc' THEN 'ASC' ELSE 'DESC' END;
    
    _safe_sort_by := CASE WHEN p_sort_by IN ('name', 'sku', 'ean', 'created_at', 'updated_at', 'our_retail_price', 'our_wholesale_price', 'stock_quantity', 'competitor_count') THEN p_sort_by ELSE 'created_at' END;
    
    BEGIN
        _brand_uuid := p_brand::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        _brand_uuid := NULL;
    END;

    -- Get total count
    WITH filtered_products AS (
        SELECT lpdm.id
        FROM latest_product_data_mv lpdm
        LEFT JOIN brands b ON lpdm.brand_id = b.id
        WHERE lpdm.user_id = p_user_id
        AND (p_brand IS NULL OR (_brand_uuid IS NOT NULL AND lpdm.brand_id = _brand_uuid) OR (_brand_uuid IS NULL AND b.name ILIKE '%' || p_brand || '%'))
        AND (p_category IS NULL OR lpdm.category ILIKE '%' || p_category || '%')
        AND (p_search IS NULL OR lpdm.name ILIKE '%' || p_search || '%' OR lpdm.sku ILIKE '%' || p_search || '%' OR lpdm.ean ILIKE '%' || p_search || '%')
        AND (p_is_active IS NULL OR lpdm.is_active = p_is_active)
        AND (p_competitor_ids IS NULL OR (lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0 AND EXISTS (SELECT 1 FROM json_array_elements(lpdm.competitor_prices) AS cp WHERE (cp->>'competitor_id')::uuid = ANY(p_competitor_ids))))
        AND (p_supplier_ids IS NULL OR EXISTS (SELECT 1 FROM price_changes_suppliers pcs WHERE pcs.user_id = p_user_id AND pcs.product_id = lpdm.id AND (pcs.supplier_id = ANY(p_supplier_ids))))
        AND ((p_has_price IS NULL AND p_not_our_products IS NULL AND p_our_products_with_competitor_prices IS NULL AND p_our_products_with_supplier_prices IS NULL) OR (p_has_price = true AND lpdm.our_retail_price IS NOT NULL) OR (p_not_our_products = true AND lpdm.our_retail_price IS NULL) OR (p_our_products_with_competitor_prices = true AND lpdm.our_retail_price IS NOT NULL AND lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0) OR (p_our_products_with_supplier_prices = true AND lpdm.our_retail_price IS NOT NULL AND EXISTS (SELECT 1 FROM price_changes_suppliers pcs WHERE pcs.user_id = p_user_id AND pcs.product_id = lpdm.id AND pcs.new_supplier_price IS NOT NULL AND pcs.supplier_id IS NOT NULL)))
        AND (p_in_stock_only IS NULL OR (p_in_stock_only = true AND lpdm.has_stock = true))
        AND (p_price_lower_than_competitors IS NULL OR (p_price_lower_than_competitors = true AND lpdm.our_retail_price IS NOT NULL AND lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0 AND lpdm.our_retail_price < ALL(SELECT (cp->>'new_competitor_price')::numeric FROM json_array_elements(lpdm.competitor_prices) AS cp WHERE cp->>'new_competitor_price' IS NOT NULL)))
        AND (p_price_higher_than_competitors IS NULL OR (p_price_higher_than_competitors = true AND lpdm.our_retail_price IS NOT NULL AND lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0 AND lpdm.our_retail_price > ALL(SELECT (cp->>'new_competitor_price')::numeric FROM json_array_elements(lpdm.competitor_prices) AS cp WHERE cp->>'new_competitor_price' IS NOT NULL)))
    )
    SELECT COUNT(*) INTO _total_count FROM filtered_products;

    -- Get products data
    WITH products_with_prices AS (
        SELECT 
            lpdm.id, lpdm.name, lpdm.sku, lpdm.ean, lpdm.brand_id, lpdm.category, lpdm.our_retail_price, lpdm.our_wholesale_price, lpdm.image_url, lpdm.our_url, lpdm.is_active, lpdm.created_at, lpdm.updated_at, lpdm.brand_name,
            lpdm.has_stock,
            lpdm.stock_quantity,
            lpdm.competitor_count,
            lpdm.competitor_prices
        FROM latest_product_data_mv lpdm
        LEFT JOIN brands b ON lpdm.brand_id = b.id
        WHERE lpdm.user_id = p_user_id
        AND (p_brand IS NULL OR (_brand_uuid IS NOT NULL AND lpdm.brand_id = _brand_uuid) OR (_brand_uuid IS NULL AND b.name ILIKE '%' || p_brand || '%'))
        AND (p_category IS NULL OR lpdm.category ILIKE '%' || p_category || '%')
        AND (p_search IS NULL OR lpdm.name ILIKE '%' || p_search || '%' OR lpdm.sku ILIKE '%' || p_search || '%' OR lpdm.ean ILIKE '%' || p_search || '%')
        AND (p_is_active IS NULL OR lpdm.is_active = p_is_active)
        AND (p_competitor_ids IS NULL OR (lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0 AND EXISTS (SELECT 1 FROM json_array_elements(lpdm.competitor_prices) AS cp WHERE (cp->>'competitor_id')::uuid = ANY(p_competitor_ids))))
        AND (p_supplier_ids IS NULL OR EXISTS (SELECT 1 FROM price_changes_suppliers pcs WHERE pcs.user_id = p_user_id AND pcs.product_id = lpdm.id AND (pcs.supplier_id = ANY(p_supplier_ids))))
        AND ((p_has_price IS NULL AND p_not_our_products IS NULL AND p_our_products_with_competitor_prices IS NULL AND p_our_products_with_supplier_prices IS NULL) OR (p_has_price = true AND lpdm.our_retail_price IS NOT NULL) OR (p_not_our_products = true AND lpdm.our_retail_price IS NULL) OR (p_our_products_with_competitor_prices = true AND lpdm.our_retail_price IS NOT NULL AND lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0) OR (p_our_products_with_supplier_prices = true AND lpdm.our_retail_price IS NOT NULL AND EXISTS (SELECT 1 FROM price_changes_suppliers pcs WHERE pcs.user_id = p_user_id AND pcs.product_id = lpdm.id AND pcs.new_supplier_price IS NOT NULL AND pcs.supplier_id IS NOT NULL)))
        AND (p_in_stock_only IS NULL OR (p_in_stock_only = true AND lpdm.has_stock = true))
        AND (p_price_lower_than_competitors IS NULL OR (p_price_lower_than_competitors = true AND lpdm.our_retail_price IS NOT NULL AND lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0 AND lpdm.our_retail_price < ALL(SELECT (cp->>'new_competitor_price')::numeric FROM json_array_elements(lpdm.competitor_prices) AS cp WHERE cp->>'new_competitor_price' IS NOT NULL)))
        AND (p_price_higher_than_competitors IS NULL OR (p_price_higher_than_competitors = true AND lpdm.our_retail_price IS NOT NULL AND lpdm.competitor_prices IS NOT NULL AND json_array_length(lpdm.competitor_prices) > 0 AND lpdm.our_retail_price > ALL(SELECT (cp->>'new_competitor_price')::numeric FROM json_array_elements(lpdm.competitor_prices) AS cp WHERE cp->>'new_competitor_price' IS NOT NULL)))
        ORDER BY CASE WHEN _safe_sort_by = 'name' AND _sort_direction = 'ASC' THEN lpdm.name END ASC, CASE WHEN _safe_sort_by = 'name' AND _sort_direction = 'DESC' THEN lpdm.name END DESC, CASE WHEN _safe_sort_by = 'sku' AND _sort_direction = 'ASC' THEN lpdm.sku END ASC, CASE WHEN _safe_sort_by = 'sku' AND _sort_direction = 'DESC' THEN lpdm.sku END DESC, CASE WHEN _safe_sort_by = 'ean' AND _sort_direction = 'ASC' THEN lpdm.ean END ASC, CASE WHEN _safe_sort_by = 'ean' AND _sort_direction = 'DESC' THEN lpdm.ean END DESC, CASE WHEN _safe_sort_by = 'created_at' AND _sort_direction = 'ASC' THEN lpdm.created_at END ASC, CASE WHEN _safe_sort_by = 'created_at' AND _sort_direction = 'DESC' THEN lpdm.created_at END DESC, CASE WHEN _safe_sort_by = 'updated_at' AND _sort_direction = 'ASC' THEN lpdm.updated_at END ASC, CASE WHEN _safe_sort_by = 'updated_at' AND _sort_direction = 'DESC' THEN lpdm.updated_at END DESC, CASE WHEN _safe_sort_by = 'our_retail_price' AND _sort_direction = 'ASC' THEN lpdm.our_retail_price END ASC, CASE WHEN _safe_sort_by = 'our_retail_price' AND _sort_direction = 'DESC' THEN lpdm.our_retail_price END DESC, CASE WHEN _safe_sort_by = 'our_wholesale_price' AND _sort_direction = 'ASC' THEN lpdm.our_wholesale_price END ASC, CASE WHEN _safe_sort_by = 'our_wholesale_price' AND _sort_direction = 'DESC' THEN lpdm.our_wholesale_price END DESC, CASE WHEN _safe_sort_by = 'stock_quantity' AND _sort_direction = 'ASC' THEN lpdm.stock_quantity END ASC NULLS LAST, CASE WHEN _safe_sort_by = 'stock_quantity' AND _sort_direction = 'DESC' THEN lpdm.stock_quantity END DESC NULLS LAST, CASE WHEN _safe_sort_by = 'competitor_count' AND _sort_direction = 'ASC' THEN NULLIF(lpdm.competitor_count, 0) END ASC NULLS LAST, CASE WHEN _safe_sort_by = 'competitor_count' AND _sort_direction = 'DESC' THEN NULLIF(lpdm.competitor_count, 0) END DESC NULLS LAST
        LIMIT _limit OFFSET _offset
    )
    SELECT COALESCE(json_agg(json_build_object('id', pwp.id, 'name', pwp.name, 'sku', pwp.sku, 'ean', pwp.ean, 'brand_id', pwp.brand_id, 'brand_name', pwp.brand_name, 'category', pwp.category, 'our_retail_price', pwp.our_retail_price, 'our_wholesale_price', pwp.our_wholesale_price, 'image_url', pwp.image_url, 'our_url', pwp.our_url, 'is_active', pwp.is_active, 'created_at', pwp.created_at, 'updated_at', pwp.updated_at, 'competitor_prices', pwp.competitor_prices)), '[]'::json) INTO _products_data FROM products_with_prices pwp;

    _result := json_build_object('data', COALESCE(_products_data, '[]'::json), 'totalCount', _total_count);
    RETURN _result;
END;
$$;


ALTER FUNCTION "public"."get_products_filtered"("p_user_id" "uuid", "p_page" integer, "p_page_size" integer, "p_sort_by" "text", "p_sort_order" "text", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_competitor_ids" "uuid"[], "p_has_price" boolean, "p_in_stock_only" boolean, "p_price_lower_than_competitors" boolean, "p_price_higher_than_competitors" boolean, "p_not_our_products" boolean, "p_supplier_ids" "uuid"[], "p_our_products_with_competitor_prices" boolean, "p_our_products_with_supplier_prices" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_analysis_data"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_brand_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("product_id" "uuid", "product_name" "text", "brand" "text", "sku" "text", "total_sold" numeric, "avg_price" numeric, "total_revenue" numeric, "active_days" bigint, "revenue_percentage" numeric, "avg_daily_sales" numeric, "avg_daily_revenue" numeric, "current_price" numeric, "days_tracked" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."get_sales_analysis_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_brand_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_scheduling_stats"() RETURNS TABLE("metric_name" "text", "metric_value" bigint, "description" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_scheduling_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_scraper_run_health"("p_scraper_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id          uuid;
    v_owner_id         uuid;
    v_last_id          uuid;
    v_last_count       integer;
    v_last_started     timestamptz;
    v_last_completed   timestamptz;
    v_last_status      text;
    v_last_is_test     boolean;
    v_baseline_median  numeric;
    v_baseline_min     integer;
    v_baseline_runs    integer;
    v_rejection_count  integer;
    v_drop_rate        numeric;
    v_denominator      integer;
    v_status           text := 'ok';
    v_reason_code      text := 'ok';
    v_reason_text      text := 'OK';
    v_window_end       timestamptz;
BEGIN
    v_user_id := auth.uid();

    SELECT user_id INTO v_owner_id FROM scrapers WHERE id = p_scraper_id;
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('status', 'unknown', 'reason_code', 'scraper_not_found', 'reason_text', 'Scraper not found');
    END IF;
    IF v_user_id IS NOT NULL AND v_owner_id <> v_user_id THEN
        RETURN jsonb_build_object('status', 'unknown', 'reason_code', 'forbidden', 'reason_text', 'Not authorized');
    END IF;

    -- Latest non-test run (any status)
    SELECT id, product_count, started_at, completed_at, status, is_test_run
      INTO v_last_id, v_last_count, v_last_started, v_last_completed, v_last_status, v_last_is_test
    FROM scraper_runs
    WHERE scraper_id = p_scraper_id
      AND COALESCE(is_test_run, false) = false
    ORDER BY COALESCE(completed_at, started_at) DESC NULLS LAST
    LIMIT 1;

    IF v_last_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'ok',
            'reason_code', 'no_runs',
            'reason_text', 'Ingen körning ännu',
            'last_run_count', NULL,
            'last_run_at', NULL,
            'last_run_status', NULL,
            'baseline_median', NULL,
            'baseline_min', NULL,
            'baseline_runs', 0,
            'rejection_count_last_run', 0,
            'drop_rate', 0
        );
    END IF;

    -- Baseline: median of last 10 completed, non-test runs BEFORE the last one
    WITH recent AS (
        SELECT product_count
        FROM scraper_runs
        WHERE scraper_id = p_scraper_id
          AND status = 'completed'
          AND COALESCE(is_test_run, false) = false
          AND id <> v_last_id
          AND product_count IS NOT NULL
        ORDER BY COALESCE(completed_at, started_at) DESC
        LIMIT 10
    )
    SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY product_count)::numeric,
        MIN(product_count),
        COUNT(*)
    INTO v_baseline_median, v_baseline_min, v_baseline_runs
    FROM recent;

    -- Rejections within the last run's time window
    v_window_end := COALESCE(v_last_completed, now());
    SELECT COUNT(*)
      INTO v_rejection_count
    FROM scraper_run_rejections
    WHERE scraper_id = p_scraper_id
      AND rejected_at >= v_last_started
      AND rejected_at <= v_window_end + interval '5 minutes';

    -- product_count in scraper_runs = rows SENT by worker.
    -- rejections is a subset of that (rows filtered by validator before insert).
    -- Use the larger of the two as denominator to stay robust against timing gaps.
    v_denominator := GREATEST(COALESCE(v_last_count, 0), COALESCE(v_rejection_count, 0));
    v_drop_rate := CASE
        WHEN v_denominator = 0 THEN 0
        ELSE LEAST(v_rejection_count::numeric / v_denominator::numeric, 1)
    END;

    -- Determine status (most severe first)
    IF v_last_status = 'failed' THEN
        v_status := 'critical';
        v_reason_code := 'last_run_failed';
        v_reason_text := 'Senaste körningen misslyckades';
    ELSIF v_last_status = 'completed' AND COALESCE(v_last_count,0) = 0 THEN
        v_status := 'critical';
        v_reason_code := 'zero_products';
        v_reason_text := 'Körningen lyckades men hittade 0 produkter';
    ELSIF v_drop_rate >= 0.5 THEN
        v_status := 'critical';
        v_reason_code := 'high_drop_rate';
        v_reason_text := format('Drop-rate %s%% – rader avvisas av validatorn (ofta: saknad brand eller SKU)',
                                round(v_drop_rate * 100)::text);
    ELSIF v_baseline_median IS NOT NULL AND v_baseline_median > 0
          AND v_last_count::numeric < 0.5 * v_baseline_median THEN
        v_status := 'critical';
        v_reason_code := 'low_volume_critical';
        v_reason_text := format('Endast %s produkter vs baseline %s (< 50%%)',
                                v_last_count, round(v_baseline_median));
    ELSIF v_drop_rate >= 0.1 THEN
        v_status := 'warning';
        v_reason_code := 'elevated_drop_rate';
        v_reason_text := format('Drop-rate %s%% – kontrollera brand/SKU-extraktion',
                                round(v_drop_rate * 100)::text);
    ELSIF v_baseline_median IS NOT NULL AND v_baseline_median > 0
          AND v_last_count::numeric < 0.8 * v_baseline_median THEN
        v_status := 'warning';
        v_reason_code := 'low_volume_warning';
        v_reason_text := format('Endast %s produkter vs baseline %s (< 80%%)',
                                v_last_count, round(v_baseline_median));
    END IF;

    RETURN jsonb_build_object(
        'status', v_status,
        'reason_code', v_reason_code,
        'reason_text', v_reason_text,
        'last_run_id', v_last_id,
        'last_run_count', v_last_count,
        'last_run_at', COALESCE(v_last_completed, v_last_started),
        'last_run_status', v_last_status,
        'baseline_median', v_baseline_median,
        'baseline_min', v_baseline_min,
        'baseline_runs', v_baseline_runs,
        'rejection_count_last_run', v_rejection_count,
        'drop_rate', round(v_drop_rate, 4)
    );
END;
$$;


ALTER FUNCTION "public"."get_scraper_run_health"("p_scraper_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_snapshot_statistics"("days_back" integer DEFAULT 30) RETURNS TABLE("metric" "text", "value" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(DISTINCT snapshot_date) as unique_dates,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(*) as total_snapshots,
            MIN(snapshot_date) as earliest_date,
            MAX(snapshot_date) as latest_date,
            AVG(total_products_analyzed) as avg_products_per_snapshot
        FROM daily_price_competitiveness_snapshots
        WHERE snapshot_date >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    )
    SELECT 'Unique Dates'::TEXT, unique_dates::TEXT FROM stats
    UNION ALL
    SELECT 'Unique Users'::TEXT, unique_users::TEXT FROM stats
    UNION ALL
    SELECT 'Total Snapshots'::TEXT, total_snapshots::TEXT FROM stats
    UNION ALL
    SELECT 'Earliest Date'::TEXT, earliest_date::TEXT FROM stats
    UNION ALL
    SELECT 'Latest Date'::TEXT, latest_date::TEXT FROM stats
    UNION ALL
    SELECT 'Avg Products/Snapshot'::TEXT, ROUND(avg_products_per_snapshot, 1)::TEXT FROM stats;
END;
$$;


ALTER FUNCTION "public"."get_snapshot_statistics"("days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_snapshot_statistics"("days_back" integer) IS 'Get summary statistics about snapshot data for monitoring and verification purposes.';



CREATE OR REPLACE FUNCTION "public"."get_stock_summary_stats"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_stock_summary_stats"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_stock_summary_stats"("p_user_id" "uuid") IS 'Returns summary statistics for stock tracking including product counts, stock levels, and sales velocity';



CREATE OR REPLACE FUNCTION "public"."get_stock_turnover_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_end_date" timestamp without time zone DEFAULT NULL::timestamp without time zone, "p_dead_stock_days" integer DEFAULT 30) RETURNS TABLE("product_id" "uuid", "product_name" "text", "brand" "text", "sku" "text", "total_sales" bigint, "avg_stock_level" numeric, "current_stock" integer, "stock_turnover_ratio" numeric, "stock_status" "text", "days_since_last_sale" integer, "velocity_category" "text", "last_sale_date" timestamp without time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '90 days');
    date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (scc.product_id, scc.competitor_id)
            scc.product_id, 
            scc.competitor_id, 
            scc.new_stock_quantity, 
            scc.changed_at
        FROM stock_changes_competitors scc
        WHERE scc.user_id = p_user_id 
          AND (p_competitor_id IS NULL OR scc.competitor_id = p_competitor_id)
        ORDER BY scc.product_id, scc.competitor_id, scc.changed_at DESC
    ),
    sales_data AS (
        SELECT 
            sc.product_id,
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
        GROUP BY sc.product_id
    ),
    stock_history AS (
        SELECT 
            sch.product_id,
            AVG(sch.new_stock_quantity) as avg_stock_level
        FROM stock_changes_competitors sch
        WHERE sch.user_id = p_user_id 
          AND (p_competitor_id IS NULL OR sch.competitor_id = p_competitor_id)
          AND sch.changed_at >= date_filter_start
          AND sch.changed_at <= date_filter_end
        GROUP BY sch.product_id
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
            -- Dead Stock Indicator: Only for products with current stock > 0
            CASE 
                WHEN cs.new_stock_quantity > 0 AND (sd.last_sale < NOW() - INTERVAL '1 day' * p_dead_stock_days OR sd.last_sale IS NULL)
                THEN 'Dead Stock'
                WHEN cs.new_stock_quantity > 0
                THEN 'Active'
                ELSE 'Out of Stock'
            END as stock_status,
            COALESCE(EXTRACT(DAYS FROM (NOW() - sd.last_sale))::INTEGER, 999) as days_since_last_sale,
            -- Velocity categories: Only for products with sales data
            CASE 
                WHEN sd.total_sales IS NULL OR sd.active_sales_days IS NULL THEN 'No Sales Data'
                WHEN COALESCE(sd.total_sales, 0) / NULLIF(sd.active_sales_days, 0) > 10 THEN 'Fast Mover'
                WHEN COALESCE(sd.total_sales, 0) / NULLIF(sd.active_sales_days, 0) > 3 THEN 'Medium Mover'
                ELSE 'Slow Mover'
            END as velocity_category,
            sd.last_sale::timestamp without time zone
        FROM products p
        LEFT JOIN sales_data sd ON p.id = sd.product_id
        LEFT JOIN stock_history sh ON p.id = sh.product_id
        LEFT JOIN current_stock cs ON p.id = cs.product_id
        WHERE p.user_id = p_user_id
          AND cs.product_id IS NOT NULL  -- Only include products we have stock data for
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


ALTER FUNCTION "public"."get_stock_turnover_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_dead_stock_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_stock_turnover_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_dead_stock_days" integer) IS 'Returns stock turnover ratios, dead stock detection, and velocity categorization';



CREATE OR REPLACE FUNCTION "public"."get_trending_new_brands"("p_user_id" "uuid", "p_days_back" integer DEFAULT 90) RETURNS TABLE("brand_name" "text", "first_seen_date" "date", "days_since_first_seen" integer, "current_product_count" integer, "competitor_count" integer, "product_growth_rate" numeric, "avg_competitor_price" numeric, "price_trend" "text", "avg_stock_level" numeric, "trending_score" numeric, "trend_category" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_start_date DATE := CURRENT_DATE - (p_days_back || ' days')::INTERVAL;
    v_mid_date DATE := CURRENT_DATE - ((p_days_back / 2)::INTEGER || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH our_brands AS (
        -- Brands we already have products for
        SELECT DISTINCT brand
        FROM products 
        WHERE user_id = p_user_id
            AND brand IS NOT NULL
            AND (our_wholesale_price IS NOT NULL OR our_retail_price IS NOT NULL)
    ),
    brand_first_appearance AS (
        -- Find when each brand first appeared in our competitor data (excluding brands we already have)
        SELECT 
            p.brand,
            MIN(pcc.changed_at)::DATE as first_seen_date
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND pcc.competitor_id IS NOT NULL
            AND pcc.changed_at >= v_start_date
        GROUP BY p.brand
    ),
    current_brand_metrics AS (
        -- Current metrics for these brands (excluding brands we already have)
        SELECT 
            p.brand,
            COUNT(DISTINCT pcc.product_id) as current_products,
            COUNT(DISTINCT pcc.competitor_id) as competitor_count,
            AVG(pcc.new_competitor_price) as avg_price
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND pcc.competitor_id IS NOT NULL
            AND pcc.new_competitor_price IS NOT NULL
            AND pcc.changed_at >= CURRENT_DATE - INTERVAL '7 days'  -- Recent data
        GROUP BY p.brand
    ),
    historical_brand_metrics AS (
        -- Historical metrics for growth calculation (excluding brands we already have)
        SELECT 
            p.brand,
            COUNT(DISTINCT pcc.product_id) as historical_products
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND pcc.competitor_id IS NOT NULL
            AND pcc.changed_at BETWEEN v_start_date AND v_mid_date
        GROUP BY p.brand
    ),
    price_trend_analysis AS (
        -- Analyze price trends for these brands (excluding brands we already have)
        SELECT 
            p.brand,
            AVG(CASE WHEN pcc.changed_at >= v_mid_date THEN pcc.new_competitor_price END) as recent_avg_price,
            AVG(CASE WHEN pcc.changed_at < v_mid_date THEN pcc.new_competitor_price END) as historical_avg_price
        FROM price_changes_competitors pcc
        JOIN products p ON pcc.product_id = p.id
        WHERE pcc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND pcc.competitor_id IS NOT NULL
            AND pcc.new_competitor_price IS NOT NULL
            AND pcc.changed_at >= v_start_date
        GROUP BY p.brand
    ),
    stock_metrics AS (
        -- Get stock information (excluding brands we already have)
        SELECT 
            p.brand,
            AVG(COALESCE(scc.new_stock_quantity, 0)) as avg_stock
        FROM stock_changes_competitors scc
        JOIN products p ON scc.product_id = p.id
        WHERE scc.user_id = p_user_id
            AND p.brand IS NOT NULL
            AND p.brand NOT IN (SELECT brand FROM our_brands)  -- EXCLUDE brands we have
            AND scc.changed_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.brand
    )
    SELECT 
        bfa.brand::TEXT,
        bfa.first_seen_date,
        (CURRENT_DATE - bfa.first_seen_date)::INTEGER as days_since_first_seen,
        COALESCE(cbm.current_products, 0)::INTEGER as current_product_count,
        COALESCE(cbm.competitor_count, 0)::INTEGER as competitor_count,
        
        -- Product growth rate (percentage increase from historical to current)
        ROUND(CASE 
            WHEN COALESCE(hbm.historical_products, 0) > 0 THEN
                ((cbm.current_products - hbm.historical_products)::NUMERIC / hbm.historical_products * 100)
            WHEN cbm.current_products > 0 THEN 100.0  -- New brand, 100% growth
            ELSE 0.0
        END, 2) as product_growth_rate,
        
        ROUND(COALESCE(cbm.avg_price, 0), 2) as avg_competitor_price,
        
        -- Price trend
        CASE 
            WHEN pta.recent_avg_price IS NULL OR pta.historical_avg_price IS NULL THEN 'Insufficient Data'
            WHEN pta.recent_avg_price > pta.historical_avg_price * 1.05 THEN 'Increasing'
            WHEN pta.recent_avg_price < pta.historical_avg_price * 0.95 THEN 'Decreasing'
            ELSE 'Stable'
        END::TEXT as price_trend,
        
        ROUND(COALESCE(sm.avg_stock, 0), 2) as avg_stock_level,
        
        -- Trending score (0-100)
        ROUND(
            -- Recency factor (newer = higher score, max 30 points)
            (CASE WHEN (CURRENT_DATE - bfa.first_seen_date) <= 30 THEN 30
                  WHEN (CURRENT_DATE - bfa.first_seen_date) <= 60 THEN 20
                  ELSE 10 END) +
            
            -- Product count factor (max 25 points)
            (LEAST(25, cbm.current_products * 0.25)) +
            
            -- Growth rate factor (max 25 points)
            (LEAST(25, CASE 
                WHEN COALESCE(hbm.historical_products, 0) > 0 THEN
                    ((cbm.current_products - hbm.historical_products)::NUMERIC / hbm.historical_products * 25)
                WHEN cbm.current_products > 0 THEN 25.0
                ELSE 0.0
            END)) +
            
            -- Competitor interest factor (max 20 points)
            (LEAST(20, cbm.competitor_count * 5))
        , 2) as trending_score,
        
        -- Trend category
        CASE 
            WHEN (CURRENT_DATE - bfa.first_seen_date) <= 30 AND cbm.current_products >= 50 THEN 'Hot New Brand - EXPANSION OPPORTUNITY'
            WHEN (CURRENT_DATE - bfa.first_seen_date) <= 60 AND cbm.current_products >= 100 THEN 'Rapidly Growing - EXPANSION OPPORTUNITY'
            WHEN cbm.current_products >= 200 AND cbm.competitor_count >= 3 THEN 'Established Trending - EXPANSION OPPORTUNITY'
            WHEN COALESCE(hbm.historical_products, 0) > 0 AND 
                 ((cbm.current_products - hbm.historical_products)::NUMERIC / hbm.historical_products) >= 0.5 THEN 'Fast Growing - EXPANSION OPPORTUNITY'
            ELSE 'Emerging - EXPANSION OPPORTUNITY'
        END::TEXT as trend_category
        
    FROM brand_first_appearance bfa
    LEFT JOIN current_brand_metrics cbm ON bfa.brand = cbm.brand
    LEFT JOIN historical_brand_metrics hbm ON bfa.brand = hbm.brand
    LEFT JOIN price_trend_analysis pta ON bfa.brand = pta.brand
    LEFT JOIN stock_metrics sm ON bfa.brand = sm.brand
    WHERE COALESCE(cbm.current_products, 0) >= 10  -- Minimum threshold for trending
    ORDER BY trending_score DESC, cbm.current_products DESC;
END;
$$;


ALTER FUNCTION "public"."get_trending_new_brands"("p_user_id" "uuid", "p_days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_trending_new_brands"("p_user_id" "uuid", "p_days_back" integer) IS 'Finds new and trending brands based on recent appearance and growth patterns in competitor data';



CREATE OR REPLACE FUNCTION "public"."get_unique_competitor_products"("p_user_id" "uuid", "p_competitor_id" "uuid") RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_unique_competitor_products"("p_user_id" "uuid", "p_competitor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unique_integration_products"("p_user_id" "uuid", "p_integration_id" "uuid") RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_unique_integration_products"("p_user_id" "uuid", "p_integration_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_message_count"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_unread_message_count"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_growth_stats"("period_days" integer DEFAULT 30) RETURNS TABLE("date" "date", "new_users" bigint, "cumulative_users" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_user_growth_stats"("period_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_growth_stats"("period_days" integer) IS 'Returns user growth statistics over a specified period in days.';



CREATE OR REPLACE FUNCTION "public"."get_user_matching_settings"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_user_matching_settings"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_matching_settings"("p_user_id" "uuid") IS 'Gets user matching settings with defaults';



CREATE OR REPLACE FUNCTION "public"."get_user_primary_currency"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_currency text;
BEGIN
    -- Get currency from user_settings table
    SELECT primary_currency INTO v_currency
    FROM user_settings
    WHERE user_id = p_user_id;
    
    -- If not found, return default
    RETURN COALESCE(v_currency, 'USD');
END;
$$;


ALTER FUNCTION "public"."get_user_primary_currency"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_workload"() RETURNS TABLE("user_id" "uuid", "user_name" "text", "user_email" "text", "active_scrapers" bigint, "active_integrations" bigint, "jobs_today" bigint, "avg_execution_time_ms" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_user_workload"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_workload_stats"() RETURNS TABLE("user_id" "uuid", "user_name" "text", "user_email" "text", "active_scrapers" bigint, "active_integrations" bigint, "jobs_today" bigint, "jobs_this_week" bigint, "jobs_this_month" bigint, "avg_execution_time_ms" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_user_workload_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_workload_stats"() IS 'Returns user workload distribution with active scrapers, integrations, and job statistics including daily, weekly, and monthly counts. Removed is_approved column reference.';



CREATE OR REPLACE FUNCTION "public"."get_worker_capacity_config"() RETURNS TABLE("worker_type" "text", "max_concurrent_jobs" integer, "current_jobs" integer, "description" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_worker_capacity_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_worker_error"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_worker_error"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_worker_error"() IS 'Handles worker timeouts by marking pending jobs as failed if they have been pending for too long and have not been claimed by a worker.';



CREATE OR REPLACE FUNCTION "public"."is_valid_ean"("ean_code" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_valid_ean"("ean_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_valid_ean"("ean_code" "text") IS 'Validates EAN codes to ensure they are 8-13 digits long, contain only numbers, and are not obviously invalid patterns like repeated single digits';



CREATE OR REPLACE FUNCTION "public"."list_unhealthy_scrapers"() RETURNS TABLE("scraper_id" "uuid", "scraper_name" "text", "competitor_id" "uuid", "competitor_name" "text", "status" "text", "reason_code" "text", "reason_text" "text", "last_run_at" timestamp with time zone, "last_run_count" integer, "baseline_median" numeric, "drop_rate" numeric, "rejection_count_last_run" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH user_scrapers AS (
        SELECT s.id, s.name AS sname, s.competitor_id, c.name AS cname
        FROM scrapers s
        JOIN competitors c ON c.id = s.competitor_id
        WHERE s.user_id = v_user_id
          AND s.is_active = true
    ),
    health AS (
        SELECT
            us.id AS sid,
            us.sname,
            us.competitor_id AS cid,
            us.cname,
            get_scraper_run_health(us.id) AS h
        FROM user_scrapers us
    )
    SELECT
        sid,
        sname,
        cid,
        cname,
        (h->>'status')::text,
        (h->>'reason_code')::text,
        (h->>'reason_text')::text,
        (h->>'last_run_at')::timestamptz,
        NULLIF(h->>'last_run_count','')::integer,
        NULLIF(h->>'baseline_median','')::numeric,
        NULLIF(h->>'drop_rate','')::numeric,
        NULLIF(h->>'rejection_count_last_run','')::integer
    FROM health
    WHERE (h->>'status') IN ('warning','critical')
    ORDER BY
        CASE (h->>'status') WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        (h->>'last_run_at')::timestamptz DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."list_unhealthy_scrapers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_messages_read"("conversation_uuid" "uuid", "reader_type" "text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mark_conversation_messages_read"("conversation_uuid" "uuid", "reader_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_integration_price_changes"("source_integration_name" "text", "target_integration_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."merge_integration_price_changes"("source_integration_name" "text", "target_integration_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_product_data"("existing_name" "text", "new_name" "text", "existing_sku" "text", "new_sku" "text", "existing_ean" "text", "new_ean" "text", "existing_brand" "text", "new_brand" "text", "existing_brand_id" "uuid", "new_brand_id" "uuid", "existing_image_url" "text", "new_image_url" "text", "existing_url" "text", "new_url" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."merge_product_data"("existing_name" "text", "new_name" "text", "existing_sku" "text", "new_sku" "text", "existing_ean" "text", "new_ean" "text", "existing_brand" "text", "new_brand" "text", "existing_brand_id" "uuid", "new_brand_id" "uuid", "existing_image_url" "text", "new_image_url" "text", "existing_url" "text", "new_url" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."merge_product_data"("existing_name" "text", "new_name" "text", "existing_sku" "text", "new_sku" "text", "existing_ean" "text", "new_ean" "text", "existing_brand" "text", "new_brand" "text", "existing_brand_id" "uuid", "new_brand_id" "uuid", "existing_image_url" "text", "new_image_url" "text", "existing_url" "text", "new_url" "text") IS 'Intelligently merges product data preferring more complete information';



CREATE OR REPLACE FUNCTION "public"."merge_products_api"("primary_id" "uuid", "duplicate_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."merge_products_api"("primary_id" "uuid", "duplicate_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."merge_products_api"("primary_id" "uuid", "duplicate_id" "uuid") IS 'Enhanced product merging with intelligent data selection and no temp table updates';



CREATE OR REPLACE FUNCTION "public"."normalize_sku"("sku" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."normalize_sku"("sku" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."normalize_sku"("sku" "text") IS 'Normalizes SKU by removing separators and converting to uppercase. Used for fuzzy SKU matching.';



CREATE OR REPLACE FUNCTION "public"."normalize_sku_for_matching"("input_sku" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."normalize_sku_for_matching"("input_sku" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."optimize_scraper_schedules"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ DECLARE scraper_record record; update_count integer := 0; time_slot integer := 0; total_scrapers integer; minutes_per_slot integer; new_hour integer; new_minute integer; new_time text; updated_schedule jsonb; BEGIN SELECT COUNT(*) INTO total_scrapers FROM public.scrapers WHERE is_active = true; minutes_per_slot := GREATEST(5, (24 * 60) / GREATEST(total_scrapers, 1)); FOR scraper_record IN SELECT id, schedule, user_id FROM public.scrapers WHERE is_active = true ORDER BY user_id, id LOOP new_hour := (time_slot * minutes_per_slot) / 60; new_minute := (time_slot * minutes_per_slot) % 60; new_time := LPAD((new_hour % 24)::text, 2, '0') || ':' || LPAD(new_minute::text, 2, '0'); updated_schedule := jsonb_set( scraper_record.schedule, '{time}', to_jsonb(new_time) ); UPDATE public.scrapers SET schedule = updated_schedule, updated_at = now() WHERE id = scraper_record.id; update_count := update_count + 1; time_slot := time_slot + 1; END LOOP; INSERT INTO public.debug_logs (message, created_at) VALUES ('Optimized scraper schedules - updated_scrapers: ' || update_count || ', total_scrapers: ' || total_scrapers || ', minutes_per_slot: ' || minutes_per_slot, now()); RETURN update_count; END; $$;


ALTER FUNCTION "public"."optimize_scraper_schedules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."perform_mv_refresh"("p_view_name" "text" DEFAULT 'latest_product_data_mv'::"text") RETURNS TABLE("success" boolean, "message" "text", "duration_ms" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_duration_ms INTEGER;
  v_error_msg TEXT;
BEGIN
  v_start_time := NOW();
  
  BEGIN
    -- Perform the actual refresh
    IF p_view_name = 'latest_product_data_mv' THEN
      REFRESH MATERIALIZED VIEW latest_product_data_mv;
    ELSIF p_view_name = 'brand_statistics_mv' THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY brand_statistics_mv;
    ELSE
      RAISE EXCEPTION 'Unknown materialized view: %', p_view_name;
    END IF;
    
    v_end_time := NOW();
    v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time))::INTEGER * 1000;
    
    -- Update status to completed
    UPDATE public.mv_refresh_status 
    SET is_refreshing = FALSE,
        last_refresh_completed_at = v_end_time,
        last_error = NULL,
        refresh_duration_ms = v_duration_ms,
        updated_at = NOW()
    WHERE view_name = p_view_name;
    
    RETURN QUERY SELECT TRUE, 'Refresh completed successfully', v_duration_ms;
    
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    
    -- Update status with error
    UPDATE public.mv_refresh_status 
    SET is_refreshing = FALSE,
        last_error = v_error_msg,
        updated_at = NOW()
    WHERE view_name = p_view_name;
    
    RETURN QUERY SELECT FALSE, 'Refresh failed: ' || v_error_msg, 0;
  END;
END;
$$;


ALTER FUNCTION "public"."perform_mv_refresh"("p_view_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."perform_mv_refresh_background"("p_view_name" "text" DEFAULT 'latest_product_data_mv'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_duration_ms NUMERIC;
  v_is_refreshing BOOLEAN;
BEGIN
  SELECT is_refreshing INTO v_is_refreshing
  FROM mv_refresh_status
  WHERE view_name = p_view_name;

  IF NOT v_is_refreshing THEN
    RAISE NOTICE 'Refresh not needed for % (is_refreshing=false)', p_view_name;
    RETURN;
  END IF;

  v_start_time := clock_timestamp();
  RAISE NOTICE 'Starting background refresh of %', p_view_name;

  BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW %I', p_view_name);

    v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;

    UPDATE mv_refresh_status
    SET is_refreshing = FALSE,
        last_refresh_completed_at = NOW(),
        refresh_duration_ms = v_duration_ms,
        last_error = NULL,
        updated_at = NOW()
    WHERE view_name = p_view_name;

    RAISE NOTICE 'Background refresh of % completed in % ms', p_view_name, v_duration_ms;

  EXCEPTION WHEN OTHERS THEN
    UPDATE mv_refresh_status
    SET is_refreshing = FALSE,
        last_error = SQLERRM,
        updated_at = NOW()
    WHERE view_name = p_view_name;

    RAISE WARNING 'Background refresh of % failed: %', p_view_name, SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "public"."perform_mv_refresh_background"("p_view_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_our_urls_in_changes"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."populate_our_urls_in_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_all_pending_temp_integrations"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."process_all_pending_temp_integrations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_all_temp_data"("batch_size" integer DEFAULT 500, "max_processing_time_minutes" integer DEFAULT 30) RETURNS TABLE("processing_stage" "text", "table_name" "text", "processed" integer, "errors" integer, "new_products" integer, "changes" integer, "processing_time_ms" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."process_all_temp_data"("batch_size" integer, "max_processing_time_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_custom_fields"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN process_custom_fields_from_raw_data(p_user_id, p_product_id, p_raw_data); END; $$;


ALTER FUNCTION "public"."process_custom_fields"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" "text" DEFAULT 'scraper'::"text", "p_source_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" "text", "p_source_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" character varying, "p_source_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" character varying, "p_source_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_scraper_timeouts"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ DECLARE timeout_count integer := 0; timeout_record record; BEGIN FOR timeout_record IN SELECT sr.id, sr.scraper_id, sr.started_at FROM public.scraper_runs sr WHERE sr.status = 'running' AND sr.started_at < now() - interval '2 hours' LOOP UPDATE public.scraper_runs SET status = 'failed', completed_at = now(), error_message = 'Job timed out after 2 hours' WHERE id = timeout_record.id; timeout_count := timeout_count + 1; INSERT INTO public.debug_logs (message, created_at) VALUES ('Scraper run timed out - run_id: ' || timeout_record.id || ', scraper_id: ' || timeout_record.scraper_id || ', started_at: ' || timeout_record.started_at, now()); END LOOP; RETURN timeout_count; END; $$;


ALTER FUNCTION "public"."process_scraper_timeouts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 500) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "stock_changes" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    total_price_changes INTEGER := 0;
    total_stock_changes INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
    current_competitor_price NUMERIC(10,2);
    current_stock_quantity INTEGER;
    current_stock_status TEXT;
    current_availability_date DATE;
    standardized_status TEXT;
    old_category TEXT;
    new_category TEXT;
    product_our_url TEXT;
BEGIN
    FOR temp_record IN 
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            matched_product_id := NULL;
            v_brand_id := NULL;
            
            -- STEP 1: Brand lookup
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            
            -- STEP 2: Product matching - EAN first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            
            -- Try brand_id + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
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
            ELSE
                -- For existing products, update image_url if the product doesn't have our_url
                SELECT our_url INTO product_our_url
                FROM products
                WHERE id = matched_product_id;

                IF product_our_url IS NULL AND temp_record.image_url IS NOT NULL THEN
                    UPDATE products
                    SET image_url = temp_record.image_url,
                        updated_at = NOW()
                    WHERE id = matched_product_id;
                END IF;
            END IF;

            -- STEP 3: Price change detection
            SELECT new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND competitor_id = temp_record.competitor_id
            ORDER BY changed_at DESC
            LIMIT 1;

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

            -- STEP 4: Stock processing
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

                    total_stock_changes := total_stock_changes + 1;
                END IF;
            END IF;

            -- STEP 5: Mark as processed and DELETE
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;

            total_processed := total_processed + 1;

        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error processing record % (SKU: %, Brand: %): %',
                temp_record.id, temp_record.sku, temp_record.brand, SQLERRM;
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;
        END;
    END LOOP;

    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_stock_changes;
END;
$$;


ALTER FUNCTION "public"."process_temp_competitors_batch"("p_competitor_id" "uuid", "batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch_keep_temp"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 100) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "stock_changes" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    total_price_changes INTEGER := 0;
    total_stock_changes INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
    current_competitor_price NUMERIC(10,2);
    current_stock_quantity INTEGER;
    current_stock_status TEXT;
    current_availability_date DATE;
    standardized_status TEXT;
    old_category TEXT;
    new_category TEXT;
    product_our_url TEXT;
BEGIN
    RAISE NOTICE 'Starting batch processing (KEEP TEMP) for competitor % (batch size: %)', p_competitor_id, batch_size;
    
    FOR temp_record IN 
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            matched_product_id := NULL;
            v_brand_id := NULL;
            
            -- STEP 1: Brand lookup
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            
            -- STEP 2: Product matching - EAN first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            
            -- Try brand_id + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
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
            ELSE
                -- For existing products, update image_url if the product doesn't have our_url
                SELECT our_url INTO product_our_url
                FROM products
                WHERE id = matched_product_id;

                IF product_our_url IS NULL AND temp_record.image_url IS NOT NULL THEN
                    UPDATE products
                    SET image_url = temp_record.image_url,
                        updated_at = NOW()
                    WHERE id = matched_product_id;
                END IF;
            END IF;

            -- STEP 3: Price change detection
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

            -- STEP 4: Stock processing
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

                    total_stock_changes := total_stock_changes + 1;
                END IF;
            END IF;

            -- STEP 5: Update temp record (MOVED TO END - only if successful)
            UPDATE temp_competitors_scraped_data 
            SET product_id = matched_product_id,
                processed = true
            WHERE id = temp_record.id;

            total_processed := total_processed + 1;

        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error processing record % (SKU: %, Brand: %): %',
                temp_record.id, temp_record.sku, temp_record.brand, SQLERRM;
            -- Mark as processed but don't set product_id on error
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
        END;
    END LOOP;

    RAISE NOTICE 'Batch complete! Processed: %, Errors: %, New products: %, Price changes: %, Stock changes: %',
                 total_processed, total_errors, total_new_products, total_price_changes, total_stock_changes;

    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_stock_changes;
END;
$$;


ALTER FUNCTION "public"."process_temp_competitors_batch_keep_temp"("p_competitor_id" "uuid", "batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch_test"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 500) RETURNS TABLE("temp_id" "uuid", "temp_name" "text", "temp_sku" "text", "temp_ean" "text", "temp_brand" "text", "matched_product_id" "uuid", "matched_product_name" "text", "match_method" "text", "would_create_new" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  temp_record RECORD;
  v_matched_product_id UUID;
  v_matched_product_name TEXT;
  v_match_method TEXT;
  v_brand_id UUID;
BEGIN
  FOR temp_record IN 
    SELECT * FROM temp_competitors_scraped_data t
    WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
      AND t.processed = false
    ORDER BY t.scraped_at
    LIMIT batch_size
  LOOP
    v_matched_product_id := NULL;
    v_matched_product_name := NULL;
    v_match_method := NULL;
    
    -- Try EAN match first
    IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
      SELECT id, name INTO v_matched_product_id, v_matched_product_name
      FROM products
      WHERE user_id = temp_record.user_id
        AND ean = temp_record.ean
      LIMIT 1;
      
      IF v_matched_product_id IS NOT NULL THEN
        v_match_method := 'EAN';
      END IF;
    END IF;
    
    -- Try SKU + Brand match if EAN didn't match
    IF v_matched_product_id IS NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
      -- Get brand_id if brand exists
      IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
        SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
      END IF;
      
      SELECT id, name INTO v_matched_product_id, v_matched_product_name
      FROM products
      WHERE user_id = temp_record.user_id
        AND sku = temp_record.sku
        AND (v_brand_id IS NULL OR brand_id = v_brand_id)
      LIMIT 1;
      
      IF v_matched_product_id IS NOT NULL THEN
        v_match_method := 'SKU+Brand';
      END IF;
    END IF;
    
    -- Return the result
    RETURN QUERY SELECT
      temp_record.id,
      temp_record.name,
      temp_record.sku,
      temp_record.ean,
      temp_record.brand,
      v_matched_product_id,
      v_matched_product_name,
      v_match_method,
      (v_matched_product_id IS NULL) as would_create_new;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_temp_competitors_batch_test"("p_competitor_id" "uuid", "batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch_with_conflict_detection"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 100) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "conflicts" integer, "reviews" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    old_category TEXT;
    new_category TEXT;
    product_our_url TEXT;
BEGIN
    start_time := clock_timestamp();
    RAISE NOTICE 'Starting batch processing for competitor % (batch size: %)', p_competitor_id, batch_size;
    
    -- Get batch IDs
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
    
    RAISE NOTICE 'Processing % records', array_length(batch_ids, 1);
    
    -- Process records
    FOR temp_record IN 
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            -- STEP 1: Brand lookup
            v_brand_id := NULL;
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            
            -- STEP 2: Product matching
            matched_product_id := NULL;
            
            -- Try EAN match first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            
            -- Try brand_id + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
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
            ELSE
                -- For existing products, update image_url if the product doesn't have our_url
                SELECT our_url INTO product_our_url
                FROM products
                WHERE id = matched_product_id;

                IF product_our_url IS NULL AND temp_record.image_url IS NOT NULL THEN
                    UPDATE products
                    SET image_url = temp_record.image_url,
                        updated_at = NOW()
                    WHERE id = matched_product_id;

                    RAISE NOTICE 'Updated image_url for product % (no our_url)', matched_product_id;
                END IF;
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

            -- RESTORED: Price change detection - only insert if price actually changed
            SELECT new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND competitor_id = temp_record.competitor_id
            ORDER BY changed_at DESC
            LIMIT 1;

            -- Only insert if price actually changed (RESTORED - WORKAROUND REMOVED)
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
                SELECT new_stock_quantity, new_stock_status, new_availability_date
                INTO current_stock_quantity, current_stock_status, current_availability_date
                FROM stock_changes_competitors
                WHERE user_id = temp_record.user_id
                  AND product_id = matched_product_id
                  AND competitor_id = temp_record.competitor_id
                ORDER BY changed_at DESC
                LIMIT 1;

                standardized_status := standardize_stock_status(temp_record.stock_status);

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

            -- Mark as processed and delete
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


ALTER FUNCTION "public"."process_temp_competitors_batch_with_conflict_detection"("p_competitor_id" "uuid", "batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_scraped_data"() RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "conflicts_detected" integer, "reviews_created" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- This function now uses the conflict detection version
    RAISE NOTICE 'Processing all competitor data using optimized batch function with conflict detection';
    
    RETURN QUERY 
    SELECT * FROM process_temp_competitors_batch_with_conflict_detection(NULL, 500);
END;
$$;


ALTER FUNCTION "public"."process_temp_competitors_scraped_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_scraped_data_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."process_temp_competitors_scraped_data_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_integrations_scraped_data"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    IF NEW.status IS NULL OR NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;

    -- Validate that the record has minimum required data
    IF (NEW.ean IS NULL OR NEW.ean = '') AND 
       (NEW.sku IS NULL OR NEW.sku = '' OR NEW.brand IS NULL OR NEW.brand = '') THEN
        -- Mark as error in the NEW record (will be saved automatically)
        NEW.status := 'error';
        NEW.error_message := 'Missing required fields (EAN or SKU+Brand)';
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

    -- Round integration prices to whole numbers
    rounded_retail_price := CASE WHEN NEW.our_retail_price IS NOT NULL THEN ROUND(NEW.our_retail_price) ELSE NULL END;
    rounded_wholesale_price := CASE WHEN NEW.our_wholesale_price IS NOT NULL THEN ROUND(NEW.our_wholesale_price) ELSE NULL END;

    -- Find or create brand
    v_brand_id := NULL;
    IF NEW.brand IS NOT NULL AND NEW.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;
    ELSE
        SELECT get_or_create_unknown_brand(NEW.user_id) INTO v_brand_id;
    END IF;

    -- Try to find existing product
    existing_product_id := NULL;
    
    -- Try EAN match first
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
        SELECT id INTO existing_product_id FROM products 
        WHERE user_id = NEW.user_id AND ean = NEW.ean
        LIMIT 1;
    END IF;
    
    -- If no EAN match, try SKU + brand_id match
    IF existing_product_id IS NULL AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL THEN
        SELECT id INTO existing_product_id FROM products 
        WHERE user_id = NEW.user_id 
          AND sku = NEW.sku 
          AND brand_id = v_brand_id
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
            user_id, name, sku, ean, brand, brand_id,
            our_retail_price, our_wholesale_price, image_url, our_url, currency_code
        ) VALUES (
            NEW.user_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN NEW.name ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN NEW.sku ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN NEW.ean ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN NEW.brand ELSE NULL END,
            v_brand_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN NEW.image_url ELSE NULL END,
            NEW.our_url,
            CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id)) ELSE NULL END
        ) RETURNING id INTO existing_product_id;
    ELSE
        -- Update existing product
        UPDATE products SET
            name = CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN COALESCE(NEW.name, name) ELSE name END,
            sku = CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN COALESCE(NEW.sku, sku) ELSE sku END,
            ean = CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN COALESCE(NEW.ean, ean) ELSE ean END,
            brand = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(NEW.brand, brand) ELSE brand END,
            brand_id = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(v_brand_id, brand_id) ELSE brand_id END,
            our_retail_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE our_retail_price END,
            our_wholesale_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE our_wholesale_price END,
            image_url = CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN COALESCE(NEW.image_url, image_url) ELSE image_url END,
            our_url = COALESCE(NEW.our_url, our_url),
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(NEW.currency_code, currency_code) ELSE currency_code END,
            updated_at = NOW()
        WHERE id = existing_product_id;
    END IF;

    -- Record price changes
    IF rounded_retail_price IS NOT NULL AND (current_retail_price IS NULL OR current_retail_price != rounded_retail_price) THEN
        INSERT INTO price_changes_competitors (
            user_id, product_id, old_our_retail_price, new_our_retail_price,
            changed_at, integration_id, currency_code, our_url
        ) VALUES (
            NEW.user_id, existing_product_id, current_retail_price, rounded_retail_price,
            NOW(), NEW.integration_id, COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id)), NEW.our_url
        );
    END IF;

    IF rounded_wholesale_price IS NOT NULL AND (current_wholesale_price IS NULL OR current_wholesale_price != rounded_wholesale_price) THEN
        INSERT INTO price_changes_suppliers (
            user_id, product_id, old_our_wholesale_price, new_our_wholesale_price,
            changed_at, integration_id, currency_code, our_url, change_source
        ) VALUES (
            NEW.user_id, existing_product_id, current_wholesale_price, rounded_wholesale_price,
            NOW(), NEW.integration_id, COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id)), NEW.our_url, 'integration'
        );
    END IF;

    -- Process custom fields
    IF NEW.raw_data IS NOT NULL THEN
        SELECT process_custom_fields_from_raw_data(
            NEW.user_id, existing_product_id, NEW.raw_data, 'integration', NEW.integration_id
        ) INTO custom_fields_result;
    END IF;

    -- Mark as processed in the NEW record (will be saved automatically)
    NEW.status := 'processed';
    NEW.processed_at := NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_temp_integrations_scraped_data"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temp_integrations_scraped_data" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "integration_run_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prestashop_product_id" "text",
    "name" "text" NOT NULL,
    "sku" "text",
    "ean" "text",
    "brand" "text",
    "our_retail_price" numeric(10,2),
    "our_wholesale_price" numeric(10,2),
    "image_url" "text",
    "raw_data" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "currency_code" "text",
    "our_url" "text",
    "stock_quantity" integer,
    "stock_status" "text",
    "availability_date" "date",
    "raw_stock_data" "jsonb",
    CONSTRAINT "temp_integrations_scraped_data_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code"))))
);


ALTER TABLE "public"."temp_integrations_scraped_data" OWNER TO "postgres";


COMMENT ON COLUMN "public"."temp_integrations_scraped_data"."stock_quantity" IS 'Numeric stock quantity from integration';



COMMENT ON COLUMN "public"."temp_integrations_scraped_data"."stock_status" IS 'Text stock status from integration';



COMMENT ON COLUMN "public"."temp_integrations_scraped_data"."availability_date" IS 'Future availability date if product is out of stock';



COMMENT ON COLUMN "public"."temp_integrations_scraped_data"."raw_stock_data" IS 'Raw stock data from integration including detailed stock information';



CREATE OR REPLACE FUNCTION "public"."process_temp_integrations_scraped_data_logic"("record_data" "public"."temp_integrations_scraped_data") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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

    -- STEP 1: Find or create brand using the proper function that respects aliases
    v_brand_id := NULL;
    IF record_data.brand IS NOT NULL AND record_data.brand != '' AND 
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        -- Use the find_or_create_brand function that properly checks aliases
        SELECT find_or_create_brand(record_data.user_id, record_data.brand) INTO v_brand_id;
    ELSE
        -- If no brand provided or brand field is disabled, use Unknown brand
        SELECT get_or_create_unknown_brand(record_data.user_id) INTO v_brand_id;
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
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(record_data.currency_code, currency_code) ELSE currency_code END,
            updated_at = NOW()
        WHERE id = existing_product_id;
    END IF;

    -- Record retail price changes in price_changes_competitors table (for our retail prices)
    IF rounded_retail_price IS NOT NULL AND (current_retail_price IS NULL OR current_retail_price != rounded_retail_price) THEN
        INSERT INTO price_changes_competitors (
            user_id, product_id, old_our_retail_price, new_our_retail_price, 
            changed_at, integration_id, currency_code, our_url
        ) VALUES (
            record_data.user_id, existing_product_id, current_retail_price, rounded_retail_price,
            NOW(), record_data.integration_id, COALESCE(record_data.currency_code, user_currency), record_data.our_url
        );
    END IF;

    -- Record wholesale price changes in price_changes_suppliers table (for our wholesale prices)
    IF rounded_wholesale_price IS NOT NULL AND (current_wholesale_price IS NULL OR current_wholesale_price != rounded_wholesale_price) THEN
        INSERT INTO price_changes_suppliers (
            user_id, product_id, old_our_wholesale_price, new_our_wholesale_price,
            changed_at, integration_id, currency_code, our_url, change_source
        ) VALUES (
            record_data.user_id, existing_product_id, current_wholesale_price, rounded_wholesale_price,
            NOW(), record_data.integration_id, COALESCE(record_data.currency_code, user_currency), record_data.our_url, 'integration'
        );
    END IF;

    -- Process custom fields if they exist in raw_data
    IF record_data.raw_data IS NOT NULL THEN
        SELECT process_custom_fields_from_raw_data(
            record_data.user_id,
            existing_product_id,
            record_data.raw_data,
            'integration',
            record_data.integration_id
        ) INTO custom_fields_result;
    END IF;

    -- Mark as processed and delete
    UPDATE temp_integrations_scraped_data 
    SET status = 'processed', processed_at = NOW() 
    WHERE id = record_data.id;

    DELETE FROM temp_integrations_scraped_data WHERE id = record_data.id;
END;
$$;


ALTER FUNCTION "public"."process_temp_integrations_scraped_data_logic"("record_data" "public"."temp_integrations_scraped_data") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_integrations_scraped_data_manual"("p_record_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."process_temp_integrations_scraped_data_manual"("p_record_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_minimal"("batch_size" integer DEFAULT 100) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
BEGIN
    FOR temp_record IN 
        SELECT * FROM temp_competitors_scraped_data t
        WHERE t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            matched_product_id := NULL;
            v_brand_id := NULL;
            
            -- Brand lookup
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            
            -- EAN match
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            
            -- SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND brand_id = v_brand_id
                  AND normalize_sku_for_matching(sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;
            END IF;
            
            -- Create new if no match
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, currency_code
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                ) RETURNING id INTO matched_product_id;
                
                total_new_products := total_new_products + 1;
            END IF;
            
            -- Update temp table
            UPDATE temp_competitors_scraped_data 
            SET product_id = matched_product_id,
                processed = true
            WHERE id = temp_record.id;
            
            total_processed := total_processed + 1;
            
        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error: % (SKU: %)', SQLERRM, temp_record.sku;
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
        END;
    END LOOP;
    
    RETURN QUERY SELECT total_processed, total_errors, total_new_products;
END;
$$;


ALTER FUNCTION "public"."process_temp_minimal"("batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_single_debug"("p_temp_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  temp_rec RECORD;
  v_brand_id UUID;
  matched_id UUID;
  result_text TEXT := '';
BEGIN
  -- Get temp record
  SELECT * INTO temp_rec FROM temp_competitors_scraped_data WHERE id = p_temp_id;
  
  IF NOT FOUND THEN
    RETURN 'Record not found';
  END IF;
  
  result_text := result_text || 'Record: ' || temp_rec.name || E'\n';
  result_text := result_text || 'SKU: ' || COALESCE(temp_rec.sku, 'NULL') || E'\n';
  result_text := result_text || 'EAN: ' || COALESCE(temp_rec.ean, 'NULL') || E'\n';
  result_text := result_text || 'Brand: ' || COALESCE(temp_rec.brand, 'NULL') || E'\n';
  
  -- Try to get brand
  BEGIN
    IF temp_rec.brand IS NOT NULL AND temp_rec.brand != '' THEN
      SELECT find_or_create_brand(temp_rec.user_id, temp_rec.brand) INTO v_brand_id;
      result_text := result_text || 'Brand ID: ' || COALESCE(v_brand_id::TEXT, 'NULL') || E'\n';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    result_text := result_text || 'Brand lookup error: ' || SQLERRM || E'\n';
  END;
  
  -- Try EAN match
  BEGIN
    IF temp_rec.ean IS NOT NULL AND temp_rec.ean != '' AND is_valid_ean(temp_rec.ean) THEN
      SELECT id INTO matched_id FROM products 
      WHERE user_id = temp_rec.user_id AND ean = temp_rec.ean LIMIT 1;
      
      IF matched_id IS NOT NULL THEN
        result_text := result_text || 'EAN Match found: ' || matched_id || E'\n';
        RETURN result_text;
      ELSE
        result_text := result_text || 'No EAN match' || E'\n';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    result_text := result_text || 'EAN match error: ' || SQLERRM || E'\n';
  END;
  
  -- Try to create product
  BEGIN
    INSERT INTO products (
      user_id, name, sku, ean, brand, brand_id, image_url, currency_code
    ) VALUES (
      temp_rec.user_id, temp_rec.name, temp_rec.sku, temp_rec.ean,
      temp_rec.brand, v_brand_id, temp_rec.image_url,
      COALESCE(temp_rec.currency_code, get_user_primary_currency(temp_rec.user_id))
    ) RETURNING id INTO matched_id;
    
    result_text := result_text || 'Created new product: ' || matched_id || E'\n';
  EXCEPTION WHEN OTHERS THEN
    result_text := result_text || 'Create product error: ' || SQLERRM || E'\n';
  END;
  
  RETURN result_text;
END;
$$;


ALTER FUNCTION "public"."process_temp_single_debug"("p_temp_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_suppliers_batch"("p_supplier_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 100) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    temp_record RECORD;
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


ALTER FUNCTION "public"."process_temp_suppliers_batch"("p_supplier_id" "uuid", "batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_temp_suppliers_scraped_data_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Only process records that are not marked as processed
    IF NEW.processed = false THEN
        -- Call the batch processing function for this specific record
        -- We'll process it immediately in small batches
        PERFORM process_temp_suppliers_batch(NEW.supplier_id, 1);
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_temp_suppliers_scraped_data_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_brand_statistics"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Refresh the internal materialized view (with _mv suffix)
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_statistics_mv;
  RAISE NOTICE 'Brand statistics refreshed at %', NOW();
END;
$$;


ALTER FUNCTION "public"."refresh_brand_statistics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_latest_competitor_prices_mv"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW latest_product_data_mv;
END;
$$;


ALTER FUNCTION "public"."refresh_latest_competitor_prices_mv"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_latest_competitor_prices_mv_with_timeout"("p_timeout_ms" integer DEFAULT 900000) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Set statement timeout for this operation
  EXECUTE format('SET statement_timeout = %s', p_timeout_ms);
  
  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW latest_product_data_mv;
  
  -- Reset timeout to default
  EXECUTE 'RESET statement_timeout';
END;
$$;


ALTER FUNCTION "public"."refresh_latest_competitor_prices_mv_with_timeout"("p_timeout_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_stuck_mv_refreshes"() RETURNS TABLE("view_name" "text", "was_stuck" boolean, "time_stuck" interval)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE mv_refresh_status
  SET is_refreshing = FALSE,
      last_error = 'Refresh process hung - automatically reset after ' || (NOW() - last_refresh_started_at)::TEXT,
      updated_at = NOW()
  WHERE is_refreshing = TRUE
    AND last_refresh_started_at < NOW() - INTERVAL '10 minutes'
  RETURNING 
    mv_refresh_status.view_name,
    TRUE as was_stuck,
    NOW() - last_refresh_started_at as time_stuck;
END;
$$;


ALTER FUNCTION "public"."reset_stuck_mv_refreshes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retry_error_integration_products"("run_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."retry_error_integration_products"("run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retry_fetch_failed_runs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."retry_fetch_failed_runs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."retry_fetch_failed_runs"() IS 'Automatically retries runs that failed with "fetch failed" error, up to 3 times within an hour';



CREATE OR REPLACE FUNCTION "public"."run_daily_price_snapshots"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    user_record RECORD;
    result_record RECORD;
    total_users INTEGER := 0;
    successful_users INTEGER := 0;
    failed_users INTEGER := 0;
    total_snapshots INTEGER := 0;
    start_time TIMESTAMP := NOW();
    end_time TIMESTAMP;
    duration_seconds INTEGER;
    log_message TEXT := '';
    error_message TEXT;
BEGIN
    log_message := log_message || '🚀 Starting daily price competitiveness snapshots for ' || CURRENT_DATE || E'\n';
    log_message := log_message || '⏰ Started at: ' || start_time || ' UTC (after daily scrapers)' || E'\n';

    -- Get all active users who have both products and competitors
    FOR user_record IN 
        SELECT DISTINCT p.user_id
        FROM products p
        WHERE p.is_active = true
        AND p.our_retail_price IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM competitors c 
            WHERE c.user_id = p.user_id 
            AND c.is_active = true
        )
        AND EXISTS (
            SELECT 1 FROM price_changes_competitors pcc 
            WHERE pcc.user_id = p.user_id 
            AND pcc.changed_at >= CURRENT_DATE - INTERVAL '7 days'
        )
        LIMIT 100 -- Safety limit
    LOOP
        total_users := total_users + 1;
        
        BEGIN
            -- Calculate snapshots for this user
            SELECT COUNT(*) INTO result_record
            FROM calculate_all_daily_snapshots(user_record.user_id, CURRENT_DATE);
            
            successful_users := successful_users + 1;
            total_snapshots := total_snapshots + COALESCE(result_record.count, 0);
            
            log_message := log_message || '✅ User ' || user_record.user_id || ': ' || COALESCE(result_record.count, 0) || ' snapshots' || E'\n';
            
        EXCEPTION WHEN OTHERS THEN
            failed_users := failed_users + 1;
            error_message := SQLERRM;
            log_message := log_message || '❌ User ' || user_record.user_id || ': ' || error_message || E'\n';
        END;
        
        -- Small delay to prevent overwhelming the database
        PERFORM pg_sleep(0.1);
    END LOOP;

    end_time := NOW();
    duration_seconds := EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER;

    -- Build summary
    log_message := log_message || E'\n📈 DAILY SNAPSHOTS SUMMARY' || E'\n';
    log_message := log_message || '═══════════════════════════════════════════════════' || E'\n';
    log_message := log_message || '📅 Date: ' || CURRENT_DATE || E'\n';
    log_message := log_message || '⏱️ Duration: ' || duration_seconds || ' seconds' || E'\n';
    log_message := log_message || '👥 Users processed: ' || total_users || E'\n';
    log_message := log_message || '✅ Successful: ' || successful_users || E'\n';
    log_message := log_message || '❌ Failed: ' || failed_users || E'\n';
    log_message := log_message || '📊 Total snapshots created: ' || total_snapshots || E'\n';
    
    IF total_users = 0 THEN
        log_message := log_message || 'ℹ️ No active users found with recent price data.' || E'\n';
    END IF;

    log_message := log_message || '🎉 Daily snapshots completed!' || E'\n';

    -- Log to a table for monitoring (optional)
    INSERT INTO cron_job_logs (job_name, execution_date, status, duration_seconds, details, users_processed, snapshots_created)
    VALUES (
        'daily_price_snapshots',
        CURRENT_DATE,
        CASE WHEN failed_users = 0 THEN 'SUCCESS' ELSE 'PARTIAL_SUCCESS' END,
        duration_seconds,
        log_message,
        total_users,
        total_snapshots
    )
    ON CONFLICT (job_name, execution_date) 
    DO UPDATE SET
        status = EXCLUDED.status,
        duration_seconds = EXCLUDED.duration_seconds,
        details = EXCLUDED.details,
        users_processed = EXCLUDED.users_processed,
        snapshots_created = EXCLUDED.snapshots_created,
        updated_at = NOW();

    RETURN log_message;
END;
$$;


ALTER FUNCTION "public"."run_daily_price_snapshots"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."run_daily_price_snapshots"() IS 'Main function executed by pg_cron daily to calculate price competitiveness snapshots for all active users.
Returns a detailed log of the execution including success/failure counts and timing information.';



CREATE OR REPLACE FUNCTION "public"."set_product_brand_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.brand_id IS NULL AND NEW.brand IS NOT NULL THEN
    SELECT id INTO NEW.brand_id FROM brands WHERE name = NEW.brand LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_product_brand_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_statement_timeout"("p_milliseconds" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  EXECUTE format('SET statement_timeout = %s', p_milliseconds);
END;
$$;


ALTER FUNCTION "public"."set_statement_timeout"("p_milliseconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stage_integration_batch"("p_run_id" "uuid", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_inserted integer;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
        RAISE EXCEPTION 'p_rows must be a JSON array, got %', jsonb_typeof(p_rows);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_rows) AS elem
        WHERE (elem->>'integration_run_id')::uuid <> p_run_id
    ) THEN
        RAISE EXCEPTION 'integration_run_id mismatch in payload (expected %)', p_run_id;
    END IF;

    PERFORM set_config('statement_timeout', '60000', true);
    PERFORM set_config('lock_timeout', '10000', true);

    WITH payload AS (
        SELECT
            row_number() OVER () AS input_order,
            r.*,
            CASE
                WHEN nullif(trim(r.ean), '') IS NOT NULL THEN 'ean:' || lower(trim(r.ean))
                WHEN nullif(trim(r.sku), '') IS NOT NULL
                    AND nullif(trim(r.brand), '') IS NOT NULL
                    THEN 'sku-brand:' || lower(trim(r.sku)) || ':' || lower(trim(r.brand))
                ELSE NULL
            END AS identity_key
        FROM jsonb_populate_recordset(
            NULL::public.temp_integrations_scraped_data,
            p_rows
        ) AS r
    ),
    deduped_payload AS (
        SELECT *
        FROM (
            SELECT
                p.*,
                row_number() OVER (
                    PARTITION BY coalesce(p.identity_key, 'row:' || p.input_order::text)
                    ORDER BY p.input_order
                ) AS duplicate_rank
            FROM payload p
        ) ranked
        WHERE duplicate_rank = 1
          AND (
            identity_key IS NULL
            OR NOT EXISTS (
                SELECT 1
                FROM public.temp_integrations_scraped_data existing
                WHERE existing.integration_run_id = p_run_id
                  AND (
                    (
                      nullif(trim(existing.ean), '') IS NOT NULL
                      AND 'ean:' || lower(trim(existing.ean)) = ranked.identity_key
                    )
                    OR (
                      nullif(trim(existing.ean), '') IS NULL
                      AND nullif(trim(existing.sku), '') IS NOT NULL
                      AND nullif(trim(existing.brand), '') IS NOT NULL
                      AND 'sku-brand:' || lower(trim(existing.sku)) || ':' || lower(trim(existing.brand)) = ranked.identity_key
                    )
                  )
            )
          )
    )
    INSERT INTO public.temp_integrations_scraped_data (
        integration_run_id,
        integration_id,
        user_id,
        prestashop_product_id,
        name,
        sku,
        ean,
        brand,
        our_retail_price,
        our_wholesale_price,
        image_url,
        raw_data,
        status,
        error_message,
        processed_at,
        currency_code,
        our_url,
        stock_quantity,
        stock_status,
        availability_date,
        raw_stock_data
    )
    SELECT
        integration_run_id,
        integration_id,
        user_id,
        prestashop_product_id,
        name,
        sku,
        ean,
        brand,
        our_retail_price,
        our_wholesale_price,
        image_url,
        raw_data,
        coalesce(status, 'pending'),
        error_message,
        processed_at,
        currency_code,
        our_url,
        stock_quantity,
        stock_status,
        availability_date,
        raw_stock_data
    FROM deduped_payload;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;


ALTER FUNCTION "public"."stage_integration_batch"("p_run_id" "uuid", "p_rows" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."stage_integration_batch"("p_run_id" "uuid", "p_rows" "jsonb") IS 'Batch insert into temp_integrations_scraped_data with a 60s local statement_timeout. Bypasses the 8s authenticator default to allow BEFORE INSERT triggers (validate_temp_integrations_trigger, auto_process_temp_integrations_trigger) to finish their per-row matching work under load. Used by the ts-util-worker.';



CREATE OR REPLACE FUNCTION "public"."standardize_stock_status"("raw_status" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
    numeric_value INTEGER;
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


ALTER FUNCTION "public"."standardize_stock_status"("raw_status" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."standardize_stock_status"("raw_status" "text") IS 'Standardizes various stock status formats into consistent categories';



CREATE OR REPLACE FUNCTION "public"."store_custom_field_optimized"("p_product_id" "uuid", "p_custom_field_id" "uuid", "p_field_name" "text", "p_field_value" "text", "p_source_type" "text" DEFAULT 'scraper'::"text", "p_source_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."store_custom_field_optimized"("p_product_id" "uuid", "p_custom_field_id" "uuid", "p_field_name" "text", "p_field_value" "text", "p_source_type" "text", "p_source_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_brand_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sync_brand_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_brand_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sync_brand_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_our_urls_from_products"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_product_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("table_name" "text", "updated_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."sync_our_urls_from_products"("p_user_id" "uuid", "p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_mv_refresh_async"("p_view_name" "text" DEFAULT 'latest_product_data_mv'::"text") RETURNS TABLE("success" boolean, "message" "text", "is_already_refreshing" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_is_refreshing BOOLEAN;
  v_last_started TIMESTAMP WITH TIME ZONE;
  v_time_since_start INTERVAL;
  v_job_id BIGINT;
BEGIN
  SELECT is_refreshing, last_refresh_started_at 
  INTO v_is_refreshing, v_last_started 
  FROM public.mv_refresh_status 
  WHERE view_name = p_view_name;
  
  IF v_is_refreshing THEN
    v_time_since_start := NOW() - v_last_started;
    
    IF v_time_since_start > INTERVAL '10 minutes' THEN
      RAISE NOTICE 'Refresh appears stuck (started % ago), resetting flag', v_time_since_start;
      
      UPDATE public.mv_refresh_status 
      SET is_refreshing = FALSE,
          last_error = 'Refresh process hung - automatically reset after ' || v_time_since_start::TEXT,
          updated_at = NOW()
      WHERE view_name = p_view_name;
    ELSE
      RETURN QUERY SELECT TRUE, 'Refresh already in progress (started ' || v_time_since_start::TEXT || ' ago)', TRUE;
      RETURN;
    END IF;
  END IF;
  
  UPDATE public.mv_refresh_status 
  SET is_refreshing = TRUE, 
      last_refresh_started_at = NOW(),
      last_error = NULL,
      updated_at = NOW()
  WHERE view_name = p_view_name;
  
  RETURN QUERY SELECT TRUE, 'Refresh triggered successfully', FALSE;
END;
$$;


ALTER FUNCTION "public"."trigger_mv_refresh_async"("p_view_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_snapshots_for_date"("target_date" "date" DEFAULT CURRENT_DATE) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    result TEXT;
BEGIN
    -- Temporarily modify the function to use the target date
    -- This is a simple approach - in production you might want a more sophisticated method
    
    SELECT run_daily_price_snapshots() INTO result;
    
    RETURN 'Triggered snapshots for ' || target_date || E'\n' || result;
END;
$$;


ALTER FUNCTION "public"."trigger_snapshots_for_date"("target_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_snapshots_for_date"("target_date" "date") IS 'Manually trigger snapshot calculations for a specific date. Useful for backfilling or testing.';



CREATE OR REPLACE FUNCTION "public"."trigger_sync_our_url_on_product_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."trigger_sync_our_url_on_product_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trim_progress_messages"("p_run_id" "uuid", "p_max_messages" integer DEFAULT 100) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trim_progress_messages"("p_run_id" "uuid", "p_max_messages" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trim_progress_messages"("p_run_id" "uuid", "p_max_messages" integer) IS 'Trims the progress_messages array to prevent database bloat';



CREATE OR REPLACE FUNCTION "public"."undismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."undismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."undismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") IS 'Undismisses product duplicates to allow them to appear in duplicate detection again';



CREATE OR REPLACE FUNCTION "public"."update_api_key_usage"("p_api_key" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    UPDATE public.api_keys
    SET last_used_at = NOW()
    WHERE api_key = p_api_key
    AND is_active = true;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_api_key_usage"("p_api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE support_conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_snapshots_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_daily_snapshots_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_next_run_on_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_integration_next_run_on_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_next_run_time"("integration_id" "uuid", "completed_at" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_integration_next_run_time"("integration_id" "uuid", "completed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_progress_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_integration_progress_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_run_status"("run_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_integration_run_status"("run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integration_sync_timestamps"("p_integration_run_id" "uuid") RETURNS TABLE("updated_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id UUID;
  v_run_started_at TIMESTAMPTZ;
  v_updated_count INTEGER;
BEGIN
  -- Get user_id and started_at from integration_runs
  SELECT user_id, started_at INTO v_user_id, v_run_started_at
  FROM integration_runs
  WHERE id = p_integration_run_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Integration run not found: %', p_integration_run_id;
  END IF;

  -- Update last_integration_sync_at for all products that were in this sync
  -- by matching against temp_integrations_scraped_data
  WITH synced_products AS (
    SELECT DISTINCT p.id
    FROM temp_integrations_scraped_data t
    JOIN products p ON (
      (t.ean IS NOT NULL AND t.ean != '' AND p.ean = t.ean AND p.user_id = t.user_id)
      OR
      (t.sku IS NOT NULL AND t.sku != '' AND p.sku = t.sku AND p.brand_id IS NOT NULL AND 
       p.brand_id = (SELECT find_or_create_brand(t.user_id, t.brand)))
    )
    WHERE t.integration_run_id = p_integration_run_id
      AND t.status = 'processed'
  )
  UPDATE products p
  SET last_integration_sync_at = v_run_started_at
  FROM synced_products sp
  WHERE p.id = sp.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN QUERY SELECT v_updated_count::INTEGER;
END;
$$;


ALTER FUNCTION "public"."update_integration_sync_timestamps"("p_integration_run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_match_reviews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_match_reviews_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scheduling_config"("p_max_python_workers" integer DEFAULT 1, "p_max_typescript_workers" integer DEFAULT 1, "p_max_integration_workers" integer DEFAULT 1, "p_max_jobs_per_run" integer DEFAULT 2) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_scheduling_config"("p_max_python_workers" integer, "p_max_typescript_workers" integer, "p_max_integration_workers" integer, "p_max_jobs_per_run" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scraper_next_run_on_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Update next_run_time when status changes to 'completed' OR 'failed' (for scheduled runs)
    IF (NEW.status = 'completed' OR NEW.status = 'failed') AND (OLD.status != 'completed' AND OLD.status != 'failed') THEN
        -- Update the scraper's last_run
        UPDATE public.scrapers
        SET 
            last_run = COALESCE(NEW.completed_at, now()),
            updated_at = now()
        WHERE id = NEW.scraper_id;
        
        -- Calculate and set the next run time (only for non-test runs)
        IF NEW.is_test_run = false THEN
            PERFORM public.update_scraper_next_run_time(NEW.scraper_id, COALESCE(NEW.completed_at, now()));
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scraper_next_run_on_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scraper_next_run_time"("scraper_id" "uuid", "completed_at" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_scraper_next_run_time"("scraper_id" "uuid", "completed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scraper_status_from_run"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_scraper_status_from_run"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_scraper_status_from_run"() IS 'Modified to remove debug logging to debug_logs table';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_api_key"("p_api_key" "text") RETURNS TABLE("user_id" "uuid", "is_valid" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    SELECT ak.user_id, true
    FROM public.api_keys ak
    WHERE ak.api_key = p_api_key
    AND ak.is_active = true;
END;
$$;


ALTER FUNCTION "public"."validate_api_key"("p_api_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_temp_competitors_data"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    user_matching_rules JSONB;
    has_ean BOOLEAN := FALSE;
    has_brand BOOLEAN := FALSE;
    has_sku BOOLEAN := FALSE;
    has_brand_sku BOOLEAN := FALSE;
    has_name BOOLEAN := FALSE;
    fuzzy_name_enabled BOOLEAN := FALSE;
    v_reason TEXT;
BEGIN
    SELECT matching_rules INTO user_matching_rules
    FROM user_settings
    WHERE user_id = NEW.user_id;

    user_matching_rules := COALESCE(user_matching_rules, '{}');

    has_ean := (NEW.ean IS NOT NULL AND NEW.ean != '' AND NEW.ean != '-' AND is_valid_ean(NEW.ean));
    has_brand := (NEW.brand IS NOT NULL AND NEW.brand != '');
    has_sku := (NEW.sku IS NOT NULL AND NEW.sku != '' AND NEW.sku != '-');
    has_brand_sku := has_brand AND has_sku;
    has_name := (NEW.name IS NOT NULL AND NEW.name != '');
    fuzzy_name_enabled := (user_matching_rules->>'fuzzy_name_matching')::boolean;

    -- If EAN is provided but invalid, null it so downstream joins don't match on garbage
    IF NEW.ean IS NOT NULL AND NEW.ean != '' AND NEW.ean != '-' AND NOT is_valid_ean(NEW.ean) THEN
        NEW.ean := NULL;
    END IF;

    -- Records without any matching criteria are silently dropped from the temp table.
    -- Log them to scraper_run_rejections first so we can diagnose silent scraper failures.
    IF NOT has_ean AND NOT has_brand_sku AND NOT (fuzzy_name_enabled AND has_name) THEN
        IF NOT has_brand AND NOT has_sku AND NOT has_name AND NEW.ean IS NULL THEN
            v_reason := 'empty_row';
        ELSIF NOT has_brand AND has_sku THEN
            v_reason := 'missing_brand';
        ELSIF has_brand AND NOT has_sku THEN
            v_reason := 'missing_sku';
        ELSIF NOT has_brand AND NOT has_sku AND has_name AND NOT fuzzy_name_enabled THEN
            v_reason := 'only_name_fuzzy_disabled';
        ELSE
            v_reason := 'no_matching_criteria';
        END IF;

        BEGIN
            INSERT INTO scraper_run_rejections (
                scraper_id, user_id, competitor_id, reason,
                had_ean, had_brand, had_sku, had_name,
                sample_name, sample_url
            ) VALUES (
                NEW.scraper_id, NEW.user_id, NEW.competitor_id, v_reason,
                (NEW.ean IS NOT NULL AND NEW.ean != '' AND NEW.ean != '-'),
                has_brand, has_sku, has_name,
                LEFT(NEW.name, 200), LEFT(NEW.competitor_url, 500)
            );
        EXCEPTION WHEN OTHERS THEN
            -- Never let rejection logging break ingestion
            NULL;
        END;

        RETURN NULL;
    END IF;

    IF NEW.competitor_price IS NULL OR NEW.competitor_price <= 0 THEN
        RAISE EXCEPTION 'competitor_price must be provided and greater than 0, got: %', NEW.competitor_price;
    END IF;

    NEW.currency_code := COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id));

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_temp_competitors_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_temp_integrations_data"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."validate_temp_integrations_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_temp_suppliers_data"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."validate_temp_suppliers_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_url"("url_text" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."validate_url"("url_text" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_communication_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "communication_type" "text" DEFAULT 'email'::"text" NOT NULL,
    "subject" "text",
    "message_content" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'sent'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_communication_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_communication_log" IS 'Logs communications sent by admins to users.';



COMMENT ON COLUMN "public"."admin_communication_log"."admin_user_id" IS 'The ID of the admin who sent the communication.';



COMMENT ON COLUMN "public"."admin_communication_log"."target_user_id" IS 'The ID of the user who received the communication.';



CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "key_name" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_aliases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "alias_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brand_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "needs_review" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_changes_competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "competitor_id" "uuid",
    "old_competitor_price" numeric(10,2),
    "new_competitor_price" numeric(10,2),
    "price_change_percentage" numeric(10,2),
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "integration_id" "uuid",
    "currency_code" "text",
    "competitor_url" "text",
    "old_our_retail_price" numeric(10,2),
    "new_our_retail_price" numeric(10,2),
    "our_url" "text",
    CONSTRAINT "check_at_least_one_price" CHECK ((("new_competitor_price" IS NOT NULL) OR ("new_our_retail_price" IS NOT NULL))),
    CONSTRAINT "check_competitor_price_has_competitor_id" CHECK (((("old_competitor_price" IS NULL) AND ("new_competitor_price" IS NULL)) OR (("competitor_id" IS NOT NULL) AND ("integration_id" IS NULL)))),
    CONSTRAINT "check_our_retail_price_has_integration_id" CHECK (((("old_our_retail_price" IS NULL) AND ("new_our_retail_price" IS NULL)) OR (("integration_id" IS NOT NULL) AND ("competitor_id" IS NULL)))),
    CONSTRAINT "check_price_consistency" CHECK (((("old_competitor_price" IS NULL) = ("new_competitor_price" IS NULL)) OR (("old_our_retail_price" IS NULL) = ("new_our_retail_price" IS NULL)))),
    CONSTRAINT "check_price_type_consistency" CHECK (((("old_competitor_price" IS NULL) AND ("old_our_retail_price" IS NULL)) OR (("old_competitor_price" IS NOT NULL) AND ("old_our_retail_price" IS NULL)) OR (("old_competitor_price" IS NULL) AND ("old_our_retail_price" IS NOT NULL)))),
    CONSTRAINT "price_changes_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code")))),
    CONSTRAINT "price_changes_source_check" CHECK ((("competitor_id" IS NOT NULL) OR ("integration_id" IS NOT NULL)))
);


ALTER TABLE "public"."price_changes_competitors" OWNER TO "postgres";


COMMENT ON COLUMN "public"."price_changes_competitors"."currency_code" IS 'ISO 4217 currency code (e.g., SEK, USD)';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "ean" "text",
    "brand" "text",
    "category" "text",
    "description" "text",
    "image_url" "text",
    "our_retail_price" numeric(10,2),
    "our_wholesale_price" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_id" "uuid" NOT NULL,
    "currency_code" "text",
    "our_url" "text",
    "last_integration_sync_at" timestamp with time zone,
    CONSTRAINT "products_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code"))))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."currency_code" IS 'ISO 4217 currency code (e.g., SEK, USD)';



COMMENT ON COLUMN "public"."products"."our_url" IS 'URL to the product on the source platform';



CREATE MATERIALIZED VIEW "public"."brand_statistics_mv" AS
 WITH "product_counts" AS (
         SELECT "p"."user_id",
            "p"."brand_id",
            "count"("p"."id") AS "product_count",
            "count"(
                CASE
                    WHEN ("p"."our_retail_price" IS NOT NULL) THEN 1
                    ELSE NULL::integer
                END) AS "our_products_count"
           FROM "public"."products" "p"
          WHERE ("p"."brand_id" IS NOT NULL)
          GROUP BY "p"."user_id", "p"."brand_id"
        ), "competitor_counts" AS (
         SELECT "p"."user_id",
            "p"."brand_id",
            "count"(DISTINCT "pc_1"."competitor_id") AS "competitor_count"
           FROM ("public"."products" "p"
             JOIN ( SELECT DISTINCT "price_changes_competitors"."user_id",
                    "price_changes_competitors"."product_id",
                    "price_changes_competitors"."competitor_id"
                   FROM "public"."price_changes_competitors"
                  WHERE ("price_changes_competitors"."competitor_id" IS NOT NULL)) "pc_1" ON ((("p"."id" = "pc_1"."product_id") AND ("p"."user_id" = "pc_1"."user_id"))))
          WHERE ("p"."brand_id" IS NOT NULL)
          GROUP BY "p"."user_id", "p"."brand_id"
        )
 SELECT "b"."id" AS "brand_id",
    "b"."user_id",
    "b"."name" AS "brand_name",
    COALESCE("pc"."product_count", (0)::bigint) AS "product_count",
    COALESCE("pc"."our_products_count", (0)::bigint) AS "our_products_count",
    COALESCE("cc"."competitor_count", (0)::bigint) AS "competitor_count",
    "now"() AS "last_updated"
   FROM (("public"."brands" "b"
     LEFT JOIN "product_counts" "pc" ON ((("b"."id" = "pc"."brand_id") AND ("b"."user_id" = "pc"."user_id"))))
     LEFT JOIN "competitor_counts" "cc" ON ((("b"."id" = "cc"."brand_id") AND ("b"."user_id" = "cc"."user_id"))))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."brand_statistics_mv" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."brand_statistics" WITH ("security_invoker"='on') AS
 SELECT "brand_id",
    "user_id",
    "brand_name",
    "product_count",
    "our_products_count",
    "competitor_count",
    "last_updated"
   FROM "public"."brand_statistics_mv"
  WHERE ("user_id" = "auth"."uid"());


ALTER VIEW "public"."brand_statistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "website" "text" NOT NULL,
    "logo_url" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."competitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cron_job_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "execution_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "duration_seconds" integer,
    "details" "text",
    "users_processed" integer DEFAULT 0,
    "snapshots_created" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cron_job_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."cron_job_logs" IS 'Logs for cron job executions, including daily price snapshots';



COMMENT ON COLUMN "public"."cron_job_logs"."job_name" IS 'Name of the cron job (e.g., daily_price_snapshots)';



COMMENT ON COLUMN "public"."cron_job_logs"."execution_date" IS 'Date when the job was executed';



COMMENT ON COLUMN "public"."cron_job_logs"."status" IS 'SUCCESS, FAILED, or PARTIAL_SUCCESS';



COMMENT ON COLUMN "public"."cron_job_logs"."details" IS 'Detailed log output from the job execution';



CREATE TABLE IF NOT EXISTS "public"."csv_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "file_content" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error_message" "text"
);


ALTER TABLE "public"."csv_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_price_competitiveness_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "competitor_id" "uuid",
    "brand_filter" "text",
    "total_products_analyzed" integer DEFAULT 0 NOT NULL,
    "products_we_are_cheapest" integer DEFAULT 0 NOT NULL,
    "products_we_are_same_price" integer DEFAULT 0 NOT NULL,
    "products_we_are_more_expensive" integer DEFAULT 0 NOT NULL,
    "cheapest_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "same_price_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "more_expensive_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "avg_price_difference_when_higher" numeric(10,2),
    "avg_price_difference_percentage_when_higher" numeric(5,2),
    "total_potential_savings" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_price_competitiveness_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_price_competitiveness_snapshots" IS 'Stores daily snapshots of price competitiveness for historical trend analysis. Supports both competitor-specific and brand-specific filtering.';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."competitor_id" IS 'NULL means analysis across all competitors';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."brand_filter" IS 'NULL means analysis across all brands. When set, only products matching this brand are included.';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."total_products_analyzed" IS 'Total number of products included in this snapshot analysis';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."products_we_are_cheapest" IS 'Number of products where our price is lower than or equal to the lowest competitor price';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."products_we_are_same_price" IS 'Number of products where our price exactly matches the lowest competitor price';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."products_we_are_more_expensive" IS 'Number of products where our price is higher than the lowest competitor price';



COMMENT ON COLUMN "public"."daily_price_competitiveness_snapshots"."total_potential_savings" IS 'Total amount in kr that customers could save if we matched all lowest competitor prices';



CREATE TABLE IF NOT EXISTS "public"."debug_logs" (
    "id" integer NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debug_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."debug_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."debug_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."debug_logs_id_seq" OWNED BY "public"."debug_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."dismissed_duplicates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "brand_id_1" "uuid" NOT NULL,
    "brand_id_2" "uuid" NOT NULL,
    "dismissal_key" "text" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "brand_id_order" CHECK (("brand_id_1" < "brand_id_2"))
);


ALTER TABLE "public"."dismissed_duplicates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "name" "text" NOT NULL,
    "api_url" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_setup'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_sync_status" "text",
    "sync_frequency" "text" DEFAULT 'daily'::"text",
    "configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "next_run_time" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."integrations"."is_active" IS 'Whether the integration is active and should run on schedule';



CREATE TABLE IF NOT EXISTS "public"."stock_changes_competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "competitor_id" "uuid",
    "integration_id" "uuid",
    "old_stock_quantity" integer,
    "new_stock_quantity" integer,
    "old_stock_status" "text",
    "new_stock_status" "text",
    "old_availability_date" "date",
    "new_availability_date" "date",
    "stock_change_quantity" integer,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "raw_stock_data" "jsonb",
    "competitor_url" "text",
    "our_url" "text",
    CONSTRAINT "stock_changes_source_check" CHECK ((("competitor_id" IS NOT NULL) OR ("integration_id" IS NOT NULL)))
);


ALTER TABLE "public"."stock_changes_competitors" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_changes_competitors" IS 'Tracks stock level changes for competitor products over time';



COMMENT ON COLUMN "public"."stock_changes_competitors"."stock_change_quantity" IS 'Calculated field: new_stock_quantity - old_stock_quantity';



COMMENT ON COLUMN "public"."stock_changes_competitors"."raw_stock_data" IS 'JSON data containing detailed stock information like product combinations/variants';



CREATE MATERIALIZED VIEW "public"."latest_product_data_mv" AS
 WITH "latest_competitor_prices" AS (
         SELECT DISTINCT ON ("price_changes_competitors"."user_id", "price_changes_competitors"."product_id", "price_changes_competitors"."competitor_id") "price_changes_competitors"."user_id",
            "price_changes_competitors"."product_id",
            "price_changes_competitors"."competitor_id",
            "price_changes_competitors"."new_competitor_price",
            "price_changes_competitors"."competitor_url",
            "price_changes_competitors"."changed_at"
           FROM "public"."price_changes_competitors"
          WHERE ("price_changes_competitors"."new_competitor_price" IS NOT NULL)
          ORDER BY "price_changes_competitors"."user_id", "price_changes_competitors"."product_id", "price_changes_competitors"."competitor_id", "price_changes_competitors"."changed_at" DESC
        ), "latest_stock_per_competitor" AS (
         SELECT DISTINCT ON ("stock_changes_competitors"."user_id", "stock_changes_competitors"."product_id", COALESCE("stock_changes_competitors"."competitor_id", "stock_changes_competitors"."integration_id")) "stock_changes_competitors"."user_id",
            "stock_changes_competitors"."product_id",
            "stock_changes_competitors"."competitor_id",
            "stock_changes_competitors"."integration_id",
            "stock_changes_competitors"."new_stock_quantity",
            "stock_changes_competitors"."new_stock_status",
            "stock_changes_competitors"."changed_at"
           FROM "public"."stock_changes_competitors"
          WHERE ("stock_changes_competitors"."new_stock_quantity" IS NOT NULL)
          ORDER BY "stock_changes_competitors"."user_id", "stock_changes_competitors"."product_id", COALESCE("stock_changes_competitors"."competitor_id", "stock_changes_competitors"."integration_id"), "stock_changes_competitors"."changed_at" DESC
        ), "product_competitor_count" AS (
         SELECT "lcp_1"."product_id",
            "lcp_1"."user_id",
            "count"(DISTINCT "lcp_1"."competitor_id") AS "competitor_count"
           FROM "latest_competitor_prices" "lcp_1"
          GROUP BY "lcp_1"."product_id", "lcp_1"."user_id"
        )
 SELECT "p"."id",
    "p"."user_id",
    "p"."name",
    "p"."sku",
    "p"."ean",
    "p"."brand_id",
    "b"."name" AS "brand_name",
    "p"."category",
    "p"."our_retail_price",
    "p"."our_wholesale_price",
    "p"."image_url",
    "p"."our_url",
    "p"."is_active",
    "p"."created_at",
    "p"."updated_at",
    COALESCE("pcc"."competitor_count", (0)::bigint) AS "competitor_count",
    COALESCE("json_agg"(DISTINCT "jsonb_build_object"('competitor_id', "lcp"."competitor_id", 'new_competitor_price', "lcp"."new_competitor_price", 'competitor_url', "lcp"."competitor_url", 'competitor_name', "c"."name", 'changed_at', "lcp"."changed_at")) FILTER (WHERE ("lcp"."competitor_id" IS NOT NULL)), '[]'::json) AS "competitor_prices",
    "bool_or"((("lsc"."new_stock_quantity" > 0) OR ("lsc"."new_stock_status" = 'in_stock'::"text"))) AS "has_stock",
    COALESCE("max"("lsc"."new_stock_quantity"), 0) AS "stock_quantity"
   FROM ((((("public"."products" "p"
     LEFT JOIN "public"."brands" "b" ON (("p"."brand_id" = "b"."id")))
     LEFT JOIN "latest_competitor_prices" "lcp" ON ((("p"."id" = "lcp"."product_id") AND ("p"."user_id" = "lcp"."user_id"))))
     LEFT JOIN "public"."competitors" "c" ON (("lcp"."competitor_id" = "c"."id")))
     LEFT JOIN "latest_stock_per_competitor" "lsc" ON ((("p"."id" = "lsc"."product_id") AND ("p"."user_id" = "lsc"."user_id") AND ("lcp"."competitor_id" = "lsc"."competitor_id"))))
     LEFT JOIN "product_competitor_count" "pcc" ON ((("p"."id" = "pcc"."product_id") AND ("p"."user_id" = "pcc"."user_id"))))
  GROUP BY "p"."id", "p"."user_id", "p"."name", "p"."sku", "p"."ean", "p"."brand_id", "b"."name", "p"."category", "p"."our_retail_price", "p"."our_wholesale_price", "p"."image_url", "p"."our_url", "p"."is_active", "p"."created_at", "p"."updated_at", "pcc"."competitor_count"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."latest_product_data_mv" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "company" "text",
    "message" "text" NOT NULL,
    "contact_type" "text" DEFAULT 'general'::"text",
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "marketing_contacts_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['general'::"text", 'sales'::"text", 'support'::"text", 'partnership'::"text"]))),
    CONSTRAINT "marketing_contacts_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."marketing_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mv_refresh_status" (
    "id" bigint NOT NULL,
    "view_name" "text" NOT NULL,
    "last_refresh_started_at" timestamp with time zone,
    "last_refresh_completed_at" timestamp with time zone,
    "is_refreshing" boolean DEFAULT false,
    "last_error" "text",
    "refresh_duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mv_refresh_status" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mv_refresh_status_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mv_refresh_status_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mv_refresh_status_id_seq" OWNED BY "public"."mv_refresh_status"."id";



CREATE TABLE IF NOT EXISTS "public"."newsletter_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "subscribed_at" timestamp with time zone DEFAULT "now"(),
    "unsubscribed_at" timestamp with time zone,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."newsletter_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operational_report_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "report_type" "text" NOT NULL,
    "report_date" "date" NOT NULL,
    "issue_signature" "text" DEFAULT ''::"text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    CONSTRAINT "operational_report_deliveries_report_type_check" CHECK (("report_type" = ANY (ARRAY['daily'::"text", 'issues'::"text"]))),
    CONSTRAINT "operational_report_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."operational_report_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_changes_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "old_our_wholesale_price" numeric(10,2),
    "new_our_wholesale_price" numeric(10,2),
    "price_change_percentage" numeric(10,2),
    "currency_code" "text" DEFAULT 'SEK'::"text",
    "supplier_url" "text",
    "minimum_order_quantity" integer DEFAULT 1,
    "lead_time_days" integer,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "change_source" "text" DEFAULT 'manual'::"text",
    "old_supplier_price" numeric(10,2),
    "new_supplier_price" numeric(10,2),
    "old_supplier_recommended_price" numeric(10,2),
    "new_supplier_recommended_price" numeric(10,2),
    "integration_id" "uuid",
    "our_url" "text",
    CONSTRAINT "check_exactly_one_source" CHECK (((("supplier_id" IS NOT NULL) AND ("integration_id" IS NULL)) OR (("supplier_id" IS NULL) AND ("integration_id" IS NOT NULL)))),
    CONSTRAINT "check_our_wholesale_price_has_integration_id" CHECK (((("old_our_wholesale_price" IS NULL) AND ("new_our_wholesale_price" IS NULL)) OR (("integration_id" IS NOT NULL) AND ("supplier_id" IS NULL)))),
    CONSTRAINT "check_supplier_price_consistency" CHECK (((("old_supplier_price" IS NULL) AND ("new_supplier_price" IS NULL)) OR (("old_supplier_price" IS NULL) AND ("new_supplier_price" IS NOT NULL)) OR (("old_supplier_price" IS NOT NULL) AND ("new_supplier_price" IS NOT NULL)) OR (("old_supplier_price" IS NOT NULL) AND ("new_supplier_price" IS NULL)))),
    CONSTRAINT "check_supplier_price_has_supplier_id" CHECK (((("old_supplier_price" IS NULL) AND ("new_supplier_price" IS NULL)) OR (("supplier_id" IS NOT NULL) AND ("integration_id" IS NULL)))),
    CONSTRAINT "price_changes_suppliers_change_source_check" CHECK (("change_source" = ANY (ARRAY['manual'::"text", 'csv'::"text", 'scraper'::"text", 'integration'::"text"])))
);


ALTER TABLE "public"."price_changes_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_custom_field_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "custom_field_id" "uuid" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source_type" character varying(20),
    "source_id" "uuid",
    "last_updated_by" character varying(20),
    "confidence_score" integer DEFAULT 100,
    "created_by_source" character varying(20),
    "value_hash" "text"
);


ALTER TABLE "public"."product_custom_field_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_custom_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "field_name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_required" boolean DEFAULT false,
    "default_value" "text",
    "validation_rules" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "update_strategy" character varying(20) DEFAULT 'source_priority'::character varying,
    "source_priority" "jsonb" DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::"jsonb",
    "allow_auto_update" boolean DEFAULT true,
    CONSTRAINT "user_custom_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'number'::"text", 'boolean'::"text", 'url'::"text", 'date'::"text"])))
);


ALTER TABLE "public"."product_custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products_dismissed_duplicates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id_1" "uuid" NOT NULL,
    "product_id_2" "uuid" NOT NULL,
    "dismissal_key" "text" NOT NULL,
    "dismissed_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "product_id_order" CHECK (("product_id_1" < "product_id_2"))
);


ALTER TABLE "public"."products_dismissed_duplicates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professional_scraper_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "competitor_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "website" "text" NOT NULL,
    "requirements" "text" NOT NULL,
    "additional_info" "text",
    "status" "text" DEFAULT 'submitted'::"text",
    "quoted_price" numeric(10,2),
    "estimated_delivery_days" integer,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "professional_scraper_requests_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'reviewing'::"text", 'quoted'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."professional_scraper_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_address" "inet" NOT NULL,
    "endpoint" "text" NOT NULL,
    "attempts" integer DEFAULT 1,
    "window_start" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scraper_ai_sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_phase" "text" NOT NULL,
    "analysis_data" "jsonb" DEFAULT '{}'::"jsonb",
    "url_collection_data" "jsonb" DEFAULT '{}'::"jsonb",
    "data_extraction_data" "jsonb" DEFAULT '{}'::"jsonb",
    "assembly_data" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "scraper_ai_sessions_current_phase_check" CHECK (("current_phase" = ANY (ARRAY['analysis'::"text", 'data-validation'::"text", 'assembly'::"text", 'complete'::"text"])))
);


ALTER TABLE "public"."scraper_ai_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."scraper_ai_sessions" IS 'AI scraper sessions with phases: analysis, data-validation, assembly, complete';



COMMENT ON COLUMN "public"."scraper_ai_sessions"."current_phase" IS 'Current phase of the AI scraper generation process: analysis, data-validation, assembly, complete';



COMMENT ON COLUMN "public"."scraper_ai_sessions"."analysis_data" IS 'Data from the site analysis phase';



COMMENT ON COLUMN "public"."scraper_ai_sessions"."url_collection_data" IS 'Legacy: Data from the URL collection phase (now part of data-validation)';



COMMENT ON COLUMN "public"."scraper_ai_sessions"."data_extraction_data" IS 'Data from the data validation phase (previously data-extraction)';



COMMENT ON COLUMN "public"."scraper_ai_sessions"."assembly_data" IS 'Data from the script assembly phase';



CREATE TABLE IF NOT EXISTS "public"."scraper_run_rejections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scraper_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "had_ean" boolean DEFAULT false NOT NULL,
    "had_brand" boolean DEFAULT false NOT NULL,
    "had_sku" boolean DEFAULT false NOT NULL,
    "had_name" boolean DEFAULT false NOT NULL,
    "sample_name" "text",
    "sample_url" "text",
    "rejected_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."scraper_run_rejections" OWNER TO "postgres";


COMMENT ON TABLE "public"."scraper_run_rejections" IS 'Logs rows rejected by validate_temp_competitors_data so we can detect silent scraper failures (e.g. site structure changes that break brand/SKU extraction). Retention: 14 days.';



CREATE TABLE IF NOT EXISTS "public"."scraper_run_timeouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "timeout_at" timestamp with time zone NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."scraper_run_timeouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scraper_runs" (
    "id" "uuid" NOT NULL,
    "scraper_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'initializing'::"text",
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "is_test_run" boolean DEFAULT false,
    "product_count" integer DEFAULT 0,
    "current_batch" integer DEFAULT 0,
    "total_batches" integer,
    "error_message" "text",
    "progress_messages" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "execution_time_ms" bigint,
    "products_per_second" numeric(10,2),
    "scraper_type" "text",
    "error_details" "text",
    "claimed_by_worker_at" timestamp with time zone,
    "current_phase" integer
);


ALTER TABLE "public"."scraper_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scrapers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "competitor_id" "uuid",
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "schedule" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT false,
    "status" "text" DEFAULT 'idle'::"text",
    "error_message" "text",
    "last_run" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "scraper_type" character varying(20) DEFAULT 'ai'::character varying NOT NULL,
    "python_script" "text",
    "script_metadata" "jsonb",
    "test_results" "jsonb",
    "execution_time" bigint,
    "last_products_per_second" numeric(10,2),
    "typescript_script" "text",
    "scrape_only_own_products" boolean DEFAULT false NOT NULL,
    "filter_by_active_brands" boolean DEFAULT false NOT NULL,
    "supplier_id" "uuid",
    "next_run_time" timestamp with time zone,
    CONSTRAINT "scrapers_target_check" CHECK (((("competitor_id" IS NOT NULL) AND ("supplier_id" IS NULL)) OR (("competitor_id" IS NULL) AND ("supplier_id" IS NOT NULL))))
);


ALTER TABLE "public"."scrapers" OWNER TO "postgres";


COMMENT ON TABLE "public"."scrapers" IS 'Stores scraper configurations for different types: AI, Python, and CSV';



COMMENT ON COLUMN "public"."scrapers"."execution_time" IS 'Time in milliseconds it took to run the scraper';



COMMENT ON COLUMN "public"."scrapers"."last_products_per_second" IS 'Products per second metric from the most recently completed successful run.';



COMMENT ON COLUMN "public"."scrapers"."scrape_only_own_products" IS 'Flag to only scrape products matching the user''s own product catalog (based on EAN/SKU/Brand matching)';



CREATE TABLE IF NOT EXISTS "public"."stock_changes_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "integration_id" "uuid",
    "old_stock_quantity" integer,
    "new_stock_quantity" integer,
    "old_stock_status" "text",
    "new_stock_status" "text",
    "old_availability_date" "date",
    "new_availability_date" "date",
    "stock_change_quantity" integer,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "raw_stock_data" "jsonb",
    "supplier_url" "text",
    "our_url" "text",
    CONSTRAINT "stock_changes_suppliers_source_check" CHECK ((("supplier_id" IS NOT NULL) OR ("integration_id" IS NOT NULL)))
);


ALTER TABLE "public"."stock_changes_suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_changes_suppliers" IS 'Tracks stock level changes for supplier products over time';



COMMENT ON COLUMN "public"."stock_changes_suppliers"."stock_change_quantity" IS 'Calculated field: new_stock_quantity - old_stock_quantity';



COMMENT ON COLUMN "public"."stock_changes_suppliers"."raw_stock_data" IS 'JSON data containing detailed stock information';



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "website" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "logo_url" "text",
    "notes" "text",
    "login_username" "text",
    "login_password" "text",
    "api_key" "text",
    "api_url" "text",
    "login_url" "text",
    "price_file_url" "text",
    "scraping_config" "jsonb",
    "sync_frequency" "text" DEFAULT 'weekly'::"text",
    "last_sync_at" timestamp with time zone,
    "last_sync_status" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "suppliers_sync_frequency_check" CHECK (("sync_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "admin_user_id" "uuid",
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "category" "text" DEFAULT 'general'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "last_read_by_user" timestamp with time zone,
    "last_read_by_admin" timestamp with time zone,
    CONSTRAINT "support_conversations_category_check" CHECK (("category" = ANY (ARRAY['general'::"text", 'technical'::"text", 'billing'::"text", 'scraper_request'::"text", 'feature_request'::"text"]))),
    CONSTRAINT "support_conversations_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "support_conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."support_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "sender_type" "text" NOT NULL,
    "message_content" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_by_recipient" boolean DEFAULT false,
    CONSTRAINT "support_messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temp_competitors_scraped_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scraper_id" "uuid",
    "competitor_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "name" "text" NOT NULL,
    "competitor_price" numeric(10,2) NOT NULL,
    "competitor_url" "text",
    "image_url" "text",
    "sku" "text",
    "brand" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "ean" "text",
    "currency_code" "text",
    "raw_data" "jsonb",
    "stock_quantity" integer,
    "stock_status" "text",
    "availability_date" "date",
    "raw_stock_data" "jsonb",
    "processed" boolean DEFAULT false,
    CONSTRAINT "temp_competitors_scraped_data_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code"))))
);


ALTER TABLE "public"."temp_competitors_scraped_data" OWNER TO "postgres";


COMMENT ON COLUMN "public"."temp_competitors_scraped_data"."stock_quantity" IS 'Numeric stock quantity extracted from competitor site';



COMMENT ON COLUMN "public"."temp_competitors_scraped_data"."stock_status" IS 'Text stock status (e.g., "I lager", "Ej i lager")';



COMMENT ON COLUMN "public"."temp_competitors_scraped_data"."availability_date" IS 'Future availability date if product is out of stock';



COMMENT ON COLUMN "public"."temp_competitors_scraped_data"."raw_stock_data" IS 'Raw stock data from scraper including combinations and metadata';



CREATE TABLE IF NOT EXISTS "public"."temp_suppliers_scraped_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "scraper_id" "uuid" NOT NULL,
    "run_id" "text" NOT NULL,
    "name" "text",
    "sku" "text",
    "brand" "text",
    "ean" "text",
    "supplier_price" numeric(10,2),
    "currency_code" "text" DEFAULT 'SEK'::"text",
    "supplier_url" "text",
    "image_url" "text",
    "minimum_order_quantity" integer DEFAULT 1,
    "lead_time_days" integer,
    "stock_quantity" integer,
    "product_description" "text",
    "category" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "supplier_recommended_price" numeric(10,2),
    "raw_data" "jsonb",
    "stock_status" "text",
    "availability_date" "date",
    "raw_stock_data" "jsonb"
);


ALTER TABLE "public"."temp_suppliers_scraped_data" OWNER TO "postgres";


COMMENT ON COLUMN "public"."temp_suppliers_scraped_data"."supplier_price" IS 'Supplier cost price (what they charge us)';



COMMENT ON COLUMN "public"."temp_suppliers_scraped_data"."stock_quantity" IS 'Numeric stock quantity from supplier (renamed from stock_level)';



COMMENT ON COLUMN "public"."temp_suppliers_scraped_data"."supplier_recommended_price" IS 'Supplier recommended retail price (what they suggest we charge customers)';



COMMENT ON COLUMN "public"."temp_suppliers_scraped_data"."stock_status" IS 'Text stock status from supplier';



COMMENT ON COLUMN "public"."temp_suppliers_scraped_data"."availability_date" IS 'Future availability date if product is out of stock';



COMMENT ON COLUMN "public"."temp_suppliers_scraped_data"."raw_stock_data" IS 'Raw stock data from supplier including detailed stock information';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "admin_role" "text",
    "is_suspended" boolean DEFAULT false
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."admin_role" IS 'Defines the admin role for the user, if any (e.g., super_admin, support_admin).';



COMMENT ON COLUMN "public"."user_profiles"."is_suspended" IS 'Indicates if the user account is currently suspended by an admin.';



CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "address" "text",
    "org_number" "text",
    "primary_currency" "text",
    "secondary_currencies" "text"[],
    "currency_format" "text",
    "matching_rules" "jsonb",
    "price_thresholds" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auto_create_custom_fields" boolean DEFAULT true,
    "custom_fields_update_strategy" character varying(20) DEFAULT 'source_priority'::character varying,
    "custom_fields_source_priority" "jsonb" DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::"jsonb",
    "operational_report_email" "text",
    "operational_report_mode" "text" DEFAULT 'disabled'::"text" NOT NULL,
    CONSTRAINT "companies_primary_currency_check" CHECK (("char_length"("primary_currency") = 3)),
    CONSTRAINT "user_settings_operational_report_mode_check" CHECK (("operational_report_mode" = ANY (ARRAY['disabled'::"text", 'daily'::"text", 'issues_only'::"text"])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "price_id" "text",
    "status" "text" DEFAULT 'inactive'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."debug_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."debug_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mv_refresh_status" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mv_refresh_status_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_communication_log"
    ADD CONSTRAINT "admin_communication_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_api_key_key" UNIQUE ("api_key");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "brand_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cron_job_logs"
    ADD CONSTRAINT "cron_job_logs_job_name_execution_date_key" UNIQUE ("job_name", "execution_date");



ALTER TABLE ONLY "public"."cron_job_logs"
    ADD CONSTRAINT "cron_job_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."csv_uploads"
    ADD CONSTRAINT "csv_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_price_competitiveness_snapshots"
    ADD CONSTRAINT "daily_price_competitiveness_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_logs"
    ADD CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dismissed_duplicates"
    ADD CONSTRAINT "dismissed_duplicates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_runs"
    ADD CONSTRAINT "integration_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_contacts"
    ADD CONSTRAINT "marketing_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mv_refresh_status"
    ADD CONSTRAINT "mv_refresh_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mv_refresh_status"
    ADD CONSTRAINT "mv_refresh_status_view_name_key" UNIQUE ("view_name");



ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operational_report_deliveries"
    ADD CONSTRAINT "operational_report_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_changes_competitors"
    ADD CONSTRAINT "price_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_changes_suppliers"
    ADD CONSTRAINT "price_changes_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_custom_field_values"
    ADD CONSTRAINT "product_custom_field_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_custom_field_values"
    ADD CONSTRAINT "product_custom_field_values_product_id_custom_field_id_key" UNIQUE ("product_id", "custom_field_id");



ALTER TABLE ONLY "public"."products_dismissed_duplicates"
    ADD CONSTRAINT "products_dismissed_duplicates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_scraper_requests"
    ADD CONSTRAINT "professional_scraper_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_log"
    ADD CONSTRAINT "rate_limit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraper_ai_sessions"
    ADD CONSTRAINT "scraper_ai_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraper_run_rejections"
    ADD CONSTRAINT "scraper_run_rejections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraper_run_timeouts"
    ADD CONSTRAINT "scraper_run_timeouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scraper_runs"
    ADD CONSTRAINT "scraper_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scrapers"
    ADD CONSTRAINT "scrapers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_changes_competitors"
    ADD CONSTRAINT "stock_changes_competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_changes_suppliers"
    ADD CONSTRAINT "stock_changes_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_conversations"
    ADD CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temp_competitors_scraped_data"
    ADD CONSTRAINT "temp_competitors_scraped_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temp_integrations_scraped_data"
    ADD CONSTRAINT "temp_integrations_scraped_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temp_suppliers_scraped_data"
    ADD CONSTRAINT "temp_suppliers_scraped_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "unique_brand_alias" UNIQUE ("user_id", "brand_id", "alias_name");



ALTER TABLE ONLY "public"."dismissed_duplicates"
    ADD CONSTRAINT "unique_dismissed_pair" UNIQUE ("user_id", "brand_id_1", "brand_id_2");



ALTER TABLE ONLY "public"."products_dismissed_duplicates"
    ADD CONSTRAINT "unique_dismissed_product_pair" UNIQUE ("user_id", "product_id_1", "product_id_2");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "unique_user_brand" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."product_custom_fields"
    ADD CONSTRAINT "user_custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_custom_fields"
    ADD CONSTRAINT "user_custom_fields_user_id_field_name_key" UNIQUE ("user_id", "field_name");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_communication_log_admin_user_id" ON "public"."admin_communication_log" USING "btree" ("admin_user_id");



CREATE INDEX "idx_admin_communication_log_sent_at" ON "public"."admin_communication_log" USING "btree" ("sent_at");



CREATE INDEX "idx_admin_communication_log_target_user_id" ON "public"."admin_communication_log" USING "btree" ("target_user_id");



CREATE INDEX "idx_api_keys_user_id" ON "public"."api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_brand_aliases_alias_name" ON "public"."brand_aliases" USING "btree" ("alias_name");



CREATE INDEX "idx_brand_aliases_brand_id" ON "public"."brand_aliases" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_aliases_user_id" ON "public"."brand_aliases" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_brand_statistics_mv_brand_user" ON "public"."brand_statistics_mv" USING "btree" ("brand_id", "user_id");



CREATE INDEX "idx_brand_statistics_mv_user" ON "public"."brand_statistics_mv" USING "btree" ("user_id");



CREATE INDEX "idx_brands_is_active" ON "public"."brands" USING "btree" ("is_active");



CREATE INDEX "idx_brands_name" ON "public"."brands" USING "btree" ("name");



CREATE INDEX "idx_brands_needs_review" ON "public"."brands" USING "btree" ("needs_review");



CREATE INDEX "idx_brands_user_id" ON "public"."brands" USING "btree" ("user_id");



CREATE INDEX "idx_competitors_user_id" ON "public"."competitors" USING "btree" ("user_id");



CREATE INDEX "idx_cron_job_logs_job_date" ON "public"."cron_job_logs" USING "btree" ("job_name", "execution_date" DESC);



CREATE INDEX "idx_csv_uploads_competitor_id" ON "public"."csv_uploads" USING "btree" ("competitor_id");



CREATE INDEX "idx_csv_uploads_user_id" ON "public"."csv_uploads" USING "btree" ("user_id");



CREATE INDEX "idx_daily_price_snapshots_competitor_id" ON "public"."daily_price_competitiveness_snapshots" USING "btree" ("competitor_id");



CREATE UNIQUE INDEX "idx_daily_snapshots_unique" ON "public"."daily_price_competitiveness_snapshots" USING "btree" ("user_id", "snapshot_date", COALESCE(("competitor_id")::"text", 'ALL'::"text"), COALESCE("brand_filter", 'ALL'::"text"));



CREATE INDEX "idx_daily_snapshots_user_brand_date" ON "public"."daily_price_competitiveness_snapshots" USING "btree" ("user_id", "brand_filter", "snapshot_date" DESC);



CREATE INDEX "idx_daily_snapshots_user_competitor_brand_date" ON "public"."daily_price_competitiveness_snapshots" USING "btree" ("user_id", "competitor_id", "brand_filter", "snapshot_date" DESC);



CREATE INDEX "idx_daily_snapshots_user_competitor_date" ON "public"."daily_price_competitiveness_snapshots" USING "btree" ("user_id", "competitor_id", "snapshot_date" DESC);



CREATE INDEX "idx_daily_snapshots_user_date" ON "public"."daily_price_competitiveness_snapshots" USING "btree" ("user_id", "snapshot_date" DESC);



CREATE INDEX "idx_dismissed_duplicates_brand_id_2" ON "public"."dismissed_duplicates" USING "btree" ("brand_id_2");



CREATE INDEX "idx_dismissed_duplicates_brand_ids" ON "public"."dismissed_duplicates" USING "btree" ("brand_id_1", "brand_id_2");



CREATE INDEX "idx_dismissed_duplicates_user_id" ON "public"."dismissed_duplicates" USING "btree" ("user_id");



CREATE INDEX "idx_integration_runs_integration_id" ON "public"."integration_runs" USING "btree" ("integration_id");



CREATE INDEX "idx_integration_runs_status" ON "public"."integration_runs" USING "btree" ("status");



CREATE INDEX "idx_integration_runs_user_id" ON "public"."integration_runs" USING "btree" ("user_id");



CREATE INDEX "idx_integrations_platform" ON "public"."integrations" USING "btree" ("platform");



CREATE INDEX "idx_integrations_status" ON "public"."integrations" USING "btree" ("status");



CREATE INDEX "idx_integrations_user_id" ON "public"."integrations" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_latest_product_data_mv_id" ON "public"."latest_product_data_mv" USING "btree" ("id");



CREATE INDEX "idx_marketing_contacts_created_at" ON "public"."marketing_contacts" USING "btree" ("created_at");



CREATE INDEX "idx_marketing_contacts_status" ON "public"."marketing_contacts" USING "btree" ("status");



CREATE INDEX "idx_mv_refresh_status_is_refreshing" ON "public"."mv_refresh_status" USING "btree" ("is_refreshing");



CREATE INDEX "idx_mv_refresh_status_view_name" ON "public"."mv_refresh_status" USING "btree" ("view_name");



CREATE INDEX "idx_price_changes_analysis" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id", "competitor_id", "changed_at" DESC, "new_competitor_price");



CREATE INDEX "idx_price_changes_competitor_id" ON "public"."price_changes_competitors" USING "btree" ("competitor_id");



CREATE INDEX "idx_price_changes_competitors_competitor_date" ON "public"."price_changes_competitors" USING "btree" ("competitor_id", "changed_at") WHERE ("competitor_id" IS NOT NULL);



CREATE INDEX "idx_price_changes_competitors_integration" ON "public"."price_changes_competitors" USING "btree" ("user_id", "integration_id", "changed_at") WHERE ("integration_id" IS NOT NULL);



CREATE INDEX "idx_price_changes_competitors_our_prices" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id", "changed_at") WHERE ("new_our_retail_price" IS NOT NULL);



CREATE INDEX "idx_price_changes_competitors_prices" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id", "changed_at") WHERE ("new_competitor_price" IS NOT NULL);



CREATE INDEX "idx_price_changes_competitors_product_user" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id", "changed_at");



CREATE INDEX "idx_price_changes_competitors_user_product_competitor" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id", "competitor_id", "changed_at" DESC) WHERE (("new_competitor_price" IS NOT NULL) AND ("competitor_id" IS NOT NULL));



CREATE INDEX "idx_price_changes_integration_id" ON "public"."price_changes_competitors" USING "btree" ("integration_id");



CREATE INDEX "idx_price_changes_product_date" ON "public"."price_changes_competitors" USING "btree" ("product_id", "changed_at" DESC);



CREATE INDEX "idx_price_changes_product_id" ON "public"."price_changes_competitors" USING "btree" ("product_id");



CREATE INDEX "idx_price_changes_product_user_time" ON "public"."price_changes_competitors" USING "btree" ("product_id", "user_id", "changed_at" DESC);



CREATE INDEX "idx_price_changes_suppliers_analysis" ON "public"."price_changes_suppliers" USING "btree" ("user_id", "product_id", "supplier_id", "changed_at" DESC, "new_our_wholesale_price");



CREATE INDEX "idx_price_changes_suppliers_changed_at" ON "public"."price_changes_suppliers" USING "btree" ("changed_at");



CREATE INDEX "idx_price_changes_suppliers_integration_id" ON "public"."price_changes_suppliers" USING "btree" ("integration_id");



CREATE INDEX "idx_price_changes_suppliers_product_date" ON "public"."price_changes_suppliers" USING "btree" ("product_id", "changed_at" DESC);



CREATE INDEX "idx_price_changes_suppliers_product_id" ON "public"."price_changes_suppliers" USING "btree" ("product_id");



CREATE INDEX "idx_price_changes_suppliers_supplier_id" ON "public"."price_changes_suppliers" USING "btree" ("supplier_id");



CREATE INDEX "idx_price_changes_suppliers_user_changed_at" ON "public"."price_changes_suppliers" USING "btree" ("user_id", "changed_at" DESC);



CREATE INDEX "idx_price_changes_suppliers_user_id" ON "public"."price_changes_suppliers" USING "btree" ("user_id");



CREATE INDEX "idx_price_changes_suppliers_user_product" ON "public"."price_changes_suppliers" USING "btree" ("user_id", "product_id");



CREATE INDEX "idx_price_changes_suppliers_user_supplier_date" ON "public"."price_changes_suppliers" USING "btree" ("user_id", "supplier_id", "changed_at" DESC) WHERE ("supplier_id" IS NOT NULL);



CREATE INDEX "idx_price_changes_user_competitor_date" ON "public"."price_changes_competitors" USING "btree" ("user_id", "competitor_id", "changed_at" DESC);



CREATE INDEX "idx_price_changes_user_id" ON "public"."price_changes_competitors" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_price_changes_user_id" IS 'Optimizes user-based price_changes queries';



CREATE INDEX "idx_price_changes_user_id_changed_at" ON "public"."price_changes_competitors" USING "btree" ("user_id", "changed_at" DESC);



COMMENT ON INDEX "public"."idx_price_changes_user_id_changed_at" IS 'Optimizes time-based price change queries';



CREATE INDEX "idx_price_changes_user_id_competitor_id" ON "public"."price_changes_competitors" USING "btree" ("user_id", "competitor_id") WHERE ("competitor_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_price_changes_user_id_competitor_id" IS 'Optimizes competitor-based price queries';



CREATE INDEX "idx_price_changes_user_id_integration_id" ON "public"."price_changes_competitors" USING "btree" ("user_id", "integration_id") WHERE ("integration_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_price_changes_user_id_integration_id" IS 'Optimizes integration-based price queries';



CREATE INDEX "idx_price_changes_user_id_percentage_changed_at" ON "public"."price_changes_competitors" USING "btree" ("user_id", "price_change_percentage", "changed_at" DESC);



COMMENT ON INDEX "public"."idx_price_changes_user_id_percentage_changed_at" IS 'Optimizes dashboard price drop queries';



CREATE INDEX "idx_price_changes_user_id_product_id" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id");



COMMENT ON INDEX "public"."idx_price_changes_user_id_product_id" IS 'Optimizes get_brand_analytics function joins';



CREATE INDEX "idx_price_changes_user_product_competitor_distinct" ON "public"."price_changes_competitors" USING "btree" ("user_id", "product_id", "competitor_id") WHERE ("competitor_id" IS NOT NULL);



CREATE INDEX "idx_product_custom_field_values_created_at_product" ON "public"."product_custom_field_values" USING "btree" ("created_at" DESC, "product_id");



CREATE INDEX "idx_product_custom_field_values_custom_field_id" ON "public"."product_custom_field_values" USING "btree" ("custom_field_id");



CREATE INDEX "idx_product_custom_field_values_dedup" ON "public"."product_custom_field_values" USING "btree" ("custom_field_id", "value_hash");



CREATE INDEX "idx_product_custom_field_values_hash" ON "public"."product_custom_field_values" USING "btree" ("value_hash");



CREATE INDEX "idx_product_custom_field_values_product_id" ON "public"."product_custom_field_values" USING "btree" ("product_id");



CREATE INDEX "idx_product_custom_field_values_product_source" ON "public"."product_custom_field_values" USING "btree" ("product_id", "source_type");



CREATE INDEX "idx_product_custom_field_values_source_id" ON "public"."product_custom_field_values" USING "btree" ("source_id");



CREATE INDEX "idx_product_custom_field_values_source_type" ON "public"."product_custom_field_values" USING "btree" ("source_type");



CREATE INDEX "idx_product_custom_field_values_value_hash" ON "public"."product_custom_field_values" USING "btree" ("md5"("value")) WHERE ("value" IS NOT NULL);



CREATE INDEX "idx_products_brand" ON "public"."products" USING "btree" ("brand");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_products_brand_id_name" ON "public"."products" USING "btree" ("user_id", "brand_id", "name");



CREATE INDEX "idx_products_brand_sku" ON "public"."products" USING "btree" ("brand", "sku");



CREATE INDEX "idx_products_dismissed_duplicates_product_id_2" ON "public"."products_dismissed_duplicates" USING "btree" ("product_id_2");



CREATE INDEX "idx_products_dismissed_duplicates_products" ON "public"."products_dismissed_duplicates" USING "btree" ("product_id_1", "product_id_2");



CREATE INDEX "idx_products_dismissed_duplicates_user_id" ON "public"."products_dismissed_duplicates" USING "btree" ("user_id");



CREATE INDEX "idx_products_dismissed_duplicates_user_products" ON "public"."products_dismissed_duplicates" USING "btree" ("user_id", "product_id_1", "product_id_2");



CREATE INDEX "idx_products_ean" ON "public"."products" USING "btree" ("ean");



CREATE INDEX "idx_products_ean_nonempty" ON "public"."products" USING "btree" ("user_id", "ean") WHERE (("ean" IS NOT NULL) AND ("ean" <> ''::"text"));



CREATE INDEX "idx_products_last_integration_sync" ON "public"."products" USING "btree" ("user_id", "last_integration_sync_at") WHERE (("our_retail_price" IS NOT NULL) OR ("our_wholesale_price" IS NOT NULL));



CREATE INDEX "idx_products_name_length" ON "public"."products" USING "btree" ("user_id", "length"("name"));



CREATE INDEX "idx_products_user_active" ON "public"."products" USING "btree" ("user_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_products_user_active_price" ON "public"."products" USING "btree" ("user_id", "is_active", "our_retail_price") WHERE (("is_active" = true) AND ("our_retail_price" IS NOT NULL));



CREATE INDEX "idx_products_user_brand" ON "public"."products" USING "btree" ("user_id", "brand");



CREATE INDEX "idx_products_user_brand_sku" ON "public"."products" USING "btree" ("user_id", "brand_id", "sku") WHERE (("brand_id" IS NOT NULL) AND ("sku" IS NOT NULL) AND ("sku" <> ''::"text"));



CREATE INDEX "idx_products_user_id" ON "public"."products" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_products_user_id" IS 'Optimizes user-based product queries';



CREATE INDEX "idx_products_user_id_brand_id" ON "public"."products" USING "btree" ("user_id", "brand_id");



COMMENT ON INDEX "public"."idx_products_user_id_brand_id" IS 'Optimizes product-brand joins in analytics';



CREATE INDEX "idx_professional_scraper_requests_competitor_id" ON "public"."professional_scraper_requests" USING "btree" ("competitor_id");



CREATE INDEX "idx_professional_scraper_requests_created_at" ON "public"."professional_scraper_requests" USING "btree" ("created_at");



CREATE INDEX "idx_professional_scraper_requests_status" ON "public"."professional_scraper_requests" USING "btree" ("status");



CREATE INDEX "idx_professional_scraper_requests_user_id" ON "public"."professional_scraper_requests" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limit_log_ip_endpoint" ON "public"."rate_limit_log" USING "btree" ("ip_address", "endpoint");



CREATE INDEX "idx_rate_limit_log_window_start" ON "public"."rate_limit_log" USING "btree" ("window_start");



CREATE INDEX "idx_scraper_ai_sessions_competitor_id" ON "public"."scraper_ai_sessions" USING "btree" ("competitor_id");



CREATE INDEX "idx_scraper_ai_sessions_current_phase" ON "public"."scraper_ai_sessions" USING "btree" ("current_phase");



CREATE INDEX "idx_scraper_ai_sessions_user_id" ON "public"."scraper_ai_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_scraper_run_rejections_rejected_at" ON "public"."scraper_run_rejections" USING "btree" ("rejected_at");



CREATE INDEX "idx_scraper_run_rejections_scraper_time" ON "public"."scraper_run_rejections" USING "btree" ("scraper_id", "rejected_at" DESC);



CREATE INDEX "idx_scraper_run_timeouts_run_id" ON "public"."scraper_run_timeouts" USING "btree" ("run_id");



CREATE INDEX "idx_scraper_run_timeouts_timeout_at" ON "public"."scraper_run_timeouts" USING "btree" ("timeout_at") WHERE ("processed" = false);



CREATE INDEX "idx_scraper_runs_created_at" ON "public"."scraper_runs" USING "btree" ("created_at");



CREATE INDEX "idx_scraper_runs_scraper_id" ON "public"."scraper_runs" USING "btree" ("scraper_id");



CREATE INDEX "idx_scraper_runs_started_at" ON "public"."scraper_runs" USING "btree" ("started_at");



CREATE INDEX "idx_scraper_runs_status" ON "public"."scraper_runs" USING "btree" ("status");



CREATE INDEX "idx_scraper_runs_user_id" ON "public"."scraper_runs" USING "btree" ("user_id");



CREATE INDEX "idx_scrapers_competitor_id" ON "public"."scrapers" USING "btree" ("competitor_id");



CREATE INDEX "idx_scrapers_execution_time" ON "public"."scrapers" USING "btree" ("execution_time");



CREATE INDEX "idx_scrapers_scraper_type" ON "public"."scrapers" USING "btree" ("scraper_type");



CREATE INDEX "idx_scrapers_supplier_id" ON "public"."scrapers" USING "btree" ("supplier_id");



CREATE INDEX "idx_scrapers_user_id" ON "public"."scrapers" USING "btree" ("user_id");



CREATE INDEX "idx_stock_changes_analysis" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "product_id", "competitor_id", "changed_at" DESC, "stock_change_quantity");



CREATE INDEX "idx_stock_changes_competitors_changed_at" ON "public"."stock_changes_competitors" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_stock_changes_competitors_competitor_date" ON "public"."stock_changes_competitors" USING "btree" ("competitor_id", "changed_at") WHERE ("competitor_id" IS NOT NULL);



CREATE INDEX "idx_stock_changes_competitors_integration_id" ON "public"."stock_changes_competitors" USING "btree" ("integration_id");



CREATE INDEX "idx_stock_changes_competitors_product_id" ON "public"."stock_changes_competitors" USING "btree" ("product_id");



CREATE INDEX "idx_stock_changes_competitors_product_user" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "product_id", "changed_at");



CREATE INDEX "idx_stock_changes_competitors_user_competitor" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "competitor_id") WHERE ("competitor_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_stock_changes_competitors_user_competitor" IS 'Optimizes competitor-based stock queries';



CREATE INDEX "idx_stock_changes_competitors_user_id" ON "public"."stock_changes_competitors" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_stock_changes_competitors_user_id" IS 'Optimizes user-based stock queries';



CREATE INDEX "idx_stock_changes_competitors_user_integration" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "integration_id") WHERE ("integration_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_stock_changes_competitors_user_integration" IS 'Optimizes integration-based stock queries';



CREATE INDEX "idx_stock_changes_competitors_user_product_time" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "product_id", "changed_at" DESC);



COMMENT ON INDEX "public"."idx_stock_changes_competitors_user_product_time" IS 'Optimizes product stock history queries';



CREATE INDEX "idx_stock_changes_product_date" ON "public"."stock_changes_competitors" USING "btree" ("product_id", "changed_at" DESC);



CREATE INDEX "idx_stock_changes_suppliers_changed_at" ON "public"."stock_changes_suppliers" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_stock_changes_suppliers_integration_id" ON "public"."stock_changes_suppliers" USING "btree" ("integration_id");



CREATE INDEX "idx_stock_changes_suppliers_product_id" ON "public"."stock_changes_suppliers" USING "btree" ("product_id");



CREATE INDEX "idx_stock_changes_suppliers_supplier_id" ON "public"."stock_changes_suppliers" USING "btree" ("supplier_id");



CREATE INDEX "idx_stock_changes_suppliers_user_id" ON "public"."stock_changes_suppliers" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_stock_changes_suppliers_user_id" IS 'Optimizes user-based supplier stock queries';



CREATE INDEX "idx_stock_changes_suppliers_user_integration" ON "public"."stock_changes_suppliers" USING "btree" ("user_id", "integration_id") WHERE ("integration_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_stock_changes_suppliers_user_integration" IS 'Optimizes integration-based supplier stock queries';



CREATE INDEX "idx_stock_changes_suppliers_user_product_time" ON "public"."stock_changes_suppliers" USING "btree" ("user_id", "product_id", "changed_at" DESC);



COMMENT ON INDEX "public"."idx_stock_changes_suppliers_user_product_time" IS 'Optimizes product supplier stock history queries';



CREATE INDEX "idx_stock_changes_suppliers_user_supplier" ON "public"."stock_changes_suppliers" USING "btree" ("user_id", "supplier_id") WHERE ("supplier_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_stock_changes_suppliers_user_supplier" IS 'Optimizes supplier-based stock queries';



CREATE INDEX "idx_stock_changes_user_competitor_date" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "competitor_id", "changed_at" DESC);



CREATE INDEX "idx_stock_changes_user_product_competitor_distinct" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "product_id", "competitor_id") WHERE ("competitor_id" IS NOT NULL);



CREATE INDEX "idx_stock_changes_user_quantity_date" ON "public"."stock_changes_competitors" USING "btree" ("user_id", "stock_change_quantity", "changed_at") WHERE ("stock_change_quantity" < 0);



CREATE INDEX "idx_suppliers_is_active" ON "public"."suppliers" USING "btree" ("is_active");



CREATE INDEX "idx_suppliers_name" ON "public"."suppliers" USING "btree" ("name");



CREATE INDEX "idx_suppliers_user_id" ON "public"."suppliers" USING "btree" ("user_id");



CREATE INDEX "idx_support_conversations_admin_user_id" ON "public"."support_conversations" USING "btree" ("admin_user_id");



CREATE INDEX "idx_support_conversations_created_at" ON "public"."support_conversations" USING "btree" ("created_at");



CREATE INDEX "idx_support_conversations_status" ON "public"."support_conversations" USING "btree" ("status");



CREATE INDEX "idx_support_conversations_user_id" ON "public"."support_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_support_messages_conversation_created" ON "public"."support_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_support_messages_conversation_id" ON "public"."support_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_support_messages_created_at" ON "public"."support_messages" USING "btree" ("created_at");



CREATE INDEX "idx_support_messages_sender_id" ON "public"."support_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_support_messages_unread" ON "public"."support_messages" USING "btree" ("conversation_id", "sender_type", "read_by_recipient");



CREATE INDEX "idx_temp_competitors_scraped_data_competitor_id" ON "public"."temp_competitors_scraped_data" USING "btree" ("competitor_id");



CREATE INDEX "idx_temp_competitors_scraped_data_product_id" ON "public"."temp_competitors_scraped_data" USING "btree" ("product_id");



CREATE INDEX "idx_temp_competitors_scraped_data_scraped_at" ON "public"."temp_competitors_scraped_data" USING "btree" ("scraped_at");



CREATE INDEX "idx_temp_competitors_scraped_data_scraper_id" ON "public"."temp_competitors_scraped_data" USING "btree" ("scraper_id");



CREATE INDEX "idx_temp_competitors_scraped_data_user_id" ON "public"."temp_competitors_scraped_data" USING "btree" ("user_id");



CREATE INDEX "idx_temp_integrations_run_ean" ON "public"."temp_integrations_scraped_data" USING "btree" ("integration_run_id", "ean") WHERE (("ean" IS NOT NULL) AND ("ean" <> ''::"text"));



CREATE INDEX "idx_temp_integrations_run_sku" ON "public"."temp_integrations_scraped_data" USING "btree" ("integration_run_id", "sku") WHERE (("sku" IS NOT NULL) AND ("sku" <> ''::"text"));



CREATE INDEX "idx_temp_integrations_run_status" ON "public"."temp_integrations_scraped_data" USING "btree" ("integration_run_id", "status");



CREATE INDEX "idx_temp_integrations_scraped_data_integration_run_id" ON "public"."temp_integrations_scraped_data" USING "btree" ("integration_run_id");



CREATE INDEX "idx_temp_integrations_scraped_data_status" ON "public"."temp_integrations_scraped_data" USING "btree" ("status");



CREATE INDEX "idx_temp_suppliers_scraped_data_processed" ON "public"."temp_suppliers_scraped_data" USING "btree" ("processed");



CREATE INDEX "idx_temp_suppliers_scraped_data_run_id" ON "public"."temp_suppliers_scraped_data" USING "btree" ("run_id");



CREATE INDEX "idx_temp_suppliers_scraped_data_scraper_id" ON "public"."temp_suppliers_scraped_data" USING "btree" ("scraper_id");



CREATE INDEX "idx_temp_suppliers_scraped_data_supplier_id" ON "public"."temp_suppliers_scraped_data" USING "btree" ("supplier_id");



CREATE INDEX "idx_temp_suppliers_scraped_data_user_id" ON "public"."temp_suppliers_scraped_data" USING "btree" ("user_id");



CREATE INDEX "idx_user_custom_fields_user_id" ON "public"."product_custom_fields" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_admin_role" ON "public"."user_profiles" USING "btree" ("admin_role") WHERE ("admin_role" IS NOT NULL);



CREATE INDEX "idx_user_profiles_created_at" ON "public"."user_profiles" USING "btree" ("created_at");



CREATE INDEX "idx_user_profiles_is_suspended" ON "public"."user_profiles" USING "btree" ("is_suspended") WHERE ("is_suspended" = true);



CREATE INDEX "idx_user_profiles_subscription_tier" ON "public"."user_profiles" USING "btree" ("subscription_tier");



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "operational_report_deliveries_daily_unique" ON "public"."operational_report_deliveries" USING "btree" ("user_id", "report_date", "report_type") WHERE ("report_type" = 'daily'::"text");



CREATE UNIQUE INDEX "operational_report_deliveries_issue_unique" ON "public"."operational_report_deliveries" USING "btree" ("user_id", "report_type", "issue_signature") WHERE ("report_type" = 'issues'::"text");



CREATE OR REPLACE TRIGGER "auto_process_temp_competitors_trigger" AFTER INSERT ON "public"."temp_competitors_scraped_data" FOR EACH ROW EXECUTE FUNCTION "public"."process_temp_competitors_scraped_data_trigger"();



CREATE OR REPLACE TRIGGER "auto_process_temp_integrations_trigger" BEFORE INSERT ON "public"."temp_integrations_scraped_data" FOR EACH ROW EXECUTE FUNCTION "public"."process_temp_integrations_scraped_data"();



CREATE OR REPLACE TRIGGER "auto_process_temp_suppliers_trigger" AFTER INSERT ON "public"."temp_suppliers_scraped_data" FOR EACH ROW EXECUTE FUNCTION "public"."process_temp_suppliers_scraped_data_trigger"();



CREATE OR REPLACE TRIGGER "integration_runs_progress_update_trigger" BEFORE UPDATE ON "public"."integration_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_progress_timestamp"();



CREATE OR REPLACE TRIGGER "one_active_scraper_per_competitor" BEFORE INSERT OR UPDATE ON "public"."scrapers" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_one_active_scraper_per_competitor"();



CREATE OR REPLACE TRIGGER "set_product_brand_id_trigger" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_product_brand_id"();



CREATE OR REPLACE TRIGGER "sync_brand_id_trigger" BEFORE INSERT OR UPDATE OF "brand" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."sync_brand_id"();



CREATE OR REPLACE TRIGGER "sync_brand_name_trigger" BEFORE INSERT OR UPDATE OF "brand_id" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."sync_brand_name"();



CREATE OR REPLACE TRIGGER "sync_our_url_trigger" AFTER UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_our_url_on_product_update"();



CREATE OR REPLACE TRIGGER "trigger_calculate_price_change_percentage" BEFORE INSERT OR UPDATE ON "public"."price_changes_competitors" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_price_change_percentage"();



CREATE OR REPLACE TRIGGER "trigger_calculate_supplier_price_change_percentage" BEFORE INSERT OR UPDATE ON "public"."price_changes_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_supplier_price_change_percentage"();



CREATE OR REPLACE TRIGGER "trigger_update_conversation_timestamp" AFTER INSERT ON "public"."support_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_daily_snapshots_updated_at" BEFORE UPDATE ON "public"."daily_price_competitiveness_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_daily_snapshots_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_integration_next_run" AFTER UPDATE ON "public"."integration_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_next_run_on_completion"();



CREATE OR REPLACE TRIGGER "trigger_update_scraper_next_run" AFTER UPDATE ON "public"."scraper_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_scraper_next_run_on_completion"();



CREATE OR REPLACE TRIGGER "update_professional_scraper_requests_updated_at" BEFORE UPDATE ON "public"."professional_scraper_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_scraper_status_trigger" AFTER UPDATE ON "public"."scraper_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_scraper_status_from_run"();



CREATE OR REPLACE TRIGGER "update_support_conversations_updated_at" BEFORE UPDATE ON "public"."support_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_temp_competitors_trigger" BEFORE INSERT ON "public"."temp_competitors_scraped_data" FOR EACH ROW EXECUTE FUNCTION "public"."validate_temp_competitors_data"();



CREATE OR REPLACE TRIGGER "validate_temp_integrations_trigger" BEFORE INSERT ON "public"."temp_integrations_scraped_data" FOR EACH ROW EXECUTE FUNCTION "public"."validate_temp_integrations_data"();



CREATE OR REPLACE TRIGGER "validate_temp_suppliers_trigger" BEFORE INSERT ON "public"."temp_suppliers_scraped_data" FOR EACH ROW EXECUTE FUNCTION "public"."validate_temp_suppliers_data"();



ALTER TABLE ONLY "public"."admin_communication_log"
    ADD CONSTRAINT "admin_communication_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "next_auth"."users"("id");



ALTER TABLE ONLY "public"."admin_communication_log"
    ADD CONSTRAINT "admin_communication_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "next_auth"."users"("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "brand_aliases_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_aliases"
    ADD CONSTRAINT "brand_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."csv_uploads"
    ADD CONSTRAINT "csv_uploads_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id");



ALTER TABLE ONLY "public"."csv_uploads"
    ADD CONSTRAINT "csv_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_price_competitiveness_snapshots"
    ADD CONSTRAINT "daily_price_competitiveness_snapshots_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_price_competitiveness_snapshots"
    ADD CONSTRAINT "daily_price_competitiveness_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dismissed_duplicates"
    ADD CONSTRAINT "dismissed_duplicates_brand_id_1_fkey" FOREIGN KEY ("brand_id_1") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dismissed_duplicates"
    ADD CONSTRAINT "dismissed_duplicates_brand_id_2_fkey" FOREIGN KEY ("brand_id_2") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dismissed_duplicates"
    ADD CONSTRAINT "dismissed_duplicates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_competitors"
    ADD CONSTRAINT "fk_stock_competitors_competitor" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_competitors"
    ADD CONSTRAINT "fk_stock_competitors_integration" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_competitors"
    ADD CONSTRAINT "fk_stock_competitors_product" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_competitors"
    ADD CONSTRAINT "fk_stock_competitors_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_suppliers"
    ADD CONSTRAINT "fk_stock_suppliers_integration" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_suppliers"
    ADD CONSTRAINT "fk_stock_suppliers_product" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_suppliers"
    ADD CONSTRAINT "fk_stock_suppliers_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_changes_suppliers"
    ADD CONSTRAINT "fk_stock_suppliers_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_runs"
    ADD CONSTRAINT "integration_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id");



ALTER TABLE ONLY "public"."integration_runs"
    ADD CONSTRAINT "integration_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."operational_report_deliveries"
    ADD CONSTRAINT "operational_report_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_changes_competitors"
    ADD CONSTRAINT "price_changes_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id");



ALTER TABLE ONLY "public"."price_changes_competitors"
    ADD CONSTRAINT "price_changes_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_changes_competitors"
    ADD CONSTRAINT "price_changes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_changes_suppliers"
    ADD CONSTRAINT "price_changes_suppliers_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id");



ALTER TABLE ONLY "public"."price_changes_suppliers"
    ADD CONSTRAINT "price_changes_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_changes_suppliers"
    ADD CONSTRAINT "price_changes_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."price_changes_suppliers"
    ADD CONSTRAINT "price_changes_suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."price_changes_competitors"
    ADD CONSTRAINT "price_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_custom_field_values"
    ADD CONSTRAINT "product_custom_field_values_custom_field_id_fkey" FOREIGN KEY ("custom_field_id") REFERENCES "public"."product_custom_fields"("id");



ALTER TABLE ONLY "public"."product_custom_field_values"
    ADD CONSTRAINT "product_custom_field_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."products_dismissed_duplicates"
    ADD CONSTRAINT "products_dismissed_duplicates_product_id_1_fkey" FOREIGN KEY ("product_id_1") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."products_dismissed_duplicates"
    ADD CONSTRAINT "products_dismissed_duplicates_product_id_2_fkey" FOREIGN KEY ("product_id_2") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."products_dismissed_duplicates"
    ADD CONSTRAINT "products_dismissed_duplicates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."professional_scraper_requests"
    ADD CONSTRAINT "professional_scraper_requests_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id");



ALTER TABLE ONLY "public"."professional_scraper_requests"
    ADD CONSTRAINT "professional_scraper_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."scraper_ai_sessions"
    ADD CONSTRAINT "scraper_ai_sessions_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id");



ALTER TABLE ONLY "public"."scraper_ai_sessions"
    ADD CONSTRAINT "scraper_ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scraper_run_rejections"
    ADD CONSTRAINT "scraper_run_rejections_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scraper_run_rejections"
    ADD CONSTRAINT "scraper_run_rejections_scraper_id_fkey" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scraper_run_timeouts"
    ADD CONSTRAINT "scraper_run_timeouts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."scraper_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scraper_runs"
    ADD CONSTRAINT "scraper_runs_scraper_id_fkey" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id");



ALTER TABLE ONLY "public"."scraper_runs"
    ADD CONSTRAINT "scraper_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scrapers"
    ADD CONSTRAINT "scrapers_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id");



ALTER TABLE ONLY "public"."scrapers"
    ADD CONSTRAINT "scrapers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."scrapers"
    ADD CONSTRAINT "scrapers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."support_conversations"
    ADD CONSTRAINT "support_conversations_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."support_conversations"
    ADD CONSTRAINT "support_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."support_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."temp_competitors_scraped_data"
    ADD CONSTRAINT "temp_competitors_scraped_data_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temp_competitors_scraped_data"
    ADD CONSTRAINT "temp_competitors_scraped_data_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."temp_competitors_scraped_data"
    ADD CONSTRAINT "temp_competitors_scraped_data_scraper_id_fkey" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id");



ALTER TABLE ONLY "public"."temp_competitors_scraped_data"
    ADD CONSTRAINT "temp_competitors_scraped_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temp_integrations_scraped_data"
    ADD CONSTRAINT "temp_integrations_scraped_data_integration_run_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temp_suppliers_scraped_data"
    ADD CONSTRAINT "temp_suppliers_scraped_data_scraper_id_fkey" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id");



ALTER TABLE ONLY "public"."temp_suppliers_scraped_data"
    ADD CONSTRAINT "temp_suppliers_scraped_data_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."temp_suppliers_scraped_data"
    ADD CONSTRAINT "temp_suppliers_scraped_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_custom_fields"
    ADD CONSTRAINT "user_custom_fields_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Authenticated users can access debug logs" ON "public"."debug_logs" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated users can access marketing contacts" ON "public"."marketing_contacts" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated users can access newsletter subscriptions" ON "public"."newsletter_subscriptions" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated users can access rate limit logs" ON "public"."rate_limit_log" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can access their own competitor stock changes" ON "public"."stock_changes_competitors" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can access their own custom fields" ON "public"."product_custom_fields" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can access their own dismissed duplicates" ON "public"."products_dismissed_duplicates" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can access their own product custom field values" ON "public"."product_custom_field_values" USING ((EXISTS ( SELECT 1
   FROM "public"."product_custom_fields" "ucf"
  WHERE (("ucf"."id" = "product_custom_field_values"."custom_field_id") AND ("ucf"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can access their own scraper runs" ON "public"."scraper_runs" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can access their own supplier stock changes" ON "public"."stock_changes_suppliers" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can add messages to own conversations" ON "public"."support_messages" FOR INSERT WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."support_conversations"
  WHERE (("support_conversations"."id" = "support_messages"."conversation_id") AND ("support_conversations"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can create conversations" ON "public"."support_conversations" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create scraper requests" ON "public"."professional_scraper_requests" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own API keys" ON "public"."api_keys" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own CSV uploads" ON "public"."csv_uploads" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own brand aliases" ON "public"."brand_aliases" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own brands" ON "public"."brands" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own company" ON "public"."user_settings" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own competitors" ON "public"."competitors" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own dismissed duplicates" ON "public"."dismissed_duplicates" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own integrations" ON "public"."integrations" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own products" ON "public"."products" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own scraper AI sessions" ON "public"."scraper_ai_sessions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own scrapers" ON "public"."scrapers" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own supplier price changes" ON "public"."price_changes_suppliers" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own supplier scraped data" ON "public"."temp_suppliers_scraped_data" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own suppliers" ON "public"."suppliers" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own API keys" ON "public"."api_keys" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own CSV uploads" ON "public"."csv_uploads" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own brand aliases" ON "public"."brand_aliases" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own brands" ON "public"."brands" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own company" ON "public"."user_settings" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own competitors" ON "public"."competitors" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own dismissed duplicates" ON "public"."dismissed_duplicates" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own integration runs" ON "public"."integration_runs" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own integrations" ON "public"."integrations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own price changes" ON "public"."price_changes_competitors" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own products" ON "public"."products" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own scraper AI sessions" ON "public"."scraper_ai_sessions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own scrapers" ON "public"."scrapers" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own supplier price changes" ON "public"."price_changes_suppliers" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own supplier scraped data" ON "public"."temp_suppliers_scraped_data" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own suppliers" ON "public"."suppliers" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own scraper run timeouts" ON "public"."scraper_run_timeouts" USING (("run_id" IN ( SELECT "sr"."id"
   FROM "public"."scraper_runs" "sr"
  WHERE ("sr"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can only access their own integration products" ON "public"."temp_integrations_scraped_data" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can only access their own scraped products" ON "public"."temp_competitors_scraped_data" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can only access their own snapshots" ON "public"."daily_price_competitiveness_snapshots" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own conversations" ON "public"."support_conversations" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own CSV uploads" ON "public"."csv_uploads" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own brands" ON "public"."brands" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own company" ON "public"."user_settings" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own competitors" ON "public"."competitors" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own integration runs" ON "public"."integration_runs" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own integrations" ON "public"."integrations" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own products" ON "public"."products" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own scraper AI sessions" ON "public"."scraper_ai_sessions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own scrapers" ON "public"."scrapers" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own supplier price changes" ON "public"."price_changes_suppliers" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own supplier scraped data" ON "public"."temp_suppliers_scraped_data" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own suppliers" ON "public"."suppliers" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view messages in own conversations" ON "public"."support_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."support_conversations"
  WHERE (("support_conversations"."id" = "support_messages"."conversation_id") AND ("support_conversations"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own conversations" ON "public"."support_conversations" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own scraper requests" ON "public"."professional_scraper_requests" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own CSV uploads" ON "public"."csv_uploads" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own brand aliases" ON "public"."brand_aliases" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own brands" ON "public"."brands" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own company" ON "public"."user_settings" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own competitors" ON "public"."competitors" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own dismissed duplicates" ON "public"."dismissed_duplicates" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own integration runs" ON "public"."integration_runs" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own integrations" ON "public"."integrations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own operational report deliveries" ON "public"."operational_report_deliveries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own price changes" ON "public"."price_changes_competitors" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own products" ON "public"."products" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own scraper AI sessions" ON "public"."scraper_ai_sessions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own scrapers" ON "public"."scrapers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own subscriptions" ON "public"."user_subscriptions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own supplier price changes" ON "public"."price_changes_suppliers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own supplier scraped data" ON "public"."temp_suppliers_scraped_data" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own suppliers" ON "public"."suppliers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."admin_communication_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_communication_log_insert_policy" ON "public"."admin_communication_log" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."admin_role" = ANY (ARRAY['super_admin'::"text", 'support_admin'::"text"]))))));



CREATE POLICY "admin_communication_log_select_policy" ON "public"."admin_communication_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."admin_role" = ANY (ARRAY['super_admin'::"text", 'support_admin'::"text"]))))));



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cron_job_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."csv_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_price_competitiveness_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dismissed_duplicates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mv_refresh_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operational_report_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_changes_competitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_changes_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_custom_field_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products_dismissed_duplicates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_scraper_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraper_ai_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraper_run_rejections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scraper_run_rejections_select_own" ON "public"."scraper_run_rejections" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."scraper_run_timeouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scraper_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scrapers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_changes_competitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_changes_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_competitors_scraped_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_integrations_scraped_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_suppliers_scraped_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "anon";



REVOKE ALL ON FUNCTION "public"."admin_list_unhealthy_scrapers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_unhealthy_scrapers"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_unhealthy_scrapers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_unhealthy_scrapers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."append_log_to_scraper_run"("p_run_id" "uuid", "p_log_entry" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."append_log_to_scraper_run"("p_run_id" "uuid", "p_log_entry" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_log_to_scraper_run"("p_run_id" "uuid", "p_log_entry" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."append_logs_to_scraper_run"("p_run_id" "uuid", "p_log_entries" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."append_logs_to_scraper_run"("p_run_id" "uuid", "p_log_entries" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_logs_to_scraper_run"("p_run_id" "uuid", "p_log_entries" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_trim_progress_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_trim_progress_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_trim_progress_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_all_daily_snapshots"("p_user_id" "uuid", "p_snapshot_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_all_daily_snapshots"("p_user_id" "uuid", "p_snapshot_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_all_daily_snapshots"("p_user_id" "uuid", "p_snapshot_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_daily_price_competitiveness_snapshot"("p_user_id" "uuid", "p_snapshot_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_daily_price_competitiveness_snapshot"("p_user_id" "uuid", "p_snapshot_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_daily_price_competitiveness_snapshot"("p_user_id" "uuid", "p_snapshot_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_integration_run_time"("sync_frequency" "text", "last_sync_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_integration_run_time"("sync_frequency" "text", "last_sync_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_integration_run_time"("sync_frequency" "text", "last_sync_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_scraper_run_time"("schedule_config" "jsonb", "last_run" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_scraper_run_time"("schedule_config" "jsonb", "last_run" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_scraper_run_time"("schedule_config" "jsonb", "last_run" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_price_change_percentage"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_price_change_percentage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_price_change_percentage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_supplier_price_change_percentage"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_supplier_price_change_percentage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_supplier_price_change_percentage"() TO "service_role";



GRANT ALL ON TABLE "public"."integration_runs" TO "anon";
GRANT ALL ON TABLE "public"."integration_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_runs" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_next_integration_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_next_integration_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_next_integration_job"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_next_scraper_job"("worker_type_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_next_scraper_job"("worker_type_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_next_scraper_job"("worker_type_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_debug_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_debug_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_debug_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_price_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_price_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_price_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_scraper_run_rejections"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_scraper_run_rejections"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_scraper_run_rejections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_scraper_run_rejections"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_scraper_runs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_scraper_runs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_scraper_runs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_rate_limit_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_rate_limit_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_rate_limit_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_removed_integration_products"("p_integration_run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_removed_integration_products"("p_integration_run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_removed_integration_products"("p_integration_run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_stalled_integration_runs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stalled_integration_runs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stalled_integration_runs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_temp_competitors_scraped_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_temp_competitors_scraped_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_temp_competitors_scraped_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_temp_integrations_scraped_data"("p_older_than" interval, "p_batch_size" integer, "p_max_batches" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_temp_integrations_scraped_data"("p_older_than" interval, "p_batch_size" integer, "p_max_batches" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_temp_integrations_scraped_data"("p_older_than" interval, "p_batch_size" integer, "p_max_batches" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_distinct_competitors_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_distinct_competitors_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_distinct_competitors_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profile_for_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profile_for_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profile_for_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_scheduled_integration_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_scheduled_integration_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_scheduled_integration_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_scheduled_scraper_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_scheduled_scraper_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_scheduled_scraper_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_for_nextauth"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_for_nextauth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_for_nextauth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_for_nextauth"("user_id" "uuid", "email" "text", "name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_for_nextauth"("user_id" "uuid", "email" "text", "name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_for_nextauth"("user_id" "uuid", "email" "text", "name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_utility_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_utility_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_utility_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."db_now"() TO "anon";
GRANT ALL ON FUNCTION "public"."db_now"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."db_now"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_create_scheduled_scraper_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_create_scheduled_scraper_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_create_scheduled_scraper_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_product_data"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_product_data"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_product_data"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_and_process_integration_conflicts"("p_user_id" "uuid", "p_integration_run_id" "uuid", "p_batch_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."detect_and_process_integration_conflicts"("p_user_id" "uuid", "p_integration_run_id" "uuid", "p_batch_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_and_process_integration_conflicts"("p_user_id" "uuid", "p_integration_run_id" "uuid", "p_batch_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_custom_field_type"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_custom_field_type"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_custom_field_type"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_ean_conflicts_and_create_reviews"("p_user_id" "uuid", "p_source_table" "text", "p_batch_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."detect_ean_conflicts_and_create_reviews"("p_user_id" "uuid", "p_source_table" "text", "p_batch_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_ean_conflicts_and_create_reviews"("p_user_id" "uuid", "p_source_table" "text", "p_batch_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."dismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_one_active_scraper_per_competitor"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_one_active_scraper_per_competitor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_one_active_scraper_per_competitor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_exists_simple"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_exists_simple"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_exists_simple"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_brand_by_name_or_alias"("p_user_id" "uuid", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_brand_by_name_or_alias"("p_user_id" "uuid", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_brand_by_name_or_alias"("p_user_id" "uuid", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_or_create_brand"("p_user_id" "uuid", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_brand"("p_user_id" "uuid", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_brand"("p_user_id" "uuid", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_potential_duplicates"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_product_by_url"("p_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_product_by_url"("p_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_product_by_url"("p_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_product_by_url"("p_user_id" "uuid", "p_url" "text", "p_source_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_product_by_url"("p_user_id" "uuid", "p_url" "text", "p_source_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_product_by_url"("p_user_id" "uuid", "p_url" "text", "p_source_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_product_with_fuzzy_matching"("p_user_id" "uuid", "p_ean" "text", "p_brand" "text", "p_sku" "text", "p_name" "text", "p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."find_product_with_fuzzy_matching"("p_user_id" "uuid", "p_ean" "text", "p_brand" "text", "p_sku" "text", "p_name" "text", "p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_product_with_fuzzy_matching"("p_user_id" "uuid", "p_ean" "text", "p_brand" "text", "p_sku" "text", "p_name" "text", "p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_user_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_user_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_user_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_aliases"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_aliases"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_aliases"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_analytics"("p_user_id" "uuid", "p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_analytics"("p_user_id" "uuid", "p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_analytics"("p_user_id" "uuid", "p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_market_positioning"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_market_positioning"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_market_positioning"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_performance_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_performance_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_performance_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_price_competitiveness"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_price_competitiveness"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_price_competitiveness"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_price_pressure_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_price_pressure_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_price_pressure_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_price_spread_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_price_spread_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_price_spread_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_products_detail"("p_user_id" "uuid", "p_brand_name" "text", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_products_detail"("p_user_id" "uuid", "p_brand_name" "text", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_products_detail"("p_user_id" "uuid", "p_brand_name" "text", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_products_with_stock"("p_user_id" "uuid", "p_brand" "text", "p_competitor_id" "uuid", "p_stock_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_products_with_stock"("p_user_id" "uuid", "p_brand" "text", "p_competitor_id" "uuid", "p_stock_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_products_with_stock"("p_user_id" "uuid", "p_brand" "text", "p_competitor_id" "uuid", "p_stock_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_statistics_secure"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_statistics_secure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_statistics_secure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_stock_availability"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_stock_availability"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_stock_availability"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brands_for_competitor"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brands_for_competitor"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brands_for_competitor"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brands_without_our_prices"("p_user_id" "uuid", "p_min_products" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_brands_without_our_prices"("p_user_id" "uuid", "p_min_products" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brands_without_our_prices"("p_user_id" "uuid", "p_min_products" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_competitor_names_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_competitor_names_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_competitor_names_for_brand"("p_user_id" "uuid", "p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_competitor_pressure_analysis"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_competitor_pressure_analysis"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_competitor_pressure_analysis"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_competitor_price_analysis"("p_user_id" "uuid", "p_competitor_ids" "uuid"[], "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_competitor_price_analysis"("p_user_id" "uuid", "p_competitor_ids" "uuid"[], "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_competitor_price_analysis"("p_user_id" "uuid", "p_competitor_ids" "uuid"[], "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_competitor_price_change_frequency"("p_user_id" "uuid", "p_days" integer, "p_competitor_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_competitor_price_change_frequency"("p_user_id" "uuid", "p_days" integer, "p_competitor_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_competitor_price_change_frequency"("p_user_id" "uuid", "p_days" integer, "p_competitor_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_competitor_statistics"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_competitor_statistics"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_competitor_statistics"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_comprehensive_analysis_summary"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_comprehensive_analysis_summary"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_comprehensive_analysis_summary"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_summary"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_summary"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_summary"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cron_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_cron_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cron_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cross_docking_friendly_brands"("p_user_id" "uuid", "p_min_products" integer, "p_max_avg_stock" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_cross_docking_friendly_brands"("p_user_id" "uuid", "p_min_products" integer, "p_max_avg_stock" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cross_docking_friendly_brands"("p_user_id" "uuid", "p_min_products" integer, "p_max_avg_stock" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_stock_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_stock_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_stock_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dismissed_product_duplicates"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dismissed_product_duplicates"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dismissed_product_duplicates"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_integration_run_stats"("run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_integration_run_stats"("run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_integration_run_stats"("run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid", "p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid", "p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices"("p_user_id" "uuid", "p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices_batch_filtered"("p_user_id" "uuid", "p_product_ids" "uuid"[], "p_competitor_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices_batch_filtered"("p_user_id" "uuid", "p_product_ids" "uuid"[], "p_competitor_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_prices_batch_filtered"("p_user_id" "uuid", "p_product_ids" "uuid"[], "p_competitor_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid", "p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid", "p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_competitor_stock"("p_user_id" "uuid", "p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_supplier_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_supplier_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_supplier_prices_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_supplier_stock_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_supplier_stock_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_supplier_stock_batch"("p_user_id" "uuid", "p_product_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_market_positioning_overview"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_market_positioning_overview"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_market_positioning_overview"("p_user_id" "uuid", "p_brand_filter" "text", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_unknown_brand"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_unknown_brand"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_unknown_brand"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_user_settings"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_user_settings"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_user_settings"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_price_competitiveness_trends"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_price_competitiveness_trends"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_price_competitiveness_trends"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_competitor_id" "uuid", "p_brand_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_price_range_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_price_range_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_price_range_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_priority_products_for_repricing"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_priority_products_for_repricing"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_priority_products_for_repricing"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_brand_filter" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_processing_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_processing_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_processing_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_price_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_price_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_price_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_stock_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_stock_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_stock_history"("p_user_id" "uuid", "p_product_id" "uuid", "p_source_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_has_price" boolean, "p_not_our_products" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_has_price" boolean, "p_not_our_products" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_count_simple"("p_user_id" "uuid", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_has_price" boolean, "p_not_our_products" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_filtered"("p_user_id" "uuid", "p_page" integer, "p_page_size" integer, "p_sort_by" "text", "p_sort_order" "text", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_competitor_ids" "uuid"[], "p_has_price" boolean, "p_in_stock_only" boolean, "p_price_lower_than_competitors" boolean, "p_price_higher_than_competitors" boolean, "p_not_our_products" boolean, "p_supplier_ids" "uuid"[], "p_our_products_with_competitor_prices" boolean, "p_our_products_with_supplier_prices" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_filtered"("p_user_id" "uuid", "p_page" integer, "p_page_size" integer, "p_sort_by" "text", "p_sort_order" "text", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_competitor_ids" "uuid"[], "p_has_price" boolean, "p_in_stock_only" boolean, "p_price_lower_than_competitors" boolean, "p_price_higher_than_competitors" boolean, "p_not_our_products" boolean, "p_supplier_ids" "uuid"[], "p_our_products_with_competitor_prices" boolean, "p_our_products_with_supplier_prices" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_filtered"("p_user_id" "uuid", "p_page" integer, "p_page_size" integer, "p_sort_by" "text", "p_sort_order" "text", "p_brand" "text", "p_category" "text", "p_search" "text", "p_is_active" boolean, "p_competitor_ids" "uuid"[], "p_has_price" boolean, "p_in_stock_only" boolean, "p_price_lower_than_competitors" boolean, "p_price_higher_than_competitors" boolean, "p_not_our_products" boolean, "p_supplier_ids" "uuid"[], "p_our_products_with_competitor_prices" boolean, "p_our_products_with_supplier_prices" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_analysis_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_brand_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_analysis_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_brand_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_analysis_data"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_brand_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_scheduling_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_scheduling_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_scheduling_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_scraper_run_health"("p_scraper_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_scraper_run_health"("p_scraper_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_scraper_run_health"("p_scraper_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_scraper_run_health"("p_scraper_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_snapshot_statistics"("days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_snapshot_statistics"("days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_snapshot_statistics"("days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_stock_summary_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_stock_summary_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stock_summary_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_stock_turnover_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_dead_stock_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_stock_turnover_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_dead_stock_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stock_turnover_analysis"("p_user_id" "uuid", "p_competitor_id" "uuid", "p_start_date" timestamp without time zone, "p_end_date" timestamp without time zone, "p_dead_stock_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_new_brands"("p_user_id" "uuid", "p_days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_new_brands"("p_user_id" "uuid", "p_days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_new_brands"("p_user_id" "uuid", "p_days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unique_competitor_products"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unique_competitor_products"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unique_competitor_products"("p_user_id" "uuid", "p_competitor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unique_integration_products"("p_user_id" "uuid", "p_integration_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unique_integration_products"("p_user_id" "uuid", "p_integration_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unique_integration_products"("p_user_id" "uuid", "p_integration_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_message_count"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_message_count"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_message_count"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_growth_stats"("period_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_growth_stats"("period_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_growth_stats"("period_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_matching_settings"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_matching_settings"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_matching_settings"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_primary_currency"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_primary_currency"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_primary_currency"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_workload"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_workload"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_workload"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_workload_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_workload_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_workload_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_worker_capacity_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_worker_capacity_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_worker_capacity_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_worker_error"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_worker_error"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_worker_error"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_ean"("ean_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_ean"("ean_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_ean"("ean_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_unhealthy_scrapers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_unhealthy_scrapers"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_unhealthy_scrapers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_unhealthy_scrapers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_messages_read"("conversation_uuid" "uuid", "reader_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_messages_read"("conversation_uuid" "uuid", "reader_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_messages_read"("conversation_uuid" "uuid", "reader_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_integration_price_changes"("source_integration_name" "text", "target_integration_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_integration_price_changes"("source_integration_name" "text", "target_integration_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_integration_price_changes"("source_integration_name" "text", "target_integration_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_product_data"("existing_name" "text", "new_name" "text", "existing_sku" "text", "new_sku" "text", "existing_ean" "text", "new_ean" "text", "existing_brand" "text", "new_brand" "text", "existing_brand_id" "uuid", "new_brand_id" "uuid", "existing_image_url" "text", "new_image_url" "text", "existing_url" "text", "new_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_product_data"("existing_name" "text", "new_name" "text", "existing_sku" "text", "new_sku" "text", "existing_ean" "text", "new_ean" "text", "existing_brand" "text", "new_brand" "text", "existing_brand_id" "uuid", "new_brand_id" "uuid", "existing_image_url" "text", "new_image_url" "text", "existing_url" "text", "new_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_product_data"("existing_name" "text", "new_name" "text", "existing_sku" "text", "new_sku" "text", "existing_ean" "text", "new_ean" "text", "existing_brand" "text", "new_brand" "text", "existing_brand_id" "uuid", "new_brand_id" "uuid", "existing_image_url" "text", "new_image_url" "text", "existing_url" "text", "new_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_products_api"("primary_id" "uuid", "duplicate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_products_api"("primary_id" "uuid", "duplicate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_products_api"("primary_id" "uuid", "duplicate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_sku"("sku" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_sku"("sku" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_sku"("sku" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_sku_for_matching"("input_sku" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_sku_for_matching"("input_sku" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_sku_for_matching"("input_sku" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."optimize_scraper_schedules"() TO "anon";
GRANT ALL ON FUNCTION "public"."optimize_scraper_schedules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."optimize_scraper_schedules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."perform_mv_refresh"("p_view_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."perform_mv_refresh"("p_view_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."perform_mv_refresh"("p_view_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."perform_mv_refresh_background"("p_view_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."perform_mv_refresh_background"("p_view_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."perform_mv_refresh_background"("p_view_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_our_urls_in_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_our_urls_in_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_our_urls_in_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_all_pending_temp_integrations"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_all_pending_temp_integrations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_all_pending_temp_integrations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_all_temp_data"("batch_size" integer, "max_processing_time_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_all_temp_data"("batch_size" integer, "max_processing_time_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_all_temp_data"("batch_size" integer, "max_processing_time_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_custom_fields"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_custom_fields"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_custom_fields"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" "text", "p_source_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" "text", "p_source_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" "text", "p_source_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" character varying, "p_source_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" character varying, "p_source_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_custom_fields_from_raw_data"("p_user_id" "uuid", "p_product_id" "uuid", "p_raw_data" "jsonb", "p_source_type" character varying, "p_source_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_scraper_timeouts"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_scraper_timeouts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_scraper_timeouts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch"("p_competitor_id" "uuid", "batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch"("p_competitor_id" "uuid", "batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch"("p_competitor_id" "uuid", "batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_keep_temp"("p_competitor_id" "uuid", "batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_keep_temp"("p_competitor_id" "uuid", "batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_keep_temp"("p_competitor_id" "uuid", "batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_test"("p_competitor_id" "uuid", "batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_test"("p_competitor_id" "uuid", "batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_test"("p_competitor_id" "uuid", "batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_with_conflict_detection"("p_competitor_id" "uuid", "batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_with_conflict_detection"("p_competitor_id" "uuid", "batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_batch_with_conflict_detection"("p_competitor_id" "uuid", "batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_competitors_scraped_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_scraped_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_scraped_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_competitors_scraped_data_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_scraped_data_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_competitors_scraped_data_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data"() TO "service_role";



GRANT ALL ON TABLE "public"."temp_integrations_scraped_data" TO "anon";
GRANT ALL ON TABLE "public"."temp_integrations_scraped_data" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_integrations_scraped_data" TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data_logic"("record_data" "public"."temp_integrations_scraped_data") TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data_logic"("record_data" "public"."temp_integrations_scraped_data") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data_logic"("record_data" "public"."temp_integrations_scraped_data") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data_manual"("p_record_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data_manual"("p_record_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_integrations_scraped_data_manual"("p_record_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_minimal"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_minimal"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_minimal"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_single_debug"("p_temp_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_single_debug"("p_temp_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_single_debug"("p_temp_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_suppliers_batch"("p_supplier_id" "uuid", "batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_suppliers_batch"("p_supplier_id" "uuid", "batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_suppliers_batch"("p_supplier_id" "uuid", "batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_temp_suppliers_scraped_data_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_temp_suppliers_scraped_data_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_temp_suppliers_scraped_data_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_brand_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_brand_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_brand_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_latest_competitor_prices_mv"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_latest_competitor_prices_mv"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_latest_competitor_prices_mv"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_latest_competitor_prices_mv_with_timeout"("p_timeout_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_latest_competitor_prices_mv_with_timeout"("p_timeout_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_latest_competitor_prices_mv_with_timeout"("p_timeout_ms" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_stuck_mv_refreshes"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_stuck_mv_refreshes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_stuck_mv_refreshes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."retry_error_integration_products"("run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."retry_error_integration_products"("run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."retry_error_integration_products"("run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."retry_fetch_failed_runs"() TO "anon";
GRANT ALL ON FUNCTION "public"."retry_fetch_failed_runs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."retry_fetch_failed_runs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."run_daily_price_snapshots"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_daily_price_snapshots"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_daily_price_snapshots"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_product_brand_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_product_brand_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_product_brand_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_statement_timeout"("p_milliseconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_statement_timeout"("p_milliseconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_statement_timeout"("p_milliseconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."stage_integration_batch"("p_run_id" "uuid", "p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."stage_integration_batch"("p_run_id" "uuid", "p_rows" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."stage_integration_batch"("p_run_id" "uuid", "p_rows" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."standardize_stock_status"("raw_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."standardize_stock_status"("raw_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."standardize_stock_status"("raw_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_custom_field_optimized"("p_product_id" "uuid", "p_custom_field_id" "uuid", "p_field_name" "text", "p_field_value" "text", "p_source_type" "text", "p_source_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."store_custom_field_optimized"("p_product_id" "uuid", "p_custom_field_id" "uuid", "p_field_name" "text", "p_field_value" "text", "p_source_type" "text", "p_source_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_custom_field_optimized"("p_product_id" "uuid", "p_custom_field_id" "uuid", "p_field_name" "text", "p_field_value" "text", "p_source_type" "text", "p_source_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_brand_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_brand_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_brand_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_brand_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_brand_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_brand_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_our_urls_from_products"("p_user_id" "uuid", "p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_our_urls_from_products"("p_user_id" "uuid", "p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_our_urls_from_products"("p_user_id" "uuid", "p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_mv_refresh_async"("p_view_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_mv_refresh_async"("p_view_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_mv_refresh_async"("p_view_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_snapshots_for_date"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_snapshots_for_date"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_snapshots_for_date"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_our_url_on_product_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_our_url_on_product_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_our_url_on_product_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trim_progress_messages"("p_run_id" "uuid", "p_max_messages" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."trim_progress_messages"("p_run_id" "uuid", "p_max_messages" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."trim_progress_messages"("p_run_id" "uuid", "p_max_messages" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."undismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."undismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."undismiss_product_duplicates"("p_user_id" "uuid", "p_product_id_1" "uuid", "p_product_id_2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_api_key_usage"("p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_api_key_usage"("p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_api_key_usage"("p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_snapshots_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_snapshots_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_snapshots_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_next_run_on_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_next_run_on_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_next_run_on_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_next_run_time"("integration_id" "uuid", "completed_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_next_run_time"("integration_id" "uuid", "completed_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_next_run_time"("integration_id" "uuid", "completed_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_progress_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_progress_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_progress_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_run_status"("run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_run_status"("run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_run_status"("run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_sync_timestamps"("p_integration_run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_sync_timestamps"("p_integration_run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_sync_timestamps"("p_integration_run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_match_reviews_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_match_reviews_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_match_reviews_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scheduling_config"("p_max_python_workers" integer, "p_max_typescript_workers" integer, "p_max_integration_workers" integer, "p_max_jobs_per_run" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_scheduling_config"("p_max_python_workers" integer, "p_max_typescript_workers" integer, "p_max_integration_workers" integer, "p_max_jobs_per_run" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scheduling_config"("p_max_python_workers" integer, "p_max_typescript_workers" integer, "p_max_integration_workers" integer, "p_max_jobs_per_run" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scraper_next_run_on_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scraper_next_run_on_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scraper_next_run_on_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scraper_next_run_time"("scraper_id" "uuid", "completed_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_scraper_next_run_time"("scraper_id" "uuid", "completed_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scraper_next_run_time"("scraper_id" "uuid", "completed_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scraper_status_from_run"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scraper_status_from_run"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scraper_status_from_run"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_api_key"("p_api_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_api_key"("p_api_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_api_key"("p_api_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_temp_competitors_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_temp_competitors_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_temp_competitors_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_temp_integrations_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_temp_integrations_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_temp_integrations_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_temp_suppliers_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_temp_suppliers_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_temp_suppliers_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_url"("url_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_url"("url_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_url"("url_text" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_communication_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_communication_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_communication_log" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."brand_aliases" TO "anon";
GRANT ALL ON TABLE "public"."brand_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."price_changes_competitors" TO "anon";
GRANT ALL ON TABLE "public"."price_changes_competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."price_changes_competitors" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."brand_statistics_mv" TO "service_role";



GRANT ALL ON TABLE "public"."brand_statistics" TO "anon";
GRANT ALL ON TABLE "public"."brand_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."competitors" TO "anon";
GRANT ALL ON TABLE "public"."competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."competitors" TO "service_role";



GRANT ALL ON TABLE "public"."cron_job_logs" TO "anon";
GRANT ALL ON TABLE "public"."cron_job_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."cron_job_logs" TO "service_role";



GRANT ALL ON TABLE "public"."csv_uploads" TO "anon";
GRANT ALL ON TABLE "public"."csv_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."csv_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."daily_price_competitiveness_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."daily_price_competitiveness_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_price_competitiveness_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."debug_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dismissed_duplicates" TO "anon";
GRANT ALL ON TABLE "public"."dismissed_duplicates" TO "authenticated";
GRANT ALL ON TABLE "public"."dismissed_duplicates" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."stock_changes_competitors" TO "anon";
GRANT ALL ON TABLE "public"."stock_changes_competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_changes_competitors" TO "service_role";



GRANT ALL ON TABLE "public"."latest_product_data_mv" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_contacts" TO "anon";
GRANT ALL ON TABLE "public"."marketing_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."mv_refresh_status" TO "anon";
GRANT ALL ON TABLE "public"."mv_refresh_status" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_refresh_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mv_refresh_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mv_refresh_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mv_refresh_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."operational_report_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."operational_report_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."operational_report_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."price_changes_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."price_changes_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."price_changes_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."product_custom_field_values" TO "anon";
GRANT ALL ON TABLE "public"."product_custom_field_values" TO "authenticated";
GRANT ALL ON TABLE "public"."product_custom_field_values" TO "service_role";



GRANT ALL ON TABLE "public"."product_custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."product_custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."product_custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."products_dismissed_duplicates" TO "anon";
GRANT ALL ON TABLE "public"."products_dismissed_duplicates" TO "authenticated";
GRANT ALL ON TABLE "public"."products_dismissed_duplicates" TO "service_role";



GRANT ALL ON TABLE "public"."professional_scraper_requests" TO "anon";
GRANT ALL ON TABLE "public"."professional_scraper_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_scraper_requests" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_log" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "service_role";



GRANT ALL ON TABLE "public"."scraper_ai_sessions" TO "anon";
GRANT ALL ON TABLE "public"."scraper_ai_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."scraper_ai_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."scraper_run_rejections" TO "anon";
GRANT ALL ON TABLE "public"."scraper_run_rejections" TO "authenticated";
GRANT ALL ON TABLE "public"."scraper_run_rejections" TO "service_role";



GRANT ALL ON TABLE "public"."scraper_run_timeouts" TO "anon";
GRANT ALL ON TABLE "public"."scraper_run_timeouts" TO "authenticated";
GRANT ALL ON TABLE "public"."scraper_run_timeouts" TO "service_role";



GRANT ALL ON TABLE "public"."scraper_runs" TO "anon";
GRANT ALL ON TABLE "public"."scraper_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."scraper_runs" TO "service_role";



GRANT ALL ON TABLE "public"."scrapers" TO "anon";
GRANT ALL ON TABLE "public"."scrapers" TO "authenticated";
GRANT ALL ON TABLE "public"."scrapers" TO "service_role";



GRANT ALL ON TABLE "public"."stock_changes_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."stock_changes_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_changes_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."support_conversations" TO "anon";
GRANT ALL ON TABLE "public"."support_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."support_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."temp_competitors_scraped_data" TO "anon";
GRANT ALL ON TABLE "public"."temp_competitors_scraped_data" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_competitors_scraped_data" TO "service_role";



GRANT ALL ON TABLE "public"."temp_suppliers_scraped_data" TO "anon";
GRANT ALL ON TABLE "public"."temp_suppliers_scraped_data" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_suppliers_scraped_data" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







