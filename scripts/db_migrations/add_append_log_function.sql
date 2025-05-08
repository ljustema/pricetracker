-- Function to append logs to scraper_runs.progress_messages
CREATE OR REPLACE FUNCTION append_log_to_scraper_run(p_run_id uuid, p_log_entry jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scraper_runs
  SET progress_messages = coalesce(progress_messages, '[]'::jsonb) || p_log_entry
  WHERE id = p_run_id;
END;
$$;
