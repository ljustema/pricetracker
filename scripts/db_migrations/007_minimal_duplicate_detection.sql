-- Minimal duplicate detection for ultra-large datasets
-- This completely bypasses expensive operations and only finds the most obvious duplicates

-- Create a minimal duplicate detection function that avoids ALL expensive operations
CREATE OR REPLACE FUNCTION public.find_potential_duplicates(
    p_user_id uuid,
    p_limit integer DEFAULT 25
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
    -- Only find EAN duplicates - the fastest possible duplicate detection
    -- Skip all user settings checks and other expensive operations
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
    ORDER BY p.ean  -- Ensure consistent ordering
    LIMIT COALESCE(p_limit, 25);
END;
$$;

-- Create a separate function for brand+SKU duplicates if needed
CREATE OR REPLACE FUNCTION public.find_brand_sku_duplicates(
    p_user_id uuid,
    p_limit integer DEFAULT 25
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
    -- Only find brand+SKU duplicates
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
    ORDER BY p.brand_id, p.sku  -- Ensure consistent ordering
    LIMIT COALESCE(p_limit, 25);
END;
$$;

COMMENT ON FUNCTION find_potential_duplicates(uuid, integer) IS 'Minimal duplicate detection - only finds EAN duplicates for ultra-fast performance';
COMMENT ON FUNCTION find_brand_sku_duplicates(uuid, integer) IS 'Brand+SKU duplicate detection as separate function for better performance control';
