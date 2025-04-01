-- This SQL script sets up the complete database for the PriceTracker application
-- It includes both the NextAuth.js tables in the next_auth schema
-- and the application-specific tables in the public schema

-- PART 1: Set up the next_auth schema for NextAuth.js
--
-- Name: next_auth; Type: SCHEMA;
--
CREATE SCHEMA next_auth;
 
GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT ALL ON SCHEMA next_auth TO postgres;
 
--
-- Create users table
--
CREATE TABLE IF NOT EXISTS next_auth.users
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT email_unique UNIQUE (email)
);
 
GRANT ALL ON TABLE next_auth.users TO postgres;
GRANT ALL ON TABLE next_auth.users TO service_role;
 
--- uid() function to be used in RLS policies
CREATE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::uuid
$$;
 
--
-- Create sessions table
--
CREATE TABLE IF NOT EXISTS next_auth.sessions
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessionToken_unique UNIQUE ("sessionToken"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);
 
GRANT ALL ON TABLE next_auth.sessions TO postgres;
GRANT ALL ON TABLE next_auth.sessions TO service_role;
 
--
-- Create accounts table
--
CREATE TABLE IF NOT EXISTS next_auth.accounts
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);
 
GRANT ALL ON TABLE next_auth.accounts TO postgres;
GRANT ALL ON TABLE next_auth.accounts TO service_role;
 
--
-- Create verification_tokens table
--
CREATE TABLE IF NOT EXISTS next_auth.verification_tokens
(
    identifier text,
    token text,
    expires timestamp with time zone NOT NULL,
    CONSTRAINT verification_tokens_pkey PRIMARY KEY (token),
    CONSTRAINT token_unique UNIQUE (token),
    CONSTRAINT token_identifier_unique UNIQUE (token, identifier)
);
 
GRANT ALL ON TABLE next_auth.verification_tokens TO postgres;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role;

-- PART 2: Set up the application-specific tables in the public schema

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy for users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create trigger to create profile on user creation
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;
CREATE TRIGGER create_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_user();

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

-- Set up Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

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

-- Set up Row Level Security
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own competitors
DROP POLICY IF EXISTS "Users can view their own competitors" ON competitors;
CREATE POLICY "Users can view their own competitors"
  ON competitors
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own competitors
DROP POLICY IF EXISTS "Users can insert their own competitors" ON competitors;
CREATE POLICY "Users can insert their own competitors"
  ON competitors
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own competitors
DROP POLICY IF EXISTS "Users can update their own competitors" ON competitors;
CREATE POLICY "Users can update their own competitors"
  ON competitors
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy for users to delete their own competitors
DROP POLICY IF EXISTS "Users can delete their own competitors" ON competitors;
CREATE POLICY "Users can delete their own competitors"
  ON competitors
  FOR DELETE
  USING (auth.uid() = user_id);

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

-- Set up Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own products
DROP POLICY IF EXISTS "Users can view their own products" ON products;
CREATE POLICY "Users can view their own products"
  ON products
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own products
DROP POLICY IF EXISTS "Users can insert their own products" ON products;
CREATE POLICY "Users can insert their own products"
  ON products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own products
DROP POLICY IF EXISTS "Users can update their own products" ON products;
CREATE POLICY "Users can update their own products"
  ON products
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy for users to delete their own products
DROP POLICY IF EXISTS "Users can delete their own products" ON products;
CREATE POLICY "Users can delete their own products"
  ON products
  FOR DELETE
  USING (auth.uid() = user_id);

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

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_scrapers_scraper_type ON scrapers(scraper_type);
CREATE INDEX IF NOT EXISTS idx_scrapers_competitor_id ON scrapers(competitor_id);
CREATE INDEX IF NOT EXISTS idx_scrapers_execution_time ON scrapers(execution_time);

-- Add comment to explain the purpose of this table
COMMENT ON TABLE scrapers IS 'Stores scraper configurations for different types: AI, Python, and CSV';

-- Set up Row Level Security
ALTER TABLE scrapers ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own scrapers
DROP POLICY IF EXISTS "Users can view their own scrapers" ON scrapers;
CREATE POLICY "Users can view their own scrapers"
  ON scrapers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own scrapers
DROP POLICY IF EXISTS "Users can insert their own scrapers" ON scrapers;
CREATE POLICY "Users can insert their own scrapers"
  ON scrapers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own scrapers
DROP POLICY IF EXISTS "Users can update their own scrapers" ON scrapers;
CREATE POLICY "Users can update their own scrapers"
  ON scrapers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy for users to delete their own scrapers
DROP POLICY IF EXISTS "Users can delete their own scrapers" ON scrapers;
CREATE POLICY "Users can delete their own scrapers"
  ON scrapers
  FOR DELETE
  USING (auth.uid() = user_id);

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

-- Add indexes for improved product matching performance
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_brand_sku ON products(brand, sku);

-- Set up Row Level Security
ALTER TABLE scraped_products ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own scraped products
DROP POLICY IF EXISTS "Users can view their own scraped products" ON scraped_products;
CREATE POLICY "Users can view their own scraped products"
  ON scraped_products
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own scraped products
DROP POLICY IF EXISTS "Users can insert their own scraped products" ON scraped_products;
CREATE POLICY "Users can insert their own scraped products"
  ON scraped_products
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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

-- Set up Row Level Security
ALTER TABLE price_changes ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own price changes
DROP POLICY IF EXISTS "Users can view their own price changes" ON price_changes;
CREATE POLICY "Users can view their own price changes"
  ON price_changes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own price changes
DROP POLICY IF EXISTS "Users can insert their own price changes" ON price_changes;
CREATE POLICY "Users can insert their own price changes"
  ON price_changes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. Create a function to detect and record price changes with enhanced product matching
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
DECLARE
  last_price DECIMAL(10, 2);
  price_change_pct DECIMAL(10, 2);
  matched_product_id UUID;
  debug_info TEXT;
BEGIN
  -- Log function start (commented for production)
  -- INSERT INTO debug_logs (message)
  -- VALUES ('Trigger started for product: ' || NEW.name || ', ID: ' || NEW.id);

  -- If product_id is not set, try to match with an existing product
  IF NEW.product_id IS NULL THEN
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Product ID is NULL, trying to match product: ' || NEW.name);
    
    -- First try to match by EAN if available
    IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
      SELECT id INTO matched_product_id
      FROM products
      WHERE user_id = NEW.user_id AND ean = NEW.ean
      LIMIT 1;
      
      IF matched_product_id IS NOT NULL THEN
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Matched by EAN: ' || NEW.ean || ', Product ID: ' || matched_product_id);
      END IF;
    END IF;
    
    -- If no match by EAN and we have brand and SKU, try matching by those
    IF matched_product_id IS NULL AND NEW.brand IS NOT NULL AND NEW.sku IS NOT NULL
       AND NEW.brand != '' AND NEW.sku != '' THEN
      SELECT id INTO matched_product_id
      FROM products
      WHERE user_id = NEW.user_id AND brand = NEW.brand AND sku = NEW.sku
      LIMIT 1;
      
      IF matched_product_id IS NOT NULL THEN
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Matched by Brand+SKU: ' || NEW.brand || '+' || NEW.sku || ', Product ID: ' || matched_product_id);
      END IF;
    END IF;
    
    -- If no match found, check if we have enough data to create a new product
    IF matched_product_id IS NULL THEN
      -- Check if the product has either a valid EAN OR both Brand and SKU
      IF (NEW.ean IS NOT NULL AND NEW.ean != '') OR
         (NEW.brand IS NOT NULL AND NEW.brand != '' AND NEW.sku IS NOT NULL AND NEW.sku != '') THEN
        
        -- Product has sufficient data, create a new product
        -- INSERT INTO debug_logs (message)
        -- VALUES ('No match found, creating new product: ' || NEW.name);
        
        INSERT INTO products (
          user_id,
          name,
          sku,
          ean,
          brand,
          image_url
        ) VALUES (
          NEW.user_id,
          NEW.name,
          NEW.sku,
          NEW.ean,
          NEW.brand,
          NEW.image_url
        )
        RETURNING id INTO matched_product_id;
        
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Created new product with ID: ' || matched_product_id);
        
        -- Update scraped_product with the new product_id
        UPDATE scraped_products
        SET product_id = matched_product_id
        WHERE id = NEW.id;
        
        -- Update NEW for the rest of the function
        NEW.product_id := matched_product_id;
        
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Updated scraped_product with new product_id: ' || matched_product_id);
      ELSE
        -- Product lacks sufficient data, ignore
        -- INSERT INTO debug_logs (message)
        -- VALUES ('Ignoring product - insufficient data: ' || NEW.name);
        
        -- Leave the product in scraped_products for now
        -- The daily cleanup will remove it later
        RETURN NEW;
      END IF;
    ELSE
      -- We found a match, update the record with the matched product_id
      UPDATE scraped_products
      SET product_id = matched_product_id
      WHERE id = NEW.id;
      
      -- Update NEW for the rest of the function
      NEW.product_id := matched_product_id;
      
      -- INSERT INTO debug_logs (message)
      -- VALUES ('Updated scraped_product with product_id: ' || matched_product_id);
    END IF;
  ELSE
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Product ID already set: ' || NEW.product_id);
    matched_product_id := NEW.product_id;
  END IF;

  -- Get the latest price for this product from this competitor
  SELECT new_price INTO last_price
  FROM price_changes
  WHERE competitor_id = NEW.competitor_id
    AND product_id = NEW.product_id
  ORDER BY changed_at DESC
  LIMIT 1;
  
  -- INSERT INTO debug_logs (message)
  -- VALUES ('Latest price for product ' || NEW.product_id || ': ' || COALESCE(last_price::TEXT, 'NULL'));

  -- Only add a price change if:
  -- 1. This is the first time we see this product (last_price IS NULL), OR
  -- 2. The price has actually changed
  IF last_price IS NULL THEN
    -- First time for the product, record initial price
    -- INSERT INTO debug_logs (message)
    -- VALUES ('First time for product, using current price as old price: ' || NEW.price);
    
    -- Record price change for first-time product
    INSERT INTO price_changes (
      user_id,
      product_id,
      competitor_id,
      old_price,
      new_price,
      price_change_percentage,
      changed_at
    ) VALUES (
      NEW.user_id,
      NEW.product_id,
      NEW.competitor_id,
      NEW.price, -- Use current price as old price the first time
      NEW.price,
      0,  -- 0% change the first time
      NOW()
    );
    
    -- INSERT INTO debug_logs (message)
    -- VALUES ('Added initial price record for product ' || NEW.product_id);
  ELSE
    -- We have a previous price, check if it changed
    IF last_price != NEW.price THEN
      price_change_pct := ((NEW.price - last_price) / last_price) * 100;
      
      -- INSERT INTO debug_logs (message)
      -- VALUES ('Price changed from ' || last_price || ' to ' || NEW.price || ', change: ' || price_change_pct || '%');
      
      -- Only add price change entry if the price changed
      INSERT INTO price_changes (
        user_id,
        product_id,
        competitor_id,
        old_price,
        new_price,
        price_change_percentage,
        changed_at
      ) VALUES (
        NEW.user_id,
        NEW.product_id,
        NEW.competitor_id,
        last_price,
        NEW.price,
        price_change_pct,
        NOW()
      );
      
      -- INSERT INTO debug_logs (message)
      -- VALUES ('Added price change entry for product ' || NEW.product_id);
    ELSE
      -- INSERT INTO debug_logs (message)
      -- VALUES ('Price unchanged: ' || NEW.price || ', no price change entry added');
    END IF;
  END IF;
  
  -- Leave products in scraped_products for now
  -- Daily cleanup will handle removing them
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS price_change_trigger ON scraped_products;
CREATE TRIGGER price_change_trigger
  AFTER INSERT ON scraped_products
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();

-- Create a function for daily cleanup of scraped_products table
CREATE OR REPLACE FUNCTION cleanup_scraped_products()
RETURNS void AS $$
BEGIN
  -- Remove all records in scraped_products that are older than 30 days
  DELETE FROM scraped_products
  WHERE scraped_at < NOW() - INTERVAL '30 days';
  
  -- Keep only the most recent record for each product/competitor combination
  -- for records that are between 3 and 30 days old
  DELETE FROM scraped_products sp1
  WHERE scraped_at < NOW() - INTERVAL '3 days'
    AND scraped_at > NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1
      FROM scraped_products sp2
      WHERE sp2.product_id = sp1.product_id
        AND sp2.competitor_id = sp1.competitor_id
        AND sp2.scraped_at > sp1.scraped_at
    );
  
  -- Remove products without product_id that are older than 1 day
  -- (these couldn't be matched and have insufficient data)
  DELETE FROM scraped_products
  WHERE product_id IS NULL
    AND scraped_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Schedule a job to run the cleanup_scraped_products function daily
-- If pg_cron extension is available
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    -- If job already exists, unschedule it first
    PERFORM cron.unschedule('cleanup_scraped_products_job');
    
    -- Schedule the job to run at 03:00 every day
    PERFORM cron.schedule(
      'cleanup_scraped_products_job',
      '0 3 * * *',
      'SELECT cleanup_scraped_products()'
    );
  ELSE
    -- If pg_cron is not available, log a message
    RAISE NOTICE 'pg_cron extension is not available. You need to run cleanup_scraped_products() manually or via an external scheduler.';
  END IF;
END $$;

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
  progress_messages TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms BIGINT, -- Total execution time of the scraper run in milliseconds (calculated from completed_at - started_at).
  products_per_second DECIMAL(10, 2) -- Calculated metric: product_count / (execution_time_ms / 1000.0). Null if execution time is zero or product_count is null.
);

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_id ON scraper_runs(scraper_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_is_test_run ON scraper_runs(is_test_run);

-- Set up Row Level Security
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own scraper runs
DROP POLICY IF EXISTS "Users can view their own scraper runs" ON scraper_runs;
CREATE POLICY "Users can view their own scraper runs"
  ON scraper_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own scraper runs
DROP POLICY IF EXISTS "Users can insert their own scraper runs" ON scraper_runs;
CREATE POLICY "Users can insert their own scraper runs"
  ON scraper_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own scraper runs
DROP POLICY IF EXISTS "Users can update their own scraper runs" ON scraper_runs;
CREATE POLICY "Users can update their own scraper runs"
  ON scraper_runs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- IMPORTANT: Don't forget to expose the next_auth schema in the Supabase API settings
-- 1. In your Supabase dashboard, go to Project Settings > API
-- 2. Scroll down to the "API Settings" section
-- 3. Find the "Exposed schemas" setting
-- 4. Add "next_auth" to the list of exposed schemas
-- 5. Click "Save" to apply the changes