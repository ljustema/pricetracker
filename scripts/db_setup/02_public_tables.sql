-- This SQL script sets up the application-specific tables in the public schema.
-- It should be run after 01_next_auth_schema.sql.

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  price_id TEXT,
  status TEXT DEFAULT 'inactive',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create competitors table
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  logo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  ean TEXT,
  brand TEXT,
  category TEXT,
  description TEXT,
  image_url TEXT,
  our_price DECIMAL(10, 2),
  cost_price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for improved product matching performance on products table
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_brand_sku ON products(brand, sku);

-- 5. Create scrapers table
CREATE TABLE IF NOT EXISTS scrapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  scraper_type TEXT DEFAULT 'ai', -- Type of scraper: 'ai', 'python', or 'csv'
  selectors JSONB, -- Made nullable since Python and CSV scrapers don't use selectors
  python_script TEXT, -- For storing Python code for Python scrapers
  script_metadata JSONB, -- For storing metadata about the script
  schedule JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE, -- Whether the scraper has been approved after testing
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  last_run TIMESTAMP WITH TIME ZONE,
  execution_time BIGINT, -- Time in milliseconds it took to run the scraper
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_products_per_second DECIMAL(10, 2) -- Products per second metric from the most recently completed successful run.
);

-- Add indexes for improved query performance on scrapers table
CREATE INDEX IF NOT EXISTS idx_scrapers_scraper_type ON scrapers(scraper_type);
CREATE INDEX IF NOT EXISTS idx_scrapers_competitor_id ON scrapers(competitor_id);
CREATE INDEX IF NOT EXISTS idx_scrapers_execution_time ON scrapers(execution_time);

-- Add comment to explain the purpose of scrapers table
COMMENT ON TABLE scrapers IS 'Stores scraper configurations for different types: AI, Python, and CSV';

-- 6. Create scraped_products table
CREATE TABLE IF NOT EXISTS scraped_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  scraper_id UUID REFERENCES scrapers(id), -- Made nullable to allow direct competitor-product relationships
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  url TEXT,
  image_url TEXT,
  sku TEXT,
  brand TEXT,
  ean TEXT, -- Added EAN for product matching
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create price_changes table
CREATE TABLE IF NOT EXISTS price_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  price_change_percentage DECIMAL(10, 2) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create scraper_runs table to track execution of scrapers
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY,
  scraper_id UUID REFERENCES scrapers(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'initializing',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_test_run BOOLEAN DEFAULT FALSE,
  product_count INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER,
  error_message TEXT,
  progress_messages TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms BIGINT, -- Total execution time of the scraper run in milliseconds (calculated from completed_at - started_at).
  products_per_second DECIMAL(10, 2) -- Calculated metric: product_count / (execution_time_ms / 1000.0). Null if execution time is zero or product_count is null.
);

-- Add indexes for improved query performance on scraper_runs table
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_id ON scraper_runs(scraper_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_is_test_run ON scraper_runs(is_test_run);