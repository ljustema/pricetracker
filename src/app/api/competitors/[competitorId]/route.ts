import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ competitorId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Safely extract competitorId with error handling
    let competitorId;
    try {
      const params = await context.params;
      competitorId = params?.competitorId;
    } catch (error) {
      console.error("Error parsing params:", error);
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

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
      // Handle the specific case where no rows are returned (competitor doesn't exist)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Competitor not found" },
          { status: 404 }
        );
      }
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> }
) {
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

    // Safely extract competitorId with error handling
    let competitorId;
    try {
      const paramsData = await params;
      competitorId = paramsData?.competitorId;
    } catch (error) {
      console.error("Error parsing params:", error);
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    if (!competitorId) {
      return NextResponse.json(
        { error: "Missing competitor ID" },
        { status: 400 }
      );
    }

    // Get the request body
    const body = await request.json();

    // Create Supabase admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // Check if the competitor exists and belongs to the user
    const { data: competitor, error: fetchError } = await supabase
      .from("competitors")
      .select("id")
      .eq("id", competitorId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !competitor) {
      return NextResponse.json(
        { error: "Competitor not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    // Update the competitor
    const { data, error } = await supabase
      .from("competitors")
      .update({
        name: body.name,
        website: body.website,
        notes: body.description,
      })
      .eq("id", competitorId)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Error updating competitor:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in competitors API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> }
) {
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

    // Safely extract competitorId with error handling
    let competitorId;
    try {
      const paramsData = await params;
      competitorId = paramsData?.competitorId;
    } catch (error) {
      console.error("Error parsing params:", error);
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    if (!competitorId) {
      return NextResponse.json(
        { error: "Missing competitor ID" },
        { status: 400 }
      );
    }

    // Create Supabase admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // Check if the competitor exists and belongs to the user
    const { data: competitor, error: fetchError } = await supabase
      .from("competitors")
      .select("id")
      .eq("id", competitorId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      // Handle the specific case where no rows are returned (competitor doesn't exist)
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Competitor not found or you don't have permission to delete it" },
          { status: 404 }
        );
      }
      console.error("Error fetching competitor for deletion:", fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    // First, delete any associated scraped products to avoid foreign key constraints
    const { error: deleteProductsError } = await supabase
      .from("temp_competitors_scraped_data")
      .delete()
      .eq("competitor_id", competitorId);

    if (deleteProductsError) {
      console.error("Error deleting associated scraped products:", deleteProductsError);
      return NextResponse.json(
        { error: "Failed to delete associated products: " + deleteProductsError.message },
        { status: 500 }
      );
    }

    // Delete any associated price changes
    const { error: deletePriceChangesError } = await supabase
      .from("price_changes_competitors")
      .delete()
      .eq("competitor_id", competitorId);

    if (deletePriceChangesError) {
      console.error("Error deleting associated price changes:", deletePriceChangesError);
      return NextResponse.json(
        { error: "Failed to delete associated price changes: " + deletePriceChangesError.message },
        { status: 500 }
      );
    }

    // Delete the competitor
    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", competitorId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting competitor:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in competitors API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}