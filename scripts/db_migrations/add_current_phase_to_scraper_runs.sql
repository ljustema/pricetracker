-- Add current_phase column to scraper_runs table
-- This migration adds the current_phase column to track the current phase of a scraper run
-- This is used by the TypeScript worker to update the UI with the current phase

-- Add the column if it doesn't exist
ALTER TABLE scraper_runs 
ADD COLUMN IF NOT EXISTS current_phase INTEGER;

-- Add a comment to explain the purpose of the column
COMMENT ON COLUMN scraper_runs.current_phase IS 'Current phase of the scraper run (1 = URL collection, 2 = Processing products, etc.)';

-- Update existing runs to have a default phase of 1
UPDATE scraper_runs
SET current_phase = 1
WHERE current_phase IS NULL;
