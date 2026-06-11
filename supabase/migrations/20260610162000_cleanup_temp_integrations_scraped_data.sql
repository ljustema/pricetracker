-- Ensure integration staging rows do not accumulate after they have been processed.
-- The per-run cleanup can be expensive for large feeds, so run it as SECURITY DEFINER
-- with a longer statement timeout and add a batched cron fallback.

CREATE OR REPLACE FUNCTION public.cleanup_removed_integration_products(p_integration_run_id uuid)
RETURNS TABLE(cleaned_count integer, cleaned_product_ids uuid[], deleted_temp_records integer, updated_timestamps integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_temp_integrations_scraped_data(
  p_older_than interval DEFAULT interval '1 day',
  p_batch_size integer DEFAULT 50000,
  p_max_batches integer DEFAULT 10
)
RETURNS TABLE(rows_deleted bigint, batches_run integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.cleanup_removed_integration_products(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_temp_integrations_scraped_data(interval, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_temp_integrations_scraped_data(interval, integer, integer) TO postgres;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-temp-integrations-scraped-data'
  ) THEN
    PERFORM cron.unschedule('cleanup-temp-integrations-scraped-data');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-temp-integrations-scraped-data',
  '17 * * * *',
  $$SELECT * FROM public.cleanup_temp_integrations_scraped_data(interval '1 day', 50000, 10);$$
);
