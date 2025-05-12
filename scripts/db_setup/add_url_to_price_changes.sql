-- Add URL column to price_changes table
ALTER TABLE price_changes ADD COLUMN IF NOT EXISTS url TEXT;

-- Update the record_price_change function to include URL from scraped_products
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
DECLARE
  last_price DECIMAL(10, 2);
  price_change_pct DECIMAL(10, 2);
  matched_product_id UUID;
  brand_id UUID;
  debug_info TEXT;
BEGIN
  -- Match product if not already matched
  IF NEW.product_id IS NULL THEN
    -- Try to match by EAN first
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
      SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND ean = NEW.ean LIMIT 1;
    END IF;

    -- If no match by EAN, try to match by brand and SKU
    IF matched_product_id IS NULL AND NEW.brand IS NOT NULL AND NEW.sku IS NOT NULL AND NEW.brand != '' AND NEW.sku != '' THEN
      -- First try to find brand_id
      SELECT id INTO brand_id FROM brands WHERE user_id = NEW.user_id AND name = NEW.brand LIMIT 1;

      -- If brand found, try to match by brand_id and SKU
      IF brand_id IS NOT NULL THEN
        SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND brand_id = brand_id AND sku = NEW.sku LIMIT 1;
      END IF;

      -- If still no match, try by brand name and SKU
      IF matched_product_id IS NULL THEN
        SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND brand = NEW.brand AND sku = NEW.sku LIMIT 1;
      END IF;
    END IF;

    -- Update the scraped_product with the matched product_id
    IF matched_product_id IS NOT NULL THEN
      NEW.product_id := matched_product_id;
    ELSE
      -- No match found, return without recording price change
      RETURN NEW;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the process_staged_integration_product function to include URL
CREATE OR REPLACE FUNCTION process_staged_integration_product()
RETURNS TRIGGER AS $$
DECLARE
    existing_product_id UUID;
    old_price DECIMAL(10, 2);
    new_price DECIMAL(10, 2);
    v_brand_id UUID;
BEGIN
    -- Only process if status is changing to 'processing'
    IF NEW.status = 'processing' THEN
        BEGIN
            -- Get the new price from the staged product
            new_price := NEW.price;

            -- Try to find brand_id if brand is provided
            IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
                -- First try to find by exact brand name
                SELECT id INTO v_brand_id
                FROM brands
                WHERE user_id = NEW.user_id AND name = NEW.brand;

                -- If not found, try to find by alias
                IF v_brand_id IS NULL THEN
                    SELECT brand_id INTO v_brand_id
                    FROM brand_aliases
                    WHERE user_id = NEW.user_id AND alias_name = NEW.brand;

                    -- If still not found, create a new brand
                    IF v_brand_id IS NULL THEN
                        INSERT INTO brands (user_id, name, is_active, needs_review)
                        VALUES (NEW.user_id, NEW.brand, true, true)
                        RETURNING id INTO v_brand_id;
                    END IF;
                END IF;
            END IF;

            -- Try to match with existing product
            IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
               (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL) THEN

                -- Try to match by EAN first
                IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
                    SELECT id, our_price INTO existing_product_id, old_price
                    FROM products
                    WHERE user_id = NEW.user_id AND ean = NEW.ean
                    LIMIT 1;
                END IF;

                -- If no match by EAN, try to match by brand_id and SKU
                IF existing_product_id IS NULL AND NEW.brand IS NOT NULL AND NEW.sku IS NOT NULL AND NEW.brand != '' AND NEW.sku != '' AND v_brand_id IS NOT NULL THEN
                    SELECT id, our_price INTO existing_product_id, old_price
                    FROM products
                    WHERE user_id = NEW.user_id AND brand_id = v_brand_id AND sku = NEW.sku
                    LIMIT 1;
                END IF;

                -- If product exists, update it
                IF existing_product_id IS NOT NULL THEN
                    -- Update the product with new data if available
                    UPDATE products
                    SET
                        name = COALESCE(NEW.name, name),
                        sku = COALESCE(NEW.sku, sku),
                        ean = COALESCE(NEW.ean, ean),
                        brand_id = COALESCE(v_brand_id, brand_id),
                        image_url = COALESCE(NEW.image_url, image_url),
                        our_price = COALESCE(new_price, our_price),
                        wholesale_price = COALESCE(NEW.wholesale_price, wholesale_price),
                        currency_code = COALESCE(NEW.currency_code, currency_code, 'SEK'),
                        updated_at = NOW()
                    WHERE id = existing_product_id;

                    -- Record price change if price has changed
                    IF old_price IS DISTINCT FROM new_price AND new_price IS NOT NULL THEN
                        INSERT INTO price_changes (
                            user_id,
                            product_id,
                            competitor_id,
                            old_price,
                            new_price,
                            price_change_percentage,
                            integration_id,
                            currency_code,
                            url
                        )
                        SELECT
                            NEW.user_id,
                            existing_product_id,
                            NULL,
                            old_price,
                            new_price,
                            CASE
                                WHEN old_price = 0 THEN 0
                                ELSE ((new_price - old_price) / old_price) * 100
                            END,
                            NEW.integration_id,
                            COALESCE(NEW.currency_code, 'SEK'),
                            NEW.raw_data->>'product_url'
                        WHERE old_price IS NOT NULL;
                    END IF;

                    -- Update the staged product
                    NEW.product_id := existing_product_id;
                    NEW.status := 'processed';
                    NEW.processed_at := NOW();
                ELSE
                    -- Create a new product
                    INSERT INTO products (
                        user_id,
                        name,
                        sku,
                        ean,
                        brand_id,
                        image_url,
                        our_price,
                        wholesale_price,
                        currency_code
                    )
                    VALUES (
                        NEW.user_id,
                        NEW.name,
                        NEW.sku,
                        NEW.ean,
                        v_brand_id,
                        NEW.image_url,
                        new_price,
                        NEW.wholesale_price,
                        COALESCE(NEW.currency_code, 'SEK')
                    )
                    RETURNING id INTO existing_product_id;

                    -- Record initial price
                    IF new_price IS NOT NULL THEN
                        INSERT INTO price_changes (
                            user_id,
                            product_id,
                            competitor_id,
                            old_price,
                            new_price,
                            price_change_percentage,
                            integration_id,
                            currency_code,
                            url
                        )
                        VALUES (
                            NEW.user_id,
                            existing_product_id,
                            NULL,
                            new_price, -- Use same price for old_price on first record
                            new_price,
                            0, -- 0% change for first record
                            NEW.integration_id,
                            COALESCE(NEW.currency_code, 'SEK'),
                            NEW.raw_data->>'product_url'
                        );
                    END IF;

                    -- Update the staged product
                    NEW.product_id := existing_product_id;
                    NEW.status := 'processed';
                    NEW.processed_at := NOW();
                END IF;
            ELSE
                -- Product lacks sufficient data, mark as error
                NEW.status := 'error';
                NEW.error_message := 'Product lacks sufficient data for matching. Requires either EAN or both SKU and brand.';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Handle errors
            NEW.status := 'error';
            NEW.error_message := SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the get_latest_competitor_prices function to include URL
DROP FUNCTION IF EXISTS get_latest_competitor_prices(UUID, UUID);
CREATE FUNCTION get_latest_competitor_prices(
    p_user_id UUID,
    p_product_id UUID
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    product_id UUID,
    competitor_id UUID,
    integration_id UUID,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2),
    price_change_percentage DECIMAL(10, 2),
    changed_at TIMESTAMP WITH TIME ZONE,
    currency_code TEXT,
    url TEXT,
    source_type TEXT,
    source_name TEXT,
    source JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH LatestCompetitorPrices AS (
        SELECT
            pc.id,
            pc.user_id,
            pc.product_id,
            pc.competitor_id,
            NULL::UUID AS integration_id,
            pc.old_price,
            pc.new_price,
            pc.price_change_percentage,
            pc.changed_at,
            pc.currency_code,
            pc.url,
            'competitor' AS source_type,
            c.name AS source_name,
            jsonb_build_object(
                'name', c.name,
                'website', c.website
            ) AS source,
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.competitor_id IS NOT NULL
    ),
    LatestIntegrationPrices AS (
        SELECT
            pc.id,
            pc.user_id,
            pc.product_id,
            NULL::UUID AS competitor_id,
            pc.integration_id,
            pc.old_price,
            pc.new_price,
            pc.price_change_percentage,
            pc.changed_at,
            pc.currency_code,
            pc.url,
            'integration' AS source_type,
            i.name AS source_name,
            jsonb_build_object(
                'name', i.name,
                'platform', i.platform
            ) AS source,
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.integration_id IS NOT NULL
    )
    SELECT * FROM LatestCompetitorPrices WHERE rn = 1
    UNION ALL
    SELECT * FROM LatestIntegrationPrices WHERE rn = 1
    ORDER BY changed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Update the get_product_price_history function to include URL
DROP FUNCTION IF EXISTS get_product_price_history(UUID, UUID, UUID, INTEGER);
CREATE FUNCTION get_product_price_history(
    p_user_id UUID,
    p_product_id UUID,
    p_source_id UUID,
    p_limit INTEGER
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    product_id UUID,
    competitor_id UUID,
    integration_id UUID,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2),
    price_change_percentage DECIMAL(10, 2),
    changed_at TIMESTAMP WITH TIME ZONE,
    currency_code TEXT,
    url TEXT,
    source_type TEXT,
    source_name TEXT,
    source JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH CompetitorPrices AS (
        SELECT
            pc.id,
            pc.user_id,
            pc.product_id,
            pc.competitor_id,
            NULL::UUID AS integration_id,
            pc.old_price,
            pc.new_price,
            pc.price_change_percentage,
            pc.changed_at,
            pc.currency_code,
            pc.url,
            'competitor' AS source_type,
            c.name AS source_name,
            jsonb_build_object(
                'name', c.name,
                'website', c.website
            ) AS source
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.competitor_id IS NOT NULL
        AND (p_source_id IS NULL OR pc.competitor_id = p_source_id)
    ),
    IntegrationPrices AS (
        SELECT
            pc.id,
            pc.user_id,
            pc.product_id,
            NULL::UUID AS competitor_id,
            pc.integration_id,
            pc.old_price,
            pc.new_price,
            pc.price_change_percentage,
            pc.changed_at,
            pc.currency_code,
            pc.url,
            'integration' AS source_type,
            i.name AS source_name,
            jsonb_build_object(
                'name', i.name,
                'platform', i.platform
            ) AS source
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.integration_id IS NOT NULL
        AND (p_source_id IS NULL OR pc.integration_id = p_source_id)
    )
    SELECT * FROM CompetitorPrices
    UNION ALL
    SELECT * FROM IntegrationPrices
    ORDER BY changed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
