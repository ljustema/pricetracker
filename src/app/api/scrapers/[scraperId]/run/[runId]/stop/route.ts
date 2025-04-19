import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ scraperId: string; runId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.error(`[Stop API] Unauthorized access attempt.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await and destructure params after successful auth
    const { scraperId, runId } = await params;

    console.log(`[Stop API] Attempting to stop run ${runId} for scraper ${scraperId}`);

    // Get the database client
    const supabase = await createSupabaseServerClient();

    // First, check if the run exists and belongs to the user
    const { data: run, error: runError } = await supabase
      .from("scraper_runs")
      .select("id, scraper_id, user_id, status")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      console.error(`[Stop API] Run not found: ${runError?.message}`);
      return NextResponse.json(
        { error: "Run not found or access denied" },
        { status: 404 }
      );
    }

    // Check if the run belongs to the requested scraper
    if (run.scraper_id !== scraperId) {
      console.error(`[Stop API] Run ${runId} does not belong to scraper ${scraperId}`);
      return NextResponse.json(
        { error: "Run does not belong to this scraper" },
        { status: 400 }
      );
    }

    // Check if the run is already completed or failed
    if (run.status === 'completed' || run.status === 'failed') {
      console.log(`[Stop API] Run ${runId} is already in final state: ${run.status}`);
      return NextResponse.json(
        { message: `Run is already ${run.status}` },
        { status: 200 }
      );
    }

    // Update the run status to 'stopped'
    const { error: updateError } = await supabase
      .from("scraper_runs")
      .update({
        status: 'stopped',
        error_message: 'Manually stopped by user',
        completed_at: new Date().toISOString()
      })
      .eq("id", runId);

    if (updateError) {
      console.error(`[Stop API] Failed to update run status: ${updateError.message}`);
      return NextResponse.json(
        { error: "Failed to stop run" },
        { status: 500 }
      );
    }

    console.log(`[Stop API] Successfully stopped run ${runId}`);
    return NextResponse.json(
      { message: "Run stopped successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Stop API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
