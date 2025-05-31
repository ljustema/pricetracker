import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";

export async function GET(_request: NextRequest) {
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

    // Get the user's settings
    const userId = ensureUUID(session.user.id);

    // First, ensure the user settings exist
    const { data: _settingsData, error: settingsError } = await supabase
      .rpc("get_or_create_user_settings", { p_user_id: userId });

    if (settingsError) {
      console.error("Error ensuring user settings exist:", settingsError);
      return NextResponse.json(
        { error: "Failed to ensure user settings exist" },
        { status: 500 }
      );
    }

    // Fetch the user's matching rules
    const { data, error } = await supabase
      .from("user_settings")
      .select("matching_rules")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching matching rules:", error);
      return NextResponse.json(
        { error: "Failed to fetch matching rules" },
        { status: 500 }
      );
    }

    return NextResponse.json(data.matching_rules || {
      ean_priority: true,
      sku_brand_fallback: true,
      fuzzy_name_matching: false,
      min_similarity_score: 70
    });
  } catch (error) {
    console.error("Error in GET /api/settings/matching-rules:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Get the user's settings ID
    const userId = ensureUUID(session.user.id);

    // First, ensure the user settings exist
    const { data: _settingsData, error: settingsError } = await supabase
      .rpc("get_or_create_user_settings", { p_user_id: userId });

    if (settingsError) {
      console.error("Error ensuring user settings exist:", settingsError);
      return NextResponse.json(
        { error: "Failed to ensure user settings exist" },
        { status: 500 }
      );
    }

    // Update the user's matching rules
    const { data, error } = await supabase
      .from("user_settings")
      .update({
        matching_rules: body,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("matching_rules");

    if (error) {
      console.error("Error updating matching rules:", error);
      return NextResponse.json(
        { error: "Failed to update matching rules" },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0].matching_rules);
  } catch (error) {
    console.error("Error in PUT /api/settings/matching-rules:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
