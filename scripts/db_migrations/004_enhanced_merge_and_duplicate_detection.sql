-- Migration: Enhanced merge function and duplicate detection
-- Date: 2025-01-27
-- Phase: 1C - Stage 2 Merge Fixes

-- Fixed merge_products_api function - remove temp table updates
CREATE OR REPLACE FUNCTION public.merge_products_api(primary_id uuid, duplicate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    primary_record RECORD;
    duplicate_record RECORD;
    result JSONB;
    price_changes_count INT := 0;
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
        our_price = COALESCE(primary_record.our_price, duplicate_record.our_price),
        wholesale_price = COALESCE(primary_record.wholesale_price, duplicate_record.wholesale_price),
        currency_code = COALESCE(primary_record.currency_code, duplicate_record.currency_code),
        url = CASE
            WHEN duplicate_record.url IS NOT NULL AND LENGTH(TRIM(duplicate_record.url)) > 0
            THEN duplicate_record.url
            ELSE primary_record.url
        END,
        updated_at = NOW()
    WHERE id = primary_id;

    -- Update references in price_changes table and count affected rows
    UPDATE price_changes
    SET product_id = primary_id
    WHERE product_id = duplicate_id;

    GET DIAGNOSTICS price_changes_count = ROW_COUNT;

    -- Check if there are any remaining references to the duplicate product
    -- REMOVED: temp table checks (they are temporary and get deleted)
    SELECT EXISTS (
        SELECT 1 FROM price_changes WHERE product_id = duplicate_id
        LIMIT 1
    ) INTO remaining_refs;

    IF remaining_refs THEN
        -- There are still references to the duplicate product
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cannot delete product: still referenced in price_changes table',
            'primary_id', primary_id,
            'duplicate_id', duplicate_id,
            'stats', jsonb_build_object(
                'price_changes_updated', price_changes_count
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
                'price_changes_updated', price_changes_count
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
                'price_changes_updated', price_changes_count
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

-- Enhanced find_potential_duplicates function with fuzzy matching and user settings
CREATE OR REPLACE FUNCTION public.find_potential_duplicates(p_user_id uuid)
RETURNS TABLE(group_id text, product_id uuid, name text, sku text, ean text, brand text, brand_id uuid, match_reason text)
LANGUAGE plpgsql
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

-- Function to dismiss product duplicates (copy from brand pattern)
CREATE OR REPLACE FUNCTION public.dismiss_product_duplicates(
    p_user_id UUID,
    p_product_id_1 UUID,
    p_product_id_2 UUID
) RETURNS JSONB
LANGUAGE plpgsql
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

-- Function to get dismissed product duplicates
CREATE OR REPLACE FUNCTION public.get_dismissed_product_duplicates(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    product_id_1 UUID,
    product_id_2 UUID,
    product_name_1 TEXT,
    product_name_2 TEXT,
    dismissal_key TEXT,
    dismissed_at TIMESTAMP
)
LANGUAGE plpgsql
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

-- Function to undismiss product duplicates
CREATE OR REPLACE FUNCTION public.undismiss_product_duplicates(
    p_user_id UUID,
    p_product_id_1 UUID,
    p_product_id_2 UUID
) RETURNS JSONB
LANGUAGE plpgsql
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

COMMENT ON FUNCTION merge_products_api(uuid, uuid) IS 'Enhanced product merging with intelligent data selection and no temp table updates';
COMMENT ON FUNCTION find_potential_duplicates(uuid) IS 'Enhanced duplicate detection with user settings support, fuzzy matching, and dismissed duplicates exclusion';
COMMENT ON FUNCTION dismiss_product_duplicates(uuid, uuid, uuid) IS 'Dismisses product duplicates to prevent them from appearing in future duplicate detection';
COMMENT ON FUNCTION get_dismissed_product_duplicates(uuid) IS 'Gets all dismissed product duplicates for a user';
COMMENT ON FUNCTION undismiss_product_duplicates(uuid, uuid, uuid) IS 'Undismisses product duplicates to allow them to appear in duplicate detection again';
