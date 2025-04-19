import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';

// GET handler to fetch all products for the current user
export async function POST(request: NextRequest) { // Changed from GET to POST
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

    // --- Start: Product Fetching Logic using RPC ---

    const body = await request.json(); // Read parameters from request body

    // Prepare parameters for the RPC call, converting types as needed
    const rpcParams = {
      p_user_id: userId,
      p_page: parseInt(body.page || "1", 10),
      p_page_size: parseInt(body.pageSize || "12", 10),
      p_sort_by: body.sortBy || "created_at",
      p_sort_order: body.sortOrder || "desc",
      p_brand: body.brand || null, // Pass null if empty/undefined
      p_category: body.category || null, // Pass null if empty/undefined
      p_search: body.search || null, // Pass null if empty/undefined
      // Convert isActive: Frontend sends 'true' or undefined (for active) or false (for inactive)
      // Function expects true (active), false (inactive), or null (don't filter)
      p_is_active: body.isActive === 'true' ? true : (body.isActive === false ? false : null),
      p_competitor_id: body.competitor || null, // Pass null if empty/undefined
      // Convert has_price: Frontend sends true or undefined
      // Function expects true or null
      p_has_price: body.has_price === true ? true : null
    };

    // Execute the RPC call
    const { data: rpcResult, error } = await supabase.rpc('get_products_filtered', rpcParams);

    if (error) {
      console.error("Error calling get_products_filtered RPC:", error);
      return NextResponse.json(
        { error: "Database error: " + error.message },
        { status: 500 }
      );
    }

    // The RPC function returns a JSON object like { "data": [], "totalCount": 0 }
    // Extract data and count from the result
    const data = rpcResult?.data || [];
    const count = rpcResult?.totalCount || 0;

    // Return paginated data and total count
    return NextResponse.json({
      data: data || [], // Ensure data is always an array
      totalCount: count || 0, // Total count matching filters
    });
    // --- End: Modified Product Fetching Logic ---
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST handler for creating products has been moved to /api/products/create/route.ts