import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";

export interface ScraperHealth {
  status: "ok" | "warning" | "critical" | "unknown";
  reason_code: string;
  reason_text: string;
  last_run_id?: string | null;
  last_run_count?: number | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
  baseline_median?: number | null;
  baseline_min?: number | null;
  baseline_runs?: number;
  rejection_count_last_run?: number;
  drop_rate?: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scraperId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { scraperId } = await params;

    // Ownership check (service role bypasses RLS, so do it explicitly)
    const { data: scraper, error: scraperError } = await supabase
      .from("scrapers")
      .select("user_id")
      .eq("id", scraperId)
      .single();

    if (scraperError || !scraper) {
      return NextResponse.json({ error: "Scraper not found" }, { status: 404 });
    }
    if (scraper.user_id !== ensureUUID(session.user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("get_scraper_run_health", {
      p_scraper_id: scraperId,
    });

    if (error) {
      console.error("get_scraper_run_health RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch scraper health" },
        { status: 500 }
      );
    }

    return NextResponse.json(data as ScraperHealth);
  } catch (error) {
    console.error("Error in scraper health route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
