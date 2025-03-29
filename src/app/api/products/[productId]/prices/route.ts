import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
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

// GET handler to fetch price history for a product
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
    
    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);
    
    // Access productId directly from params
    const productId = params.productId;
    
    // Create a Supabase client with the service role key to bypass RLS
    const supabase = createSupabaseAdminClient();
    
    // Check if the product exists and belongs to the user
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();
    
    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found or you don't have permission to access it" },
        { status: 404 }
      );
    }
    
    // Get query parameters
    const url = new URL(request.url);
    const competitorId = url.searchParams.get('competitorId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const latest = url.searchParams.get('latest') === 'true';
    
    // Build the query
    let query = supabase
      .from("price_changes")
      .select(`
        *,
        competitors(name, website)
      `)
      .eq("user_id", userId)
      .eq("product_id", productId)
      .order("changed_at", { ascending: false });
    
    // Add competitorId filter if provided
    if (competitorId) {
      query = query.eq("competitor_id", competitorId);
    }
    
    // Add limit if not fetching latest prices
    if (!latest) {
      query = query.limit(limit);
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch price history: ${error.message}` },
        { status: 500 }
      );
    }
    
    // If we're fetching the latest prices, we need to filter to get only the latest price for each competitor
    if (latest) {
      const latestPrices = new Map();
      data.forEach((priceChange) => {
        if (!latestPrices.has(priceChange.competitor_id)) {
          latestPrices.set(priceChange.competitor_id, priceChange);
        }
      });
      
      return NextResponse.json(Array.from(latestPrices.values()));
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in prices API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}