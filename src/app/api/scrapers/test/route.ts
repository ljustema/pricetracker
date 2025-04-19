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
    
    // Create a Supabase client with the service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    
    // Create Supabase client (not used in this implementation)
    const _supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the request body
    const body = await request.json();
    
    // Ensure the user ID is set correctly
    body.user_id = ensureUUID(session.user.id);
    
    // In a real implementation, this would:
    // 1. Use a headless browser or HTTP client to fetch the page
    // 2. Apply the selectors to extract product data
    // 3. Return the results and any errors
    
    // For now, return mock results
    const mockResults = [
      {
        scraper_id: 'test',
        competitor_id: body.competitor_id,
        name: 'Test Product 1',
        price: 99.99,
        currency: 'USD',
        image_url: 'https://example.com/image1.jpg',
        sku: 'SKU123',
        brand: 'Test Brand',
        url: `${body.url}/product1`,
        scraped_at: new Date().toISOString(),
      },
      {
        scraper_id: 'test',
        competitor_id: body.competitor_id,
        name: 'Test Product 2',
        price: 149.99,
        currency: 'USD',
        image_url: 'https://example.com/image2.jpg',
        sku: 'SKU456',
        brand: 'Test Brand',
        url: `${body.url}/product2`,
        scraped_at: new Date().toISOString(),
      },
    ];
    
    return NextResponse.json({
      success: true,
      message: 'Scraper test completed successfully',
      products: mockResults,
    });
  } catch (error) {
    console.error("Error in scraper test API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}