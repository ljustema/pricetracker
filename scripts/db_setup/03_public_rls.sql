-- This SQL script sets up Row Level Security (RLS) for the public schema tables.
-- It should be run after 02_public_tables.sql.

-- 1. RLS for user_profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 2. RLS for user_subscriptions table
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. RLS for competitors table
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own competitors" ON competitors;
CREATE POLICY "Users can view their own competitors"
  ON competitors
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own competitors" ON competitors;
CREATE POLICY "Users can insert their own competitors"
  ON competitors
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own competitors" ON competitors;
CREATE POLICY "Users can update their own competitors"
  ON competitors
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own competitors" ON competitors;
CREATE POLICY "Users can delete their own competitors"
  ON competitors
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. RLS for products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own products" ON products;
CREATE POLICY "Users can view their own products"
  ON products
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own products" ON products;
CREATE POLICY "Users can insert their own products"
  ON products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own products" ON products;
CREATE POLICY "Users can update their own products"
  ON products
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own products" ON products;
CREATE POLICY "Users can delete their own products"
  ON products
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RLS for scrapers table
ALTER TABLE scrapers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scrapers" ON scrapers;
CREATE POLICY "Users can view their own scrapers"
  ON scrapers
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scrapers" ON scrapers;
CREATE POLICY "Users can insert their own scrapers"
  ON scrapers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own scrapers" ON scrapers;
CREATE POLICY "Users can update their own scrapers"
  ON scrapers
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own scrapers" ON scrapers;
CREATE POLICY "Users can delete their own scrapers"
  ON scrapers
  FOR DELETE
  USING (auth.uid() = user_id);

-- 6. RLS for scraped_products table
ALTER TABLE scraped_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scraped products" ON scraped_products;
CREATE POLICY "Users can view their own scraped products"
  ON scraped_products
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scraped products" ON scraped_products;
CREATE POLICY "Users can insert their own scraped products"
  ON scraped_products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. RLS for price_changes table
ALTER TABLE price_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own price changes" ON price_changes;
CREATE POLICY "Users can view their own price changes"
  ON price_changes
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own price changes" ON price_changes;
CREATE POLICY "Users can insert their own price changes"
  ON price_changes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. RLS for scraper_runs table
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own scraper runs" ON scraper_runs;
CREATE POLICY "Users can view their own scraper runs"
  ON scraper_runs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scraper runs" ON scraper_runs;
CREATE POLICY "Users can insert their own scraper runs"
  ON scraper_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own scraper runs" ON scraper_runs;
CREATE POLICY "Users can update their own scraper runs"
  ON scraper_runs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 9. RLS for brands table
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own brands" ON brands;
CREATE POLICY "Users can view their own brands"
  ON brands
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own brands" ON brands;
CREATE POLICY "Users can insert their own brands"
  ON brands
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own brands" ON brands;
CREATE POLICY "Users can update their own brands"
  ON brands
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own brands" ON brands;
CREATE POLICY "Users can delete their own brands"
  ON brands
  FOR DELETE
  USING (auth.uid() = user_id);

-- 10. RLS for dismissed_duplicates table
ALTER TABLE dismissed_duplicates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own dismissed duplicates" ON dismissed_duplicates;
CREATE POLICY "Users can view their own dismissed duplicates"
  ON dismissed_duplicates
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own dismissed duplicates" ON dismissed_duplicates;
CREATE POLICY "Users can insert their own dismissed duplicates"
  ON dismissed_duplicates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own dismissed duplicates" ON dismissed_duplicates;
CREATE POLICY "Users can delete their own dismissed duplicates"
  ON dismissed_duplicates
  FOR DELETE
  USING (auth.uid() = user_id);

-- 11. RLS for brand_aliases table
ALTER TABLE brand_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own brand aliases" ON brand_aliases;
CREATE POLICY "Users can view their own brand aliases"
  ON brand_aliases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own brand aliases" ON brand_aliases;
CREATE POLICY "Users can insert their own brand aliases"
  ON brand_aliases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own brand aliases" ON brand_aliases;
CREATE POLICY "Users can delete their own brand aliases"
  ON brand_aliases
  FOR DELETE
  USING (auth.uid() = user_id);

-- 12. RLS for staged_integration_products table
ALTER TABLE staged_integration_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own staged integration products" ON staged_integration_products;
CREATE POLICY "Users can view their own staged integration products"
  ON staged_integration_products
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own staged integration products" ON staged_integration_products;
CREATE POLICY "Users can insert their own staged integration products"
  ON staged_integration_products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own staged integration products" ON staged_integration_products;
CREATE POLICY "Users can update their own staged integration products"
  ON staged_integration_products
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own staged integration products" ON staged_integration_products;
CREATE POLICY "Users can delete their own staged integration products"
  ON staged_integration_products
  FOR DELETE
  USING (auth.uid() = user_id);

-- 13. RLS for integrations table
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own integrations" ON integrations;
CREATE POLICY "Users can view their own integrations"
  ON integrations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own integrations" ON integrations;
CREATE POLICY "Users can insert their own integrations"
  ON integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own integrations" ON integrations;
CREATE POLICY "Users can update their own integrations"
  ON integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own integrations" ON integrations;
CREATE POLICY "Users can delete their own integrations"
  ON integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- 14. RLS for integration_runs table
ALTER TABLE integration_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own integration runs" ON integration_runs;
CREATE POLICY "Users can view their own integration runs"
  ON integration_runs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own integration runs" ON integration_runs;
CREATE POLICY "Users can insert their own integration runs"
  ON integration_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own integration runs" ON integration_runs;
CREATE POLICY "Users can update their own integration runs"
  ON integration_runs
  FOR UPDATE
  USING (auth.uid() = user_id);