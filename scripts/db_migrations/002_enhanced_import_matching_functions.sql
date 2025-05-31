-- Migration: Enhanced import matching functions with user settings support
-- Date: 2025-01-27
-- Phase: 1B - Stage 1 Import Fixes

-- Helper function to get user matching settings
CREATE OR REPLACE FUNCTION get_user_matching_settings(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
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

-- Enhanced function to find product with fuzzy matching
CREATE OR REPLACE FUNCTION find_product_with_fuzzy_matching(
    p_user_id UUID,
    p_ean TEXT,
    p_brand TEXT,
    p_sku TEXT,
    p_name TEXT,
    p_brand_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
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

    -- 1. EAN Priority (if enabled and EAN provided)
    IF (settings->>'ean_priority')::BOOLEAN = true AND p_ean IS NOT NULL AND p_ean != '' THEN
        SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id AND ean = p_ean
        LIMIT 1;

        IF product_id IS NOT NULL THEN
            RETURN product_id;
        END IF;
    END IF;

    -- 2. SKU + Brand Fallback (if enabled)
    IF (settings->>'sku_brand_fallback')::BOOLEAN = true AND p_sku IS NOT NULL AND p_sku != '' THEN
        -- Try exact brand + exact SKU first
        IF p_brand_id IS NOT NULL THEN
            SELECT id INTO product_id
            FROM products
            WHERE user_id = p_user_id
              AND brand_id = p_brand_id
              AND sku = p_sku
            LIMIT 1;

            IF product_id IS NOT NULL THEN
                RETURN product_id;
            END IF;
        END IF;

        -- Try brand name + exact SKU
        IF p_brand IS NOT NULL AND p_brand != '' THEN
            SELECT id INTO product_id
            FROM products
            WHERE user_id = p_user_id
              AND brand = p_brand
              AND sku = p_sku
            LIMIT 1;

            IF product_id IS NOT NULL THEN
                RETURN product_id;
            END IF;
        END IF;

        -- Try fuzzy SKU matching (normalize SKUs)
        normalized_sku := normalize_sku(p_sku);
        IF normalized_sku IS NOT NULL THEN
            -- Try with brand_id + normalized SKU
            IF p_brand_id IS NOT NULL THEN
                SELECT id INTO product_id
                FROM products
                WHERE user_id = p_user_id
                  AND brand_id = p_brand_id
                  AND normalize_sku(sku) = normalized_sku
                LIMIT 1;

                IF product_id IS NOT NULL THEN
                    RETURN product_id;
                END IF;
            END IF;

            -- Try with brand name + normalized SKU
            IF p_brand IS NOT NULL AND p_brand != '' THEN
                SELECT id INTO product_id
                FROM products
                WHERE user_id = p_user_id
                  AND brand = p_brand
                  AND normalize_sku(sku) = normalized_sku
                LIMIT 1;

                IF product_id IS NOT NULL THEN
                    RETURN product_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- 3. Fuzzy Name Matching (if enabled and name provided)
    IF (settings->>'fuzzy_name_matching')::BOOLEAN = true AND p_name IS NOT NULL AND p_name != '' THEN
        -- Find products with similar names using Levenshtein distance
        SELECT id INTO product_id
        FROM products
        WHERE user_id = p_user_id
          AND name IS NOT NULL
          AND (
              -- High similarity threshold for name matching
              (LENGTH(name) > 0 AND LENGTH(p_name) > 0 AND
               (100 - (levenshtein(LOWER(name), LOWER(p_name)) * 100.0 / GREATEST(LENGTH(name), LENGTH(p_name)))) >= similarity_threshold)
              OR
              -- Substring matching for shorter names
              (LENGTH(p_name) >= 10 AND LOWER(name) LIKE '%' || LOWER(p_name) || '%')
              OR
              (LENGTH(name) >= 10 AND LOWER(p_name) LIKE '%' || LOWER(name) || '%')
          )
        ORDER BY
            -- Prefer exact matches, then by similarity
            CASE WHEN LOWER(name) = LOWER(p_name) THEN 0 ELSE 1 END,
            levenshtein(LOWER(name), LOWER(p_name))
        LIMIT 1;

        IF product_id IS NOT NULL THEN
            RETURN product_id;
        END IF;
    END IF;

    -- No match found
    RETURN NULL;
END;
$$;

-- Enhanced data quality function - prefer more complete data
CREATE OR REPLACE FUNCTION merge_product_data(
    existing_name TEXT, new_name TEXT,
    existing_sku TEXT, new_sku TEXT,
    existing_ean TEXT, new_ean TEXT,
    existing_brand TEXT, new_brand TEXT,
    existing_brand_id UUID, new_brand_id UUID,
    existing_image_url TEXT, new_image_url TEXT,
    existing_url TEXT, new_url TEXT
) RETURNS JSONB
LANGUAGE plpgsql
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

-- Enhanced process_staged_integration_product function
CREATE OR REPLACE FUNCTION public.process_staged_integration_product()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    existing_product_id UUID;
    v_brand_id UUID;
    old_price DECIMAL(10, 2);
    new_price DECIMAL(10, 2);
    merged_data JSONB;
    existing_product RECORD;
BEGIN
    -- Skip if already processed
    IF NEW.status = 'processed' THEN
        RETURN NEW;
    END IF;

    -- Calculate new price (integration prices already include tax)
    new_price := NEW.price;

    -- Find or create brand
    IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
        SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;
    END IF;

    -- Use enhanced fuzzy matching to find existing product
    SELECT find_product_with_fuzzy_matching(
        NEW.user_id,
        NEW.ean,
        NEW.brand,
        NEW.sku,
        NEW.name,
        v_brand_id
    ) INTO existing_product_id;

    IF existing_product_id IS NOT NULL THEN
        -- Product exists - UPDATE with intelligent data merging
        SELECT our_price, name, sku, ean, brand, brand_id, image_url, url
        INTO existing_product
        FROM products
        WHERE id = existing_product_id;

        old_price := existing_product.our_price;

        -- Use intelligent data merging
        SELECT merge_product_data(
            existing_product.name, NEW.name,
            existing_product.sku, NEW.sku,
            existing_product.ean, NEW.ean,
            existing_product.brand, NEW.brand,
            existing_product.brand_id, v_brand_id,
            existing_product.image_url, NEW.image_url,
            existing_product.url, NEW.url
        ) INTO merged_data;

        -- Update product with merged data
        UPDATE products
        SET
            name = merged_data->>'name',
            sku = merged_data->>'sku',
            ean = merged_data->>'ean',
            brand = merged_data->>'brand',
            brand_id = (merged_data->>'brand_id')::UUID,
            our_price = new_price,
            wholesale_price = COALESCE(NEW.wholesale_price, wholesale_price),
            image_url = merged_data->>'image_url',
            url = merged_data->>'url',
            currency_code = COALESCE(NEW.currency_code, currency_code),
            updated_at = NOW()
        WHERE id = existing_product_id;

        NEW.product_id := existing_product_id;
    ELSE
        -- Product doesn't exist - CREATE new product
        INSERT INTO products (
            user_id, name, sku, ean, brand, brand_id,
            our_price, wholesale_price, image_url, url, currency_code,
            is_active, created_at, updated_at
        ) VALUES (
            NEW.user_id, NEW.name, NEW.sku, NEW.ean, NEW.brand, v_brand_id,
            new_price, NEW.wholesale_price, NEW.image_url, NEW.url, NEW.currency_code,
            true, NOW(), NOW()
        ) RETURNING id INTO existing_product_id;

        NEW.product_id := existing_product_id;
    END IF;

    -- Record price change if we have a price
    IF new_price IS NOT NULL THEN
        INSERT INTO price_changes (
            user_id, product_id, integration_id, old_price, new_price,
            price_change_percentage, currency_code, changed_at, url
        ) VALUES (
            NEW.user_id, existing_product_id, NEW.integration_id,
            old_price, new_price,
            CASE
                WHEN old_price IS NOT NULL AND old_price > 0 THEN
                    ROUND(((new_price - old_price) / old_price * 100)::numeric, 2)
                ELSE NULL
            END,
            NEW.currency_code, NOW(), NEW.url
        );
    END IF;

    -- Mark as processed
    NEW.status := 'processed';
    NEW.processed_at := NOW();

    -- Delete from temp table (cleanup after processing)
    DELETE FROM temp_integrations_scraped_data WHERE id = NEW.id;

    -- Return NULL to prevent the UPDATE (since we deleted the record)
    RETURN NULL;

EXCEPTION WHEN OTHERS THEN
    -- Mark as error and store error message
    NEW.status := 'error';
    NEW.error_message := SQLERRM;
    NEW.processed_at := NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION get_user_matching_settings(UUID) IS 'Gets user matching settings with defaults';
COMMENT ON FUNCTION find_product_with_fuzzy_matching(UUID, TEXT, TEXT, TEXT, TEXT, UUID) IS 'Enhanced product matching with user settings support and fuzzy matching';
COMMENT ON FUNCTION merge_product_data(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT) IS 'Intelligently merges product data preferring more complete information';
COMMENT ON FUNCTION process_staged_integration_product() IS 'Enhanced integration processing with user settings support and intelligent data merging';
