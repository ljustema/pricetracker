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
  RETURN QUERY
  WITH competitor_price_data AS (
    SELECT
      mv.id AS product_id,
      mv.name AS product_name,
      mv.sku AS product_sku,
      mv.brand_name AS product_brand,
      mv.ean AS product_ean,
      mv.our_retail_price,
      elem->>'competitor_id' AS comp_id_text,
      (elem->>'new_competitor_price')::numeric AS comp_price,
      elem->>'competitor_name' AS comp_name
    FROM latest_product_data_mv mv,
         jsonb_array_elements(mv.competitor_prices::jsonb) AS elem
    WHERE mv.user_id = p_user_id
      AND mv.our_retail_price IS NOT NULL
      AND mv.is_active = true
      AND mv.competitor_count > 0
      AND (p_brand_filter IS NULL OR mv.brand_name ILIKE '%' || p_brand_filter || '%')
      AND (p_competitor_id IS NULL OR (elem->>'competitor_id')::uuid = p_competitor_id)
  ),
  product_analysis AS (
    SELECT
      cpd.product_id,
      cpd.product_name,
      cpd.product_sku,
      cpd.product_brand,
      cpd.product_ean,
      cpd.our_retail_price,
      MIN(cpd.comp_price) AS min_competitor_price,
      COUNT(DISTINCT cpd.comp_id_text::uuid) AS competitor_count,
      (ARRAY_AGG(cpd.comp_name ORDER BY cpd.comp_price ASC))[1] AS lowest_price_competitor
    FROM competitor_price_data cpd
    GROUP BY
      cpd.product_id,
      cpd.product_name,
      cpd.product_sku,
      cpd.product_brand,
      cpd.product_ean,
      cpd.our_retail_price
  )
  SELECT
    pa.product_id,
    pa.product_name,
    pa.product_sku,
    pa.product_brand,
    pa.product_ean,
    ROUND(pa.our_retail_price, 2) AS our_price,
    ROUND(pa.min_competitor_price, 2) AS lowest_competitor_price,
    ROUND(pa.our_retail_price - pa.min_competitor_price, 2) AS price_difference,
    ROUND(((pa.our_retail_price - pa.min_competitor_price) / pa.our_retail_price * 100), 2) AS price_difference_percentage,
    GREATEST(ROUND(pa.our_retail_price - pa.min_competitor_price, 2), 0) AS potential_savings,
    pa.competitor_count::integer,
    COALESCE(pa.lowest_price_competitor, 'Unknown') AS most_competitive_competitor_name
  FROM product_analysis pa
  WHERE pa.min_competitor_price > 0
  ORDER BY
    CASE WHEN pa.our_retail_price > pa.min_competitor_price THEN 0 ELSE 1 END,
    ABS(pa.our_retail_price - pa.min_competitor_price) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT ALL ON FUNCTION public.get_price_matching_coverage_export(uuid, uuid, text, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.get_price_matching_coverage_export(uuid, uuid, text, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_price_matching_coverage_export(uuid, uuid, text, integer, integer) TO service_role;
