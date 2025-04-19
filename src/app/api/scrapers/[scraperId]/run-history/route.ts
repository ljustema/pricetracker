import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: { scraperId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = ensureUUID(session.user.id);
    const { scraperId } = params;

    if (!scraperId) {
      return NextResponse.json({ error: "Scraper ID is required" }, { status: 400 });
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. First verify the scraper exists and belongs to the user
    const { data: scraper, error: scraperError } = await supabase
      .from("scrapers")
      .select("id")
      .eq("id", scraperId)
      .eq("user_id", userId)
      .single();

    if (scraperError || !scraper) {
      // Log the error but return a generic 404/401 to avoid leaking info
      console.error(`Error fetching scraper or permission denied for scraper ${scraperId}, user ${userId}:`, scraperError);
      return NextResponse.json({ error: "Scraper not found or access denied" }, { status: 404 });
    }

    // 2. Fetch the scraper runs, ordered by start time descending
    // Add pagination later if needed
    const { data: runs, error: runsError } = await supabase
      .from('scraper_runs')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        product_count,
        error_message,
        execution_time_ms,
        products_per_second
      `)
      .eq('scraper_id', scraperId)
      .order('started_at', { ascending: false })
      .limit(50); // Add a reasonable limit for now

    if (runsError) {
      console.error(`Error fetching runs for scraper ${scraperId}:`, runsError);
      return NextResponse.json({ error: "Failed to fetch scraper runs" }, { status: 500 });
    }

    return NextResponse.json(runs || []);
  } catch (error) {
    console.error("Error in scraper runs API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
