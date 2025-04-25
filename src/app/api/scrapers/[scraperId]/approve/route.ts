import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// import { ScraperManagementService } from "@/lib/services/scraper-management-service"; // Use direct DB update for now

type ApproveScraperParams = {
  params: {
    scraperId: string;
  };
};

export async function POST(req: NextRequest, { params }: ApproveScraperParams) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { scraperId } = params;

    if (!scraperId) {
      return NextResponse.json({ error: "Scraper ID is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // 2. Verify the scraper exists and belongs to the user
    const { data: scraper, error: fetchError } = await supabase
      .from("scrapers")
      .select("id, is_approved") // Select current status
      .eq("id", scraperId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching scraper for approval:", fetchError);
      return NextResponse.json({ error: "Failed to fetch scraper details" }, { status: 500 });
    }

    if (!scraper) {
      return NextResponse.json({ error: "Scraper not found or access denied" }, { status: 404 });
    }

    if (scraper.is_approved) {
      return NextResponse.json({ message: "Scraper is already approved" }, { status: 200 });
    }

    // Optional: Check for a recent successful test run before approving
    // const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    // const { data: recentTestRun, error: runError } = await supabase
    //   .from("scraper_runs")
    //   .select("id")
    //   .eq("scraper_id", scraperId)
    //   .eq("is_test_run", true)
    //   .eq("status", "success")
    //   .gte("completed_at", tenMinutesAgo) // Check if completed recently
    //   .limit(1)
    //   .maybeSingle();
    //
    // if (runError) {
    //   console.error("Error checking for recent test run:", runError);
    //   // Decide if this should block approval or just be a warning
    //   // return NextResponse.json({ error: "Failed to verify recent test run" }, { status: 500 });
    // }
    // if (!recentTestRun) {
    //    return NextResponse.json({ error: "A recent successful test run is required before approval" }, { status: 400 });
    // }

    // 3. Update the scraper's is_approved status
    const { error: updateError } = await supabase
      .from("scrapers")
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq("id", scraperId);

    if (updateError) {
      console.error("Error approving scraper:", updateError);
      return NextResponse.json({ error: "Failed to approve scraper" }, { status: 500 });
    }

    console.log(`Scraper ${scraperId} approved successfully.`);

    return NextResponse.json({
      success: true,
      message: "Scraper approved successfully.",
    });

  } catch (error) {
    console.error("Error in POST /api/scrapers/[scraperId]/approve:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}