-- Avoid processing the same product identity multiple times within one
-- integration run. EAN is the primary identity; SKU+brand is used when EAN is
-- missing. Rows without either identity are still passed through for validation.

CREATE OR REPLACE FUNCTION public.stage_integration_batch(p_run_id uuid, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.stage_integration_batch(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stage_integration_batch(uuid, jsonb) TO service_role;
