import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";

// GET handler to fetch a specific supplier
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
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

    const { supplierId } = await params;

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

    // Fetch the supplier
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .eq("user_id", userId)
      .single();

    if (error) {
      // Handle the specific case where no rows are returned (supplier doesn't exist)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Supplier not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching supplier:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in supplier API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// PUT handler to update a supplier
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
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

    const { supplierId } = await params;

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

    // Update the supplier
    const { data, error } = await supabase
      .from("suppliers")
      .update({
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
        sync_frequency: body.sync_frequency,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", supplierId)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Error updating supplier:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in supplier API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a supplier
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
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

    const { supplierId } = await params;

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

    // Delete the supplier
    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplierId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting supplier:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in supplier API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
