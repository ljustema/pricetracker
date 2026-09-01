import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils/uuid";

export async function POST(request: NextRequest) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();

    // Validate the request body
    if (!body || !body.older_than_days) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { older_than_days, include_products, include_price_changes, include_temp_competitors_scraped_data } = body;

    // Validate older_than_days
    if (older_than_days < 1 || older_than_days > 365) {
      return NextResponse.json(
        { error: "older_than_days must be between 1 and 365" },
        { status: 400 }
      );
    }

    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();
    const { data: deletedCounts, error: cleanupError } = await supabase.rpc("cleanup_user_data", {
      p_user_id: userId,
      p_older_than_days: older_than_days,
      p_include_products: Boolean(include_products),
      p_include_price_changes: Boolean(include_price_changes),
      p_include_temp_competitors_scraped_data: Boolean(include_temp_competitors_scraped_data),
    });

    if (cleanupError) {
      console.error("Error cleaning up user data:", cleanupError);
      return NextResponse.json(
        { error: cleanupError.message || "Failed to perform data cleanup" },
        { status: 500 }
      );
    }

    const deletedCount = Number(deletedCounts?.total ?? 0);

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      deleted_counts: deletedCounts,
      message: `Successfully deleted ${deletedCount} records older than ${older_than_days} days.`
    });
  } catch (error) {
    console.error("Error in POST /api/settings/data-cleanup:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
