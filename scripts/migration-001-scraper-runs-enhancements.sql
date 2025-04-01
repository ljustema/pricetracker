-- Migration: Enhance scraper_runs and scrapers tables for performance metrics

-- Add execution time and products/sec to scraper_runs
-- Uses existing 'product_count', 'started_at', and 'completed_at' columns.
ALTER TABLE public.scraper_runs
ADD COLUMN IF NOT EXISTS execution_time_ms BIGINT,
ADD COLUMN IF NOT EXISTS products_per_second DECIMAL(10, 2); -- Use DECIMAL for precision

-- Add index for scraper_id if it doesn't exist (likely does due to FK)
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_id ON public.scraper_runs(scraper_id);

-- Add index for started_at for ordering history
CREATE INDEX IF NOT EXISTS idx_scraper_runs_started_at ON public.scraper_runs(started_at DESC);

-- Add last products/sec to scrapers table (optional, for UI performance)
ALTER TABLE public.scrapers
ADD COLUMN IF NOT EXISTS last_products_per_second DECIMAL(10, 2);

-- Add comments for new columns
COMMENT ON COLUMN public.scraper_runs.execution_time_ms IS 'Total execution time of the scraper run in milliseconds (calculated from completed_at - started_at).';
COMMENT ON COLUMN public.scraper_runs.products_per_second IS 'Calculated metric: product_count / (execution_time_ms / 1000.0). Null if execution time is zero or product_count is null.';
COMMENT ON COLUMN public.scrapers.last_products_per_second IS 'Products per second metric from the most recently completed successful run.';

-- Note: You need to apply this migration to your Supabase database.
-- You can do this via the Supabase dashboard's SQL Editor or using a migration tool.
-- After applying, update your scraper execution logic to calculate and populate these new fields.