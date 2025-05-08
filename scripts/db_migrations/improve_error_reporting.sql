-- Function to extract detailed error information from scraper runs
CREATE OR REPLACE FUNCTION get_detailed_error_info(run_id UUID)
RETURNS TABLE (
    error_message TEXT,
    error_details TEXT,
    stderr_output TEXT,
    script_errors TEXT[],
    stack_trace TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.error_message,
        sr.error_details,
        -- Extract stderr output from error_details if it's JSON
        CASE 
            WHEN sr.error_details IS NOT NULL AND sr.error_details ~ '^\\s*\\{' THEN
                COALESCE(
                    (CASE WHEN jsonb_typeof(sr.error_details::jsonb) = 'object' THEN
                        CASE 
                            WHEN (sr.error_details::jsonb) ? 'fullStderr' THEN (sr.error_details::jsonb)->>'fullStderr'
                            WHEN (sr.error_details::jsonb) ? 'stderr' THEN (sr.error_details::jsonb)->>'stderr'
                            ELSE NULL
                        END
                    ELSE NULL END),
                    sr.error_details
                )
            ELSE sr.error_details
        END AS stderr_output,
        -- Extract script errors if available
        CASE 
            WHEN sr.error_details IS NOT NULL AND sr.error_details ~ '^\\s*\\{' AND
                 jsonb_typeof(sr.error_details::jsonb) = 'object' AND
                 (sr.error_details::jsonb) ? 'scriptErrors' AND
                 jsonb_typeof((sr.error_details::jsonb)->'scriptErrors') = 'array'
            THEN
                ARRAY(SELECT jsonb_array_elements_text((sr.error_details::jsonb)->'scriptErrors'))
            ELSE ARRAY[]::TEXT[]
        END AS script_errors,
        -- Extract stack trace if available
        CASE 
            WHEN sr.error_details IS NOT NULL AND sr.error_details ~ '^\\s*\\{' AND
                 jsonb_typeof(sr.error_details::jsonb) = 'object' AND
                 (sr.error_details::jsonb) ? 'stack'
            THEN
                (sr.error_details::jsonb)->>'stack'
            ELSE NULL
        END AS stack_trace
    FROM scraper_runs sr
    WHERE sr.id = run_id;
END;
$$;

-- Grant execute permission to the roles that will be calling this function
GRANT EXECUTE ON FUNCTION get_detailed_error_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_detailed_error_info(UUID) TO service_role;

COMMENT ON FUNCTION get_detailed_error_info(UUID) IS 'Extracts detailed error information from a scraper run, parsing the error_details JSON if available to provide more structured error data.';

-- Add a view to make it easier to query failed runs with their detailed error information
CREATE OR REPLACE VIEW failed_scraper_runs_with_details AS
SELECT 
    sr.id,
    sr.created_at,
    sr.started_at,
    sr.completed_at,
    sr.scraper_id,
    sr.user_id,
    sr.error_message,
    err.stderr_output,
    err.script_errors,
    err.stack_trace,
    s.name AS scraper_name,
    c.name AS competitor_name
FROM 
    scraper_runs sr
JOIN 
    get_detailed_error_info(sr.id) err ON true
JOIN 
    scrapers s ON sr.scraper_id = s.id
LEFT JOIN
    competitors c ON s.competitor_id = c.id
WHERE 
    sr.status = 'failed'
ORDER BY 
    sr.completed_at DESC;

-- Grant access to the view
GRANT SELECT ON failed_scraper_runs_with_details TO authenticated;
GRANT SELECT ON failed_scraper_runs_with_details TO service_role;

COMMENT ON VIEW failed_scraper_runs_with_details IS 'A view that provides detailed error information for failed scraper runs, including parsed error details, script errors, and stack traces.';
