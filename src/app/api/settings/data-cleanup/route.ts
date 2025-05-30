import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
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

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse the request body
    const body = await request.json();

    // Validate the request body
    if (!body || !body.older_than_days) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { older_than_days, include_products, include_price_changes, include_scraped_products } = body;

    // Validate older_than_days
    if (older_than_days < 1 || older_than_days > 365) {
      return NextResponse.json(
        { error: "older_than_days must be between 1 and 365" },
        { status: 400 }
      );
    }

    const userId = ensureUUID(session.user.id);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - older_than_days);
    const cutoffDateString = cutoffDate.toISOString();

    let deletedCount = 0;

    // Delete scraped products if requested
    if (include_scraped_products) {
      const { data: scrapedProductsData, error: scrapedProductsError } = await supabase
        .from("temp_competitors_scraped_data")
        .delete()
        .eq("user_id", userId)
        .lt("scraped_at", cutoffDateString)
        .select("count");

      if (scrapedProductsError) {
        console.error("Error deleting scraped products:", scrapedProductsError);
        return NextResponse.json(
          { error: "Failed to delete scraped products" },
          { status: 500 }
        );
      }

      deletedCount += scrapedProductsData.length;
    }

    // Delete price changes if requested
    if (include_price_changes) {
      const { data: priceChangesData, error: priceChangesError } = await supabase
        .from("price_changes")
        .delete()
        .eq("user_id", userId)
        .lt("changed_at", cutoffDateString)
        .select("count");

      if (priceChangesError) {
        console.error("Error deleting price changes:", priceChangesError);
        return NextResponse.json(
          { error: "Failed to delete price changes" },
          { status: 500 }
        );
      }

      deletedCount += priceChangesData.length;
    }

    // Delete products if requested (be careful with this one!)
    if (include_products) {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .delete()
        .eq("user_id", userId)
        .lt("created_at", cutoffDateString)
        .select("count");

      if (productsError) {
        console.error("Error deleting products:", productsError);
        return NextResponse.json(
          { error: "Failed to delete products. This may be due to foreign key constraints." },
          { status: 500 }
        );
      }

      deletedCount += productsData.length;
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
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
