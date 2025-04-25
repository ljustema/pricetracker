import { NextRequest, NextResponse } from "next/server";
// import { ScraperExecutionService } from "@/lib/services/scraper-execution-service"; // No longer needed, status read from DB
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import fs from 'fs';
import path from 'path';

/**
 * Get recent progress messages from the logs
 */
async function getRecentProgressMessages(runId: string, limit: number = 10): Promise<string[]> {
  try {
    // First try to get messages from the database
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: logData } = await supabaseAdmin
      .from('scraper_logs')
      .select('message')
      .eq('run_id', runId)
      .eq('level', 'INFO')
      .ilike('message', '%PROGRESS:%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logData && logData.length > 0) {
      return logData.map(log => log.message.replace('PROGRESS:', '').trim());
    }

    // If no logs in database, try to read from log file
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '-');
    const logFilePath = path.join(process.cwd(), 'logs', `py-worker-${today}.log`);

    if (fs.existsSync(logFilePath)) {
      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      const lines = logContent.split('\n').reverse();

      const progressMessages: string[] = [];
      for (const line of lines) {
        if (line.includes(`"run_id": "${runId}"`) && line.includes('"phase": "SCRIPT_LOG"')) {
          try {
            const logEntry = JSON.parse(line);
            if (logEntry.msg) {
              progressMessages.push(logEntry.msg);
              if (progressMessages.length >= limit) break;
            }
          } catch (_e) {
            // Skip invalid JSON
          }
        }
      }

      return progressMessages;
    }

    return [];
  } catch (error) {
    console.error(`Error getting progress messages for run ${runId}:`, error);
    return [];
  }
}
// import { revalidatePath } from 'next/cache'; // Not needed when using 'force-dynamic'

// Force dynamic execution, disable caching for this route
export const dynamic = 'force-dynamic';

// Remove separate Params interface

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scraperId: string; runId: string }> } // Params is a Promise in App Router
) {
  // console.log(`[Status API] Received request`); // Log entry (runId logged after validation)
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    // Check session *before* accessing params
    if (!session?.user) {
      // Log unauthorized attempt without runId initially, as params access might be the issue
      console.error(`[Status API] Unauthorized access attempt.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Await and destructure params after successful auth
    const { scraperId, runId } = await params;

    // Now log with runId
  // console.log(`[Status API] Session validated for runId: ${runId}`); // Log session success

    // ALWAYS query the database for the authoritative status
    const supabaseAdmin = createSupabaseAdminClient();
    let runData, error;
    let retries = 0;
    const maxRetries = 5;
    const retryDelayMs = 500;

    console.log(`[Status API] Querying database for run ${runId}`);

    while (retries < maxRetries) {
      const res = await supabaseAdmin
        .from('scraper_runs')
        .select('*')
        .eq('id', runId)
        .single();
      runData = res.data;
      error = res.error;

      console.log(`[Status API] Query attempt ${retries+1}/${maxRetries}: Found data: ${!!runData}, Error: ${!!error}`);
      if (runData) {
        console.log(`[Status API] Run data for ${runId}: status=${runData.status}, product_count=${runData.product_count}, current_batch=${runData.current_batch}, total_batches=${runData.total_batches}`);
        break;
      }
      await new Promise(res => setTimeout(res, retryDelayMs));
      retries++;
    }
    if (error) {
      // If there was a database error during fetch after retries
      console.error(`[Status API] Final DB error fetching run ${runId}: ${error.message}`);
      return NextResponse.json({ error: `Database error fetching run status: ${error.message}` }, { status: 500 });
    }

    if (!runData) {
      // If no error, but runData is still null after retries (might be too soon or invalid ID)
      // Consider if returning pending is okay, or if 404 might be better after a delay
      // For now, keep returning pending to allow for slight delays, but log a warning.
      console.warn(`[Status API] Run data for ${runId} not found after retries, returning pending.`);
      return NextResponse.json({
        status: 'pending', // Still report pending if simply not found yet
        isComplete: false,
        errorMessage: null,
        progressMessages: [],
        productCount: 0,
        currentBatch: 0,
        totalBatches: null,
        elapsedTime: 0
      }, { status: 200 });
    }

  // console.log(`[Status API] DB query for runId ${runId}: Error - ${!!error}, Found - ${!!runData}`); // Log DB query result

    // Calculate progress details directly from the database record
    const startTime = new Date(runData.started_at).getTime();
    const endTime = runData.completed_at ? new Date(runData.completed_at).getTime() : null;
    const executionTime = endTime ? endTime - startTime : null;

    // Calculate elapsed time (use current time if not completed)
    const elapsedTime = endTime ? executionTime : Date.now() - startTime;

    // Extract phase information from progress messages
    const progressMessages = await getRecentProgressMessages(runId, 10);
    let currentPhase = 1;

    // Try to determine the current phase from progress messages
    for (const msg of progressMessages) {
      const phaseMatch = msg.match(/Phase (\d+):/i);
      if (phaseMatch && phaseMatch[1]) {
        const phase = parseInt(phaseMatch[1], 10);
        if (!isNaN(phase) && phase > 0) {
          currentPhase = phase;
          break; // Use the first phase we find (most recent)
        }
      }
    }

    // Return the progress data
    const responseData: {
      scraperId: string;
      runId: string;
      status: string;
      productCount: number;
      currentBatch: number;
      totalBatches: number | null;
      currentPhase: number;
      elapsedTime: number | null;
      errorMessage: string | null;
      progressMessages: string[];
      isComplete: boolean;
      errorDetails: string | null;
    } = {
      scraperId,
      runId,
      status: runData.status,
      productCount: runData.product_count || 0,
      currentBatch: runData.current_batch || 0,
      totalBatches: runData.total_batches || null,
      currentPhase,
      elapsedTime,
      errorMessage: runData.error_message || null,
      // Include the progress messages
      progressMessages,
      // Ensure isComplete reflects the actual status correctly
      isComplete: ['completed', 'failed', 'success'].includes(runData.status), // Use includes for clarity
      errorDetails: null // Initialize errorDetails
    };

    // Log the phase information for debugging
    console.log(`[Status API] Run ${runId} phase info: Phase ${currentPhase}, Batch ${responseData.currentBatch}/${responseData.totalBatches}`);

    // Log more detailed information if the run failed or completed
    if (runData.status === 'failed') {
      console.log(`[Status API] Run ${runId} failed with error: ${runData.error_message || 'No error message provided'}`);

      // Log additional details that might help diagnose the issue
      console.log(`[Status API] Run details: Test run: ${runData.is_test_run}, Started at: ${runData.started_at}, Completed at: ${runData.completed_at || 'Not completed'}`);

      // Extract and log detailed error information from progress_messages if available
      // Worker now stores error details as a JSON string in progress_messages
      if (runData.progress_messages && Array.isArray(runData.progress_messages)) {
        // Find the specific error details log entry
        const errorLogEntryStr = runData.progress_messages.find((msg: string) => msg.includes('"type": "error_details"'));
        if (errorLogEntryStr) {
          try {
            const errorLogEntry = JSON.parse(errorLogEntryStr);
            if (errorLogEntry.details) {
               console.log(`[Status API] Extracted error details for run ${runId}`);
               responseData.errorDetails = errorLogEntry.details; // Assign extracted details
            } else {
               console.warn(`[Status API] Found error details log entry for ${runId}, but 'details' key is missing.`);
            }
          } catch (parseError) {
            console.error(`[Status API] Failed to parse error details JSON from progress_messages for run ${runId}: ${parseError}`);
            // Optionally add the raw string if parsing fails
            // responseData.errorDetails = `Failed to parse details: ${errorLogEntryStr}`;
          }
        } else {
           console.log(`[Status API] No specific error details log entry found in progress_messages for failed run ${runId}.`);
        }
      } else {
         console.log(`[Status API] No progress_messages found for failed run ${runId}.`);
      }
    } else if (runData.status === 'completed' || runData.status === 'success') {
      console.log(`[Status API] Run ${runId} completed successfully with ${runData.product_count || 0} products`);
      console.log(`[Status API] Run details: Test run: ${runData.is_test_run}, Started at: ${runData.started_at}, Completed at: ${runData.completed_at || 'Not completed'}`);
    }

    console.log(`[Status API] Returning status for runId ${runId}: Status=${responseData.status}, isComplete=${responseData.isComplete}`); // Log return data
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error getting run status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
