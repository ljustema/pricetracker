import { NextRequest, NextResponse } from "next/server";
import { ScraperExecutionService } from "@/lib/services/scraper-execution-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

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
    
    // Test the scraper using the newer implementation that bypasses RLS
    const testResults = await ScraperExecutionService.runScraperTest(scraperId);

    return NextResponse.json(testResults);
  } catch (error) {
    console.error("Error testing scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}