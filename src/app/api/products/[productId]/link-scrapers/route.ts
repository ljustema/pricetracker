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

// POST handler to link scrapers to a product
// DEPRECATED: Use link-competitors endpoint instead
export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    // Log deprecation warning
    console.warn("DEPRECATED: /api/products/[productId]/link-scrapers is deprecated. Use /api/products/[productId]/link-competitors instead.");
    
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
    const { scraperIds } = body;
    
    if (!Array.isArray(scraperIds)) {
      return NextResponse.json(
        { error: "Invalid request: scraperIds must be an array" },
        { status: 400 }
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
    
    // Access productId directly from params
    const productId = params.productId;
    
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
    
    // Get all scrapers that belong to the user
    const { data: userScrapers, error: scrapersError } = await supabase
      .from("scrapers")
      .select("id, competitor_id")
      .eq("user_id", userId)
      .in("id", scraperIds);
    
    if (scrapersError) {
      console.error("Error fetching scrapers:", scrapersError);
      return NextResponse.json(
        { error: "Failed to fetch scrapers: " + scrapersError.message },
        { status: 500 }
      );
    }
    
    // Check if all scraperIds belong to the user
    if (userScrapers.length !== scraperIds.length) {
      return NextResponse.json(
        { error: "One or more scrapers not found or you don't have permission to access them" },
        { status: 400 }
      );
    }
    
    // First, delete all existing links for this product
    const { error: deleteError } = await supabase
      .from("scraped_products")
      .delete()
      .eq("product_id", productId)
      .eq("user_id", userId);
    
    if (deleteError) {
      console.error("Error deleting existing links:", deleteError);
      return NextResponse.json(
        { error: "Failed to update scraper links: " + deleteError.message },
        { status: 500 }
      );
    }
    
    // If there are no scrapers to link, we're done
    if (scraperIds.length === 0) {
      return NextResponse.json({
        success: true,
        warning: "This endpoint is deprecated. Please use /api/products/[productId]/link-competitors instead."
      });
    }
    
    // Create new links for each scraper
    const linksToCreate = userScrapers.map(scraper => ({
      user_id: userId,
      product_id: productId,
      scraper_id: scraper.id,
      competitor_id: scraper.competitor_id,
      name: "", // These will be populated when the scraper runs
      price: 0,
      currency: "USD",
      scraped_at: new Date().toISOString()
    }));
    
    const { data, error } = await supabase
      .from("scraped_products")
      .insert(linksToCreate)
      .select();
    
    if (error) {
      console.error("Error creating scraper links:", error);
      return NextResponse.json(
        { error: "Failed to create scraper links: " + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      links: data,
      warning: "This endpoint is deprecated. Please use /api/products/[productId]/link-competitors instead."
    });
  } catch (error) {
    console.error("Error in link-scrapers API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}