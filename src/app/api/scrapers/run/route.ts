import { NextRequest, NextResponse } from "next/server";
import { ScraperService } from "@/lib/services/scraper-service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all active scrapers for the user
    const supabase = await createSupabaseServerClient();
    const { data: scrapers, error } = await supabase
      .from('scrapers')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get active scrapers: ${error.message}`);
    }

    if (!scrapers || scrapers.length === 0) {
      return NextResponse.json({ message: "No active scrapers found" });
    }

    // Run each scraper
    const results = await Promise.all(
      scrapers.map(async (scraper) => {
        try {
          const result = await ScraperService.runScraper(scraper.id);
          return {
            id: scraper.id,
            success: true,
            result,
          };
        } catch (error) {
          return {
            id: scraper.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: `Ran ${results.length} scrapers`,
      results,
    });
  } catch (error) {
    console.error("Error running scrapers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}