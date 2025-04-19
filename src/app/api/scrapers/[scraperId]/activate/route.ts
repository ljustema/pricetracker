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

    // Use await for params if needed
    const { scraperId } = await params;
    const userId = session.user.id;
    
    // Activate the scraper for the user
    const scraper = await ScraperService.activateScraper(scraperId, userId);

    return NextResponse.json(scraper);
  } catch (error) {
    console.error("Error activating scraper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}