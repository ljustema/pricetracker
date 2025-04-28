import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";
import { Json } from "@/lib/supabase/database.types";

// Define a type for user profile update data
interface ProfileUpdateData {
  name?: string;
  image?: string;
  language?: string;
  timezone?: string;
  primary_currency?: string;
  secondary_currencies?: string[];
  currency_format?: string;
  notification_preferences?: Json;
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
    const {
      name,
      image,
      language,
      timezone,
      primary_currency,
      secondary_currencies,
      currency_format,
      notification_preferences
    } = body;

    // Prepare the update data
    const updateData: ProfileUpdateData = {};
    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    if (language !== undefined) updateData.language = language;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (primary_currency !== undefined) updateData.primary_currency = primary_currency;
    if (secondary_currencies !== undefined) updateData.secondary_currencies = secondary_currencies;
    if (currency_format !== undefined) updateData.currency_format = currency_format;
    if (notification_preferences !== undefined) updateData.notification_preferences = notification_preferences;

    // Update the user profile in next_auth.users
    const userId = ensureUUID(session.user.id);
    const { data, error } = await supabase
      .schema("next_auth")
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select();

    if (error) {
      console.error("Error updating user profile:", error);
      return NextResponse.json(
        { error: "Failed to update user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error("Error in PATCH /api/settings/profile:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
