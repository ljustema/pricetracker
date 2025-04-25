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
  brand_id UUID;
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

        -- Try to find brand_id for the brand name
        IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
          SELECT find_brand_by_name_or_alias(NEW.user_id, NEW.brand) INTO brand_id;
        END IF;

        -- Product has sufficient data, create a new product
        -- INSERT INTO debug_logs (message)
        -- VALUES ('No match found, creating new product: ' || NEW.name);

        INSERT INTO products (
          user_id,
          name,
          sku,
          ean,
          brand,
          brand_id,
          image_url,
          currency_code -- Added currency_code
        ) VALUES (
          NEW.user_id,
          NEW.name,
          NEW.sku,
          NEW.ean,
          NEW.brand,
          brand_id,
          NEW.image_url,
          NEW.currency_code -- Added currency_code from scraped_products
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
      changed_at,
      currency_code -- Added currency_code
    ) VALUES (
      NEW.user_id,
      NEW.product_id,
      NEW.competitor_id,
      NEW.price, -- Use current price as old price the first time
      NEW.price,
      0,  -- 0% change the first time
      NOW(),
      NEW.currency_code -- Added currency_code from scraped_products
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
        changed_at,
        currency_code -- Added currency_code
      ) VALUES (
        NEW.user_id,
        NEW.product_id,
        NEW.competitor_id,
        last_price,
        NEW.price,
        price_change_pct,
        NOW(),
        NEW.currency_code -- Added currency_code from scraped_products
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
  -- Ensure only one active scraper per competitor
  IF NEW.is_active THEN
    UPDATE scrapers
    SET is_active = FALSE
    WHERE competitor_id = NEW.competitor_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS one_active_scraper_per_competitor ON scrapers;
CREATE TRIGGER one_active_scraper_per_competitor
  BEFORE INSERT OR UPDATE ON scrapers
  FOR EACH ROW
  EXECUTE FUNCTION ensure_one_active_scraper_per_competitor();

-- 5. Function to update scraper status from run
CREATE OR REPLACE FUNCTION update_scraper_status_from_run()
RETURNS TRIGGER AS $$
BEGIN
  -- When a scraper run is completed or failed, update the scraper's status
  IF NEW.status IN ('completed', 'failed') THEN
    -- Log the update to debug_logs for troubleshooting
    INSERT INTO debug_logs (message)
    VALUES ('Updating scraper status from run: ' || NEW.id ||
            ', Status: ' || NEW.status ||
            ', Execution time: ' || NEW.execution_time_ms ||
            ', Products per second: ' || NEW.products_per_second);
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
      execution_time = COALESCE(
        NEW.execution_time_ms,
        EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000
      ),
      last_products_per_second = NEW.products_per_second,
      updated_at = NOW()
    WHERE id = NEW.scraper_id;
    -- Log the update result to debug_logs
    INSERT INTO debug_logs (message)
    VALUES ('Updated scraper: ' || NEW.scraper_id ||
            ' with execution_time: ' || COALESCE(
              NEW.execution_time_ms,
              EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000
            ) ||
            ', last_products_per_second: ' || NEW.products_per_second);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers for update_scraper_status_from_run exist
DROP TRIGGER IF EXISTS update_scraper_status_trigger ON scraper_runs;
CREATE TRIGGER update_scraper_status_trigger
  AFTER UPDATE ON scraper_runs
  FOR EACH ROW
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
DROP FUNCTION IF EXISTS get_products_filtered(uuid,integer,integer,text,text,text,text,text,boolean,uuid,boolean);
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

    -- Validate sort_by parameter to prevent null field name error
    IF p_sort_by IS NULL OR p_sort_by = '' THEN
        _safe_sort_by := 'created_at';
    ELSIF p_sort_by = ANY(_allowed_sort_columns) THEN
        _safe_sort_by := p_sort_by;
    ELSE
        _safe_sort_by := 'created_at'; -- Default sort column
    END IF;

    -- Validate and sanitize sort direction
    IF p_sort_order IS NULL OR p_sort_order = '' THEN
        _sort_direction := 'DESC';
    ELSIF lower(p_sort_order) = 'asc' THEN
        _sort_direction := 'ASC';
    ELSE
        _sort_direction := 'DESC';
    END IF;

    -- Base query construction for counting
    _count_query := format('
        SELECT count(DISTINCT p.id)
        FROM products p
        LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
        WHERE p.user_id = %L', p_user_id);

    -- Apply filters dynamically to count query
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _count_query := _count_query || format(' AND p.brand_id = %L', p_brand);
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
    IF p_has_price = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL';
    END IF;

    -- Add competitor filter to count query
    IF p_competitor_id IS NOT NULL THEN
        _count_query := _count_query || format('
            AND p.id IN (
                SELECT DISTINCT pc.product_id
                FROM price_changes pc
                WHERE pc.user_id = %L
                AND pc.competitor_id = %L
            )', p_user_id, p_competitor_id);
    END IF;

    -- Execute count query first
    EXECUTE _count_query INTO _total_count;

    -- Base query construction for data fetching
    _query := format('
        WITH FilteredProductsBase AS ( -- Renamed to avoid conflict later
            SELECT p.id
            FROM products p
            LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
            WHERE p.user_id = %L', p_user_id);

    -- Apply filters dynamically to data query (similar to count query)
    IF p_brand IS NOT NULL AND p_brand <> '' THEN
        _query := _query || format(' AND p.brand_id = %L', p_brand);
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
    IF p_has_price = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL';
    END IF;

    -- Add competitor filter to data query
    IF p_competitor_id IS NOT NULL THEN
        _query := _query || format('
            AND p.id IN (
                SELECT DISTINCT pc.product_id
                FROM price_changes pc
                WHERE pc.user_id = %L
                AND pc.competitor_id = %L
            )', p_user_id, p_competitor_id);
    END IF;

    -- Add grouping, sorting and pagination to the subquery selecting product IDs
    _query := _query || format('
            GROUP BY p.id -- Ensure unique product IDs before sorting/limiting
            ORDER BY p.%I %s
            LIMIT %L OFFSET %L
        ),
        -- CTEs for fetching and aggregating latest prices from competitors and integrations
        LatestCompetitorPrices AS (
            SELECT
                pc.product_id,
                pc.competitor_id as source_id,
                pc.new_price,
                ''competitor'' as source_type,
                c.name as source_name,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            JOIN competitors c ON pc.competitor_id = c.id
            WHERE pc.user_id = %L AND pc.competitor_id IS NOT NULL
        ),
        LatestIntegrationPrices AS (
            SELECT
                pc.product_id,
                pc.integration_id as source_id,
                pc.new_price,
                ''integration'' as source_type,
                i.name as source_name,
                ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
            FROM price_changes pc
            JOIN integrations i ON pc.integration_id = i.id
            WHERE pc.user_id = %L AND pc.integration_id IS NOT NULL
        ),
        AllLatestPrices AS (
            SELECT product_id, source_id, new_price, source_type, source_name FROM LatestCompetitorPrices WHERE rn = 1
            UNION ALL
            SELECT product_id, source_id, new_price, source_type, source_name FROM LatestIntegrationPrices WHERE rn = 1
        ),
        AggregatedSourcePrices AS (
            SELECT
                product_id,
                jsonb_object_agg(
                    source_id::text,
                    jsonb_build_object(''price'', new_price, ''source_type'', source_type, ''source_name'', COALESCE(source_name, ''Unknown''))
                ) as source_prices
            FROM AllLatestPrices
            GROUP BY product_id
        ),
        AggregatedCompetitorPrices AS (
             SELECT
                product_id,
                jsonb_object_agg(source_id::text, new_price) as competitor_prices
            FROM AllLatestPrices
            GROUP BY product_id
        )
        -- Final SELECT joining products with aggregated prices
        SELECT
            p.*,
            COALESCE(asp.source_prices, ''{}''::jsonb) as source_prices,
            COALESCE(acp.competitor_prices, ''{}''::jsonb) as competitor_prices
        FROM products p
        JOIN FilteredProductsBase fp ON p.id = fp.id -- Join with the filtered product IDs
        LEFT JOIN AggregatedSourcePrices asp ON p.id = asp.product_id
        LEFT JOIN AggregatedCompetitorPrices acp ON p.id = acp.product_id
        ORDER BY p.%I %s', -- Apply final sorting based on the main product table fields
        _safe_sort_by, _sort_direction, _limit, _offset, -- Parameters for LIMIT/OFFSET
        p_user_id, -- For LatestCompetitorPrices CTE
        p_user_id, -- For LatestIntegrationPrices CTE
        _safe_sort_by, _sort_direction -- Parameters for final ORDER BY
    );

    -- Execute the main query and construct the JSON result
    EXECUTE format('SELECT json_build_object(%L, COALESCE(json_agg(q), %L::json), %L, %L) FROM (%s) q',
                   'data', '[]', 'totalCount', _total_count, _query)
    INTO _result;

    RETURN _result;
END;
$$;

-- 9. Function to count distinct competitors for a brand
CREATE OR REPLACE FUNCTION count_distinct_competitors_for_brand(p_user_id UUID, p_brand_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COUNT(DISTINCT pc.competitor_id)
  FROM price_changes pc
  JOIN products p ON pc.product_id = p.id
  WHERE p.user_id = p_user_id
    AND p.brand_id = p_brand_id;
$$;

-- 10. Function to find brand by name or alias
CREATE OR REPLACE FUNCTION find_brand_by_name_or_alias(
  p_user_id UUID,
  p_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_brand_id UUID;
BEGIN
  -- First try to find by exact brand name
  SELECT id INTO v_brand_id
  FROM brands
  WHERE user_id = p_user_id AND name = p_name;

  -- If not found, try to find by alias
  IF v_brand_id IS NULL THEN
    SELECT brand_id INTO v_brand_id
    FROM brand_aliases
    WHERE user_id = p_user_id AND alias_name = p_name;
  END IF;

  RETURN v_brand_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Function to efficiently get brand analytics in a single query
CREATE OR REPLACE FUNCTION get_brand_analytics(p_user_id UUID, p_brand_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  needs_review BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_count BIGINT,
  competitor_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH product_counts AS (
    SELECT
      b.id AS brand_id,
      COUNT(p.id) AS product_count
    FROM
      brands b
    LEFT JOIN
      products p ON b.id = p.brand_id AND p.user_id = b.user_id
    WHERE
      b.user_id = p_user_id
      AND (p_brand_id IS NULL OR b.id = p_brand_id)
    GROUP BY
      b.id
  ),
  competitor_counts AS (
    SELECT
      b.id AS brand_id,
      COUNT(DISTINCT pc.competitor_id) AS competitor_count
    FROM
      brands b
    LEFT JOIN
      products p ON b.id = p.brand_id AND p.user_id = b.user_id
    LEFT JOIN
      price_changes pc ON p.id = pc.product_id AND pc.user_id = b.user_id
    WHERE
      b.user_id = p_user_id
      AND (p_brand_id IS NULL OR b.id = p_brand_id)
    GROUP BY
      b.id
  )
  SELECT
    b.id,
    b.name,
    b.is_active,
    b.needs_review,
    b.created_at,
    b.updated_at,
    COALESCE(pc.product_count, 0) AS product_count,
    COALESCE(cc.competitor_count, 0) AS competitor_count
  FROM
    brands b
  LEFT JOIN
    product_counts pc ON b.id = pc.brand_id
  LEFT JOIN
    competitor_counts cc ON b.id = cc.brand_id
  WHERE
    b.user_id = p_user_id
    AND (p_brand_id IS NULL OR b.id = p_brand_id)
  ORDER BY
    b.name ASC;
END;
$$ LANGUAGE plpgsql;

-- 12. Function to efficiently get brand aliases in a single query
CREATE OR REPLACE FUNCTION get_brand_aliases(p_user_id UUID)
RETURNS TABLE (
  brand_id UUID,
  aliases TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.brand_id,
    ARRAY_AGG(ba.alias_name) AS aliases
  FROM
    brand_aliases ba
  WHERE
    ba.user_id = p_user_id
  GROUP BY
    ba.brand_id;
END;
$$ LANGUAGE plpgsql;

-- 13. Function to automatically set brand_id when a product is created or updated
CREATE OR REPLACE FUNCTION set_product_brand_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.brand_id IS NULL AND NEW.brand IS NOT NULL THEN
    SELECT id INTO NEW.brand_id FROM brands WHERE name = NEW.brand LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_product_brand_id_trigger ON products;
CREATE TRIGGER set_product_brand_id_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_brand_id();

-- 14. Function to get competitor statistics efficiently
CREATE OR REPLACE FUNCTION get_competitor_statistics(p_user_id UUID)
RETURNS TABLE (
  competitor_id UUID,
  product_count BIGINT,
  brand_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH competitor_products AS (
    -- Get distinct product IDs for each competitor
    SELECT DISTINCT
      pc.competitor_id,
      pc.product_id
    FROM
      price_changes pc
    WHERE
      pc.user_id = p_user_id
  ),
  product_counts AS (
    -- Count products per competitor
    SELECT
      cp.competitor_id,
      COUNT(cp.product_id) AS product_count
    FROM
      competitor_products cp
    GROUP BY
      cp.competitor_id
  ),
  brand_counts AS (
    -- Count distinct brands per competitor
    SELECT
      cp.competitor_id,
      COUNT(DISTINCT p.brand_id) AS brand_count
    FROM
      competitor_products cp
    JOIN
      products p ON cp.product_id = p.id
    WHERE
      p.user_id = p_user_id
      AND p.brand_id IS NOT NULL
    GROUP BY
      cp.competitor_id
  )
  SELECT
    c.id AS competitor_id,
    COALESCE(pc.product_count, 0) AS product_count,
    COALESCE(bc.brand_count, 0) AS brand_count
  FROM
    competitors c
  LEFT JOIN
    product_counts pc ON c.id = pc.competitor_id
  LEFT JOIN
    brand_counts bc ON c.id = bc.competitor_id
  WHERE
    c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 15. Function to get brands for a specific competitor
CREATE OR REPLACE FUNCTION get_brands_for_competitor(p_user_id UUID, p_competitor_id UUID)
RETURNS TABLE (
  brand_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.brand_id
  FROM
    price_changes pc
  JOIN
    products p ON pc.product_id = p.id
  WHERE
    pc.user_id = p_user_id
    AND pc.competitor_id = p_competitor_id
    AND p.brand_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 16. Function to get competitor names for a brand
CREATE OR REPLACE FUNCTION get_competitor_names_for_brand(p_user_id UUID, p_brand_id UUID)
RETURNS TABLE (
  competitor_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ARRAY_AGG(DISTINCT c.name) AS competitor_names
  FROM
    price_changes pc
  JOIN
    products p ON pc.product_id = p.id
  JOIN
    competitors c ON pc.competitor_id = c.id
  WHERE
    p.user_id = p_user_id
    AND p.brand_id = p_brand_id
    AND c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: retry_fetch_failed_runs
CREATE OR REPLACE FUNCTION retry_fetch_failed_runs()
RETURNS TRIGGER AS $$
DECLARE
  retry_count INTEGER;
BEGIN
  IF NEW.status = 'failed' AND NEW.error_message = 'fetch failed' THEN
    SELECT COUNT(*) INTO retry_count
    FROM scraper_runs
    WHERE scraper_id = NEW.scraper_id
      AND error_message = 'fetch failed'
      AND started_at > NOW() - INTERVAL '1 hour';
    IF retry_count < 3 THEN
      INSERT INTO scraper_runs (
        scraper_id, user_id, status, started_at, is_test_run, scraper_type
      ) VALUES (
        NEW.scraper_id, NEW.user_id, 'pending', NOW(), NEW.is_test_run, NEW.scraper_type
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS retry_fetch_failed_trigger ON scraper_runs;
CREATE TRIGGER retry_fetch_failed_trigger
  AFTER UPDATE ON scraper_runs
  FOR EACH ROW
  EXECUTE FUNCTION retry_fetch_failed_runs();

-- Function: handle_specific_error_types
CREATE OR REPLACE FUNCTION handle_specific_error_types()
RETURNS TRIGGER AS $$
BEGIN
  -- Add custom error handling logic here if needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_specific_error_types_trigger ON scraper_runs;
CREATE TRIGGER handle_specific_error_types_trigger
  AFTER UPDATE ON scraper_runs
  FOR EACH ROW
  EXECUTE FUNCTION handle_specific_error_types();

-- Function: record_price_change (if not present)
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
DECLARE
  last_price DECIMAL(10, 2);
  price_change_pct DECIMAL(10, 2);
  matched_product_id UUID;
BEGIN
  IF NEW.product_id IS NULL THEN
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
      SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND ean = NEW.ean LIMIT 1;
    END IF;
    IF matched_product_id IS NULL AND NEW.brand IS NOT NULL AND NEW.sku IS NOT NULL AND NEW.brand != '' AND NEW.sku != '' THEN
      SELECT id INTO matched_product_id FROM products WHERE user_id = NEW.user_id AND brand = NEW.brand AND sku = NEW.sku LIMIT 1;
    END IF;
    IF matched_product_id IS NOT NULL THEN
      NEW.product_id := matched_product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS price_change_trigger ON scraped_products;
CREATE TRIGGER price_change_trigger
  BEFORE INSERT ON scraped_products
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();

-- 16. Functions for handling integrations and staged products

-- Function to find or create a brand by name
DROP FUNCTION IF EXISTS find_or_create_brand(UUID, TEXT);
CREATE OR REPLACE FUNCTION find_or_create_brand(
  p_user_id UUID,
  p_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_brand_id UUID;
BEGIN
  -- First try to find by exact brand name
  SELECT id INTO v_brand_id
  FROM brands
  WHERE user_id = p_user_id AND name = p_name;

  -- If not found, try to find by alias
  IF v_brand_id IS NULL THEN
    SELECT brand_id INTO v_brand_id
    FROM brand_aliases
    WHERE user_id = p_user_id AND alias_name = p_name;
  END IF;

  -- If still not found, create a new brand
  IF v_brand_id IS NULL THEN
    INSERT INTO brands (
      user_id,
      name,
      is_active,
      needs_review
    ) VALUES (
      p_user_id,
      p_name,
      TRUE,
      TRUE
    )
    RETURNING id INTO v_brand_id;
  END IF;

  RETURN v_brand_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get statistics for an integration run
CREATE OR REPLACE FUNCTION get_integration_run_stats(run_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'processed', COUNT(*) FILTER (WHERE status = 'processed'),
        'created', COUNT(*) FILTER (WHERE status = 'processed' AND product_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM price_changes pc WHERE pc.product_id = staged_integration_products.product_id AND pc.changed_at < staged_integration_products.processed_at
        )),
        'updated', COUNT(*) FILTER (WHERE status = 'processed' AND product_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM price_changes pc WHERE pc.product_id = staged_integration_products.product_id AND pc.changed_at < staged_integration_products.processed_at
        )),
        'errors', COUNT(*) FILTER (WHERE status = 'error'),
        'pending', COUNT(*) FILTER (WHERE status = 'pending')
    )
    INTO stats
    FROM staged_integration_products
    WHERE integration_run_id = run_id;

    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Function to process a single staged integration product
DROP FUNCTION IF EXISTS process_staged_integration_product();
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
        -- Validate that the product has either a valid EAN OR both Brand and SKU
        IF NOT ((NEW.ean IS NOT NULL AND NEW.ean != '') OR
                (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '')) THEN
            -- Product lacks sufficient data for matching, mark as error
            NEW.status := 'error';
            NEW.error_message := 'Product lacks sufficient data for matching. Requires either EAN or both SKU and brand.';
            RETURN NEW;
        END IF;

        -- Find or create the brand (only if brand is provided)
        IF NEW.brand IS NOT NULL AND NEW.brand != '' THEN
            SELECT find_or_create_brand(NEW.user_id, NEW.brand) INTO v_brand_id;
        ELSE
            -- If no brand is provided but we have EAN, we'll still process it
            -- but we won't try to find/create a brand
            v_brand_id := NULL;
        END IF;

        -- Look for an existing product by EAN (if available) or by SKU and brand
        IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
            SELECT id, our_price INTO existing_product_id, old_price
            FROM products
            WHERE user_id = NEW.user_id AND ean = NEW.ean
            LIMIT 1;
        ELSIF NEW.sku IS NOT NULL AND NEW.sku != '' AND v_brand_id IS NOT NULL THEN
            SELECT id, our_price INTO existing_product_id, old_price
            FROM products
            WHERE user_id = NEW.user_id AND sku = NEW.sku AND products.brand_id = v_brand_id
            LIMIT 1;
        END IF;

        -- Set the new price
        new_price := NEW.price;

        -- If product exists, update it
        IF existing_product_id IS NOT NULL THEN
            -- Update the product
            UPDATE products
            SET
                name = COALESCE(NEW.name, name),
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
                    currency_code
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
                    COALESCE(NEW.currency_code, 'SEK')
                WHERE old_price IS NOT NULL;
            END IF;

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

-- Create trigger for processing staged integration products
DROP TRIGGER IF EXISTS process_staged_integration_product_trigger ON staged_integration_products;
CREATE TRIGGER process_staged_integration_product_trigger
BEFORE UPDATE ON staged_integration_products
FOR EACH ROW
EXECUTE FUNCTION process_staged_integration_product();

-- Function to process all staged products for a run
CREATE OR REPLACE FUNCTION process_staged_integration_products(run_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    -- Process all pending products by updating them in place
    UPDATE staged_integration_products
    SET status = status  -- This is a no-op update that will trigger the AFTER UPDATE trigger
    WHERE integration_run_id = run_id AND status = 'pending';

    -- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

    -- Update the run status
    PERFORM update_integration_run_status(run_id);

    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Function to process pending integration products
CREATE OR REPLACE FUNCTION process_pending_integration_products(run_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    -- Force processing of any pending products by updating them in place
    UPDATE staged_integration_products
    SET status = status  -- This is a no-op update that will trigger the AFTER UPDATE trigger
    WHERE integration_run_id = run_id AND status = 'pending';

    -- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

    -- Update the run status
    PERFORM update_integration_run_status(run_id);

    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Function to retry error integration products
CREATE OR REPLACE FUNCTION retry_error_integration_products(run_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    -- Reset error products to pending status
    UPDATE staged_integration_products
    SET
        status = 'pending',
        error_message = NULL
    WHERE integration_run_id = run_id AND status = 'error';

    -- Force processing of these products
    UPDATE staged_integration_products
    SET status = status  -- This is a no-op update that will trigger the AFTER UPDATE trigger
    WHERE integration_run_id = run_id AND status = 'pending';

    -- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

    -- Update the run status
    PERFORM update_integration_run_status(run_id);

    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Function to update integration run status
CREATE OR REPLACE FUNCTION update_integration_run_status(run_id UUID)
RETURNS VOID AS $$
DECLARE
    stats JSONB;
    integration_record RECORD;
BEGIN
    -- Get the statistics
    SELECT get_integration_run_stats(run_id) INTO stats;

    -- Get the integration ID
    SELECT integration_id INTO integration_record
    FROM integration_runs
    WHERE id = run_id;

    -- If there are no pending products, mark the run as completed
    IF (stats->>'pending')::INTEGER = 0 THEN
        UPDATE integration_runs
        SET
            status = 'completed',
            completed_at = NOW(),
            products_processed = (stats->>'processed')::INTEGER,
            products_created = (stats->>'created')::INTEGER,
            products_updated = (stats->>'updated')::INTEGER,
            error_message = CASE
                WHEN (stats->>'errors')::INTEGER > 0
                THEN format('Completed with %s errors', (stats->>'errors')::INTEGER)
                ELSE NULL
            END
        WHERE id = run_id;

        -- Update the integration status
        UPDATE integrations
        SET
            status = 'active',
            last_sync_at = NOW(),
            last_sync_status = 'success'
        WHERE id = integration_record.integration_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 16. Function to get the latest competitor prices for a list of products
CREATE OR REPLACE FUNCTION get_latest_competitor_prices_for_products(
    p_user_id UUID,
    p_product_ids UUID[]
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    competitor_id UUID,
    new_price DECIMAL(10, 2),
    changed_at TIMESTAMP WITH TIME ZONE,
    competitors JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH LatestPrices AS (
        SELECT
            pc.id,
            pc.product_id,
            pc.competitor_id,
            pc.new_price,
            pc.changed_at,
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        WHERE pc.user_id = p_user_id
        AND pc.product_id = ANY(p_product_ids)
        AND pc.competitor_id IS NOT NULL
    )
    SELECT
        lp.id,
        lp.product_id,
        lp.competitor_id,
        lp.new_price,
        lp.changed_at,
        jsonb_build_object(
            'name', c.name,
            'website', c.website
        ) AS competitors
    FROM LatestPrices lp
    JOIN competitors c ON lp.competitor_id = c.id
    WHERE lp.rn = 1
    ORDER BY lp.product_id, lp.competitor_id;
END;
$$ LANGUAGE plpgsql;

-- 17. Function to get the latest integration prices for a list of products
CREATE OR REPLACE FUNCTION get_latest_integration_prices_for_products(
    p_user_id UUID,
    p_product_ids UUID[]
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    integration_id UUID,
    new_price DECIMAL(10, 2),
    changed_at TIMESTAMP WITH TIME ZONE,
    integrations JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH LatestPrices AS (
        SELECT
            pc.id,
            pc.product_id,
            pc.integration_id,
            pc.new_price,
            pc.changed_at,
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        WHERE pc.user_id = p_user_id
        AND pc.product_id = ANY(p_product_ids)
        AND pc.integration_id IS NOT NULL
    )
    SELECT
        lp.id,
        lp.product_id,
        lp.integration_id,
        lp.new_price,
        lp.changed_at,
        jsonb_build_object(
            'name', i.name,
            'platform', i.platform
        ) AS integrations
    FROM LatestPrices lp
    JOIN integrations i ON lp.integration_id = i.id
    WHERE lp.rn = 1
    ORDER BY lp.product_id, lp.integration_id;
END;
$$ LANGUAGE plpgsql;