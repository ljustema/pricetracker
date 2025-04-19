-- This SQL script defines application-specific functions and triggers in the public schema.
-- It should be run after 03_public_rls.sql.

-- 1. Function and Trigger to create profile on user creation
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;
CREATE TRIGGER create_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_user();

-- 2. Function and Trigger to detect and record price changes with enhanced product matching
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
DECLARE
  last_price DECIMAL(10, 2);
  price_change_pct DECIMAL(10, 2);
  matched_product_id UUID;
  debug_info TEXT;
BEGIN
  -- Log function start (commented for production)
  -- INSERT INTO debug_logs (message)
  -- VALUES ('Trigger started for product: ' || NEW.name || ', ID: ' || NEW.id);

  -- If product_id is not set, try to match with an existing product
  IF NEW.product_id IS NULL THEN
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Product ID is NULL, trying to match product: ' || NEW.name);

    -- First try to match by EAN if available
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
      SELECT id INTO matched_product_id
      FROM products
      WHERE user_id = NEW.user_id AND ean = NEW.ean
      LIMIT 1;

      IF matched_product_id IS NOT NULL THEN
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Matched by EAN: ' || NEW.ean || ', Product ID: ' || matched_product_id);
      END IF;
    END IF;

    -- If no match by EAN and we have brand and SKU, try matching by those
    IF matched_product_id IS NULL AND NEW.brand IS NOT NULL AND NEW.sku IS NOT NULL
       AND NEW.brand != '' AND NEW.sku != '' THEN
      SELECT id INTO matched_product_id
      FROM products
      WHERE user_id = NEW.user_id AND brand = NEW.brand AND sku = NEW.sku
      LIMIT 1;

      IF matched_product_id IS NOT NULL THEN
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Matched by Brand+SKU: ' || NEW.brand || '+' || NEW.sku || ', Product ID: ' || matched_product_id);
      END IF;
    END IF;

    -- If no match found, check if we have enough data to create a new product
    IF matched_product_id IS NULL THEN
      -- Check if the product has either a valid EAN OR both Brand and SKU
      IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
         (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '') THEN

        -- Product has sufficient data, create a new product
        -- INSERT INTO debug_logs (message)
        -- VALUES ('No match found, creating new product: ' || NEW.name);

        INSERT INTO products (
          user_id,
          name,
          sku,
          ean,
          brand,
          image_url
        ) VALUES (
          NEW.user_id,
          NEW.name,
          NEW.sku,
          NEW.ean,
          NEW.brand,
          NEW.image_url
        )
        RETURNING id INTO matched_product_id;

        -- INSERT INTO debug_logs (message)
        -- VALUES ('Created new product with ID: ' || matched_product_id);

        -- Update scraped_product with the new product_id
        UPDATE scraped_products
        SET product_id = matched_product_id
        WHERE id = NEW.id;

        -- Update NEW for the rest of the function
        NEW.product_id := matched_product_id;

        -- INSERT INTO debug_logs (message)
        -- VALUES ('Updated scraped_product with new product_id: ' || matched_product_id);
      ELSE
        -- Product lacks sufficient data, ignore
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Ignoring product - insufficient data: ' || NEW.name);

        -- Leave the product in scraped_products for now
        -- The daily cleanup will remove it later
        RETURN NEW;
      END IF;
    ELSE
      -- We found a match, update the record with the matched product_id
      UPDATE scraped_products
      SET product_id = matched_product_id
      WHERE id = NEW.id;

      -- Update NEW for the rest of the function
      NEW.product_id := matched_product_id;

      -- INSERT INTO debug_logs (message)
      -- VALUES ('Updated scraped_product with product_id: ' || matched_product_id);
    END IF;
  ELSE
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Product ID already set: ' || NEW.product_id);
    matched_product_id := NEW.product_id;
  END IF;

  -- Get the latest price for this product from this competitor
  SELECT new_price INTO last_price
  FROM price_changes
  WHERE competitor_id = NEW.competitor_id
    AND product_id = NEW.product_id
  ORDER BY changed_at DESC
  LIMIT 1;

  -- INSERT INTO debug_logs (message)
  -- VALUES ('Latest price for product ' || NEW.product_id || ': ' || COALESCE(last_price::TEXT, 'NULL'));

  -- Only add a price change if:
  -- 1. This is the first time we see this product (last_price IS NULL), OR
  -- 2. The price has actually changed
  IF last_price IS NULL THEN
    -- First time for the product, record initial price
    -- INSERT INTO debug_logs (message)
    -- VALUES ('First time for product, using current price as old price: ' || NEW.price);

    -- Record price change for first-time product
    INSERT INTO price_changes (
      user_id,
      product_id,
      competitor_id,
      old_price,
      new_price,
      price_change_percentage,
      changed_at
    ) VALUES (
      NEW.user_id,
      NEW.product_id,
      NEW.competitor_id,
      NEW.price, -- Use current price as old price the first time
      NEW.price,
      0,  -- 0% change the first time
      NOW()
    );

    -- INSERT INTO debug_logs (message)
    -- VALUES ('Added initial price record for product ' || NEW.product_id);
  ELSE
    -- We have a previous price, check if it changed
    IF last_price != NEW.price THEN
      price_change_pct := ((NEW.price - last_price) / last_price) * 100;

      -- INSERT INTO debug_logs (message)
      -- VALUES ('Price changed from ' || last_price || ' to ' || NEW.price || ', change: ' || price_change_pct || '%');

      -- Only add price change entry if the price changed
      INSERT INTO price_changes (
        user_id,
        product_id,
        competitor_id,
        old_price,
        new_price,
        price_change_percentage,
        changed_at
      ) VALUES (
        NEW.user_id,
        NEW.product_id,
        NEW.competitor_id,
        last_price,
        NEW.price,
        price_change_pct,
        NOW()
      );

      -- INSERT INTO debug_logs (message)
      -- VALUES ('Added price change entry for product ' || NEW.product_id);
    ELSE
      -- INSERT INTO debug_logs (message)
      -- VALUES ('Price unchanged: ' || NEW.price || ', no price change entry added');
    END IF;
  END IF;

  -- Leave products in scraped_products for now
  -- Daily cleanup will handle removing them
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger for price changes
DROP TRIGGER IF EXISTS price_change_trigger ON scraped_products;
CREATE TRIGGER price_change_trigger
  AFTER INSERT ON scraped_products
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();

-- 3. Function for daily cleanup of scraped_products table
CREATE OR REPLACE FUNCTION cleanup_scraped_products()
RETURNS void AS $$
BEGIN
  -- Remove all records in scraped_products that are older than 30 days
  DELETE FROM scraped_products
  WHERE scraped_at < NOW() - INTERVAL '30 days';

  -- Keep only the most recent record for each product/competitor combination
  -- for records that are between 3 and 30 days old
  DELETE FROM scraped_products sp1
  WHERE scraped_at < NOW() - INTERVAL '3 days'
    AND scraped_at > NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1
      FROM scraped_products sp2
      WHERE sp2.product_id = sp1.product_id
        AND sp2.competitor_id = sp1.competitor_id
        AND sp2.scraped_at > sp1.scraped_at
    );

  -- Remove products without product_id that are older than 1 day
  -- (these couldn't be matched and have insufficient data)
  DELETE FROM scraped_products
  WHERE product_id IS NULL
    AND scraped_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- 4. Function to ensure only one active scraper per competitor
CREATE OR REPLACE FUNCTION ensure_one_active_scraper_per_competitor()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated scraper is being set to active
  IF NEW.is_active = TRUE THEN
    -- Deactivate all other scrapers for the same competitor
    UPDATE scrapers
    SET is_active = FALSE
    WHERE competitor_id = NEW.competitor_id
      AND id != NEW.id
      AND is_active = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS ensure_one_active_scraper_trigger ON scrapers;
CREATE TRIGGER ensure_one_active_scraper_trigger
  BEFORE INSERT OR UPDATE OF is_active ON scrapers
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION ensure_one_active_scraper_per_competitor();

-- 5. Function to update scraper status from run
CREATE OR REPLACE FUNCTION update_scraper_status_from_run()
RETURNS TRIGGER AS $$
BEGIN
  -- When a scraper run is completed or failed, update the scraper's status
  IF NEW.status IN ('completed', 'failed') THEN
    UPDATE scrapers
    SET
      status = CASE
        WHEN NEW.status = 'completed' THEN 'idle'
        WHEN NEW.status = 'failed' THEN 'error'
        ELSE status
      END,
      error_message = CASE
        WHEN NEW.status = 'failed' THEN NEW.error_message
        ELSE NULL
      END,
      last_run = NEW.completed_at,
      execution_time = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000, -- Convert to milliseconds
      last_products_per_second = NEW.products_per_second,
      updated_at = NOW()
    WHERE id = NEW.scraper_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_scraper_status_trigger ON scraper_runs;
CREATE TRIGGER update_scraper_status_trigger
  AFTER UPDATE OF status ON scraper_runs
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed'))
  EXECUTE FUNCTION update_scraper_status_from_run();

-- 6. Function to handle specific error types
CREATE OR REPLACE FUNCTION handle_specific_error_types()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle specific error types
  IF NEW.status = 'failed' THEN
    -- Add specific error handling logic here
    -- For example, you could categorize errors, send notifications, etc.

    -- Log the error to debug_logs
    INSERT INTO debug_logs (message)
    VALUES ('Scraper run failed: ' || NEW.id || ', Error: ' || COALESCE(NEW.error_message, 'Unknown error'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS handle_specific_error_types_trigger ON scraper_runs;
CREATE TRIGGER handle_specific_error_types_trigger
  AFTER UPDATE OF status ON scraper_runs
  FOR EACH ROW
  WHEN (NEW.status = 'failed')
  EXECUTE FUNCTION handle_specific_error_types();

-- 7. Function to create a user in the next_auth schema
CREATE OR REPLACE FUNCTION create_user_for_nextauth()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a user in the next_auth schema when a user is created in auth.users
  INSERT INTO next_auth.users (id, name, email, email_verified, image)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    NOW(),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS create_nextauth_user_trigger ON auth.users;
CREATE TRIGGER create_nextauth_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_for_nextauth();

-- 8. Function to fetch filtered products efficiently with latest competitor prices
CREATE OR REPLACE FUNCTION get_products_filtered(
    p_user_id uuid,
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 12,
    p_sort_by text DEFAULT 'created_at',
    p_sort_order text DEFAULT 'desc',
    p_brand text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_is_active boolean DEFAULT NULL, -- NULL means don't filter, true means active, false means inactive
    p_competitor_id uuid DEFAULT NULL,
    p_has_price boolean DEFAULT NULL -- NULL means don't filter, true means has our_price
)
RETURNS json -- Return a JSON object { "data": [], "totalCount": 0 }
LANGUAGE plpgsql
AS $$
DECLARE
    _query text;
    _count_query text;
    _offset integer;
    _limit integer;
    _sort_direction text;
    _allowed_sort_columns text[] := ARRAY['name', 'sku', 'ean', 'brand', 'category', 'our_price', 'cost_price', 'created_at', 'updated_at'];
    _safe_sort_by text;
    _result json;
    _total_count bigint;
BEGIN
    -- Calculate offset and limit
    _offset := (p_page - 1) * p_page_size;
    _limit := p_page_size;

    -- Validate and sanitize sort direction
    IF lower(p_sort_order) = 'asc' THEN
        _sort_direction := 'ASC';
    ELSE
        _sort_direction := 'DESC';
    END IF;

    -- Validate sort column
    IF p_sort_by = ANY(_allowed_sort_columns) THEN
        _safe_sort_by := p_sort_by;
    ELSE
        _safe_sort_by := 'created_at'; -- Default sort column
        _sort_direction := 'DESC';     -- Default sort direction
    END IF;

    -- Base query construction for counting
    _count_query := format('
        SELECT count(DISTINCT p.id)
        FROM products p
        LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
        WHERE p.user_id = %L', p_user_id);

    -- Apply filters dynamically to count query
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _count_query := _count_query || format(' AND p.brand = %L', p_brand);
    END IF;
    IF p_category IS NOT NULL AND p_category <> '' THEN
        _count_query := _count_query || format(' AND p.category = %L', p_category);
    END IF;
    IF p_search IS NOT NULL AND p_search <> '' THEN
        _count_query := _count_query || format(' AND (p.name ILIKE %L OR p.sku ILIKE %L OR p.ean ILIKE %L OR p.brand ILIKE %L OR p.category ILIKE %L)',
                                               '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    END IF;
    IF p_is_active IS NOT NULL THEN
        _count_query := _count_query || format(' AND p.is_active = %L', p_is_active);
    END IF;
    IF p_has_price IS NOT NULL AND p_has_price = true THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL';
    END IF;
    IF p_competitor_id IS NOT NULL THEN
        -- Ensure the product has *at least one* price change record for the specified competitor
         _count_query := _count_query || format(' AND pc_filter.competitor_id = %L', p_competitor_id);
    END IF;

    -- Execute count query first
    EXECUTE _count_query INTO _total_count;

    -- Base query construction for data fetching, including competitor prices
    _query := format('
        WITH LatestPrices AS (
            SELECT
                pc.product_id,
                pc.competitor_id,
                pc.new_price,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            WHERE pc.user_id = %L -- Filter by user_id early if possible
        ),
        FilteredProducts AS (
            SELECT p.id
            FROM products p
            LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
            WHERE p.user_id = %L', p_user_id, p_user_id); -- user_id used twice

    -- Apply filters dynamically to data query (similar to count query)
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _query := _query || format(' AND p.brand = %L', p_brand);
    END IF;
    IF p_category IS NOT NULL AND p_category <> '' THEN
        _query := _query || format(' AND p.category = %L', p_category);
    END IF;
    IF p_search IS NOT NULL AND p_search <> '' THEN
        _query := _query || format(' AND (p.name ILIKE %L OR p.sku ILIKE %L OR p.ean ILIKE %L OR p.brand ILIKE %L OR p.category ILIKE %L)',
                                   '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    END IF;
    IF p_is_active IS NOT NULL THEN
        _query := _query || format(' AND p.is_active = %L', p_is_active);
    END IF;
    IF p_has_price IS NOT NULL AND p_has_price = true THEN
        _query := _query || ' AND p.our_price IS NOT NULL';
    END IF;
    IF p_competitor_id IS NOT NULL THEN
         _query := _query || format(' AND pc_filter.competitor_id = %L', p_competitor_id);
    END IF;

    -- Add grouping, sorting and pagination to the subquery selecting product IDs
    _query := _query || format('
            GROUP BY p.id -- Ensure unique product IDs before sorting/limiting
            ORDER BY p.%I %s
            LIMIT %L OFFSET %L
        )
        SELECT
            p.*,
            COALESCE(
                (SELECT jsonb_object_agg(lp.competitor_id, lp.new_price)
                 FROM LatestPrices lp
                 WHERE lp.product_id = p.id AND lp.rn = 1),
                ''{}''::jsonb
            ) AS competitor_prices
        FROM products p
        JOIN FilteredProducts fp ON p.id = fp.id
        ORDER BY p.%I %s', -- Apply final sorting based on the main product table fields
        _safe_sort_by, _sort_direction, _limit, _offset, _safe_sort_by, _sort_direction
    );


    -- Execute the main query and construct the JSON result
    EXECUTE format('SELECT json_build_object(%L, COALESCE(json_agg(q), %L::json), %L, %L) FROM (%s) q',
                   'data', '[]', 'totalCount', _total_count, _query)
    INTO _result;

    RETURN _result;
END;
$$;