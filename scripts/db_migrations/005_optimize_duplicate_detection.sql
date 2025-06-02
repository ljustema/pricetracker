-- Migration to optimize duplicate detection function
-- This addresses the timeout issue with find_potential_duplicates

-- Create a function to set statement timeout
CREATE OR REPLACE FUNCTION public.set_statement_timeout(p_milliseconds integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('SET statement_timeout = %s', p_milliseconds);
END;
$$;

-- Create index to speed up fuzzy name matching
CREATE INDEX IF NOT EXISTS idx_products_name_length ON products (user_id, length(name));
CREATE INDEX IF NOT EXISTS idx_products_brand_id_name ON products (user_id, brand_id, name);

-- Optimize the find_potential_duplicates function
CREATE OR REPLACE FUNCTION public.find_potential_duplicates(
    p_user_id uuid,
    p_limit integer DEFAULT 200
)
RETURNS TABLE(
    group_id text,
    product_id uuid,
    name text,
    sku text,
    ean text,
    brand text,
    brand_id uuid,
    match_reason text
)
LANGUAGE plpgsql
AS $$
DECLARE
    settings JSONB;
    similarity_threshold INTEGER;
    results_count INTEGER := 0;
    max_results INTEGER := COALESCE(p_limit, 200);
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
            )
        LIMIT max_results;
        
        -- Update count of returned results
        GET DIAGNOSTICS results_count = ROW_COUNT;
        
        -- If we've reached the limit, return early
        IF results_count >= max_results THEN
            RETURN;
        END IF;
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
            )
        LIMIT (max_results - results_count);
        
        -- Update count of returned results
        GET DIAGNOSTICS results_count = results_count + ROW_COUNT;
        
        -- If we've reached the limit, return early
        IF results_count >= max_results THEN
            RETURN;
        END IF;

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
            )
        LIMIT (max_results - results_count);
        
        -- Update count of returned results
        GET DIAGNOSTICS results_count = results_count + ROW_COUNT;
        
        -- If we've reached the limit, return early
        IF results_count >= max_results THEN
            RETURN;
        END IF;
    END IF;

    -- 4. Products with similar names (if fuzzy name matching enabled)
    -- This is the most expensive operation, so we optimize it:
    -- 1. Only compare products within the same brand
    -- 2. Pre-filter by name length (names with very different lengths can't be similar)
    -- 3. Limit the number of products we process
    IF (settings->>'fuzzy_name_matching')::BOOLEAN = true THEN
        RETURN QUERY
        WITH product_candidates AS (
            SELECT p.id, p.name, p.brand_id, length(p.name) as name_length
            FROM products p
            WHERE p.user_id = p_user_id
              AND p.name IS NOT NULL 
              AND p.name != ''
              AND p.brand_id IS NOT NULL
            LIMIT 1000  -- Limit the initial set to avoid excessive comparisons
        )
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
        JOIN product_candidates p_c ON p.id = p_c.id
        JOIN product_candidates p2_c ON 
            p2_c.brand_id = p_c.brand_id AND 
            p2_c.id != p_c.id AND
            -- Only compare products with similar name lengths (within 30%)
            ABS(p2_c.name_length - p_c.name_length) <= p_c.name_length * 0.3
        JOIN products p2 ON p2.id = p2_c.id
        WHERE
            -- High similarity threshold for name matching
            (100 - (levenshtein(LOWER(p.name), LOWER(p2.name)) * 100.0 / GREATEST(LENGTH(p.name), LENGTH(p2.name)))) >= similarity_threshold
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id
                AND ((pdd.product_id_1 = p.id AND pdd.product_id_2 = p2.id)
                  OR (pdd.product_id_1 = p2.id AND pdd.product_id_2 = p.id))
            )
        LIMIT (max_results - results_count);
    END IF;

    RETURN;
END;
$$;

COMMENT ON FUNCTION find_potential_duplicates(uuid, integer) IS 'Optimized duplicate detection with performance improvements and pagination support';
