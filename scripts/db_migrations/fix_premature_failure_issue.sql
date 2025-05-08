-- Fix for premature failure issue where jobs are marked as failed before the worker can claim them
-- This script adds a trigger to prevent jobs from being marked as failed with "Script execution failed with non-zero exit code 1"
-- if they haven't been given enough time to be claimed by a worker

-- 1. Create a function to prevent premature failures
CREATE OR REPLACE FUNCTION prevent_premature_failure()
RETURNS TRIGGER AS $$
BEGIN
    -- If the job is being marked as failed with "Script execution failed with non-zero exit code 1"
    -- but it has been created recently, prevent the update
    IF NEW.status = 'failed' AND 
       NEW.error_message = 'Script execution failed with non-zero exit code 1' AND
       (NOW() - NEW.created_at) < INTERVAL '30 seconds'
    THEN
        -- Prevent the update by returning OLD
        RAISE NOTICE 'Preventing premature failure of job % that was created at % (only % seconds ago)',
                     OLD.id, OLD.created_at, EXTRACT(EPOCH FROM (NOW() - OLD.created_at));
        RETURN OLD;
    END IF;
    
    -- Otherwise, allow the update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a trigger to prevent premature failures
DROP TRIGGER IF EXISTS prevent_premature_failure_trigger ON scraper_runs;
CREATE TRIGGER prevent_premature_failure_trigger
BEFORE UPDATE OF status ON scraper_runs
FOR EACH ROW
WHEN (NEW.status = 'failed' AND NEW.error_message = 'Script execution failed with non-zero exit code 1')
EXECUTE FUNCTION prevent_premature_failure();

-- 3. Grant execute permission for the prevent_premature_failure function
GRANT EXECUTE ON FUNCTION prevent_premature_failure() TO authenticated;
GRANT EXECUTE ON FUNCTION prevent_premature_failure() TO service_role;

COMMENT ON FUNCTION prevent_premature_failure() IS 'Prevents jobs from being marked as failed with "Script execution failed with non-zero exit code 1" if they have been created recently, giving the worker time to claim them.';
