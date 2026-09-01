CREATE OR REPLACE FUNCTION public.cleanup_user_data(
  p_user_id uuid,
  p_older_than_days integer,
  p_include_products boolean DEFAULT false,
  p_include_price_changes boolean DEFAULT false,
  p_include_temp_competitors_scraped_data boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => p_older_than_days);
  v_counts jsonb := '{}'::jsonb;
  v_deleted integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_older_than_days < 1 OR p_older_than_days > 365 THEN
    RAISE EXCEPTION 'p_older_than_days must be between 1 and 365';
  END IF;

  CREATE TEMP TABLE cleanup_products_to_delete(
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  IF p_include_products THEN
    INSERT INTO cleanup_products_to_delete(id)
    SELECT id
    FROM public.products
    WHERE user_id = p_user_id
      AND created_at < v_cutoff
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_include_temp_competitors_scraped_data THEN
    DELETE FROM public.temp_competitors_scraped_data
    WHERE user_id = p_user_id
      AND scraped_at < v_cutoff;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{temp_competitors_scraped_data}', to_jsonb(v_deleted), true);
  ELSE
    v_counts := jsonb_set(v_counts, '{temp_competitors_scraped_data}', '0'::jsonb, true);
  END IF;

  IF p_include_products THEN
    DELETE FROM public.temp_competitors_scraped_data t
    USING cleanup_products_to_delete p
    WHERE t.product_id = p.id;

    DELETE FROM public.product_custom_field_values v
    USING cleanup_products_to_delete p
    WHERE v.product_id = p.id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{product_custom_field_values}', to_jsonb(v_deleted), true);

    DELETE FROM public.products_dismissed_duplicates d
    USING cleanup_products_to_delete p
    WHERE d.product_id_1 = p.id
       OR d.product_id_2 = p.id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{products_dismissed_duplicates}', to_jsonb(v_deleted), true);
  ELSE
    v_counts := jsonb_set(v_counts, '{product_custom_field_values}', '0'::jsonb, true);
    v_counts := jsonb_set(v_counts, '{products_dismissed_duplicates}', '0'::jsonb, true);
  END IF;

  IF p_include_price_changes THEN
    DELETE FROM public.price_changes_competitors
    WHERE user_id = p_user_id
      AND changed_at < v_cutoff;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{price_changes_competitors}', to_jsonb(v_deleted), true);

    DELETE FROM public.price_changes_suppliers
    WHERE user_id = p_user_id
      AND changed_at < v_cutoff;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{price_changes_suppliers}', to_jsonb(v_deleted), true);
  ELSE
    v_counts := jsonb_set(v_counts, '{price_changes_competitors}', '0'::jsonb, true);
    v_counts := jsonb_set(v_counts, '{price_changes_suppliers}', '0'::jsonb, true);
  END IF;

  IF p_include_products THEN
    DELETE FROM public.price_changes_competitors c
    USING cleanup_products_to_delete p
    WHERE c.product_id = p.id;

    DELETE FROM public.price_changes_suppliers s
    USING cleanup_products_to_delete p
    WHERE s.product_id = p.id;

    DELETE FROM public.stock_changes_competitors c
    USING cleanup_products_to_delete p
    WHERE c.product_id = p.id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{stock_changes_competitors}', to_jsonb(v_deleted), true);

    DELETE FROM public.stock_changes_suppliers s
    USING cleanup_products_to_delete p
    WHERE s.product_id = p.id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{stock_changes_suppliers}', to_jsonb(v_deleted), true);

    DELETE FROM public.products pr
    USING cleanup_products_to_delete p
    WHERE pr.id = p.id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{products}', to_jsonb(v_deleted), true);

    DELETE FROM public.brands b
    WHERE b.user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.products pr
        WHERE pr.brand_id = b.id
      );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_counts := jsonb_set(v_counts, '{brands}', to_jsonb(v_deleted), true);
  ELSE
    v_counts := jsonb_set(v_counts, '{stock_changes_competitors}', '0'::jsonb, true);
    v_counts := jsonb_set(v_counts, '{stock_changes_suppliers}', '0'::jsonb, true);
    v_counts := jsonb_set(v_counts, '{products}', '0'::jsonb, true);
    v_counts := jsonb_set(v_counts, '{brands}', '0'::jsonb, true);
  END IF;

  RETURN v_counts || jsonb_build_object(
    'total',
    (
      SELECT COALESCE(sum(value::integer), 0)
      FROM jsonb_each_text(v_counts)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_user_data(uuid, integer, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_user_data(uuid, integer, boolean, boolean, boolean) TO service_role;
