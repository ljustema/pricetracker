import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

// GET handler to fetch a specific product
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
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
    
    // Extract productId - must await params in App Router
    const { productId } = await params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID format" },
        { status: 400 }
      );
    }
    
    // Fetch the product
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();
    
    if (error) {
      console.error("Error fetching product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// PUT handler to update a specific product
export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
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
    
    // Extract productId - must await params in App Router
    const { productId } = await params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID format" },
        { status: 400 }
      );
    }
    
    // Check if the product exists and belongs to the user
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();
    
    if (fetchError || !existingProduct) {
      return NextResponse.json(
        { error: "Product not found or you don't have permission to update it" },
        { status: 404 }
      );
    }
    
    // Update the product
    const { data, error } = await supabase
      .from("products")
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("user_id", userId)
      .select();
    
    if (error) {
      console.error("Error updating product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a specific product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { productId: string } }
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
    
    // Extract productId - must await params in App Router
    const { productId } = await params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID format" },
        { status: 400 }
      );
    }
    
    // Check if the product exists and belongs to the user
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();
    
    if (fetchError || !existingProduct) {
      return NextResponse.json(
        { error: "Product not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }
    
    // Delete the product
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("user_id", userId);
    
    if (error) {
      console.error("Error deleting product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}