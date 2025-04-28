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

    // Get the user's company
    const userId = ensureUUID(session.user.id);

    // First, check if the user has a company
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching company:", error);
      return NextResponse.json(
        { error: "Failed to fetch company" },
        { status: 500 }
      );
    }

    // If no company exists, create one with default values
    if (!data) {
      // Call the get_or_create_company function
      const { data: functionData, error: functionError } = await supabase
        .rpc("get_or_create_company", { p_user_id: userId });

      if (functionError) {
        console.error("Error creating company:", functionError);
        return NextResponse.json(
          { error: "Failed to create company" },
          { status: 500 }
        );
      }

      // Fetch the newly created company
      const { data: newCompany, error: fetchError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", functionData)
        .single();

      if (fetchError) {
        console.error("Error fetching new company:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch new company" },
          { status: 500 }
        );
      }

      return NextResponse.json(newCompany);
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

    // Get the user's company ID
    const userId = ensureUUID(session.user.id);

    // First, ensure the company exists
    const { error: companyError } = await supabase
      .rpc("get_or_create_company", { p_user_id: userId });

    if (companyError) {
      console.error("Error ensuring company exists:", companyError);
      return NextResponse.json(
        { error: "Failed to ensure company exists" },
        { status: 500 }
      );
    }

    // Update the company
    const { data, error } = await supabase
      .from("companies")
      .update(updateData)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Error updating company:", error);
      return NextResponse.json(
        { error: "Failed to update company" },
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
