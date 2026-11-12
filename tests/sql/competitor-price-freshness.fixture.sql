-- Disposable local database only. Matching helpers are fixture stubs;
-- the processors below are the existing application functions.
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE user_profiles(id uuid PRIMARY KEY);
CREATE TABLE brands(id uuid PRIMARY KEY, user_id uuid, name text);
CREATE TABLE competitors(id uuid PRIMARY KEY, user_id uuid, name text);
CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "ean" "text",
    "brand" "text",
    "category" "text",
    "description" "text",
    "image_url" "text",
    "our_retail_price" numeric(10,2),
    "our_wholesale_price" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_id" "uuid" NOT NULL,
    "currency_code" "text",
    "our_url" "text",
    "last_integration_sync_at" timestamp with time zone,
    CONSTRAINT "products_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code"))))
);
CREATE TABLE IF NOT EXISTS "public"."price_changes_competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "competitor_id" "uuid",
    "old_competitor_price" numeric(10,2),
    "new_competitor_price" numeric(10,2),
    "price_change_percentage" numeric(10,2),
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "integration_id" "uuid",
    "currency_code" "text",
    "competitor_url" "text",
    "old_our_retail_price" numeric(10,2),
    "new_our_retail_price" numeric(10,2),
    "our_url" "text",
    CONSTRAINT "check_at_least_one_price" CHECK ((("new_competitor_price" IS NOT NULL) OR ("new_our_retail_price" IS NOT NULL))),
    CONSTRAINT "check_competitor_price_has_competitor_id" CHECK (((("old_competitor_price" IS NULL) AND ("new_competitor_price" IS NULL)) OR (("competitor_id" IS NOT NULL) AND ("integration_id" IS NULL)))),
    CONSTRAINT "check_our_retail_price_has_integration_id" CHECK (((("old_our_retail_price" IS NULL) AND ("new_our_retail_price" IS NULL)) OR (("integration_id" IS NOT NULL) AND ("competitor_id" IS NULL)))),
    CONSTRAINT "check_price_consistency" CHECK (((("old_competitor_price" IS NULL) = ("new_competitor_price" IS NULL)) OR (("old_our_retail_price" IS NULL) = ("new_our_retail_price" IS NULL)))),
    CONSTRAINT "check_price_type_consistency" CHECK (((("old_competitor_price" IS NULL) AND ("old_our_retail_price" IS NULL)) OR (("old_competitor_price" IS NOT NULL) AND ("old_our_retail_price" IS NULL)) OR (("old_competitor_price" IS NULL) AND ("old_our_retail_price" IS NOT NULL)))),
    CONSTRAINT "price_changes_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code")))),
    CONSTRAINT "price_changes_source_check" CHECK ((("competitor_id" IS NOT NULL) OR ("integration_id" IS NOT NULL)))
);
CREATE TABLE IF NOT EXISTS "public"."temp_competitors_scraped_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scraper_id" "uuid",
    "competitor_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "name" "text" NOT NULL,
    "competitor_price" numeric(10,2) NOT NULL,
    "competitor_url" "text",
    "image_url" "text",
    "sku" "text",
    "brand" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "ean" "text",
    "currency_code" "text",
    "raw_data" "jsonb",
    "stock_quantity" integer,
    "stock_status" "text",
    "availability_date" "date",
    "raw_stock_data" "jsonb",
    "processed" boolean DEFAULT false,
    CONSTRAINT "temp_competitors_scraped_data_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("currency_code" = "upper"("currency_code"))))
);
CREATE TABLE IF NOT EXISTS "public"."stock_changes_competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "competitor_id" "uuid",
    "integration_id" "uuid",
    "old_stock_quantity" integer,
    "new_stock_quantity" integer,
    "old_stock_status" "text",
    "new_stock_status" "text",
    "old_availability_date" "date",
    "new_availability_date" "date",
    "stock_change_quantity" integer,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "raw_stock_data" "jsonb",
    "competitor_url" "text",
    "our_url" "text",
    CONSTRAINT "stock_changes_source_check" CHECK ((("competitor_id" IS NOT NULL) OR ("integration_id" IS NOT NULL)))
);

ALTER TABLE products ADD PRIMARY KEY(id);
CREATE FUNCTION find_or_create_brand(uuid,text) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION is_valid_ean(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION normalize_sku_for_matching(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$;
CREATE FUNCTION find_product_with_fuzzy_matching(uuid,text,text,text,text,uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION get_user_primary_currency(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'SEK'::text $$;
CREATE FUNCTION process_custom_fields_from_raw_data(uuid,uuid,jsonb,text,uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION standardize_stock_status(text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
 IF $1 = 'explode' THEN RAISE EXCEPTION 'Injected row processing failure'; END IF;
 RETURN $1;
END $$;
CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 500) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "stock_changes" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;
CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch_keep_temp"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 100) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "stock_changes" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;
CREATE OR REPLACE FUNCTION "public"."process_temp_competitors_batch_with_conflict_detection"("p_competitor_id" "uuid" DEFAULT NULL::"uuid", "batch_size" integer DEFAULT 100) RETURNS TABLE("processed" integer, "errors" integer, "new_products" integer, "price_changes" integer, "conflicts" integer, "reviews" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;
