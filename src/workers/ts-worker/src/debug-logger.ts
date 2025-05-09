import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory: ${logsDir}`);
  }
} catch (err) {
  console.error(`Failed to create logs directory ${logsDir}:`, err);
}

// Log file path
const logFile = path.join(logsDir, 'worker-debug.log');

// Initialize log file
try {
  fs.writeFileSync(logFile, `Worker debug log started at ${new Date().toISOString()}\n`);
  console.log(`Initialized log file: ${logFile}`);
} catch (err) {
  console.error(`Failed to initialize log file ${logFile}:`, err);
}

// Log function
export function debugLog(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  // Append to log file
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Failed to write to log file: ${errorMessage}`);
  }

  // Also log to console
  console.log(`[DEBUG] ${message}`);
}

// Initialize Supabase client for direct database access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  debugLog('Supabase client initialized for direct database access');
} else {
  debugLog('Missing Supabase credentials, direct database access not available');
}

// Function to directly log to the database
export async function logToDatabase(runId: string, message: string, data: any = null): Promise<void> {
  if (!supabase) {
    debugLog(`Cannot log to database: Supabase client not initialized`);
    return;
  }

  try {
    debugLog(`Attempting to log to database for run ${runId}: ${message}`);

    // Skip the RPC call and use direct update instead
    // Update the error_details field with the latest log
    // The error_details column is TEXT type, not JSONB, so we need to stringify the data
    const logEntry = {
      debug_message: message,
      debug_data: data,
      timestamp: new Date().toISOString()
    };

    // Convert to string for storage in TEXT column
    const logEntryString = JSON.stringify(logEntry);

    const { error: updateError } = await supabase
      .from('scraper_runs')
      .update({
        error_details: logEntryString // Store as string in TEXT column
      })
      .eq('id', runId);

    if (updateError) {
      debugLog(`Error updating error_details: ${updateError.message}`);
    } else {
      debugLog(`Successfully updated error_details for run ${runId}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Exception logging to database: ${errorMessage}`);
  }
}
