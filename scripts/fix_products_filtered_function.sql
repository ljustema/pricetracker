-- Fix the get_products_filtered function to properly handle competitor_id
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
