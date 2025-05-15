import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';

// GET handler to fetch all competitors for the current user
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

    // Fetch all competitors for the current user
    const { data, error } = await supabase
      .from("competitors")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching competitors:", error);
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

    // Skip checking auth.users and focus on ensuring the user profile exists
    // The auth.users table is managed by Supabase Auth and shouldn't be directly modified
    try {
      // Ensure the user has a profile in user_profiles
      const { data: userProfile, error: userProfileError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (!userProfile || userProfileError) {
        console.log("User profile not found, creating one...");

        // Create user profile
        const { error: profileInsertError } = await supabase
          .from("user_profiles")
          .insert({
            id: userId,
            name: session.user.name || "",
            avatar_url: session.user.image || "",
            email: session.user.email || ""
          });

        if (profileInsertError) {
          console.error("Error creating user profile:", profileInsertError);

          // Check if it's an empty object
          const isEmptyObject = typeof profileInsertError === 'object' &&
                               Object.keys(profileInsertError).length === 0;

          // If it's not a duplicate key error, return an error response
          if (isEmptyObject || !profileInsertError.message || !profileInsertError.message.includes('duplicate key')) {
            // Try to get a meaningful error message, or default to a generic one
            let errorMessage;
            if (isEmptyObject) {
              errorMessage = "Unknown database error occurred";
            } else {
              errorMessage = profileInsertError.message || profileInsertError.details ||
                            profileInsertError.hint || JSON.stringify(profileInsertError);
            }

            console.error("Returning error to client:", errorMessage);

            return NextResponse.json(
              { error: "Failed to create user profile: " + errorMessage },
              { status: 500 }
            );
          }
        }
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

    // Insert the new competitor
    const { data, error } = await supabase
      .from("competitors")
      .insert({
        user_id: userId,
        name: body.name,
        website: body.website,
        notes: body.description,
      })
      .select();

    if (error) {
      console.error("Error creating competitor:", error);
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