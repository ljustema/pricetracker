-- Function to get unique products for an integration (products that only this integration has)
CREATE OR REPLACE FUNCTION get_unique_integration_products(p_user_id UUID, p_integration_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COUNT(DISTINCT pc1.product_id)
  FROM price_changes pc1
  WHERE pc1.user_id = p_user_id
    AND pc1.integration_id = p_integration_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_changes pc2
      WHERE pc2.user_id = p_user_id
        AND pc2.product_id = pc1.product_id
        AND (
          (pc2.integration_id IS NOT NULL AND pc2.integration_id != p_integration_id)
          OR pc2.competitor_id IS NOT NULL
        )
    );
$$;

-- Function to get unique products for a competitor (products that only this competitor has)
CREATE OR REPLACE FUNCTION get_unique_competitor_products(p_user_id UUID, p_competitor_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COUNT(DISTINCT pc1.product_id)
  FROM price_changes pc1
  WHERE pc1.user_id = p_user_id
    AND pc1.competitor_id = p_competitor_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_changes pc2
      WHERE pc2.user_id = p_user_id
        AND pc2.product_id = pc1.product_id
        AND (
          (pc2.competitor_id IS NOT NULL AND pc2.competitor_id != p_competitor_id)
          OR pc2.integration_id IS NOT NULL
        )
    );
$$;
