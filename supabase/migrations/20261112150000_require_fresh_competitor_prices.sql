-- Price freshness is independent of price-change history. No historical
-- rows are marked fresh at installation: only a new successful observation counts.
BEGIN;
CREATE TABLE public.competitor_price_observations (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL CHECK (price > 0),
  verified_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, product_id, competitor_id)
);
ALTER TABLE public.competitor_price_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitor_observations_owner ON public.competitor_price_observations
  FOR SELECT USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.competitor_price_observations TO authenticated;
GRANT ALL ON public.competitor_price_observations TO service_role;

CREATE FUNCTION public.record_competitor_price_observation(
  p_user_id uuid, p_product_id uuid, p_competitor_id uuid,
  p_price numeric, p_verified_at timestamptz
) RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO public.competitor_price_observations AS existing
    (user_id, product_id, competitor_id, price, verified_at)
  SELECT p_user_id, p_product_id, p_competitor_id, p_price, p_verified_at
  WHERE p_price > 0 AND p_verified_at <= statement_timestamp()
    AND p_verified_at IS NOT NULL
  ON CONFLICT (user_id, product_id, competitor_id) DO UPDATE
    SET price = EXCLUDED.price, verified_at = EXCLUDED.verified_at
    WHERE EXCLUDED.verified_at > existing.verified_at;
$$;
REVOKE ALL ON FUNCTION public.record_competitor_price_observation(uuid,uuid,uuid,numeric,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_competitor_price_observation(uuid,uuid,uuid,numeric,timestamptz) TO service_role;

-- Preserve the installed processors, including any newer matching/conflict
-- logic. Patch only the unique price-change condition in each supported path.
-- Fail atomically if that anchor has changed rather than replacing an unknown
-- production function with a historical snapshot.
DO $patch$
DECLARE
  processor text;
  definition text;
  anchor constant text := 'IF current_competitor_price IS NULL OR ABS(current_competitor_price - temp_record.competitor_price) > 0.01 THEN';
  observation_call constant text := 'PERFORM public.record_competitor_price_observation(
                temp_record.user_id, matched_product_id, temp_record.competitor_id,
                temp_record.competitor_price, temp_record.scraped_at
            );

            ';
BEGIN
  FOREACH processor IN ARRAY ARRAY[
    'public.process_temp_competitors_batch(uuid,integer)',
    'public.process_temp_competitors_batch_keep_temp(uuid,integer)',
    'public.process_temp_competitors_batch_with_conflict_detection(uuid,integer)'
  ] LOOP
    definition := pg_get_functiondef(processor::regprocedure);
    IF (length(definition) - length(replace(definition, anchor, ''))) <> length(anchor)
       OR position('record_competitor_price_observation' IN definition) > 0 THEN
      RAISE EXCEPTION 'Unexpected processor definition: %. Review before applying freshness migration.', processor;
    END IF;
    -- The observation is written for unchanged prices too, and rolls back with
    -- the row if later processing fails. Delayed jobs retain acquisition time.
    EXECUTE replace(definition, anchor, observation_call || anchor);
  END LOOP;
END;
$patch$;

-- Read current verified prices directly so a materialized-view refresh
-- cannot keep an expired competitor in the export or hide a fresh observation.
CREATE FUNCTION public.get_fresh_price_matching_export(
  p_user_id uuid, p_competitor_id uuid DEFAULT NULL,
  p_brand_filter text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0, p_mode text DEFAULT 'priority'
) RETURNS TABLE(
  product_id uuid, product_name text, product_sku text, product_brand text,
  product_ean text, our_price numeric, lowest_competitor_price numeric,
  price_difference numeric, price_difference_percentage numeric,
  potential_savings numeric, competitor_count integer,
  most_competitive_competitor_name text, competitor_price_verified_at timestamptz
) LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH fresh AS (
    SELECT o.*, c.name AS competitor_name,
      count(*) OVER (PARTITION BY o.product_id) AS competitors,
      row_number() OVER (PARTITION BY o.product_id
        ORDER BY o.price, o.verified_at DESC, o.competitor_id) AS position
    FROM public.competitor_price_observations o
    JOIN public.competitors c ON c.id = o.competitor_id AND c.user_id = o.user_id
    WHERE o.user_id = p_user_id
      AND o.verified_at >= statement_timestamp() - interval '72 hours'
      AND o.verified_at <= statement_timestamp()
      AND (p_competitor_id IS NULL OR o.competitor_id = p_competitor_id)
  )
  SELECT p.id, p.name, p.sku, b.name, p.ean,
    round(p.our_retail_price, 2), round(f.price, 2),
    round(p.our_retail_price - f.price, 2),
    round((p.our_retail_price - f.price) / NULLIF(p.our_retail_price, 0) * 100, 2),
    greatest(round(p.our_retail_price - f.price, 2), 0),
    f.competitors::integer, COALESCE(f.competitor_name, 'Unknown'), f.verified_at
  FROM fresh f
  JOIN public.products p ON p.id = f.product_id AND p.user_id = f.user_id
  LEFT JOIN public.brands b ON b.id = p.brand_id
  WHERE f.position = 1 AND p.is_active = true AND p.our_retail_price IS NOT NULL
    AND (p_brand_filter IS NULL OR b.name ILIKE '%' || p_brand_filter || '%')
    AND (p_mode = 'coverage' OR (p_mode = 'priority' AND p.our_retail_price > f.price))
  ORDER BY CASE WHEN p.our_retail_price > f.price THEN 0 ELSE 1 END,
    abs(p.our_retail_price - f.price) DESC, p.id
  LIMIT p_limit OFFSET p_offset;
$$;
REVOKE ALL ON FUNCTION public.get_fresh_price_matching_export(uuid,uuid,text,integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fresh_price_matching_export(uuid,uuid,text,integer,integer,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION "public"."get_priority_products_for_repricing"("p_user_id" "uuid", "p_competitor_id" "uuid" DEFAULT NULL::"uuid", "p_brand_filter" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "product_name" "text", "product_sku" "text", "product_brand" "text", "product_ean" "text", "our_price" numeric, "lowest_competitor_price" numeric, "price_difference" numeric, "price_difference_percentage" numeric, "potential_savings" numeric, "competitor_count" integer, "most_competitive_competitor_name" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY SELECT f.product_id, f.product_name, f.product_sku, f.product_brand,
    f.product_ean, f.our_price, f.lowest_competitor_price, f.price_difference,
    f.price_difference_percentage, f.potential_savings, f.competitor_count,
    f.most_competitive_competitor_name
  FROM public.get_fresh_price_matching_export(
    p_user_id,p_competitor_id,p_brand_filter,p_limit,p_offset,'priority') f;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_price_matching_coverage_export(
  p_user_id uuid,
  p_competitor_id uuid DEFAULT NULL::uuid,
  p_brand_filter text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  product_sku text,
  product_brand text,
  product_ean text,
  our_price numeric,
  lowest_competitor_price numeric,
  price_difference numeric,
  price_difference_percentage numeric,
  potential_savings numeric,
  competitor_count integer,
  most_competitive_competitor_name text
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY SELECT f.product_id, f.product_name, f.product_sku, f.product_brand,
    f.product_ean, f.our_price, f.lowest_competitor_price, f.price_difference,
    f.price_difference_percentage, f.potential_savings, f.competitor_count,
    f.most_competitive_competitor_name
  FROM public.get_fresh_price_matching_export(
    p_user_id,p_competitor_id,p_brand_filter,p_limit,p_offset,'coverage') f;
END;
$$;

COMMIT;
