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