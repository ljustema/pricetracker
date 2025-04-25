-- Function to get the latest competitor prices for a list of products
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

-- Function to get the latest integration prices for a list of products
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
