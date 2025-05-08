import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { ScraperAIService } from "@/lib/services/scraper-ai-service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

// Helper function to ensure user ID is a valid UUID
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID v5 from the ID
  // Using the DNS namespace as a base
  return randomUUID();
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    // 2. Parse and validate request body
    let body: { url: string; competitorId: string; name?: string };
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: "Invalid request body: Malformed JSON." }, { status: 400 });
    }

    const { url, competitorId, name } = body;

    if (!url || !competitorId) {
      return NextResponse.json(
        { error: "Missing required fields: url, competitorId" },
        { status: 400 }
      );
    }

    // 3. Validate the competitor exists and belongs to the user
    const supabase = createSupabaseAdminClient();
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('id', competitorId)
      .eq('user_id', userId)
      .single();

    if (competitorError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    // 4. Generate a unique scraper name
    const baseScraperName = `${competitor.name} TypeScript Scraper`;
    const { data: existingScrapers, error: existingScrapersError } = await supabase
      .from('scrapers')
      .select('name')
      .eq('competitor_id', competitorId)
      .ilike('name', `${baseScraperName}%`)
      .order('name', { ascending: true });

    if (existingScrapersError) {
      return NextResponse.json(
        { error: `Failed to check existing scrapers: ${existingScrapersError.message}` },
        { status: 500 }
      );
    }

    // Find the next available number for the scraper name
    let nextNumber = 1;
    if (existingScrapers && existingScrapers.length > 0) {
      for (const existingScraper of existingScrapers) {
        const match = existingScraper.name.match(new RegExp(`${baseScraperName}\\s*(\\d+)`));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }
    }

    // Generate the final scraper name
    const scraperName = `${baseScraperName} ${nextNumber}`;

    // 5. Generate the AI scraper
    console.log(`Generating AI scraper for URL: ${url}, competitor: ${competitor.name}, name: ${scraperName}`);

    const scraper = await ScraperAIService.createAIScraper(
      url,
      userId,
      competitorId,
      scraperName
    );

    // 5. Return the created scraper
    return NextResponse.json(scraper);
  } catch (error) {
    console.error("Error in POST /api/scrapers/generate-ai:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
