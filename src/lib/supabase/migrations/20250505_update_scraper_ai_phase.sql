-- Update the check constraint for the scraper_ai_sessions table
-- to include the new 'data-validation' phase

-- First, drop the existing constraint
ALTER TABLE scraper_ai_sessions 
DROP CONSTRAINT IF EXISTS scraper_ai_sessions_current_phase_check;

-- Then, add the new constraint with the updated phases
ALTER TABLE scraper_ai_sessions 
ADD CONSTRAINT scraper_ai_sessions_current_phase_check 
CHECK (current_phase IN ('analysis', 'url-collection', 'data-extraction', 'data-validation', 'assembly', 'complete'));
