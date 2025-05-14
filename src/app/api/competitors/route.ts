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

    // First, check if the user exists in auth.users
    const { data: authUser, error: authUserError } = await supabase
      .from("auth.users")
      .select("id")
      .eq("id", userId)
      .single();

    // If the user doesn't exist in auth.users, create one
    if (!authUser || authUserError) {
      console.log("User not found in auth.users, creating one...");

      try {
        // Directly insert into auth.users
        const { error: insertError } = await supabase
          .from("auth.users")
          .insert({
            id: userId,
            email: session.user.email || "",
            raw_user_meta_data: { name: session.user.name || "" },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("Error inserting into auth.users:", insertError);

          // If it's not a duplicate key error, return an error response
          if (!insertError.message.includes('duplicate key')) {
            return NextResponse.json(
              { error: "Failed to create user in auth.users: " + insertError.message },
              { status: 500 }
            );
          }
        }

        // Also ensure the user exists in next_auth.users
        const { data: nextAuthUser, error: nextAuthUserError } = await supabase
          .from("next_auth.users")
          .select("id")
          .eq("id", userId)
          .single();

        if (!nextAuthUser || nextAuthUserError) {
          const { error: nextAuthInsertError } = await supabase
            .from("next_auth.users")
            .insert({
              id: userId,
              name: session.user.name || "",
              email: session.user.email || "",
              "emailVerified": new Date().toISOString(),
              image: session.user.image || ""
            });

          if (nextAuthInsertError && !nextAuthInsertError.message.includes('duplicate key')) {
            console.error("Error inserting into next_auth.users:", nextAuthInsertError);
          }
        }

        // Also ensure the user has a profile
        const { data: userProfile, error: userProfileError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", userId)
          .single();

        if (!userProfile || userProfileError) {
          const { error: profileInsertError } = await supabase
            .from("user_profiles")
            .insert({
              id: userId,
              name: session.user.name || "",
              avatar_url: session.user.image || ""
            });

          if (profileInsertError && !profileInsertError.message.includes('duplicate key')) {
            console.error("Error inserting into user_profiles:", profileInsertError);
          }
        }
      } catch (error) {
        console.error("Error in user creation process:", error);
        return NextResponse.json(
          { error: "Failed to create user: " + (error instanceof Error ? error.message : String(error)) },
          { status: 500 }
        );
      }
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