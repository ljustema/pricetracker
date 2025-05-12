-- Migration to update the get_latest_competitor_prices function to use URLs from price_changes table

-- Drop the existing function
DROP FUNCTION IF EXISTS get_latest_competitor_prices(UUID, UUID);

-- Create the updated function with the url column from price_changes for competitors
CREATE OR REPLACE FUNCTION get_latest_competitor_prices(
    p_user_id UUID,
    p_product_id UUID
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    competitor_id UUID,
    integration_id UUID,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2),
    price_change_percentage DECIMAL(10, 2),
    currency_code TEXT,
    changed_at TIMESTAMP WITH TIME ZONE,
    source_type TEXT,
    source_name TEXT,
    source_website TEXT,
    source_platform TEXT,
    source_id UUID,
    url TEXT
) AS $$
BEGIN
    -- First get competitor prices
    RETURN QUERY
    WITH LatestCompetitorPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'competitor'::TEXT AS source_type,
            c.name AS source_name,
            c.website AS source_website,
            NULL::TEXT AS source_platform,
            pc.competitor_id AS source_id,
            pc.url AS url, -- Use URL from price_changes table for competitor prices
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.competitor_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.competitor_id IS NOT NULL
    ),
    LatestIntegrationPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'integration'::TEXT AS source_type,
            i.name AS source_name,
            NULL::TEXT AS source_website,
            i.platform AS source_platform,
            pc.integration_id AS source_id,
            COALESCE(pc.url, p.url) AS url, -- Try price_changes URL first, then products URL
            ROW_NUMBER() OVER(PARTITION BY pc.product_id, pc.integration_id ORDER BY pc.changed_at DESC) as rn
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        JOIN products p ON pc.product_id = p.id -- Join with products to get url
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.integration_id IS NOT NULL
    )
    (
        SELECT
            lcp.id AS id,
            lcp.product_id AS product_id,
            lcp.competitor_id AS competitor_id,
            lcp.integration_id AS integration_id,
            lcp.old_price AS old_price,
            lcp.new_price AS new_price,
            lcp.price_change_percentage AS price_change_percentage,
            lcp.currency_code AS currency_code,
            lcp.changed_at AS changed_at,
            lcp.source_type AS source_type,
            lcp.source_name AS source_name,
            lcp.source_website AS source_website,
            lcp.source_platform AS source_platform,
            lcp.source_id AS source_id,
            lcp.url AS url
        FROM LatestCompetitorPrices lcp
        WHERE lcp.rn = 1
    )
    UNION ALL
    (
        SELECT
            lip.id AS id,
            lip.product_id AS product_id,
            lip.competitor_id AS competitor_id,
            lip.integration_id AS integration_id,
            lip.old_price AS old_price,
            lip.new_price AS new_price,
            lip.price_change_percentage AS price_change_percentage,
            lip.currency_code AS currency_code,
            lip.changed_at AS changed_at,
            lip.source_type AS source_type,
            lip.source_name AS source_name,
            lip.source_website AS source_website,
            lip.source_platform AS source_platform,
            lip.source_id AS source_id,
            lip.url AS url
        FROM LatestIntegrationPrices lip
        WHERE lip.rn = 1
    )
    ORDER BY changed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Also update the get_product_price_history function to use URLs from price_changes
DROP FUNCTION IF EXISTS get_product_price_history(UUID, UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_product_price_history(
    p_user_id UUID,
    p_product_id UUID,
    p_source_id UUID,
    p_limit INTEGER
)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    competitor_id UUID,
    integration_id UUID,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2),
    price_change_percentage DECIMAL(10, 2),
    currency_code TEXT,
    changed_at TIMESTAMP WITH TIME ZONE,
    source_type TEXT,
    source_name TEXT,
    source_website TEXT,
    source_platform TEXT,
    source_id UUID,
    url TEXT
) AS $$
BEGIN
    -- First get competitor prices
    RETURN QUERY
    WITH CompetitorPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'competitor'::TEXT AS source_type,
            c.name AS source_name,
            c.website AS source_website,
            NULL::TEXT AS source_platform,
            pc.competitor_id AS source_id,
            pc.url AS url -- Use URL from price_changes table
        FROM price_changes pc
        JOIN competitors c ON pc.competitor_id = c.id
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.competitor_id IS NOT NULL
        AND (p_source_id IS NULL OR pc.competitor_id = p_source_id)
    ),
    IntegrationPrices AS (
        SELECT
            pc.id AS id,
            pc.product_id AS product_id,
            pc.competitor_id AS competitor_id,
            pc.integration_id AS integration_id,
            pc.old_price AS old_price,
            pc.new_price AS new_price,
            pc.price_change_percentage AS price_change_percentage,
            pc.currency_code AS currency_code,
            pc.changed_at AS changed_at,
            'integration'::TEXT AS source_type,
            i.name AS source_name,
            NULL::TEXT AS source_website,
            i.platform AS source_platform,
            pc.integration_id AS source_id,
            COALESCE(pc.url, p.url) AS url -- Try price_changes URL first, then products URL
        FROM price_changes pc
        JOIN integrations i ON pc.integration_id = i.id
        JOIN products p ON pc.product_id = p.id -- Join with products to get url
        WHERE pc.user_id = p_user_id
        AND pc.product_id = p_product_id
        AND pc.integration_id IS NOT NULL
        AND (p_source_id IS NULL OR pc.integration_id = p_source_id)
    )
    (
        SELECT
            cp.id AS id,
            cp.product_id AS product_id,
            cp.competitor_id AS competitor_id,
            cp.integration_id AS integration_id,
            cp.old_price AS old_price,
            cp.new_price AS new_price,
            cp.price_change_percentage AS price_change_percentage,
            cp.currency_code AS currency_code,
            cp.changed_at AS changed_at,
            cp.source_type AS source_type,
            cp.source_name AS source_name,
            cp.source_website AS source_website,
            cp.source_platform AS source_platform,
            cp.source_id AS source_id,
            cp.url AS url
        FROM CompetitorPrices cp
    )
    UNION ALL
    (
        SELECT
            ip.id AS id,
            ip.product_id AS product_id,
            ip.competitor_id AS competitor_id,
            ip.integration_id AS integration_id,
            ip.old_price AS old_price,
            ip.new_price AS new_price,
            ip.price_change_percentage AS price_change_percentage,
            ip.currency_code AS currency_code,
            ip.changed_at AS changed_at,
            ip.source_type AS source_type,
            ip.source_name AS source_name,
            ip.source_website AS source_website,
            ip.source_platform AS source_platform,
            ip.source_id AS source_id,
            ip.url AS url
        FROM IntegrationPrices ip
    )
    ORDER BY changed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Notify of completion
SELECT 'Migration completed: Updated get_latest_competitor_prices and get_product_price_history functions to use URLs from price_changes table.' AS result;
