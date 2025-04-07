import { NextRequest, NextResponse } from "next/server";
// import { ScraperExecutionService } from "@/lib/services/scraper-execution-service"; // No longer needed, status read from DB
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
// import { revalidatePath } from 'next/cache'; // Not needed when using 'force-dynamic'

// Force dynamic execution, disable caching for this route
export const dynamic = 'force-dynamic';

interface Params {
  params: {
    scraperId: string;
    runId: string;
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  console.log(`[Status API] Received request for runId: ${params.runId}`); // Log entry
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.error(`[Status API] Unauthorized access attempt for runId: ${params.runId}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[Status API] Session validated for runId: ${params.runId}`); // Log session success

    const { scraperId, runId } = params; // No need for await here
    
    // ALWAYS query the database for the authoritative status
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: runData, error } = await supabaseAdmin
      .from('scraper_runs')
      .select('*')
      .eq('id', runId)
      .single();

    console.log(`[Status API] DB query for runId ${runId}: Error - ${!!error}, Found - ${!!runData}`); // Log DB query result
    if (error || !runData) {
      console.error(`Run not found in database: ${runId}`, error);
      return NextResponse.json(
        { error: "Run not found or expired" },
        { status: 404 }
      );
    }

    // Calculate progress details directly from the database record
    const startTime = new Date(runData.started_at).getTime();
    const endTime = runData.completed_at ? new Date(runData.completed_at).getTime() : null;
    const executionTime = endTime ? endTime - startTime : null;
    
    // Calculate elapsed time (use current time if not completed)
    const elapsedTime = endTime ? executionTime : Date.now() - startTime;
    
    // Return the progress data
    const responseData = {
      scraperId,
      runId,
      status: runData.status,
      productCount: runData.product_count || 0,
      currentBatch: runData.current_batch || 0,
      totalBatches: runData.total_batches || null,
      elapsedTime,
      errorMessage: runData.error_message || null,
      // TODO: Consider storing/retrieving progress messages if needed, currently not in DB schema shown
      progressMessages: [], // Assuming progressMessages aren't stored/needed for now
      isComplete: runData.status === 'success' || runData.status === 'failed'
    };
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