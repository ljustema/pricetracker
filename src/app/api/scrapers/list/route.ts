import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperService } from "@/lib/services/scraper-service";
import { createSupabaseAdminClient } from "@/lib/supabase/server"; // Use admin client for server route
import { ensureUUID } from "@/lib/utils/uuid";

export async function GET(_request: NextRequest) { // Prefix unused variable
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = ensureUUID(session.user.id);

    // Fetch scrapers using the service
    const scrapers = await ScraperService.getScrapersByUser(userId);

    // Fetch associated competitors and suppliers
    const competitorIds = [...new Set(scrapers.map(scraper => scraper.competitor_id).filter(id => !!id))];
    const supplierIds = [...new Set(scrapers.map(scraper => scraper.supplier_id).filter(id => !!id))];

    let competitorsMap: Record<string, { id: string; name: string; website: string }> = {};
    let suppliersMap: Record<string, { id: string; name: string; website: string }> = {};

    const supabaseAdmin = createSupabaseAdminClient(); // Use admin client here

    // Fetch competitors
    if (competitorIds.length > 0) {
      const { data: competitorsData, error: competitorsError } = await supabaseAdmin
        .from("competitors")
        .select("id, name, website")
        .in("id", competitorIds)
        .eq("user_id", userId); // Ensure user owns competitors too

      if (competitorsError) {
        console.error("Error fetching competitors in API route:", competitorsError);
      } else if (competitorsData) {
        competitorsMap = competitorsData.reduce((acc, competitor) => {
          acc[competitor.id] = competitor;
          return acc;
        }, {} as Record<string, { id: string; name: string; website: string }>);
      }
    }

    // Fetch suppliers
    if (supplierIds.length > 0) {
      const { data: suppliersData, error: suppliersError } = await supabaseAdmin
        .from("suppliers")
        .select("id, name, website")
        .in("id", supplierIds)
        .eq("user_id", userId); // Ensure user owns suppliers too

      if (suppliersError) {
        console.error("Error fetching suppliers in API route:", suppliersError);
      } else if (suppliersData) {
        suppliersMap = suppliersData.reduce((acc, supplier) => {
          acc[supplier.id] = supplier;
          return acc;
        }, {} as Record<string, { id: string; name: string; website: string }>);
      }
    }

    // Combine data
    const responseData = scrapers.map(scraper => ({
      ...scraper,
      competitor: scraper.competitor_id ? competitorsMap[scraper.competitor_id] : null,
      supplier: scraper.supplier_id ? suppliersMap[scraper.supplier_id] : null,
      scraper_target_type: scraper.competitor_id ? 'competitor' : 'supplier',
    }));

    return NextResponse.json(responseData);

  } catch (error) {
    console.error("Error fetching scrapers list:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}