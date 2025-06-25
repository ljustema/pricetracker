-- Enhanced Stock Analysis Functions and Views
-- This file contains all database functions and views for the comprehensive stock analysis system

-- =====================================================
-- FUNCTION: get_sales_analysis_data
-- Purpose: Calculate sales metrics for products based on stock decreases
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_sales_analysis_data(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_brand_filter TEXT DEFAULT NULL
) RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    brand TEXT,
    sku TEXT,
    total_sold BIGINT,
    avg_price NUMERIC,
    total_revenue NUMERIC,
    active_days BIGINT,
    revenue_percentage NUMERIC,
    avg_daily_sales NUMERIC,
    avg_daily_revenue NUMERIC
) LANGUAGE plpgsql AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH sales_data AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            SUM(ABS(sc.stock_change_quantity)) as total_sold,
            AVG(pc.new_competitor_price) as avg_price,
            SUM(ABS(sc.stock_change_quantity) * COALESCE(pc.new_competitor_price, 0)) as total_revenue,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_days
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT new_competitor_price
            FROM price_changes_competitors pc2
            WHERE pc2.product_id = p.id 
              AND pc2.user_id = p_user_id
              AND pc2.changed_at <= sc.changed_at
              AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
            ORDER BY pc2.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0  -- Only sales (decreases)
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
          AND (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
        GROUP BY p.id, p.name, p.brand, p.sku
    ),
    totals AS (
        SELECT 
            SUM(total_revenue) as grand_total_revenue
        FROM sales_data
    )
    SELECT 
        sd.id,
        sd.name,
        sd.brand,
        sd.sku,
        sd.total_sold,
        sd.avg_price,
        sd.total_revenue,
        sd.active_days,
        CASE 
            WHEN t.grand_total_revenue > 0 THEN (sd.total_revenue / t.grand_total_revenue * 100)
            ELSE 0 
        END as revenue_percentage,
        CASE 
            WHEN sd.active_days > 0 THEN (sd.total_sold::NUMERIC / sd.active_days)
            ELSE 0 
        END as avg_daily_sales,
        CASE 
            WHEN sd.active_days > 0 THEN (sd.total_revenue / sd.active_days)
            ELSE 0 
        END as avg_daily_revenue
    FROM sales_data sd
    CROSS JOIN totals t
    ORDER BY sd.total_sold DESC;
END;
$$;

-- =====================================================
-- FUNCTION: get_brand_performance_data
-- Purpose: Aggregate sales and revenue data by brand
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_brand_performance_data(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL
) RETURNS TABLE (
    brand TEXT,
    products_tracked BIGINT,
    total_sold BIGINT,
    total_revenue NUMERIC,
    avg_sales_per_product NUMERIC,
    active_days BIGINT,
    revenue_percentage NUMERIC,
    avg_daily_sales NUMERIC,
    avg_daily_revenue NUMERIC
) LANGUAGE plpgsql AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH brand_sales AS (
        SELECT 
            p.brand,
            COUNT(DISTINCT p.id) as products_tracked,
            SUM(ABS(sc.stock_change_quantity)) as total_sold,
            SUM(ABS(sc.stock_change_quantity) * COALESCE(pc.new_competitor_price, 0)) as total_revenue,
            AVG(ABS(sc.stock_change_quantity)) as avg_sales_per_product,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_days
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT new_competitor_price
            FROM price_changes_competitors pc2
            WHERE pc2.product_id = p.id 
              AND pc2.user_id = p_user_id
              AND pc2.changed_at <= sc.changed_at
              AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
            ORDER BY pc2.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        GROUP BY p.brand
    ),
    totals AS (
        SELECT SUM(total_revenue) as grand_total_revenue FROM brand_sales
    )
    SELECT 
        bs.brand,
        bs.products_tracked,
        bs.total_sold,
        bs.total_revenue,
        bs.avg_sales_per_product,
        bs.active_days,
        CASE 
            WHEN t.grand_total_revenue > 0 THEN (bs.total_revenue / t.grand_total_revenue * 100)
            ELSE 0 
        END as revenue_percentage,
        CASE 
            WHEN bs.active_days > 0 THEN (bs.total_sold::NUMERIC / bs.active_days)
            ELSE 0 
        END as avg_daily_sales,
        CASE 
            WHEN bs.active_days > 0 THEN (bs.total_revenue / bs.active_days)
            ELSE 0 
        END as avg_daily_revenue
    FROM brand_sales bs
    CROSS JOIN totals t
    ORDER BY bs.total_revenue DESC;
END;
$$;

-- =====================================================
-- FUNCTION: get_current_stock_analysis
-- Purpose: Analyze current inventory levels and stock distribution
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_current_stock_analysis(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL,
    p_brand_filter TEXT DEFAULT NULL
) RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    brand TEXT,
    sku TEXT,
    current_stock INTEGER,
    current_price NUMERIC,
    inventory_value NUMERIC,
    in_stock_flag INTEGER,
    total_products BIGINT,
    products_in_stock BIGINT,
    in_stock_percentage NUMERIC,
    total_inventory_value NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id, 
            competitor_id, 
            new_stock_quantity, 
            new_stock_status
        FROM stock_changes_competitors
        WHERE user_id = p_user_id 
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    stock_analysis AS (
        SELECT 
            p.id,
            p.name,
            p.brand,
            p.sku,
            cs.new_stock_quantity as current_stock,
            pc.new_competitor_price as current_price,
            (COALESCE(cs.new_stock_quantity, 0) * COALESCE(pc.new_competitor_price, 0)) as inventory_value,
            CASE WHEN cs.new_stock_quantity > 0 THEN 1 ELSE 0 END as in_stock_flag
        FROM current_stock cs
        JOIN products p ON cs.product_id = p.id
        LEFT JOIN LATERAL (
            SELECT new_competitor_price
            FROM price_changes_competitors pc2
            WHERE pc2.product_id = p.id 
              AND pc2.user_id = p_user_id
              AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
            ORDER BY pc2.changed_at DESC
            LIMIT 1
        ) pc ON true
        WHERE (p_brand_filter IS NULL OR p.brand ILIKE '%' || p_brand_filter || '%')
    ),
    totals AS (
        SELECT 
            COUNT(*) as total_products,
            SUM(in_stock_flag) as products_in_stock,
            SUM(inventory_value) as total_inventory_value
        FROM stock_analysis
    )
    SELECT 
        sa.id,
        sa.name,
        sa.brand,
        sa.sku,
        sa.current_stock,
        sa.current_price,
        sa.inventory_value,
        sa.in_stock_flag,
        t.total_products,
        t.products_in_stock,
        CASE 
            WHEN t.total_products > 0 THEN (t.products_in_stock::NUMERIC / t.total_products * 100)
            ELSE 0 
        END as in_stock_percentage,
        t.total_inventory_value
    FROM stock_analysis sa
    CROSS JOIN totals t
    ORDER BY sa.current_stock DESC NULLS LAST;
END;
$$;

-- =====================================================
-- FUNCTION: get_brand_stock_availability
-- Purpose: Calculate stock availability percentages by brand
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_brand_stock_availability(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL
) RETURNS TABLE (
    brand TEXT,
    total_products BIGINT,
    in_stock_products BIGINT,
    out_of_stock_products BIGINT,
    in_stock_percentage NUMERIC,
    out_of_stock_percentage NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id, 
            competitor_id, 
            new_stock_quantity, 
            new_stock_status
        FROM stock_changes_competitors
        WHERE user_id = p_user_id 
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    brand_availability AS (
        SELECT 
            p.brand,
            COUNT(*) as total_products,
            COUNT(CASE WHEN cs.new_stock_quantity > 0 THEN 1 END) as in_stock_products,
            COUNT(CASE WHEN cs.new_stock_quantity = 0 OR cs.new_stock_quantity IS NULL THEN 1 END) as out_of_stock_products
        FROM current_stock cs
        JOIN products p ON cs.product_id = p.id
        GROUP BY p.brand
    )
    SELECT 
        ba.brand,
        ba.total_products,
        ba.in_stock_products,
        ba.out_of_stock_products,
        CASE 
            WHEN ba.total_products > 0 THEN (ba.in_stock_products::NUMERIC / ba.total_products * 100)
            ELSE 0 
        END as in_stock_percentage,
        CASE 
            WHEN ba.total_products > 0 THEN (ba.out_of_stock_products::NUMERIC / ba.total_products * 100)
            ELSE 0 
        END as out_of_stock_percentage
    FROM brand_availability ba
    ORDER BY ba.in_stock_percentage DESC;
END;
$$;

-- =====================================================
-- FUNCTION: get_stock_turnover_analysis
-- Purpose: Calculate stock turnover ratios and dead stock detection
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_stock_turnover_analysis(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_dead_stock_days INTEGER DEFAULT 30
) RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    brand TEXT,
    sku TEXT,
    total_sales BIGINT,
    avg_stock_level NUMERIC,
    current_stock INTEGER,
    stock_turnover_ratio NUMERIC,
    stock_status TEXT,
    days_since_last_sale INTEGER,
    velocity_category TEXT,
    last_sale_date TIMESTAMP
) LANGUAGE plpgsql AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '90 days');
    date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH current_stock AS (
        SELECT DISTINCT ON (product_id, competitor_id)
            product_id,
            competitor_id,
            new_stock_quantity,
            changed_at
        FROM stock_changes_competitors
        WHERE user_id = p_user_id
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ORDER BY product_id, competitor_id, changed_at DESC
    ),
    sales_data AS (
        SELECT
            product_id,
            SUM(ABS(sc.stock_change_quantity)) as total_sales,
            COUNT(DISTINCT DATE(sc.changed_at)) as active_sales_days,
            MIN(sc.changed_at) as first_sale,
            MAX(sc.changed_at) as last_sale
        FROM stock_changes_competitors sc
        WHERE sc.user_id = p_user_id
          AND sc.stock_change_quantity < 0
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        GROUP BY product_id
    ),
    stock_history AS (
        SELECT
            product_id,
            AVG(new_stock_quantity) as avg_stock_level
        FROM stock_changes_competitors
        WHERE user_id = p_user_id
          AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
          AND changed_at >= date_filter_start
          AND changed_at <= date_filter_end
        GROUP BY product_id
    ),
    turnover_analysis AS (
        SELECT
            p.id,
            p.name,
            p.brand,
            p.sku,
            COALESCE(sd.total_sales, 0) as total_sales,
            COALESCE(sh.avg_stock_level, 0) as avg_stock_level,
            COALESCE(cs.new_stock_quantity, 0) as current_stock,
            -- Stock Turnover Ratio = Total Sales / Average Stock
            CASE
                WHEN sh.avg_stock_level > 0 THEN sd.total_sales / sh.avg_stock_level
                ELSE 0
            END as stock_turnover_ratio,
            -- Dead Stock Indicator
            CASE
                WHEN sd.last_sale < NOW() - INTERVAL '1 day' * p_dead_stock_days OR sd.last_sale IS NULL
                THEN 'Dead Stock'
                ELSE 'Active'
            END as stock_status,
            COALESCE(EXTRACT(DAYS FROM (NOW() - sd.last_sale))::INTEGER, 999) as days_since_last_sale,
            -- Velocity categories
            CASE
                WHEN COALESCE(sd.total_sales, 0) / NULLIF(sd.active_sales_days, 0) > 10 THEN 'Fast Mover'
                WHEN COALESCE(sd.total_sales, 0) / NULLIF(sd.active_sales_days, 0) > 3 THEN 'Medium Mover'
                ELSE 'Slow Mover'
            END as velocity_category,
            sd.last_sale
        FROM products p
        LEFT JOIN sales_data sd ON p.id = sd.product_id
        LEFT JOIN stock_history sh ON p.id = sh.product_id
        LEFT JOIN current_stock cs ON p.id = cs.product_id
        WHERE p.user_id = p_user_id
          AND (cs.product_id IS NOT NULL OR sd.product_id IS NOT NULL)
    )
    SELECT
        ta.id,
        ta.name,
        ta.brand,
        ta.sku,
        ta.total_sales,
        ta.avg_stock_level,
        ta.current_stock,
        ta.stock_turnover_ratio,
        ta.stock_status,
        ta.days_since_last_sale,
        ta.velocity_category,
        ta.last_sale
    FROM turnover_analysis ta
    ORDER BY ta.stock_turnover_ratio DESC NULLS LAST;
END;
$$;

-- =====================================================
-- FUNCTION: get_price_range_analysis
-- Purpose: Analyze sales distribution across different price segments
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_price_range_analysis(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL
) RETURNS TABLE (
    price_range TEXT,
    unique_products BIGINT,
    total_units_sold BIGINT,
    total_revenue NUMERIC,
    avg_price_in_range NUMERIC,
    revenue_percentage NUMERIC,
    range_order INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH price_ranges AS (
        SELECT
            CASE
                WHEN pc.new_competitor_price <= 500 THEN '1-500'
                WHEN pc.new_competitor_price <= 1000 THEN '501-1000'
                WHEN pc.new_competitor_price <= 1500 THEN '1001-1500'
                WHEN pc.new_competitor_price <= 2000 THEN '1501-2000'
                WHEN pc.new_competitor_price <= 3000 THEN '2001-3000'
                ELSE '3000+'
            END as price_range,
            CASE
                WHEN pc.new_competitor_price <= 500 THEN 1
                WHEN pc.new_competitor_price <= 1000 THEN 2
                WHEN pc.new_competitor_price <= 1500 THEN 3
                WHEN pc.new_competitor_price <= 2000 THEN 4
                WHEN pc.new_competitor_price <= 3000 THEN 5
                ELSE 6
            END as range_order,
            pc.new_competitor_price,
            p.name,
            p.brand,
            ABS(sc.stock_change_quantity) as units_sold,
            ABS(sc.stock_change_quantity) * pc.new_competitor_price as revenue
        FROM stock_changes_competitors sc
        JOIN products p ON sc.product_id = p.id
        JOIN price_changes_competitors pc ON pc.product_id = p.id
        WHERE sc.stock_change_quantity < 0
          AND sc.user_id = p_user_id
          AND pc.user_id = p_user_id
          AND sc.changed_at >= date_filter_start
          AND sc.changed_at <= date_filter_end
          AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
          AND (p_competitor_id IS NULL OR pc.competitor_id = p_competitor_id)
          -- Match price change to stock change timing
          AND pc.changed_at <= sc.changed_at
          AND pc.changed_at = (
              SELECT MAX(pc2.changed_at)
              FROM price_changes_competitors pc2
              WHERE pc2.product_id = pc.product_id
                AND pc2.user_id = pc.user_id
                AND pc2.changed_at <= sc.changed_at
                AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
          )
    ),
    range_analysis AS (
        SELECT
            price_range,
            range_order,
            COUNT(DISTINCT name) as unique_products,
            SUM(units_sold) as total_units_sold,
            SUM(revenue) as total_revenue,
            AVG(new_competitor_price) as avg_price_in_range
        FROM price_ranges
        GROUP BY price_range, range_order
    ),
    totals AS (
        SELECT SUM(total_revenue) as grand_total_revenue FROM range_analysis
    )
    SELECT
        ra.price_range,
        ra.unique_products,
        ra.total_units_sold,
        ra.total_revenue,
        ra.avg_price_in_range,
        CASE
            WHEN t.grand_total_revenue > 0 THEN (ra.total_revenue / t.grand_total_revenue * 100)
            ELSE 0
        END as revenue_percentage,
        ra.range_order
    FROM range_analysis ra
    CROSS JOIN totals t
    ORDER BY ra.range_order;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_sales_analysis_data IS 'Returns comprehensive sales analysis data for products based on stock decreases with revenue calculations and daily averages';
COMMENT ON FUNCTION public.get_brand_performance_data IS 'Returns brand-level sales performance metrics including revenue percentages and daily averages';
COMMENT ON FUNCTION public.get_current_stock_analysis IS 'Returns current stock levels, inventory values, and stock distribution analysis';
COMMENT ON FUNCTION public.get_brand_stock_availability IS 'Returns stock availability percentages by brand for inventory strategy analysis';
COMMENT ON FUNCTION public.get_stock_turnover_analysis IS 'Returns stock turnover ratios, dead stock detection, and velocity categorization';
COMMENT ON FUNCTION public.get_price_range_analysis IS 'Returns sales distribution analysis across different price segments';

-- =====================================================
-- PERFORMANCE INDEXES FOR STOCK ANALYSIS
-- Purpose: Optimize query performance for large datasets
-- =====================================================

-- Index for stock_changes_competitors table
CREATE INDEX IF NOT EXISTS idx_stock_changes_user_competitor_date
ON stock_changes_competitors (user_id, competitor_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_changes_product_date
ON stock_changes_competitors (product_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_changes_user_quantity_date
ON stock_changes_competitors (user_id, stock_change_quantity, changed_at)
WHERE stock_change_quantity < 0;

-- Index for price_changes_competitors table
CREATE INDEX IF NOT EXISTS idx_price_changes_user_competitor_date
ON price_changes_competitors (user_id, competitor_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_changes_product_date
ON price_changes_competitors (product_id, changed_at DESC);

-- Index for products table
CREATE INDEX IF NOT EXISTS idx_products_user_brand
ON products (user_id, brand);

CREATE INDEX IF NOT EXISTS idx_products_user_active
ON products (user_id, is_active)
WHERE is_active = true;

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_stock_changes_analysis
ON stock_changes_competitors (user_id, product_id, competitor_id, changed_at DESC, stock_change_quantity);

CREATE INDEX IF NOT EXISTS idx_price_changes_analysis
ON price_changes_competitors (user_id, product_id, competitor_id, changed_at DESC, new_competitor_price);

-- =====================================================
-- HELPER FUNCTION: get_comprehensive_analysis_summary
-- Purpose: Get summary statistics for all analysis modules
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_comprehensive_analysis_summary(
    p_user_id UUID,
    p_competitor_id UUID DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
    result JSON;
    date_filter_start TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    date_filter_end TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
    SELECT json_build_object(
        'total_sales', (
            SELECT COALESCE(SUM(ABS(stock_change_quantity)), 0)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND stock_change_quantity < 0
              AND changed_at >= date_filter_start
              AND changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ),
        'total_revenue', (
            SELECT COALESCE(SUM(ABS(sc.stock_change_quantity) * pc.new_competitor_price), 0)
            FROM stock_changes_competitors sc
            JOIN price_changes_competitors pc ON pc.product_id = sc.product_id
            WHERE sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND sc.changed_at >= date_filter_start
              AND sc.changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
              AND pc.changed_at <= sc.changed_at
        ),
        'unique_products_sold', (
            SELECT COUNT(DISTINCT product_id)
            FROM stock_changes_competitors
            WHERE user_id = p_user_id
              AND stock_change_quantity < 0
              AND changed_at >= date_filter_start
              AND changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
        ),
        'unique_brands_sold', (
            SELECT COUNT(DISTINCT p.brand)
            FROM stock_changes_competitors sc
            JOIN products p ON sc.product_id = p.id
            WHERE sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND sc.changed_at >= date_filter_start
              AND sc.changed_at <= date_filter_end
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
        ),
        'total_inventory_value', (
            WITH current_stock AS (
                SELECT DISTINCT ON (product_id, competitor_id)
                    product_id, new_stock_quantity
                FROM stock_changes_competitors
                WHERE user_id = p_user_id
                  AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
                ORDER BY product_id, competitor_id, changed_at DESC
            )
            SELECT COALESCE(SUM(cs.new_stock_quantity * pc.new_competitor_price), 0)
            FROM current_stock cs
            JOIN LATERAL (
                SELECT new_competitor_price
                FROM price_changes_competitors pc2
                WHERE pc2.product_id = cs.product_id
                  AND pc2.user_id = p_user_id
                  AND (p_competitor_id IS NULL OR pc2.competitor_id = p_competitor_id)
                ORDER BY pc2.changed_at DESC
                LIMIT 1
            ) pc ON true
            WHERE cs.new_stock_quantity > 0
        ),
        'dead_stock_count', (
            SELECT COUNT(DISTINCT p.id)
            FROM products p
            LEFT JOIN stock_changes_competitors sc ON p.id = sc.product_id
              AND sc.user_id = p_user_id
              AND sc.stock_change_quantity < 0
              AND (p_competitor_id IS NULL OR sc.competitor_id = p_competitor_id)
            WHERE p.user_id = p_user_id
              AND (sc.changed_at IS NULL OR sc.changed_at < NOW() - INTERVAL '30 days')
        ),
        'avg_daily_sales', (
            WITH daily_sales AS (
                SELECT DATE(changed_at) as sale_date, SUM(ABS(stock_change_quantity)) as daily_total
                FROM stock_changes_competitors
                WHERE user_id = p_user_id
                  AND stock_change_quantity < 0
                  AND changed_at >= date_filter_start
                  AND changed_at <= date_filter_end
                  AND (p_competitor_id IS NULL OR competitor_id = p_competitor_id)
                GROUP BY DATE(changed_at)
            )
            SELECT COALESCE(AVG(daily_total), 0) FROM daily_sales
        )
    ) INTO result;

    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_comprehensive_analysis_summary IS 'Returns comprehensive summary statistics for all stock analysis modules';
