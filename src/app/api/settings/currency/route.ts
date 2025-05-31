import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils";

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

    // Get the user's company
    const userId = ensureUUID(session.user.id);

    // First, check if the user has settings
    const { data, error } = await supabase
      .from("user_settings")
      .select("primary_currency, currency_format")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching currency settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch currency settings" },
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
        .select("primary_currency, currency_format")
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
    console.error("Error in GET /api/settings/currency:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
