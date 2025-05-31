import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";

export async function GET() {
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

    // First, check if the user has settings
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch user settings" },
        { status: 500 }
      );
    }

    // If no settings exist, create them with default values
    if (!data) {
      // Call the get_or_create_user_settings function
      const { data: functionData, error: functionError } = await supabase
        .rpc("get_or_create_user_settings", { p_user_id: userId });

      if (functionError) {
        console.error("Error creating user settings:", functionError);
        return NextResponse.json(
          { error: "Failed to create user settings" },
          { status: 500 }
        );
      }

      // Fetch the newly created settings
      const { data: newSettings, error: fetchError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("id", functionData)
        .single();

      if (fetchError) {
        console.error("Error fetching new user settings:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch new user settings" },
          { status: 500 }
        );
      }

      return NextResponse.json(newSettings);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in GET /api/settings/company:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Define a type for company update data
interface CompanyUpdateData {
  name?: string;
  address?: string;
  org_number?: string;
  updated_at: string;
}

export async function PATCH(request: NextRequest) {
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

    // Extract the fields to update
    const { name, address, org_number } = body;

    // Prepare the update data
    const updateData: CompanyUpdateData = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (org_number !== undefined) updateData.org_number = org_number;

    // Get the user's settings ID
    const userId = ensureUUID(session.user.id);

    // First, ensure the user settings exist
    const { error: settingsError } = await supabase
      .rpc("get_or_create_user_settings", { p_user_id: userId });

    if (settingsError) {
      console.error("Error ensuring user settings exist:", settingsError);
      return NextResponse.json(
        { error: "Failed to ensure user settings exist" },
        { status: 500 }
      );
    }

    // Update the user settings
    const { data, error } = await supabase
      .from("user_settings")
      .update(updateData)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Error updating user settings:", error);
      return NextResponse.json(
        { error: "Failed to update user settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error("Error in PATCH /api/settings/company:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
