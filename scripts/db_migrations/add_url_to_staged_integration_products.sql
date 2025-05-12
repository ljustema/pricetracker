-- Migration to add url column to staged_integration_products and products tables
-- This allows storing product URLs from integrations like Prestashop

-- Add the url column to the staged_integration_products table
ALTER TABLE staged_integration_products
ADD COLUMN IF NOT EXISTS url TEXT;

-- Add comment to the column
COMMENT ON COLUMN staged_integration_products.url IS 'URL to the product on the integration platform';

-- Add the url column to the products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS url TEXT;

-- Add comment to the column
COMMENT ON COLUMN products.url IS 'URL to the product on the source platform';

-- Update the process_staged_integration_product function to include the url when creating products
DROP TRIGGER IF EXISTS process_staged_integration_product_trigger ON staged_integration_products;

CREATE OR REPLACE FUNCTION process_staged_integration_product()
RETURNS TRIGGER AS $$
DECLARE
    existing_product_id UUID;
    old_price DECIMAL(10, 2);
    new_price DECIMAL(10, 2);
    v_brand_id UUID;
BEGIN
    -- Only process products with 'pending' status
    IF NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;

    BEGIN
        -- Calculate the new price (with tax if needed)
        -- For Prestashop, we need to add 25% tax to match competitor prices
        -- This is because competitor prices include tax, but Prestashop prices might not
        IF NEW.price IS NOT NULL THEN
            new_price := NEW.price * 1.25; -- Add 25% tax
        ELSE
            new_price := NULL;
        END IF;

        -- Try to find the brand ID
        IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
            -- Look for an exact match first
            SELECT id INTO v_brand_id
            FROM brands
            WHERE user_id = NEW.user_id
              AND LOWER(name) = LOWER(NEW.brand)
              AND is_active = TRUE
            LIMIT 1;

            -- If no exact match, try to find a similar brand
            IF v_brand_id IS NULL THEN
                SELECT id INTO v_brand_id
                FROM brands
                WHERE user_id = NEW.user_id
                  AND is_active = TRUE
                  AND (
                    -- Try different similarity approaches
                    LOWER(name) LIKE LOWER('%' || NEW.brand || '%') OR
                    LOWER(NEW.brand) LIKE LOWER('%' || name || '%')
                  )
                ORDER BY
                    -- Prioritize shorter names that are more likely to be exact matches
                    LENGTH(name) ASC
                LIMIT 1;
            END IF;
        END IF;

        -- Try to find an existing product by EAN or SKU+brand
        IF (NEW.ean IS NOT NULL AND NEW.ean != '') THEN
            -- Match by EAN (preferred)
            SELECT id, our_price INTO existing_product_id, old_price
            FROM products
            WHERE user_id = NEW.user_id
              AND ean = NEW.ean
            LIMIT 1;
        ELSIF (NEW.sku IS NOT NULL AND NEW.sku != '' AND NEW.brand IS NOT NULL AND NEW.brand != '' AND v_brand_id IS NOT NULL) THEN
            -- Match by SKU + brand
            SELECT id, our_price INTO existing_product_id, old_price
            FROM products
            WHERE user_id = NEW.user_id
              AND sku = NEW.sku
              AND brand_id = v_brand_id
            LIMIT 1;
        END IF;

        -- If we found an existing product, update it
        IF existing_product_id IS NOT NULL THEN
            -- Update the product with all available data
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
                url = COALESCE(NEW.url, url), -- Add URL update
                updated_at = NOW()
            WHERE id = existing_product_id;

            -- Update the staged product
            NEW.product_id := existing_product_id;
            NEW.status := 'processed';
            NEW.processed_at := NOW();
        ELSE
            -- Create a new product only if we have sufficient data
            -- This is a redundant check since we already validated above, but keeping it for safety
            IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
               (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL) THEN

                INSERT INTO products (
                    user_id,
                    name,
                    sku,
                    ean,
                    brand_id,
                    image_url,
                    our_price,
                    wholesale_price,
                    currency_code,
                    url
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
                    COALESCE(NEW.currency_code, 'SEK'),
                    NEW.url
                )
                RETURNING id INTO existing_product_id;

                -- Update the staged product
                NEW.product_id := existing_product_id;
                NEW.status := 'processed';
                NEW.processed_at := NOW();
            ELSE
                -- Product lacks sufficient data, mark as error
                NEW.status := 'error';
                NEW.error_message := 'Product lacks sufficient data for matching. Requires either EAN or both SKU and brand.';
            END IF;
        END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Handle errors
            NEW.status := 'error';
            NEW.error_message := SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER process_staged_integration_product_trigger
BEFORE UPDATE ON staged_integration_products
FOR EACH ROW
EXECUTE FUNCTION process_staged_integration_product();

-- Notify of completion
SELECT 'Migration completed: Added url column to staged_integration_products table and updated trigger function.' AS result;
