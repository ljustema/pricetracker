import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { competitorId: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params before using its properties
    const { competitorId } = await params;
    if (!competitorId) {
      return NextResponse.json(
        { error: "Missing competitor ID" },
        { status: 400 }
      );
    }

    // Create Supabase admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Get the competitor
    const { data: competitor, error } = await supabase
      .from("competitors")
      .select("*")
      .eq("id", competitorId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to get competitor: ${error.message}` },
        { status: 500 }
      );
    }

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(competitor);
  } catch (error) {
    console.error("Error getting competitor:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}