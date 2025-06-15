-- Test script for integration improvements
-- Run these queries to test the new functionality

-- 1. Test the custom fields import configuration
-- Check current integration configuration
SELECT 
    id, 
    name, 
    platform,
    configuration,
    CASE 
        WHEN configuration->>'importAllCustomFields' = 'false' THEN 'Basic import only'
        WHEN configuration->>'importAllCustomFields' = 'true' THEN 'Import all custom fields'
        WHEN configuration->>'importAllCustomFields' IS NULL THEN 'Default (import all)'
        ELSE 'Unknown setting'
    END as import_mode
FROM integrations 
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
ORDER BY created_at DESC;

-- 2. Update an integration to test basic import mode
-- Replace 'your-integration-id' with actual integration ID
/*
UPDATE integrations 
SET configuration = jsonb_set(
    COALESCE(configuration, '{}'), 
    '{importAllCustomFields}', 
    'false'
)
WHERE id = 'your-integration-id';
*/

-- 3. Monitor integration run progress and heartbeat
-- This query shows the progress tracking improvements
SELECT 
    ir.id,
    ir.status,
    ir.products_processed,
    ir.started_at,
    ir.last_progress_update,
    ir.completed_at,
    CASE 
        WHEN ir.last_progress_update IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (now() - ir.last_progress_update))/60
        ELSE NULL
    END as minutes_since_last_update,
    CASE 
        WHEN ir.status = 'processing' AND ir.last_progress_update IS NOT NULL 
             AND ir.last_progress_update < now() - interval '1 hour' THEN 'WOULD BE MARKED AS STALLED'
        WHEN ir.status = 'processing' AND ir.last_progress_update IS NULL 
             AND ir.started_at < now() - interval '1 hour' THEN 'WOULD BE MARKED AS STALLED'
        ELSE 'OK'
    END as stall_status,
    i.name as integration_name
FROM integration_runs ir
JOIN integrations i ON ir.integration_id = i.id
WHERE ir.created_at > now() - interval '24 hours'
ORDER BY ir.created_at DESC
LIMIT 10;

-- 4. Check raw_data content based on import configuration
-- This shows whether custom fields are being imported or not
SELECT 
    tisd.id,
    tisd.name,
    tisd.integration_id,
    CASE 
        WHEN tisd.raw_data = '{}' OR tisd.raw_data IS NULL THEN 'Empty (basic import)'
        WHEN jsonb_typeof(tisd.raw_data) = 'object' AND tisd.raw_data != '{}' THEN 'Contains data (full import)'
        ELSE 'Unknown format'
    END as raw_data_status,
    jsonb_object_keys(tisd.raw_data) as custom_field_keys,
    i.configuration->>'importAllCustomFields' as import_setting
FROM temp_integrations_scraped_data tisd
JOIN integrations i ON tisd.integration_id = i.id
WHERE tisd.created_at > now() - interval '1 hour'
ORDER BY tisd.created_at DESC
LIMIT 20;

-- 5. Test query to simulate the stall detection logic
-- This shows which runs would be marked as stalled
SELECT 
    ir.id,
    ir.status,
    ir.started_at,
    ir.last_progress_update,
    ir.products_processed,
    i.name as integration_name,
    CASE 
        WHEN ir.last_progress_update IS NOT NULL 
             AND ir.last_progress_update < now() - interval '1 hour' THEN 
            'STALLED: No progress update for ' || 
            EXTRACT(EPOCH FROM (now() - ir.last_progress_update))/60 || ' minutes'
        WHEN ir.last_progress_update IS NULL 
             AND ir.started_at IS NOT NULL 
             AND ir.started_at < now() - interval '1 hour' THEN 
            'STALLED: No progress update since start ' || 
            EXTRACT(EPOCH FROM (now() - ir.started_at))/60 || ' minutes ago'
        ELSE 'OK'
    END as stall_check
FROM integration_runs ir
JOIN integrations i ON ir.integration_id = i.id
WHERE ir.status = 'processing'
ORDER BY ir.started_at DESC;

-- 6. Check integration run logs for heartbeat and progress updates
-- Look for the new log entries from our improvements
SELECT 
    ir.id,
    ir.status,
    jsonb_array_length(ir.log_details) as log_count,
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(ir.log_details) as log_entry
        WHERE log_entry->>'phase' = 'PROGRESS_UPDATE'
    ) as progress_update_logs,
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(ir.log_details) as log_entry
        WHERE log_entry->>'message' LIKE '%Import all custom fields setting%'
    ) as custom_fields_config_logs,
    i.name as integration_name
FROM integration_runs ir
JOIN integrations i ON ir.integration_id = i.id
WHERE ir.created_at > now() - interval '24 hours'
  AND ir.log_details IS NOT NULL
ORDER BY ir.created_at DESC
LIMIT 10;

-- 7. Performance check - count of temp records by import type
-- This helps verify that the custom fields setting is working
SELECT 
    i.name as integration_name,
    i.configuration->>'importAllCustomFields' as import_setting,
    COUNT(*) as total_records,
    COUNT(CASE WHEN tisd.raw_data = '{}' OR tisd.raw_data IS NULL THEN 1 END) as empty_raw_data,
    COUNT(CASE WHEN tisd.raw_data != '{}' AND tisd.raw_data IS NOT NULL THEN 1 END) as populated_raw_data,
    ROUND(
        COUNT(CASE WHEN tisd.raw_data = '{}' OR tisd.raw_data IS NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as empty_percentage
FROM temp_integrations_scraped_data tisd
JOIN integrations i ON tisd.integration_id = i.id
WHERE tisd.created_at > now() - interval '24 hours'
GROUP BY i.id, i.name, i.configuration->>'importAllCustomFields'
ORDER BY tisd.created_at DESC;

-- 8. Check for any failed integrations that might need retry
-- Helps identify integrations that failed due to stalling
SELECT
    ir.id,
    ir.integration_id,
    ir.status,
    ir.error_message,
    ir.products_processed,
    ir.started_at,
    ir.completed_at,
    EXTRACT(EPOCH FROM (ir.completed_at - ir.started_at))/60 as duration_minutes,
    i.name as integration_name
FROM integration_runs ir
JOIN integrations i ON ir.integration_id = i.id
WHERE ir.status = 'failed'
  AND ir.error_message LIKE '%stalled%'
  AND ir.created_at > now() - interval '7 days'
ORDER BY ir.created_at DESC;

-- 9. Analyze the failed integration run logs to identify where it got stuck
-- This helps understand what operation was hanging
SELECT
    ir.id,
    ir.status,
    ir.products_processed,
    ir.started_at,
    ir.last_progress_update,
    ir.completed_at,
    -- Extract the last few log entries to see where it stopped
    (
        SELECT jsonb_agg(log_entry ORDER BY (log_entry->>'timestamp')::timestamp DESC)
        FROM (
            SELECT log_entry
            FROM jsonb_array_elements(ir.log_details) as log_entry
            ORDER BY (log_entry->>'timestamp')::timestamp DESC
            LIMIT 10
        ) last_logs
    ) as last_10_logs,
    -- Count different types of operations
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(ir.log_details) as log_entry
        WHERE log_entry->>'phase' = 'BATCH_PROCESSED'
    ) as completed_batches,
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(ir.log_details) as log_entry
        WHERE log_entry->>'phase' = 'BATCH_PROCESSING_TRIGGER'
    ) as triggered_batches,
    i.name as integration_name
FROM integration_runs ir
JOIN integrations i ON ir.integration_id = i.id
WHERE ir.id = '8da9d8b9-313c-48c4-8bcc-c98f5f34a045' -- The failed run
ORDER BY ir.created_at DESC;
