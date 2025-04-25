import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
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
    
    // Get the request body
    const body = await request.json();
    
    // Check if the required parameters are provided
    if (!body.url || !body.competitorId) {
      return NextResponse.json(
        { error: "Missing required parameters: url, competitorId" },
        { status: 400 }
      );
    }
    
    // In a real implementation, this would:
    // 1. Use an AI service to analyze the website structure
    // 2. Identify product listing patterns
    // 3. Generate CSS selectors for products, names, prices, etc.
    // 4. Test the selectors against the actual page
    
    // For now, return a mock configuration
    const mockConfig = {
      user_id: ensureUUID(session.user.id),
      competitor_id: body.competitorId,
      name: `AI Generated Scraper for ${new URL(body.url).hostname}`,
      url: body.url,
      selectors: {
        product: '.product-item',
        name: '.product-name',
        price: '.product-price',
        image: '.product-image img',
        sku: '.product-sku',
        brand: '.product-brand',
      },
      schedule: {
        frequency: 'daily',
        time: '02:00', // Run at 2 AM
      },
      is_active: false, // Default to inactive until tested
    };
    
    return NextResponse.json(mockConfig);
  } catch (error) {
    console.error("Error in scraper generate API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}