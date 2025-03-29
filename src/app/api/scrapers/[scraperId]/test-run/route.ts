import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";

interface Params {
  params: {
    scraperId: string;
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scraperId } = await params;
    
    // Start the test run asynchronously and return a runId
    const { runId } = await ScraperExecutionService.startScraperTestRun(scraperId);
    
    // Log the runId for debugging
    console.log(`Started test run for scraper ${scraperId} with runId ${runId}`);
    
    // Return 202 Accepted with the runId for polling
    return NextResponse.json({ runId }, { status: 202 });
  } catch (error) {
    console.error("Error starting scraper test run:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}