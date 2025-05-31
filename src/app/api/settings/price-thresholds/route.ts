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

    // Get the user's company
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

    // Fetch the user's price thresholds
    const { data, error } = await supabase
      .from("user_settings")
      .select("price_thresholds")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching price thresholds:", error);
      return NextResponse.json(
        { error: "Failed to fetch price thresholds" },
        { status: 500 }
      );
    }

    return NextResponse.json(data.price_thresholds || {
      significant_increase: 10.0,
      significant_decrease: 5.0
    });
  } catch (error) {
    console.error("Error in GET /api/settings/price-thresholds:", error);
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

    // Get the user's company ID
    const userId = ensureUUID(session.user.id);

    // First, ensure the company exists
    const { data: _companyData, error: companyError } = await supabase
      .rpc("get_or_create_company", { p_user_id: userId });

    if (companyError) {
      console.error("Error ensuring company exists:", companyError);
      return NextResponse.json(
        { error: "Failed to ensure company exists" },
        { status: 500 }
      );
    }

    // Update the company's price thresholds
    const { data, error } = await supabase
      .from("companies")
      .update({
        price_thresholds: body,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("price_thresholds");

    if (error) {
      console.error("Error updating price thresholds:", error);
      return NextResponse.json(
        { error: "Failed to update price thresholds" },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0].price_thresholds);
  } catch (error) {
    console.error("Error in PUT /api/settings/price-thresholds:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
