-- This SQL script sets up the application-specific tables in the public schema.
-- It should be run after 01_next_auth_schema.sql.
-- NOTE: For improved type safety in TypeScript code (e.g., workers, API routes),
-- remember to generate Supabase types after applying schema changes:
-- `supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/supabase/database.types.ts`

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
  wholesale_price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  brand_id UUID NOT NULL REFERENCES brands(id),
  currency_code TEXT CHECK (char_length(currency_code) = 3 AND currency_code = upper(currency_code)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for currency_code column
COMMENT ON COLUMN products.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

-- Add indexes for improved product matching performance on products table
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_brand_sku ON products(brand, sku);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- 5. Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for user_id and brand name
ALTER TABLE brands ADD CONSTRAINT unique_user_brand UNIQUE (user_id, name);

-- Add indexes for improved query performance on brands table
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands(is_active);
CREATE INDEX IF NOT EXISTS idx_brands_needs_review ON brands(needs_review);

-- 6. Create scrapers table
CREATE TABLE IF NOT EXISTS scrapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  scraper_type VARCHAR(20) DEFAULT 'ai', -- Type of scraper: 'ai', 'python', or 'typescript'. NOTE: Existing data might need manual migration if changing usage patterns.
  python_script TEXT, -- For storing Python code for Python scrapers
  typescript_script TEXT, -- For storing TypeScript code for Crawlee scrapers
  script_metadata JSONB, -- For storing metadata about the script
  schedule JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE, -- Whether the scraper has passed a Test Run and is eligible for activation
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  last_run TIMESTAMP WITH TIME ZONE,
  execution_time BIGINT, -- Time in milliseconds it took to run the scraper
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_products_per_second DECIMAL(10, 2), -- Products per second metric from the most recently completed successful run.
  filter_by_active_brands BOOLEAN DEFAULT FALSE NOT NULL, -- Flag to filter scraping by active brands
  scrape_only_own_products BOOLEAN DEFAULT FALSE NOT NULL, -- Flag to only scrape products matching user's catalog
  test_results JSONB -- For storing test run results
);

-- Drop the legacy approved_at column if it exists
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='scrapers' AND column_name='approved_at') THEN
    ALTER TABLE public.scrapers DROP COLUMN approved_at;
  END IF;
END $$;

-- Add filter_by_active_brands column if it doesn't exist (handles case where table was created before this column was added)
ALTER TABLE public.scrapers ADD COLUMN IF NOT EXISTS filter_by_active_brands BOOLEAN DEFAULT FALSE NOT NULL;

-- Add indexes for improved query performance on scrapers table
CREATE INDEX IF NOT EXISTS idx_scrapers_scraper_type ON scrapers(scraper_type);
CREATE INDEX IF NOT EXISTS idx_scrapers_competitor_id ON scrapers(competitor_id);
CREATE INDEX IF NOT EXISTS idx_scrapers_execution_time ON scrapers(execution_time);

-- Add comment to explain the purpose of scrapers table
COMMENT ON TABLE scrapers IS 'Stores scraper configurations for different types: AI, Python, and CSV';

-- 7. Create scraped_products table
CREATE TABLE IF NOT EXISTS scraped_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  scraper_id UUID REFERENCES scrapers(id), -- Made nullable to allow direct competitor-product relationships
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  currency_code TEXT CHECK (char_length(currency_code) = 3 AND currency_code = upper(currency_code)),
  url TEXT,
  image_url TEXT,
  sku TEXT,
  brand TEXT,
  ean TEXT, -- Added EAN for product matching
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for currency_code column
COMMENT ON COLUMN scraped_products.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

-- Add indexes for improved query performance on scraped_products table
CREATE INDEX IF NOT EXISTS idx_scraped_products_ean ON scraped_products(ean);
CREATE INDEX IF NOT EXISTS idx_scraped_products_brand_sku ON scraped_products(brand, sku);
CREATE INDEX IF NOT EXISTS idx_scraped_products_scraper_id_scraped_at ON scraped_products(scraper_id, scraped_at);

-- 8. Create price_changes table
CREATE TABLE IF NOT EXISTS price_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  price_change_percentage DECIMAL(10, 2) NOT NULL,
  currency_code TEXT CHECK (char_length(currency_code) = 3 AND currency_code = upper(currency_code)),
  integration_id UUID REFERENCES integrations(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for currency_code column
COMMENT ON COLUMN price_changes.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

-- Add indexes for improved query performance on price_changes table
CREATE INDEX IF NOT EXISTS idx_price_changes_product_id ON price_changes(product_id);
CREATE INDEX IF NOT EXISTS idx_price_changes_competitor_id ON price_changes(competitor_id);

-- 9. Create scraper_runs table to track execution of scrapers
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
  error_details TEXT, -- Detailed error information for debugging
  progress_messages TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms BIGINT, -- Total execution time of the scraper run in milliseconds (calculated from completed_at - started_at).
  products_per_second DECIMAL(10, 2), -- Calculated metric: product_count / (execution_time_ms / 1000.0). Null if execution time is zero or product_count is null.
  scraper_type VARCHAR(20) -- Type of scraper: 'python', 'typescript', etc.
);

-- Add indexes for improved query performance on scraper_runs table
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_id ON scraper_runs(scraper_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_is_test_run ON scraper_runs(is_test_run);

-- 10. Create scraper_run_timeouts table to track timeouts for scraper runs
CREATE TABLE IF NOT EXISTS scraper_run_timeouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES scraper_runs(id) ON DELETE CASCADE,
  timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create an index on timeout_at and processed for efficient querying
CREATE INDEX IF NOT EXISTS idx_scraper_run_timeouts_lookup
ON scraper_run_timeouts(timeout_at, processed);

-- Create an index on run_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scraper_run_timeouts_run_id
ON scraper_run_timeouts(run_id);

-- Add a comment to the table
COMMENT ON TABLE scraper_run_timeouts IS 'Stores timeout information for scraper runs';

-- 11. Create csv_uploads table to track CSV file uploads
CREATE TABLE IF NOT EXISTS csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  filename TEXT NOT NULL,
  file_content TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Add indexes for improved query performance on csv_uploads table
CREATE INDEX IF NOT EXISTS idx_csv_uploads_user_id ON csv_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_csv_uploads_competitor_id ON csv_uploads(competitor_id);
CREATE INDEX IF NOT EXISTS idx_csv_uploads_processed ON csv_uploads(processed);

-- Add a comment to the table
COMMENT ON TABLE csv_uploads IS 'Stores CSV file uploads for processing';

-- 12. Create debug_logs table for application logging
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add an index for improved query performance on debug_logs table
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at);

-- Add a comment to the table
COMMENT ON TABLE debug_logs IS 'Stores debug logs for application troubleshooting';

-- 13. Create dismissed_duplicates table to track dismissed duplicate brands
CREATE TABLE IF NOT EXISTS dismissed_duplicates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id_1 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  brand_id_2 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  dismissal_key TEXT NOT NULL, -- A key to group related dismissals
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure we don't have duplicate entries for the same brand pair
  CONSTRAINT unique_dismissed_pair UNIQUE (user_id, brand_id_1, brand_id_2),

  -- Ensure brand_id_1 is always less than brand_id_2 for consistency
  CONSTRAINT brand_id_order CHECK (brand_id_1 < brand_id_2)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dismissed_duplicates_user_id ON dismissed_duplicates(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_duplicates_brand_ids ON dismissed_duplicates(brand_id_1, brand_id_2);

-- Add RLS policies
ALTER TABLE dismissed_duplicates ENABLE ROW LEVEL SECURITY;

-- 14. Create brand_aliases table to track brand aliases (merged brand names)
CREATE TABLE IF NOT EXISTS brand_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure we don't have duplicate aliases for the same brand
  CONSTRAINT unique_brand_alias UNIQUE (user_id, brand_id, alias_name)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_brand_aliases_brand_id ON brand_aliases(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_alias_name ON brand_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_user_id ON brand_aliases(user_id);

-- Add RLS policies
ALTER TABLE brand_aliases ENABLE ROW LEVEL SECURITY;

-- 15. Create staged_integration_products table for integration imports
CREATE TABLE IF NOT EXISTS staged_integration_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_run_id UUID NOT NULL,
  integration_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  prestashop_product_id TEXT,
  name TEXT NOT NULL,
  sku TEXT,
  ean TEXT,
  brand TEXT,
  price NUMERIC,
  wholesale_price NUMERIC,
  image_url TEXT,
  raw_data JSONB,
  status TEXT DEFAULT 'pending' NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  product_id UUID,
  currency_code TEXT CHECK (char_length(currency_code) = 3 AND currency_code = upper(currency_code))
);

-- Add comment for currency_code column
COMMENT ON COLUMN staged_integration_products.currency_code IS 'ISO 4217 currency code from the integration source';

-- Add indexes for improved query performance on staged_integration_products table
CREATE INDEX IF NOT EXISTS idx_staged_integration_products_integration_run_id ON staged_integration_products(integration_run_id);
CREATE INDEX IF NOT EXISTS idx_staged_integration_products_user_id ON staged_integration_products(user_id);
CREATE INDEX IF NOT EXISTS idx_staged_integration_products_status ON staged_integration_products(status);

-- 16. Create integrations table for external platform connections
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending_setup' NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  sync_frequency TEXT DEFAULT 'daily',
  configuration JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for improved query performance on integrations table
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- Add comment to the table
COMMENT ON TABLE integrations IS 'Stores external platform integrations like PrestaShop, WooCommerce, etc.';

-- 17. Create integration_runs table to track integration syncs
CREATE TABLE IF NOT EXISTS integration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  products_processed INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_created INTEGER DEFAULT 0,
  error_message TEXT,
  log_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  test_products JSONB,
  configuration JSONB
);

-- Add indexes for improved query performance on integration_runs table
CREATE INDEX IF NOT EXISTS idx_integration_runs_integration_id ON integration_runs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_runs_user_id ON integration_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_runs_status ON integration_runs(status);

-- Add comment to the table
COMMENT ON TABLE integration_runs IS 'Tracks execution of integration syncs with external platforms';