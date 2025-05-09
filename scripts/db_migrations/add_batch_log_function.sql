-- Function to append multiple logs to scraper_runs.progress_messages at once
-- This is more efficient than appending one at a time
CREATE OR REPLACE FUNCTION append_logs_to_scraper_run(p_run_id uuid, p_log_entries jsonb[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use a single update to append all log entries at once
  UPDATE scraper_runs
  SET progress_messages = (
    CASE 
      WHEN progress_messages IS NULL THEN 
        jsonb_build_array()
      ELSE 
        progress_messages
    END
  ) || jsonb_build_array(VARIADIC p_log_entries)
  WHERE id = p_run_id;
END;
$$;

-- Add an index to improve performance of scraper_runs queries
CREATE INDEX IF NOT EXISTS idx_scraper_runs_status ON scraper_runs(status);

-- Add an index for faster lookups by scraper_id
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_id ON scraper_runs(scraper_id);

-- Add a function to clean up old progress messages to prevent database bloat
CREATE OR REPLACE FUNCTION trim_progress_messages(p_run_id uuid, p_max_messages integer DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_messages jsonb;
  v_message_count integer;
BEGIN
  -- Get current messages
  SELECT progress_messages INTO v_current_messages
  FROM scraper_runs
  WHERE id = p_run_id;
  
  -- If no messages or null, do nothing
  IF v_current_messages IS NULL OR jsonb_array_length(v_current_messages) = 0 THEN
    RETURN;
  END IF;
  
  v_message_count := jsonb_array_length(v_current_messages);
  
  -- If we have more messages than the max, trim the oldest ones
  IF v_message_count > p_max_messages THEN
    UPDATE scraper_runs
    SET progress_messages = (
      SELECT jsonb_agg(value)
      FROM jsonb_array_elements(v_current_messages)
      WITH ORDINALITY AS a(value, idx)
      WHERE idx > (v_message_count - p_max_messages)
      ORDER BY idx
    )
    WHERE id = p_run_id;
  END IF;
END;
$$;

-- Create a trigger to automatically trim progress messages when they get too large
CREATE OR REPLACE FUNCTION auto_trim_progress_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If progress_messages has more than 200 entries, trim it to 100
  IF NEW.progress_messages IS NOT NULL AND jsonb_array_length(NEW.progress_messages) > 200 THEN
    NEW.progress_messages := (
      SELECT jsonb_agg(value)
      FROM jsonb_array_elements(NEW.progress_messages)
      WITH ORDINALITY AS a(value, idx)
      WHERE idx > (jsonb_array_length(NEW.progress_messages) - 100)
      ORDER BY idx
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add the trigger to the scraper_runs table
DROP TRIGGER IF EXISTS trg_auto_trim_progress_messages ON scraper_runs;
CREATE TRIGGER trg_auto_trim_progress_messages
BEFORE UPDATE ON scraper_runs
FOR EACH ROW
WHEN (NEW.progress_messages IS NOT NULL)
EXECUTE FUNCTION auto_trim_progress_messages();

-- Comment explaining the changes
COMMENT ON FUNCTION append_logs_to_scraper_run IS 'Efficiently appends multiple log entries to a scraper run''s progress_messages in a single database operation';
COMMENT ON FUNCTION trim_progress_messages IS 'Trims the progress_messages array to prevent database bloat';
COMMENT ON FUNCTION auto_trim_progress_messages IS 'Automatically trims progress_messages when they exceed 200 entries';
