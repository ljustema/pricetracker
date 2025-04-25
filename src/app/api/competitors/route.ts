import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

// Helper function to ensure user ID is a valid UUID
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  
  // If not a UUID, create a deterministic UUID v5 from the ID
  // Using the DNS namespace as a base
  return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
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
    
    // Check if the user exists in the auth.users table
    const { data: authUser, error: authUserError } = await supabase
      .from("auth.users")
      .select("id")
      .eq("id", userId)
      .single();
    
    // If the user doesn't exist in auth.users, create one
    if (!authUser || authUserError) {
      console.log("User not found in auth.users, creating one...");
      
      // Create a user in the auth.users table
      // Note: This is a simplified version, in a real app you'd need to handle this properly
      const { error: createUserError } = await supabase.rpc("create_user_for_nextauth", {
        user_id: userId,
        email: session.user.email || "",
        name: session.user.name || "",
      });
      
      if (createUserError) {
        console.error("Error creating user in auth.users:", createUserError);
        return NextResponse.json(
          { error: "Failed to create user in auth.users: " + createUserError.message },
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