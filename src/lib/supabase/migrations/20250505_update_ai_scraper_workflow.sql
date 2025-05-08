-- Comprehensive update for the AI scraper workflow
-- This script:
-- 1. Empties the scraper_ai_sessions table
-- 2. Updates the check constraint for the current_phase column
-- 3. Makes any other schema improvements needed for the new workflow

-- 1. Empty the scraper_ai_sessions table
DELETE FROM scraper_ai_sessions;

-- 2. Update the check constraint for the current_phase column
ALTER TABLE scraper_ai_sessions 
DROP CONSTRAINT IF EXISTS scraper_ai_sessions_current_phase_check;

ALTER TABLE scraper_ai_sessions 
ADD CONSTRAINT scraper_ai_sessions_current_phase_check 
CHECK (current_phase IN ('analysis', 'data-validation', 'assembly', 'complete'));

-- 3. Add a comment to the table to document the workflow phases
COMMENT ON TABLE scraper_ai_sessions IS 'AI scraper sessions with phases: analysis, data-validation, assembly, complete';

-- 4. Add comments to the columns to document their purpose
COMMENT ON COLUMN scraper_ai_sessions.current_phase IS 'Current phase of the AI scraper generation process: analysis, data-validation, assembly, complete';
COMMENT ON COLUMN scraper_ai_sessions.analysis_data IS 'Data from the site analysis phase';
COMMENT ON COLUMN scraper_ai_sessions.url_collection_data IS 'Legacy: Data from the URL collection phase (now part of data-validation)';
COMMENT ON COLUMN scraper_ai_sessions.data_extraction_data IS 'Data from the data validation phase (previously data-extraction)';
COMMENT ON COLUMN scraper_ai_sessions.assembly_data IS 'Data from the script assembly phase';
