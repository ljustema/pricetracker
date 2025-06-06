import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";

// GET handler to fetch all suppliers for the current user
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

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // Fetch all suppliers for the current user
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching suppliers:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in suppliers API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST handler to create a new supplier
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

    // Get the request body
    const body = await request.json();

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

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "Supplier name is required" },
        { status: 400 }
      );
    }

    // Check if user profile exists, create if it doesn't
    try {
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (profileCheckError && profileCheckError.code === 'PGRST116') {
        // User profile doesn't exist, create it
        const { error: profileCreateError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: session.user.email || '',
            name: session.user.name || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileCreateError) {
          console.error("Error creating user profile:", profileCreateError);
          return NextResponse.json(
            { error: "Failed to create user profile: " + profileCreateError.message },
            { status: 500 }
          );
        }
      } else if (profileCheckError) {
        console.error("Error checking user profile:", profileCheckError);
        return NextResponse.json(
          { error: "Failed to verify user profile: " + profileCheckError.message },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Error in user profile creation process:", error);
      // Provide more detailed error information
      const errorDetails = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { rawError: String(error) };
      console.error("Error details:", JSON.stringify(errorDetails));

      return NextResponse.json(
        { error: "Failed to create user profile: " + (error instanceof Error ? error.message : String(error)) },
        { status: 500 }
      );
    }

    // Insert the new supplier
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        user_id: userId,
        name: body.name,
        website: body.website,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        logo_url: body.logo_url,
        notes: body.notes,
        login_username: body.login_username,
        login_password: body.login_password,
        api_key: body.api_key,
        api_url: body.api_url,
        login_url: body.login_url,
        price_file_url: body.price_file_url,
        scraping_config: body.scraping_config,
        sync_frequency: body.sync_frequency || 'weekly',
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select();

    if (error) {
      console.error("Error creating supplier:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in suppliers API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
