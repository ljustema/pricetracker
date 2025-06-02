-- Ultra-fast duplicate detection for large datasets
-- This addresses timeout issues with 50k+ products by using aggressive optimizations

-- Create indexes for ultra-fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_products_ean_nonempty ON products (user_id, ean) WHERE ean IS NOT NULL AND ean != '';
CREATE INDEX IF NOT EXISTS idx_products_brand_sku ON products (user_id, brand_id, sku) WHERE brand_id IS NOT NULL AND sku IS NOT NULL AND sku != '';

-- Create a lightning-fast duplicate detection function that only finds the most obvious duplicates
CREATE OR REPLACE FUNCTION public.find_potential_duplicates_fast(
    p_user_id uuid,
    p_limit integer DEFAULT 50
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
    remaining_limit INTEGER;
BEGIN
    -- Get user matching settings
    settings := get_user_matching_settings(p_user_id);
    remaining_limit := COALESCE(p_limit, 50);

    -- Only find the most obvious duplicates to avoid timeouts
    
    -- 1. Products with same EAN (if EAN priority enabled) - FASTEST
    IF (settings->>'ean_priority')::BOOLEAN = true AND remaining_limit > 0 THEN
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
                LIMIT 1  -- Early exit optimization
            )
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id
                AND (pdd.product_id_1 = p.id OR pdd.product_id_2 = p.id)
                LIMIT 1  -- Early exit optimization
            )
        ORDER BY p.ean  -- Ensure consistent ordering
        LIMIT remaining_limit;
        
        -- Update remaining limit
        GET DIAGNOSTICS remaining_limit = ROW_COUNT;
        remaining_limit := COALESCE(p_limit, 50) - remaining_limit;
    END IF;

    -- 2. Products with same brand+SKU (if SKU+brand fallback enabled) - FAST
    IF (settings->>'sku_brand_fallback')::BOOLEAN = true AND remaining_limit > 0 THEN
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
                LIMIT 1  -- Early exit optimization
            )
            -- Exclude dismissed duplicates
            AND NOT EXISTS (
                SELECT 1 FROM products_dismissed_duplicates pdd
                WHERE pdd.user_id = p_user_id
                AND (pdd.product_id_1 = p.id OR pdd.product_id_2 = p.id)
                LIMIT 1  -- Early exit optimization
            )
        ORDER BY p.brand_id, p.sku  -- Ensure consistent ordering
        LIMIT remaining_limit;
    END IF;

    -- Skip fuzzy matching entirely for large datasets to avoid timeouts
    -- Users can run a separate "deep scan" if needed
END;
$$;

-- Replace the original function with the fast version
CREATE OR REPLACE FUNCTION public.find_potential_duplicates(
    p_user_id uuid,
    p_limit integer DEFAULT 50
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
BEGIN
    -- For large datasets, use the ultra-fast version
    -- Check if user has more than 10,000 products
    IF (SELECT COUNT(*) FROM products WHERE user_id = p_user_id) > 10000 THEN
        RETURN QUERY SELECT * FROM find_potential_duplicates_fast(p_user_id, p_limit);
    ELSE
        -- For smaller datasets, use the original optimized version
        RETURN QUERY SELECT * FROM find_potential_duplicates_optimized(p_user_id, p_limit);
    END IF;
END;
$$;

-- Rename the original optimized function
CREATE OR REPLACE FUNCTION public.find_potential_duplicates_optimized(
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
    remaining_limit INTEGER;
    temp_count INTEGER;
BEGIN
    -- Get user matching settings
    settings := get_user_matching_settings(p_user_id);
    similarity_threshold := COALESCE((settings->>'min_similarity_score')::INTEGER, 80);
    remaining_limit := COALESCE(p_limit, 200);

    -- Create a temporary table to store results
    CREATE TEMP TABLE IF NOT EXISTS temp_duplicates (
        group_id text,
        product_id uuid,
        name text,
        sku text,
        ean text,
        brand text,
        brand_id uuid,
        match_reason text
    ) ON COMMIT DROP;
    
    -- Clear any existing data (temp table is created fresh each time, but just to be safe)
    TRUNCATE temp_duplicates;

    -- 1. Products with same EAN (if EAN priority enabled)
    IF (settings->>'ean_priority')::BOOLEAN = true AND remaining_limit > 0 THEN
        INSERT INTO temp_duplicates
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
        LIMIT remaining_limit;
        
        -- Get count of inserted rows
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        remaining_limit := remaining_limit - temp_count;
    END IF;

    -- 2. Products with same brand+SKU (if SKU+brand fallback enabled)
    IF (settings->>'sku_brand_fallback')::BOOLEAN = true AND remaining_limit > 0 THEN
        INSERT INTO temp_duplicates
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
        LIMIT remaining_limit;
        
        -- Get count of inserted rows
        GET DIAGNOSTICS temp_count = ROW_COUNT;
        remaining_limit := remaining_limit - temp_count;

        -- 3. Products with same brand+normalized SKU (fuzzy SKU matching) - Only for smaller datasets
        IF remaining_limit > 0 AND (SELECT COUNT(*) FROM products WHERE user_id = p_user_id) < 5000 THEN
            INSERT INTO temp_duplicates
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
            LIMIT remaining_limit;
            
            -- Get count of inserted rows
            GET DIAGNOSTICS temp_count = ROW_COUNT;
            remaining_limit := remaining_limit - temp_count;
        END IF;
    END IF;

    -- Skip fuzzy name matching for large datasets to avoid timeouts
    -- Only enable for very small datasets
    IF (settings->>'fuzzy_name_matching')::BOOLEAN = true AND remaining_limit > 0 
       AND (SELECT COUNT(*) FROM products WHERE user_id = p_user_id) < 1000 THEN
        INSERT INTO temp_duplicates
        WITH product_candidates AS (
            SELECT p.id, p.name, p.brand_id, length(p.name) as name_length
            FROM products p
            WHERE p.user_id = p_user_id
              AND p.name IS NOT NULL 
              AND p.name != ''
              AND p.brand_id IS NOT NULL
            LIMIT 500  -- Very limited for performance
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
        LIMIT remaining_limit;
    END IF;

    -- Return all results from the temp table
    RETURN QUERY SELECT * FROM temp_duplicates;
END;
$$;

COMMENT ON FUNCTION find_potential_duplicates(uuid, integer) IS 'Adaptive duplicate detection that uses fast mode for large datasets and full mode for smaller ones';
COMMENT ON FUNCTION find_potential_duplicates_fast(uuid, integer) IS 'Ultra-fast duplicate detection for large datasets - only finds obvious duplicates';
COMMENT ON FUNCTION find_potential_duplicates_optimized(uuid, integer) IS 'Full-featured duplicate detection for smaller datasets';
