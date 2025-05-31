-- Migration: Rename companies table and create products dismissed duplicates
-- Date: 2025-01-27
-- Phase: 1A - Database Structure

-- Step 1: Rename companies table to user_settings
ALTER TABLE companies RENAME TO user_settings;

-- Step 2: Rename the function accordingly
ALTER FUNCTION get_or_create_company(uuid) RENAME TO get_or_create_user_settings;

-- Step 3: Update function body to reference new table name
CREATE OR REPLACE FUNCTION public.get_or_create_user_settings(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings_id UUID;
BEGIN
  -- Check if the user already has settings
  SELECT id INTO v_settings_id
  FROM public.user_settings
  WHERE user_id = p_user_id
  LIMIT 1;

  -- If not, create new user settings
  IF v_settings_id IS NULL THEN
    INSERT INTO public.user_settings (
      user_id,
      primary_currency,
      currency_format,
      matching_rules,
      price_thresholds
    ) VALUES (
      p_user_id,
      'SEK',
      '#,##0.00',
      '{"ean_priority": true, "sku_brand_fallback": true}'::jsonb,
      '{"significant_increase": 10.0, "significant_decrease": 5.0}'::jsonb
    )
    RETURNING id INTO v_settings_id;
  END IF;

  RETURN v_settings_id;
END;
$$;

-- Step 4: Create products dismissed duplicates table (copy from brand pattern)
CREATE TABLE products_dismissed_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id_1 UUID NOT NULL,
  product_id_2 UUID NOT NULL,
  dismissal_key TEXT NOT NULL,
  dismissed_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT product_id_order CHECK (product_id_1 < product_id_2),
  CONSTRAINT unique_dismissed_product_pair UNIQUE (user_id, product_id_1, product_id_2)
);

-- Step 5: Add foreign key constraints
ALTER TABLE products_dismissed_duplicates
ADD CONSTRAINT products_dismissed_duplicates_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE products_dismissed_duplicates
ADD CONSTRAINT products_dismissed_duplicates_product_id_1_fkey
FOREIGN KEY (product_id_1) REFERENCES products(id);

ALTER TABLE products_dismissed_duplicates
ADD CONSTRAINT products_dismissed_duplicates_product_id_2_fkey
FOREIGN KEY (product_id_2) REFERENCES products(id);

-- Step 6: Add indexes for performance
CREATE INDEX idx_products_dismissed_duplicates_user_id
ON products_dismissed_duplicates(user_id);

CREATE INDEX idx_products_dismissed_duplicates_products
ON products_dismissed_duplicates(product_id_1, product_id_2);

-- Step 7: Create SKU normalization function for fuzzy matching
CREATE OR REPLACE FUNCTION normalize_sku(sku TEXT) RETURNS TEXT AS $$
BEGIN
  -- Return NULL if input is NULL or empty
  IF sku IS NULL OR TRIM(sku) = '' THEN
    RETURN NULL;
  END IF;

  -- Remove common separators and normalize to uppercase
  RETURN REGEXP_REPLACE(UPPER(TRIM(sku)), '[^A-Z0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 8: Add comment to document the function
COMMENT ON FUNCTION normalize_sku(TEXT) IS 'Normalizes SKU by removing separators and converting to uppercase. Used for fuzzy SKU matching.';

-- Verification queries (run these to test)
-- SELECT normalize_sku('234-234'); -- Should return '234234'
-- SELECT normalize_sku('234+234'); -- Should return '234234'
-- SELECT normalize_sku('234 234'); -- Should return '234234'
-- SELECT normalize_sku('ABC-123-XYZ'); -- Should return 'ABC123XYZ'
