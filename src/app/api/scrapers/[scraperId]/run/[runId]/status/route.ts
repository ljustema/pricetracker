import { NextRequest, NextResponse } from "next/server";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";
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
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scraperId, runId } = await params;
    
    // Get the progress data for the run from in-memory cache
    let progress = ScraperExecutionService.getProgress(runId);
    
    // If not found in memory cache, try to get from database
    if (!progress) {
      const supabaseAdmin = createSupabaseAdminClient();
      // Query for the run, including both regular runs and test runs
      const { data: runData, error } = await supabaseAdmin
        .from('scraper_runs')
        .select('*')
        .eq('id', runId)
        .single();
      
      if (error || !runData) {
        console.error(`Run not found in database: ${runId}`, error);
        return NextResponse.json(
          { error: "Run not found or expired" },
          { status: 404 }
        );
      }
      
      // Convert database record to progress format
      const startTime = new Date(runData.started_at).getTime();
      const endTime = runData.completed_at ? new Date(runData.completed_at).getTime() : null;
      
      // Create a progress object from the database record
      progress = {
        status: runData.status,
        productCount: runData.product_count || 0,
        currentBatch: runData.current_batch || 0,
        totalBatches: runData.total_batches || null,
        startTime,
        endTime,
        executionTime: endTime ? endTime - startTime : null,
        errorMessage: runData.error_message || null,
        progressMessages: runData.progress_messages || []
      };
    }
    
    // Calculate elapsed time
    const elapsedTime = progress.endTime
      ? progress.executionTime
      : Date.now() - progress.startTime;
    
    // Return the progress data
    return NextResponse.json({
      scraperId,
      runId,
      status: progress.status,
      productCount: progress.productCount,
      currentBatch: progress.currentBatch,
      totalBatches: progress.totalBatches,
      elapsedTime,
      errorMessage: progress.errorMessage,
      progressMessages: progress.progressMessages.slice(-5), // Return only the last 5 messages
      isComplete: progress.status === 'success' || progress.status === 'failed'
    });
  } catch (error) {
    console.error("Error getting run status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}