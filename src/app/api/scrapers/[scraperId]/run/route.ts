import { NextRequest, NextResponse } from "next/server";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { randomUUID } from "crypto";

// Remove the separate Params interface

export async function POST(
  req: NextRequest,
  { params }: { params: { scraperId: string } } // Use standard inline type
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scraperId } = params; // This access should now be correct
    const body = await req.json().catch(() => ({})); // Allow empty body
    const isTestRun = body?.isTestRun === true; // Default to false if not provided or not true

    // Generate a unique runId
    const runId = randomUUID();

    // Start the scraper asynchronously (non-blocking), passing the test run flag
    // No need to await here as runScraper starts the process in the background
    // Await the runScraper call to ensure the initial DB record is created before responding
    await ScraperExecutionService.runScraper(scraperId, runId, isTestRun);

    // Return 202 Accepted with the runId
    return NextResponse.json({ runId: runId }, { status: 202 }); // Return the runId in the response body
  } catch (error) {
    console.error("Error starting scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}