-- Migration: Enhanced competitor matching function
-- Date: 2025-01-27
-- Phase: 1B - Stage 1 Import Fixes (Part 2)

-- Enhanced record_price_change function with user settings support
CREATE OR REPLACE FUNCTION public.record_price_change() 
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    last_price DECIMAL(10, 2);
    price_change_pct DECIMAL(10, 2);
    matched_product_id UUID;
    v_brand_id UUID;
    debug_info TEXT;
BEGIN
    -- Match product if not already matched
    IF NEW.product_id IS NULL THEN
        -- Find or create brand if we have brand name
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
        ) INTO matched_product_id;

        -- If no match found, create a new product if we have sufficient data
        IF matched_product_id IS NULL THEN
            -- Check if we have sufficient data to create a product
            IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
               (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL) THEN

                -- Create a new product
                INSERT INTO products (
                    user_id,
                    name,
                    sku,
                    ean,
                    brand,
                    brand_id,
                    image_url,
                    url,
                    currency_code
                ) VALUES (
                    NEW.user_id,
                    NEW.name,
                    NEW.sku,
                    NEW.ean,
                    NEW.brand,
                    v_brand_id,
                    NEW.image_url,
                    NEW.url,
                    COALESCE(NEW.currency_code, 'SEK')
                )
                RETURNING id INTO matched_product_id;

                -- Update the scraped_product with the new product_id
                NEW.product_id := matched_product_id;
            ELSE
                -- Insufficient data to create a product
                RETURN NEW;
            END IF;
        ELSE
            -- Update the scraped_product with the matched product_id
            NEW.product_id := matched_product_id;
        END IF;
    END IF;

    -- Get the latest price for this product from this competitor
    SELECT new_price INTO last_price
    FROM price_changes
    WHERE competitor_id = NEW.competitor_id
      AND product_id = NEW.product_id
    ORDER BY changed_at DESC
    LIMIT 1;

    -- Only add a price change if:
    -- 1. This is the first time we see this product (last_price IS NULL), OR
    -- 2. The price has actually changed
    IF last_price IS NULL THEN
        -- First time for the product, record initial price
        INSERT INTO price_changes (
            user_id,
            product_id,
            competitor_id,
            old_price,
            new_price,
            price_change_percentage,
            changed_at,
            currency_code,
            url
        ) VALUES (
            NEW.user_id,
            NEW.product_id,
            NEW.competitor_id,
            NEW.price, -- Use current price as old price the first time
            NEW.price,
            0,  -- 0% change the first time
            NOW(),
            NEW.currency_code,
            NEW.url
        );
    ELSE
        -- Calculate price change percentage
        IF last_price = 0 THEN
            price_change_pct := 0; -- Avoid division by zero
        ELSE
            price_change_pct := ((NEW.price - last_price) / last_price) * 100;
        END IF;

        -- Check if price has changed
        IF NEW.price != last_price THEN
            -- Only add price change entry if the price changed
            INSERT INTO price_changes (
                user_id,
                product_id,
                competitor_id,
                old_price,
                new_price,
                price_change_percentage,
                changed_at,
                currency_code,
                url
            ) VALUES (
                NEW.user_id,
                NEW.product_id,
                NEW.competitor_id,
                last_price,
                NEW.price,
                price_change_pct,
                NOW(),
                NEW.currency_code,
                NEW.url
            );
        END IF;
    END IF;

    -- Leave products in scraped_products for now
    -- Daily cleanup will handle removing them
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION record_price_change() IS 'Enhanced competitor price processing with user settings support and fuzzy matching';
