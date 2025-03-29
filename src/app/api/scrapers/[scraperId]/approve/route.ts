import { NextRequest, NextResponse } from "next/server";
import { ScraperService } from "@/lib/services/scraper-service";
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
    
    // Approve the scraper
    const scraper = await ScraperService.approveScraper(scraperId);

    return NextResponse.json(scraper);
  } catch (error) {
    console.error("Error approving scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}