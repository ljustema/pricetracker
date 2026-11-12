
ALTER TABLE brands ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE brands ADD COLUMN is_active boolean DEFAULT true;
ALTER TABLE brands ADD COLUMN needs_review boolean DEFAULT false;
CREATE TABLE brand_aliases(user_id uuid,brand_id uuid,alias_name text);
CREATE TABLE scrapers(id uuid,user_id uuid,competitor_id uuid);
CREATE TABLE scraper_run_rejections(id uuid DEFAULT gen_random_uuid(),scraper_id uuid,user_id uuid,competitor_id uuid,reason text,had_ean boolean,had_brand boolean,had_sku boolean,had_name boolean,sample_name text,sample_url text,rejected_at timestamptz DEFAULT now());
CREATE TABLE test_matching_settings(user_id uuid,settings jsonb);
CREATE FUNCTION public.get_user_matching_settings(p_user_id uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT COALESCE((SELECT settings FROM test_matching_settings WHERE user_id=p_user_id),'{"ean_priority":true,"sku_brand_fallback":true,"fuzzy_name_matching":false}'::jsonb)
$$;
CREATE OR REPLACE FUNCTION public.is_valid_ean(ean_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Return false if ean_code is null, empty, or just whitespace
    IF ean_code IS NULL OR trim(ean_code) = '' THEN
        RETURN FALSE;
    END IF;
    -- Clean the EAN code by trimming whitespace
    ean_code := trim(ean_code);
    -- Check if it contains only digits
    IF ean_code !~ '^[0-9]+$' THEN
        RETURN FALSE;
    END IF;
    -- Check length - valid EAN codes are 8, 10, 11, 12, or 13 digits
    -- EAN-8: 8 digits
    -- UPC-A: 12 digits
    -- EAN-13: 13 digits
    -- Some systems also accept 10 and 11 digit codes
    IF length(ean_code) < 8 OR length(ean_code) > 13 THEN
        RETURN FALSE;
    END IF;
    -- Additional check: reject obviously invalid codes like single digits repeated
    -- Reject codes like "11111111" or "00000000" for 8-digit codes
    IF length(ean_code) = 8 AND ean_code ~ '^(.)\1{7}$' THEN
        RETURN FALSE;
    END IF;
    -- Reject codes like "111111111111" or "1111111111111" for 12-13 digit codes
    IF length(ean_code) >= 12 AND ean_code ~ '^(.)\1{11,12}$' THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.normalize_sku_for_matching(input_sku text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Return NULL if input is NULL or empty
    IF input_sku IS NULL OR trim(input_sku) = '' THEN
        RETURN NULL;
    END IF;
    -- Remove spaces, hyphens, equals signs and similar separators
    -- Keep only letters and numbers, convert to lowercase
    RETURN lower(regexp_replace(input_sku, '[^a-zA-Z0-9]', '', 'g'));
END;
$function$;
CREATE OR REPLACE FUNCTION public.process_temp_competitors_batch(p_competitor_id uuid DEFAULT NULL::uuid, batch_size integer DEFAULT 500)
 RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer, stock_changes integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    total_price_changes INTEGER := 0;
    total_stock_changes INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
    current_competitor_price NUMERIC(10,2);
    current_stock_quantity INTEGER;
    current_stock_status TEXT;
    current_availability_date DATE;
    standardized_status TEXT;
    old_category TEXT;
    new_category TEXT;
    product_our_url TEXT;
BEGIN
    FOR temp_record IN
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            matched_product_id := NULL;
            v_brand_id := NULL;
            -- STEP 1: Brand lookup
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            -- STEP 2: Product matching - EAN first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            -- Try brand_id + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND brand_id = v_brand_id
                  AND normalize_sku_for_matching(sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;
            END IF;
            -- Fuzzy matching as last resort
            IF matched_product_id IS NULL THEN
                SELECT find_product_with_fuzzy_matching(
                    temp_record.user_id,
                    temp_record.ean,
                    temp_record.brand,
                    temp_record.sku,
                    temp_record.name,
                    v_brand_id
                ) INTO matched_product_id;
            END IF;
            -- Create new product if no match
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, image_url, currency_code
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id, temp_record.image_url,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                ) RETURNING id INTO matched_product_id;
                total_new_products := total_new_products + 1;
            ELSE
                -- For existing products, update image_url if the product doesn't have our_url
                SELECT our_url INTO product_our_url
                FROM products
                WHERE id = matched_product_id;
                IF product_our_url IS NULL AND temp_record.image_url IS NOT NULL THEN
                    UPDATE products
                    SET image_url = temp_record.image_url,
                        updated_at = NOW()
                    WHERE id = matched_product_id;
                END IF;
            END IF;
            -- STEP 3: Price change detection
            SELECT new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND competitor_id = temp_record.competitor_id
            ORDER BY changed_at DESC
            LIMIT 1;
            PERFORM public.record_competitor_price_observation(
                temp_record.user_id, matched_product_id, temp_record.competitor_id,
                temp_record.competitor_price, temp_record.scraped_at
            );
            IF current_competitor_price IS NULL OR ABS(current_competitor_price - temp_record.competitor_price) > 0.01 THEN
                INSERT INTO price_changes_competitors (
                    user_id, product_id, competitor_id, old_competitor_price, new_competitor_price,
                    changed_at, competitor_url, currency_code
                ) VALUES (
                    temp_record.user_id, matched_product_id, temp_record.competitor_id,
                    current_competitor_price, temp_record.competitor_price, NOW(),
                    temp_record.competitor_url,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                );
                total_price_changes := total_price_changes + 1;
            END IF;
            -- STEP 4: Stock processing
            IF temp_record.stock_quantity IS NOT NULL OR temp_record.stock_status IS NOT NULL THEN
                SELECT new_stock_quantity, new_stock_status, new_availability_date
                INTO current_stock_quantity, current_stock_status, current_availability_date
                FROM stock_changes_competitors
                WHERE user_id = temp_record.user_id
                  AND product_id = matched_product_id
                  AND competitor_id = temp_record.competitor_id
                ORDER BY changed_at DESC
                LIMIT 1;
                standardized_status := standardize_stock_status(temp_record.stock_status);
                old_category := CASE
                    WHEN current_stock_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN current_stock_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN current_stock_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;
                new_category := CASE
                    WHEN standardized_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN standardized_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN standardized_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;
                IF (current_stock_quantity IS DISTINCT FROM temp_record.stock_quantity) OR
                   (current_stock_status IS NULL) OR
                   (old_category IS DISTINCT FROM new_category) THEN
                    INSERT INTO stock_changes_competitors (
                        user_id, product_id, competitor_id,
                        old_stock_quantity, new_stock_quantity,
                        old_stock_status, new_stock_status,
                        old_availability_date, new_availability_date,
                        stock_change_quantity, changed_at, raw_stock_data,
                        competitor_url
                    ) VALUES (
                        temp_record.user_id, matched_product_id, temp_record.competitor_id,
                        current_stock_quantity, temp_record.stock_quantity,
                        current_stock_status, standardized_status,
                        current_availability_date, temp_record.availability_date,
                        COALESCE(temp_record.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                        NOW(), temp_record.raw_stock_data,
                        temp_record.competitor_url
                    );
                    total_stock_changes := total_stock_changes + 1;
                END IF;
            END IF;
            -- STEP 5: Mark as processed and DELETE
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;
            total_processed := total_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error processing record % (SKU: %, Brand: %): %',
                temp_record.id, temp_record.sku, temp_record.brand, SQLERRM;
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;
        END;
    END LOOP;
    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_stock_changes;
END;
$function$;
CREATE OR REPLACE FUNCTION public.process_temp_competitors_batch_keep_temp(p_competitor_id uuid DEFAULT NULL::uuid, batch_size integer DEFAULT 100)
 RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer, stock_changes integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    total_price_changes INTEGER := 0;
    total_stock_changes INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
    current_competitor_price NUMERIC(10,2);
    current_stock_quantity INTEGER;
    current_stock_status TEXT;
    current_availability_date DATE;
    standardized_status TEXT;
    old_category TEXT;
    new_category TEXT;
    product_our_url TEXT;
BEGIN
    RAISE NOTICE 'Starting batch processing (KEEP TEMP) for competitor % (batch size: %)', p_competitor_id, batch_size;
    FOR temp_record IN
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            matched_product_id := NULL;
            v_brand_id := NULL;
            -- STEP 1: Brand lookup
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            -- STEP 2: Product matching - EAN first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            -- Try brand_id + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND brand_id = v_brand_id
                  AND normalize_sku_for_matching(sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;
            END IF;
            -- Fuzzy matching as last resort
            IF matched_product_id IS NULL THEN
                SELECT find_product_with_fuzzy_matching(
                    temp_record.user_id,
                    temp_record.ean,
                    temp_record.brand,
                    temp_record.sku,
                    temp_record.name,
                    v_brand_id
                ) INTO matched_product_id;
            END IF;
            -- Create new product if no match
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, image_url, currency_code
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id, temp_record.image_url,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                ) RETURNING id INTO matched_product_id;
                total_new_products := total_new_products + 1;
            ELSE
                -- For existing products, update image_url if the product doesn't have our_url
                SELECT our_url INTO product_our_url
                FROM products
                WHERE id = matched_product_id;
                IF product_our_url IS NULL AND temp_record.image_url IS NOT NULL THEN
                    UPDATE products
                    SET image_url = temp_record.image_url,
                        updated_at = NOW()
                    WHERE id = matched_product_id;
                END IF;
            END IF;
            -- STEP 3: Price change detection
            SELECT new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND competitor_id = temp_record.competitor_id
            ORDER BY changed_at DESC
            LIMIT 1;
            -- Only insert if price actually changed
            PERFORM public.record_competitor_price_observation(
                temp_record.user_id, matched_product_id, temp_record.competitor_id,
                temp_record.competitor_price, temp_record.scraped_at
            );
            IF current_competitor_price IS NULL OR ABS(current_competitor_price - temp_record.competitor_price) > 0.01 THEN
                INSERT INTO price_changes_competitors (
                    user_id, product_id, competitor_id, old_competitor_price, new_competitor_price,
                    changed_at, competitor_url, currency_code
                ) VALUES (
                    temp_record.user_id, matched_product_id, temp_record.competitor_id,
                    current_competitor_price, temp_record.competitor_price, NOW(),
                    temp_record.competitor_url,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                );
                total_price_changes := total_price_changes + 1;
            END IF;
            -- STEP 4: Stock processing
            IF temp_record.stock_quantity IS NOT NULL OR temp_record.stock_status IS NOT NULL THEN
                SELECT new_stock_quantity, new_stock_status, new_availability_date
                INTO current_stock_quantity, current_stock_status, current_availability_date
                FROM stock_changes_competitors
                WHERE user_id = temp_record.user_id
                  AND product_id = matched_product_id
                  AND competitor_id = temp_record.competitor_id
                ORDER BY changed_at DESC
                LIMIT 1;
                standardized_status := standardize_stock_status(temp_record.stock_status);
                old_category := CASE
                    WHEN current_stock_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN current_stock_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN current_stock_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;
                new_category := CASE
                    WHEN standardized_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN standardized_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN standardized_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;
                IF (current_stock_quantity IS DISTINCT FROM temp_record.stock_quantity) OR
                   (current_stock_status IS NULL) OR
                   (old_category IS DISTINCT FROM new_category) THEN
                    INSERT INTO stock_changes_competitors (
                        user_id, product_id, competitor_id,
                        old_stock_quantity, new_stock_quantity,
                        old_stock_status, new_stock_status,
                        old_availability_date, new_availability_date,
                        stock_change_quantity, changed_at, raw_stock_data,
                        competitor_url
                    ) VALUES (
                        temp_record.user_id, matched_product_id, temp_record.competitor_id,
                        current_stock_quantity, temp_record.stock_quantity,
                        current_stock_status, standardized_status,
                        current_availability_date, temp_record.availability_date,
                        COALESCE(temp_record.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                        NOW(), temp_record.raw_stock_data,
                        temp_record.competitor_url
                    );
                    total_stock_changes := total_stock_changes + 1;
                END IF;
            END IF;
            -- STEP 5: Update temp record (MOVED TO END - only if successful)
            UPDATE temp_competitors_scraped_data
            SET product_id = matched_product_id,
                processed = true
            WHERE id = temp_record.id;
            total_processed := total_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error processing record % (SKU: %, Brand: %): %',
                temp_record.id, temp_record.sku, temp_record.brand, SQLERRM;
            -- Mark as processed but don't set product_id on error
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
        END;
    END LOOP;
    RAISE NOTICE 'Batch complete! Processed: %, Errors: %, New products: %, Price changes: %, Stock changes: %',
                 total_processed, total_errors, total_new_products, total_price_changes, total_stock_changes;
    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_stock_changes;
END;
$function$;
CREATE OR REPLACE FUNCTION public.process_temp_competitors_batch_with_conflict_detection(p_competitor_id uuid DEFAULT NULL::uuid, batch_size integer DEFAULT 100)
 RETURNS TABLE(processed integer, errors integer, new_products integer, price_changes integer, conflicts integer, reviews integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    temp_record RECORD;
    total_processed INTEGER := 0;
    total_errors INTEGER := 0;
    total_new_products INTEGER := 0;
    total_price_changes INTEGER := 0;
    total_conflicts INTEGER := 0;
    total_reviews INTEGER := 0;
    matched_product_id UUID;
    v_brand_id UUID;
    current_competitor_price NUMERIC(10,2);
    current_stock_quantity INTEGER;
    current_stock_status TEXT;
    current_availability_date DATE;
    standardized_status TEXT;
    start_time TIMESTAMP;
    batch_ids UUID[];
    first_user_id UUID;
    custom_fields_processed INTEGER;
    old_category TEXT;
    new_category TEXT;
    product_our_url TEXT;
BEGIN
    start_time := clock_timestamp();
    RAISE NOTICE 'Starting batch processing for competitor % (batch size: %)', p_competitor_id, batch_size;
    -- Get batch IDs
    SELECT array_agg(subq.id ORDER BY subq.scraped_at) INTO batch_ids
    FROM (
        SELECT t.id, t.scraped_at
        FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    ) subq;
    -- Skip if no records
    IF array_length(batch_ids, 1) IS NULL OR array_length(batch_ids, 1) = 0 THEN
        RAISE NOTICE 'No records to process';
        RETURN QUERY SELECT 0, 0, 0, 0, 0, 0;
        RETURN;
    END IF;
    -- Get user_id from first record
    SELECT t.user_id INTO first_user_id
    FROM temp_competitors_scraped_data t
    WHERE t.id = batch_ids[1];
    total_conflicts := 0;
    total_reviews := 0;
    RAISE NOTICE 'Processing % records', array_length(batch_ids, 1);
    -- Process records
    FOR temp_record IN
        SELECT * FROM temp_competitors_scraped_data t
        WHERE (p_competitor_id IS NULL OR t.competitor_id = p_competitor_id)
          AND t.processed = false
        ORDER BY t.scraped_at
        LIMIT batch_size
    LOOP
        BEGIN
            -- STEP 1: Brand lookup
            v_brand_id := NULL;
            IF temp_record.brand IS NOT NULL AND temp_record.brand != '' THEN
                SELECT find_or_create_brand(temp_record.user_id, temp_record.brand) INTO v_brand_id;
            END IF;
            -- STEP 2: Product matching
            matched_product_id := NULL;
            -- Try EAN match first
            IF temp_record.ean IS NOT NULL AND temp_record.ean != '' AND is_valid_ean(temp_record.ean) THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND ean = temp_record.ean
                LIMIT 1;
            END IF;
            -- Try brand_id + SKU match
            IF matched_product_id IS NULL AND v_brand_id IS NOT NULL AND temp_record.sku IS NOT NULL AND temp_record.sku != '' THEN
                SELECT id INTO matched_product_id
                FROM products
                WHERE user_id = temp_record.user_id
                  AND brand_id = v_brand_id
                  AND normalize_sku_for_matching(sku) = normalize_sku_for_matching(temp_record.sku)
                LIMIT 1;
            END IF;
            -- Fuzzy matching as last resort
            IF matched_product_id IS NULL THEN
                SELECT find_product_with_fuzzy_matching(
                    temp_record.user_id,
                    temp_record.ean,
                    temp_record.brand,
                    temp_record.sku,
                    temp_record.name,
                    v_brand_id
                ) INTO matched_product_id;
            END IF;
            -- Create new product if no match
            IF matched_product_id IS NULL THEN
                INSERT INTO products (
                    user_id, name, sku, ean, brand, brand_id, image_url, currency_code
                ) VALUES (
                    temp_record.user_id, temp_record.name, temp_record.sku, temp_record.ean,
                    temp_record.brand, v_brand_id, temp_record.image_url,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                ) RETURNING id INTO matched_product_id;
                total_new_products := total_new_products + 1;
            ELSE
                -- For existing products, update image_url if the product doesn't have our_url
                SELECT our_url INTO product_our_url
                FROM products
                WHERE id = matched_product_id;
                IF product_our_url IS NULL AND temp_record.image_url IS NOT NULL THEN
                    UPDATE products
                    SET image_url = temp_record.image_url,
                        updated_at = NOW()
                    WHERE id = matched_product_id;
                    RAISE NOTICE 'Updated image_url for product % (no our_url)', matched_product_id;
                END IF;
            END IF;
            -- Process custom fields
            IF matched_product_id IS NOT NULL AND temp_record.raw_data IS NOT NULL THEN
                SELECT process_custom_fields_from_raw_data(
                    temp_record.user_id,
                    matched_product_id,
                    temp_record.raw_data,
                    'competitor',
                    temp_record.competitor_id
                ) INTO custom_fields_processed;
            END IF;
            -- RESTORED: Price change detection - only insert if price actually changed
            SELECT new_competitor_price INTO current_competitor_price
            FROM price_changes_competitors
            WHERE user_id = temp_record.user_id
              AND product_id = matched_product_id
              AND competitor_id = temp_record.competitor_id
            ORDER BY changed_at DESC
            LIMIT 1;
            -- Only insert if price actually changed (RESTORED - WORKAROUND REMOVED)
            PERFORM public.record_competitor_price_observation(
                temp_record.user_id, matched_product_id, temp_record.competitor_id,
                temp_record.competitor_price, temp_record.scraped_at
            );
            IF current_competitor_price IS NULL OR ABS(current_competitor_price - temp_record.competitor_price) > 0.01 THEN
                INSERT INTO price_changes_competitors (
                    user_id, product_id, competitor_id, old_competitor_price, new_competitor_price,
                    changed_at, competitor_url, currency_code
                ) VALUES (
                    temp_record.user_id, matched_product_id, temp_record.competitor_id,
                    current_competitor_price, temp_record.competitor_price, NOW(),
                    temp_record.competitor_url,
                    COALESCE(temp_record.currency_code, get_user_primary_currency(temp_record.user_id))
                );
                total_price_changes := total_price_changes + 1;
            END IF;
            -- Stock processing
            IF temp_record.stock_quantity IS NOT NULL OR temp_record.stock_status IS NOT NULL THEN
                SELECT new_stock_quantity, new_stock_status, new_availability_date
                INTO current_stock_quantity, current_stock_status, current_availability_date
                FROM stock_changes_competitors
                WHERE user_id = temp_record.user_id
                  AND product_id = matched_product_id
                  AND competitor_id = temp_record.competitor_id
                ORDER BY changed_at DESC
                LIMIT 1;
                standardized_status := standardize_stock_status(temp_record.stock_status);
                old_category := CASE
                    WHEN current_stock_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN current_stock_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN current_stock_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;
                new_category := CASE
                    WHEN standardized_status IN ('in_stock', 'limited_stock') THEN 'available'
                    WHEN standardized_status IN ('out_of_stock', 'discontinued') THEN 'unavailable'
                    WHEN standardized_status IN ('back_order', 'coming_soon') THEN 'pre_order'
                    ELSE 'unknown'
                END;
                IF (current_stock_quantity IS DISTINCT FROM temp_record.stock_quantity) OR
                   (current_stock_status IS NULL) OR
                   (old_category IS DISTINCT FROM new_category) THEN
                    INSERT INTO stock_changes_competitors (
                        user_id, product_id, competitor_id,
                        old_stock_quantity, new_stock_quantity,
                        old_stock_status, new_stock_status,
                        old_availability_date, new_availability_date,
                        stock_change_quantity, changed_at, raw_stock_data,
                        competitor_url
                    ) VALUES (
                        temp_record.user_id, matched_product_id, temp_record.competitor_id,
                        current_stock_quantity, temp_record.stock_quantity,
                        current_stock_status, standardized_status,
                        current_availability_date, temp_record.availability_date,
                        COALESCE(temp_record.stock_quantity, 0) - COALESCE(current_stock_quantity, 0),
                        NOW(), temp_record.raw_stock_data,
                        temp_record.competitor_url
                    );
                    RAISE NOTICE 'Stock change recorded: % -> % (category: % -> %)',
                        current_stock_status, standardized_status, old_category, new_category;
                END IF;
            END IF;
            -- Mark as processed and delete
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;
            total_processed := total_processed + 1;
            IF total_processed % 50 = 0 THEN
                RAISE NOTICE 'Processed % records (%.2f ms avg per record)',
                    total_processed,
                    EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000 / total_processed;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            total_errors := total_errors + 1;
            RAISE WARNING 'Error processing record % (SKU: %, Brand: %): %',
                temp_record.id, temp_record.sku, temp_record.brand, SQLERRM;
            UPDATE temp_competitors_scraped_data SET processed = true WHERE id = temp_record.id;
            DELETE FROM temp_competitors_scraped_data WHERE id = temp_record.id;
        END;
    END LOOP;
    RAISE NOTICE 'Batch complete! Processed: %, Errors: %, New products: %, Price changes: %, Total time: %.2f ms',
                 total_processed, total_errors, total_new_products, total_price_changes,
                 EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    RETURN QUERY SELECT total_processed, total_errors, total_new_products, total_price_changes, total_conflicts, total_reviews;
END;
$function$;
CREATE TABLE IF NOT EXISTS integrations(id uuid PRIMARY KEY,configuration jsonb);
CREATE TABLE IF NOT EXISTS "public"."temp_integrations_scraped_data" (
    "id" "uuid" DEFAULT gen_random_uuid() NOT NULL,
    "integration_run_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prestashop_product_id" "text",
    "name" "text" NOT NULL,
    "sku" "text",
    "ean" "text",
    "brand" "text",
    "our_retail_price" numeric(10,2),
    "our_wholesale_price" numeric(10,2),
    "image_url" "text",
    "raw_data" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "currency_code" "text",
    "our_url" "text",
    "stock_quantity" integer,
    "stock_status" "text",
    "availability_date" "date",
    "raw_stock_data" "jsonb",
    CONSTRAINT "temp_integrations_scraped_data_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code"))))
);
CREATE OR REPLACE FUNCTION public.process_temp_integrations_scraped_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    existing_product_id UUID;
    v_brand_id UUID;
    current_retail_price NUMERIC(10,2);
    current_wholesale_price NUMERIC(10,2);
    custom_fields_result JSONB;
    rounded_retail_price NUMERIC(10,2);
    rounded_wholesale_price NUMERIC(10,2);
    integration_config JSONB;
    selective_import_enabled BOOLEAN := FALSE;
    field_config JSONB;
BEGIN
    -- CRITICAL: Only process records with status 'pending'
    IF NEW.status IS NULL OR NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;
    -- Validate that the record has minimum required data
    IF (NEW.ean IS NULL OR NEW.ean = '') AND
       (NEW.sku IS NULL OR NEW.sku = '' OR NEW.brand IS NULL OR NEW.brand = '') THEN
        -- Mark as error in the NEW record (will be saved automatically)
        NEW.status := 'error';
        NEW.error_message := 'Missing required fields (EAN or SKU+Brand)';
        RETURN NEW;
    END IF;
    -- Get integration configuration
    SELECT configuration INTO integration_config
    FROM integrations
    WHERE id = NEW.integration_id;
    -- Check if selective import is enabled
    IF integration_config IS NOT NULL AND
       integration_config->'selectiveImport'->>'enabled' = 'true' THEN
        selective_import_enabled := TRUE;
        field_config := integration_config->'selectiveImport'->'fields';
    END IF;
    -- Round integration prices to whole numbers
    rounded_retail_price := CASE WHEN NEW.our_retail_price IS NOT NULL THEN ROUND(NEW.our_retail_price) ELSE NULL END;
    rounded_wholesale_price := CASE WHEN NEW.our_wholesale_price IS NOT NULL THEN ROUND(NEW.our_wholesale_price) ELSE NULL END;
    -- Find or create brand
    v_brand_id := NULL;
    IF NEW.brand IS NOT NULL AND NEW.brand != '' AND
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;
    ELSE
        SELECT get_or_create_unknown_brand(NEW.user_id) INTO v_brand_id;
    END IF;
    -- Try to find existing product
    existing_product_id := NULL;
    -- Try EAN match first
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
        SELECT id INTO existing_product_id FROM products
        WHERE user_id = NEW.user_id AND ean = NEW.ean
        LIMIT 1;
    END IF;
    -- If no EAN match, try SKU + brand_id match
    IF existing_product_id IS NULL AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL THEN
        SELECT id INTO existing_product_id FROM products
        WHERE user_id = NEW.user_id
          AND sku = NEW.sku
          AND brand_id = v_brand_id
        LIMIT 1;
    END IF;
    -- Get current prices for price change tracking
    IF existing_product_id IS NOT NULL THEN
        SELECT our_retail_price, our_wholesale_price
        INTO current_retail_price, current_wholesale_price
        FROM products WHERE id = existing_product_id;
    END IF;
    IF existing_product_id IS NULL THEN
        -- Create new product
        INSERT INTO products (
            user_id, name, sku, ean, brand, brand_id,
            our_retail_price, our_wholesale_price, image_url, our_url, currency_code
        ) VALUES (
            NEW.user_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN NEW.name ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN NEW.sku ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN NEW.ean ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN NEW.brand ELSE NULL END,
            v_brand_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN NEW.image_url ELSE NULL END,
            NEW.our_url,
            CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id)) ELSE NULL END
        ) RETURNING id INTO existing_product_id;
    ELSE
        -- Update existing product
        UPDATE products SET
            name = CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN COALESCE(NEW.name, name) ELSE name END,
            sku = CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN COALESCE(NEW.sku, sku) ELSE sku END,
            ean = CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN COALESCE(NEW.ean, ean) ELSE ean END,
            brand = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(NEW.brand, brand) ELSE brand END,
            brand_id = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(v_brand_id, brand_id) ELSE brand_id END,
            our_retail_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE our_retail_price END,
            our_wholesale_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE our_wholesale_price END,
            image_url = CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN COALESCE(NEW.image_url, image_url) ELSE image_url END,
            our_url = COALESCE(NEW.our_url, our_url),
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(NEW.currency_code, currency_code) ELSE currency_code END,
            updated_at = NOW()
        WHERE id = existing_product_id;
    END IF;
    -- Record price changes
    IF rounded_retail_price IS NOT NULL AND (current_retail_price IS NULL OR current_retail_price != rounded_retail_price) THEN
        INSERT INTO price_changes_competitors (
            user_id, product_id, old_our_retail_price, new_our_retail_price,
            changed_at, integration_id, currency_code, our_url
        ) VALUES (
            NEW.user_id, existing_product_id, current_retail_price, rounded_retail_price,
            NOW(), NEW.integration_id, COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id)), NEW.our_url
        );
    END IF;
    IF rounded_wholesale_price IS NOT NULL AND (current_wholesale_price IS NULL OR current_wholesale_price != rounded_wholesale_price) THEN
        INSERT INTO price_changes_suppliers (
            user_id, product_id, old_our_wholesale_price, new_our_wholesale_price,
            changed_at, integration_id, currency_code, our_url, change_source
        ) VALUES (
            NEW.user_id, existing_product_id, current_wholesale_price, rounded_wholesale_price,
            NOW(), NEW.integration_id, COALESCE(NEW.currency_code, get_user_primary_currency(NEW.user_id)), NEW.our_url, 'integration'
        );
    END IF;
    -- Process custom fields
    IF NEW.raw_data IS NOT NULL THEN
        SELECT process_custom_fields_from_raw_data(
            NEW.user_id, existing_product_id, NEW.raw_data, 'integration', NEW.integration_id
        ) INTO custom_fields_result;
    END IF;
    -- Mark as processed in the NEW record (will be saved automatically)
    NEW.status := 'processed';
    NEW.processed_at := NOW();
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.process_temp_integrations_scraped_data_logic(record_data temp_integrations_scraped_data)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    existing_product_id UUID;
    v_brand_id UUID;
    current_retail_price NUMERIC(10,2);
    current_wholesale_price NUMERIC(10,2);
    custom_fields_result JSONB;
    rounded_retail_price NUMERIC(10,2);
    rounded_wholesale_price NUMERIC(10,2);
    integration_config JSONB;
    selective_import_enabled BOOLEAN := FALSE;
    field_config JSONB;
    user_currency TEXT;
BEGIN
    -- Get user's primary currency
    user_currency := get_user_primary_currency(record_data.user_id);
    -- Validate that the record has minimum required data
    IF (record_data.ean IS NULL OR record_data.ean = '') AND
       (record_data.sku IS NULL OR record_data.sku = '' OR record_data.brand IS NULL OR record_data.brand = '') THEN
        -- Delete unprocessable records immediately
        DELETE FROM temp_integrations_scraped_data WHERE id = record_data.id;
        RETURN;
    END IF;
    -- Get integration configuration
    SELECT configuration INTO integration_config
    FROM integrations
    WHERE id = record_data.integration_id;
    -- Check if selective import is enabled
    IF integration_config IS NOT NULL AND
       integration_config->'selectiveImport'->>'enabled' = 'true' THEN
        selective_import_enabled := TRUE;
        field_config := integration_config->'selectiveImport'->'fields';
    END IF;
    -- Round integration prices to whole numbers (no decimals)
    rounded_retail_price := CASE WHEN record_data.our_retail_price IS NOT NULL THEN ROUND(record_data.our_retail_price) ELSE NULL END;
    rounded_wholesale_price := CASE WHEN record_data.our_wholesale_price IS NOT NULL THEN ROUND(record_data.our_wholesale_price) ELSE NULL END;
    -- STEP 1: Find or create brand using the proper function that respects aliases
    v_brand_id := NULL;
    IF record_data.brand IS NOT NULL AND record_data.brand != '' AND
       (NOT selective_import_enabled OR field_config->>'brand' != 'false') THEN
        -- Use the find_or_create_brand function that properly checks aliases
        SELECT find_or_create_brand(record_data.user_id, record_data.brand) INTO v_brand_id;
    ELSE
        -- If no brand provided or brand field is disabled, use Unknown brand
        SELECT get_or_create_unknown_brand(record_data.user_id) INTO v_brand_id;
    END IF;
    -- STEP 2: Try to find existing product using RESOLVED brand_id for matching
    existing_product_id := NULL;
    -- Try EAN match first (most reliable)
    IF record_data.ean IS NOT NULL AND record_data.ean != '' THEN
        SELECT id INTO existing_product_id FROM products
        WHERE user_id = record_data.user_id AND ean = record_data.ean
        LIMIT 1;
    END IF;
    -- If no EAN match, try SKU + resolved brand_id match
    IF existing_product_id IS NULL AND record_data.sku IS NOT NULL AND record_data.sku != '' AND v_brand_id IS NOT NULL THEN
        SELECT id INTO existing_product_id FROM products
        WHERE user_id = record_data.user_id
          AND sku = record_data.sku
          AND brand_id = v_brand_id  -- Use resolved brand_id instead of original brand text
        LIMIT 1;
    END IF;
    -- Get current prices for price change tracking
    IF existing_product_id IS NOT NULL THEN
        SELECT our_retail_price, our_wholesale_price
        INTO current_retail_price, current_wholesale_price
        FROM products WHERE id = existing_product_id;
    END IF;
    IF existing_product_id IS NULL THEN
        -- Create new product
        INSERT INTO products (
            user_id, name, sku, ean, brand, brand_id, our_retail_price, our_wholesale_price,
            image_url, our_url, currency_code
        ) VALUES (
            record_data.user_id,
            CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN record_data.name ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN record_data.sku ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN record_data.ean ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN record_data.brand ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN v_brand_id ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE NULL END,
            CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN record_data.image_url ELSE NULL END,
            record_data.our_url,
            CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(record_data.currency_code, user_currency) ELSE NULL END
        ) RETURNING id INTO existing_product_id;
    ELSE
        -- Update existing product
        UPDATE products SET
            name = CASE WHEN NOT selective_import_enabled OR field_config->>'name' != 'false' THEN COALESCE(record_data.name, name) ELSE name END,
            sku = CASE WHEN NOT selective_import_enabled OR field_config->>'sku' != 'false' THEN COALESCE(record_data.sku, sku) ELSE sku END,
            ean = CASE WHEN NOT selective_import_enabled OR field_config->>'ean' != 'false' THEN COALESCE(record_data.ean, ean) ELSE ean END,
            brand = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(record_data.brand, brand) ELSE brand END,
            brand_id = CASE WHEN NOT selective_import_enabled OR field_config->>'brand' != 'false' THEN COALESCE(v_brand_id, brand_id) ELSE brand_id END,
            our_retail_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_retail_price' != 'false' THEN rounded_retail_price ELSE our_retail_price END,
            our_wholesale_price = CASE WHEN NOT selective_import_enabled OR field_config->>'our_wholesale_price' != 'false' THEN rounded_wholesale_price ELSE our_wholesale_price END,
            image_url = CASE WHEN NOT selective_import_enabled OR field_config->>'image_url' != 'false' THEN COALESCE(record_data.image_url, image_url) ELSE image_url END,
            our_url = COALESCE(record_data.our_url, our_url),
            currency_code = CASE WHEN NOT selective_import_enabled OR field_config->>'currency_code' != 'false' THEN COALESCE(record_data.currency_code, currency_code) ELSE currency_code END,
            updated_at = NOW()
        WHERE id = existing_product_id;
    END IF;
    -- Record retail price changes in price_changes_competitors table (for our retail prices)
    IF rounded_retail_price IS NOT NULL AND (current_retail_price IS NULL OR current_retail_price != rounded_retail_price) THEN
        INSERT INTO price_changes_competitors (
            user_id, product_id, old_our_retail_price, new_our_retail_price,
            changed_at, integration_id, currency_code, our_url
        ) VALUES (
            record_data.user_id, existing_product_id, current_retail_price, rounded_retail_price,
            NOW(), record_data.integration_id, COALESCE(record_data.currency_code, user_currency), record_data.our_url
        );
    END IF;
    -- Record wholesale price changes in price_changes_suppliers table (for our wholesale prices)
    IF rounded_wholesale_price IS NOT NULL AND (current_wholesale_price IS NULL OR current_wholesale_price != rounded_wholesale_price) THEN
        INSERT INTO price_changes_suppliers (
            user_id, product_id, old_our_wholesale_price, new_our_wholesale_price,
            changed_at, integration_id, currency_code, our_url, change_source
        ) VALUES (
            record_data.user_id, existing_product_id, current_wholesale_price, rounded_wholesale_price,
            NOW(), record_data.integration_id, COALESCE(record_data.currency_code, user_currency), record_data.our_url, 'integration'
        );
    END IF;
    -- Process custom fields if they exist in raw_data
    IF record_data.raw_data IS NOT NULL THEN
        SELECT process_custom_fields_from_raw_data(
            record_data.user_id,
            existing_product_id,
            record_data.raw_data,
            'integration',
            record_data.integration_id
        ) INTO custom_fields_result;
    END IF;
    -- Mark as processed and delete
    UPDATE temp_integrations_scraped_data
    SET status = 'processed', processed_at = NOW()
    WHERE id = record_data.id;
    DELETE FROM temp_integrations_scraped_data WHERE id = record_data.id;
END;
$function$;
CREATE TABLE IF NOT EXISTS "public"."price_changes_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "old_our_wholesale_price" numeric(10,2),
    "new_our_wholesale_price" numeric(10,2),
    "price_change_percentage" numeric(10,2),
    "currency_code" "text" DEFAULT 'SEK'::"text",
    "supplier_url" "text",
    "minimum_order_quantity" integer DEFAULT 1,
    "lead_time_days" integer,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "change_source" "text" DEFAULT 'manual'::"text",
    "old_supplier_price" numeric(10,2),
    "new_supplier_price" numeric(10,2),
    "old_supplier_recommended_price" numeric(10,2),
    "new_supplier_recommended_price" numeric(10,2),
    "integration_id" "uuid",
    "our_url" "text",
    CONSTRAINT "check_exactly_one_source" CHECK (((("supplier_id" IS NOT NULL) AND ("integration_id" IS NULL)) OR (("supplier_id" IS NULL) AND ("integration_id" IS NOT NULL)))),
    CONSTRAINT "check_our_wholesale_price_has_integration_id" CHECK (((("old_our_wholesale_price" IS NULL) AND ("new_our_wholesale_price" IS NULL)) OR (("integration_id" IS NOT NULL) AND ("supplier_id" IS NULL)))),
    CONSTRAINT "check_supplier_price_consistency" CHECK (((("old_supplier_price" IS NULL) AND ("new_supplier_price" IS NULL)) OR (("old_supplier_price" IS NULL) AND ("new_supplier_price" IS NOT NULL)) OR (("old_supplier_price" IS NOT NULL) AND ("new_supplier_price" IS NOT NULL)) OR (("old_supplier_price" IS NOT NULL) AND ("new_supplier_price" IS NULL)))),
    CONSTRAINT "check_supplier_price_has_supplier_id" CHECK (((("old_supplier_price" IS NULL) AND ("new_supplier_price" IS NULL)) OR (("supplier_id" IS NOT NULL) AND ("integration_id" IS NULL)))),
    CONSTRAINT "price_changes_suppliers_change_source_check" CHECK (("change_source" = ANY (ARRAY['manual'::"text", 'csv'::"text", 'scraper'::"text", 'integration'::"text"])))
);
