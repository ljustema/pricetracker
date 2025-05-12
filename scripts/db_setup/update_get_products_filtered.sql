-- Update the get_products_filtered function to add price comparison filters
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
    p_has_price boolean DEFAULT NULL, -- NULL means don't filter, true means has our_price
    p_price_lower_than_competitors boolean DEFAULT NULL, -- NULL means don't filter, true means our_price < competitor_price
    p_price_higher_than_competitors boolean DEFAULT NULL -- NULL means don't filter, true means our_price > competitor_price
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
        WITH LatestCompetitorPrices AS (
            SELECT
                pc.product_id,
                MIN(pc.new_price) as min_competitor_price
            FROM price_changes pc
            WHERE pc.user_id = %L
            AND pc.competitor_id IS NOT NULL
            GROUP BY pc.product_id
        )
        SELECT count(DISTINCT p.id)
        FROM products p
        LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
        LEFT JOIN LatestCompetitorPrices lcp ON p.id = lcp.product_id
        WHERE p.user_id = %L', p_user_id, p_user_id);

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

    -- Add price comparison filters to count query
    IF p_price_lower_than_competitors = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL AND lcp.min_competitor_price IS NOT NULL AND p.our_price < lcp.min_competitor_price';
    END IF;
    IF p_price_higher_than_competitors = TRUE THEN
        _count_query := _count_query || ' AND p.our_price IS NOT NULL AND lcp.min_competitor_price IS NOT NULL AND p.our_price > lcp.min_competitor_price';
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
        WITH LatestCompetitorPrices AS (
            SELECT
                pc.product_id,
                MIN(pc.new_price) as min_competitor_price
            FROM price_changes pc
            WHERE pc.user_id = %L
            AND pc.competitor_id IS NOT NULL
            GROUP BY pc.product_id
        ),
        FilteredProductsBase AS ( -- Renamed to avoid conflict later
            SELECT p.id
            FROM products p
            LEFT JOIN price_changes pc_filter ON pc_filter.product_id = p.id AND pc_filter.user_id = p.user_id
            LEFT JOIN LatestCompetitorPrices lcp ON p.id = lcp.product_id
            WHERE p.user_id = %L', p_user_id, p_user_id);

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

    -- Add price comparison filters to data query
    IF p_price_lower_than_competitors = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL AND lcp.min_competitor_price IS NOT NULL AND p.our_price < lcp.min_competitor_price';
    END IF;
    IF p_price_higher_than_competitors = TRUE THEN
        _query := _query || ' AND p.our_price IS NOT NULL AND lcp.min_competitor_price IS NOT NULL AND p.our_price > lcp.min_competitor_price';
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
    -- Add id as a secondary sort to ensure consistent ordering
    _query := _query || format('
            GROUP BY p.id -- Ensure unique product IDs before sorting/limiting
            ORDER BY p.%I %s, p.id ASC
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
        ORDER BY p.%I %s, p.id ASC', -- Apply final sorting based on the main product table fields with id as secondary sort
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
