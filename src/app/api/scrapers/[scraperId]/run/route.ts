import { NextRequest, NextResponse } from "next/server";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { randomUUID } from "crypto";

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
    
    // Generate a unique runId
    const runId = randomUUID();
    
    // Start the scraper asynchronously (non-blocking)
    const result = await ScraperExecutionService.runScraper(scraperId, runId);

    // Return 202 Accepted with the runId
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("Error starting scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}