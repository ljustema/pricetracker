-- Fix for the mismatch between progress_messages column type (TEXT[]) and functions that expect JSONB
-- This migration updates the functions to work with TEXT[] instead of JSONB

-- Drop the existing functions and triggers
DROP TRIGGER IF EXISTS trg_auto_trim_progress_messages ON scraper_runs;
DROP FUNCTION IF EXISTS auto_trim_progress_messages();
DROP FUNCTION IF EXISTS trim_progress_messages(uuid, integer);
DROP FUNCTION IF EXISTS append_logs_to_scraper_run(uuid, jsonb[]);

-- Create a new function to append logs to scraper_runs.progress_messages that works with TEXT[]
CREATE OR REPLACE FUNCTION append_logs_to_scraper_run(p_run_id uuid, p_log_entries text[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use a single update to append all log entries at once
  UPDATE scraper_runs
  SET progress_messages = COALESCE(progress_messages, ARRAY[]::text[]) || p_log_entries
  WHERE id = p_run_id;
END;
$$;

-- Add a function to clean up old progress messages to prevent database bloat
CREATE OR REPLACE FUNCTION trim_progress_messages(p_run_id uuid, p_max_messages integer DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_messages text[];
  v_message_count integer;
BEGIN
  -- Get current messages
  SELECT progress_messages INTO v_current_messages
  FROM scraper_runs
  WHERE id = p_run_id;
  
  -- If no messages or null, do nothing
  IF v_current_messages IS NULL OR array_length(v_current_messages, 1) IS NULL THEN
    RETURN;
  END IF;
  
  v_message_count := array_length(v_current_messages, 1);
  
  -- If we have more messages than the max, trim the oldest ones
  IF v_message_count > p_max_messages THEN
    UPDATE scraper_runs
    SET progress_messages = v_current_messages[(v_message_count - p_max_messages + 1):v_message_count]
    WHERE id = p_run_id;
  END IF;
END;
$$;

-- Create a trigger to automatically trim progress messages when they get too large
CREATE OR REPLACE FUNCTION auto_trim_progress_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_count integer;
BEGIN
  -- If progress_messages has more than 200 entries, trim it to 100
  IF NEW.progress_messages IS NOT NULL THEN
    v_message_count := array_length(NEW.progress_messages, 1);
    
    IF v_message_count IS NOT NULL AND v_message_count > 200 THEN
      NEW.progress_messages := NEW.progress_messages[(v_message_count - 100 + 1):v_message_count];
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add the trigger to the scraper_runs table
CREATE TRIGGER trg_auto_trim_progress_messages
BEFORE UPDATE ON scraper_runs
FOR EACH ROW
WHEN (NEW.progress_messages IS NOT NULL)
EXECUTE FUNCTION auto_trim_progress_messages();

-- Comment explaining the changes
COMMENT ON FUNCTION append_logs_to_scraper_run IS 'Efficiently appends multiple log entries to a scraper run''s progress_messages in a single database operation';
COMMENT ON FUNCTION trim_progress_messages IS 'Trims the progress_messages array to prevent database bloat';
COMMENT ON FUNCTION auto_trim_progress_messages IS 'Automatically trims progress_messages when they exceed 200 entries';
