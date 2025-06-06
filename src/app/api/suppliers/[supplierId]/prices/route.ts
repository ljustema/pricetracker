import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from "@supabase/supabase-js";
import { ensureUUID } from "@/lib/utils/uuid";

// GET handler to fetch supplier price changes
export async function GET(
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
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

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

    // Build query
    let query = supabase
      .from("price_changes_suppliers")
      .select(`
        *,
        products!inner(name, sku, brand),
        suppliers!inner(name)
      `)
      .eq("user_id", userId)
      .eq("supplier_id", supplierId)
      .order("changed_at", { ascending: false });

    // Filter by product if specified
    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching supplier price changes:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in supplier prices API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST handler to create a new supplier price change
export async function POST(
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
    if (!body.product_id || !body.new_price) {
      return NextResponse.json(
        { error: "Product ID and new price are required" },
        { status: 400 }
      );
    }

    // Get the current price for this product/supplier combination
    const { data: currentPrice } = await supabase
      .from("price_changes_suppliers")
      .select("new_price, new_wholesale_price")
      .eq("user_id", userId)
      .eq("product_id", body.product_id)
      .eq("supplier_id", supplierId)
      .order("changed_at", { ascending: false })
      .limit(1)
      .single();

    // Calculate price change percentage
    let priceChangePercentage = null;
    if (currentPrice?.new_price && body.new_price) {
      priceChangePercentage = ((body.new_price - currentPrice.new_price) / currentPrice.new_price) * 100;
    }

    // Insert the new price change
    const { data, error } = await supabase
      .from("price_changes_suppliers")
      .insert({
        user_id: userId,
        product_id: body.product_id,
        supplier_id: supplierId,
        old_price: currentPrice?.new_price || null,
        new_price: body.new_price,
        old_wholesale_price: currentPrice?.new_wholesale_price || null,
        new_wholesale_price: body.new_wholesale_price || null,
        price_change_percentage: priceChangePercentage,
        currency_code: body.currency_code || 'SEK',
        url: body.url,
        minimum_order_quantity: body.minimum_order_quantity || 1,
        lead_time_days: body.lead_time_days,
        change_source: body.change_source || 'manual',
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating supplier price change:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in supplier prices API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
