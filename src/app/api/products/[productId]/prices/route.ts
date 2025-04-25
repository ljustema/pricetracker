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
    const sourceId = url.searchParams.get('sourceId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const latest = url.searchParams.get('latest') === 'true';

    // Use the new database functions that handle both competitor and integration prices
    if (latest) {
      // Use the get_latest_competitor_prices function for latest prices
      const { data, error } = await supabase
        .rpc('get_latest_competitor_prices', {
          p_user_id: userId,
          p_product_id: productId
        });

      if (error) {
        return NextResponse.json(
          { error: `Failed to fetch latest prices: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(data || []);
    } else {
      // Use the get_product_price_history function for price history
      const { data, error } = await supabase
        .rpc('get_product_price_history', {
          p_user_id: userId,
          p_product_id: productId,
          p_source_id: sourceId || null,
          p_limit: limit
        });

      if (error) {
        return NextResponse.json(
          { error: `Failed to fetch price history: ${error.message}` },
          { status: 500 }
        );
      }

    return NextResponse.json(data || []);
    }
  } catch (error) {
    console.error("Error in prices API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}