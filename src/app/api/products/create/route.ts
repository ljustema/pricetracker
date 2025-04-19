import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';

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
        { error: "Product name is required" },
        { status: 400 }
      );
    }
    
    // Insert the new product
    const { data, error } = await supabase
      .from("products")
      .insert({
        user_id: userId,
        name: body.name,
        sku: body.sku || null,
        ean: body.ean || null,
        brand: body.brand || null,
        category: body.category || null,
        description: body.description || null,
        image_url: body.image_url || null,
        our_price: body.our_price || null,
        cost_price: body.cost_price || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select();
    
    if (error) {
      console.error("Error creating product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in products/create API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
