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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scraperId: string }> }
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
    
    // Await and extract the scraperId parameter
    const { scraperId } = await params;
    
    // Get the scraper
    const { data: scraper, error } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (error) {
      throw new Error(`Failed to get scraper: ${error.message}`);
    }
    
    // Check if the scraper belongs to the user
    if (scraper.user_id !== ensureUUID(session.user.id)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    return NextResponse.json(scraper);
  } catch (error) {
    console.error("Error in scraper API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ scraperId: string }> }
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
    
    // Await and extract the scraperId parameter
    const { scraperId } = await params;
    console.log("API: Updating scraper with ID:", scraperId);
    
    // Get the request body
    const body = await request.json();
    console.log("API: Update payload:", body);
    
    // Get the scraper to check ownership
    const { data: scraper, error: getError } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (getError) {
      throw new Error(`Failed to get scraper: ${getError.message}`);
    }
    
    // Check if the scraper belongs to the user
    if (scraper.user_id !== ensureUUID(session.user.id)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Update the scraper
    console.log("API: Running Supabase update query with ID:", scraperId);
    const { error: updateError } = await supabase
      .from('scrapers')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scraperId);
    
    if (updateError) {
      console.error("API: Error updating scraper:", updateError);
      throw new Error(`Failed to update scraper: ${updateError.message}`);
    }
    
    // Fetch the updated scraper
    const { data: updatedScraper, error: fetchError } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (fetchError) {
      console.error("API: Error fetching updated scraper:", fetchError);
      throw new Error(`Failed to get updated scraper: ${fetchError.message}`);
    }
    
    return NextResponse.json(updatedScraper);
  } catch (error) {
    console.error("Error in scraper API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scraperId: string }> }
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
    
    // Await and extract the scraperId parameter
    const { scraperId } = await params;
    
    // Get the scraper to check ownership
    const { data: scraper, error: getError } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (getError) {
      throw new Error(`Failed to get scraper: ${getError.message}`);
    }
    
    // Check if the scraper belongs to the user
    if (scraper.user_id !== ensureUUID(session.user.id)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // First, delete associated scraped products to satisfy foreign key constraints
    const { error: deleteProductsError } = await supabase
      .from('scraped_products')
      .delete()
      .eq('scraper_id', scraperId);

    if (deleteProductsError) {
      // Log the error but attempt to continue deleting the scraper itself if desired,
      // or handle it more strictly depending on requirements.
      console.error(`Failed to delete associated products for scraper ${scraperId}: ${deleteProductsError.message}`);
      // Optionally re-throw or return an error if deletion of products is critical
      // throw new Error(`Failed to delete associated products: ${deleteProductsError.message}`);
    }

    // Now, delete the scraper
    const { error: deleteError } = await supabase
      .from('scrapers')
      .delete()
      .eq('id', scraperId);
    
    if (deleteError) {
      throw new Error(`Failed to delete scraper: ${deleteError.message}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in scraper API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}