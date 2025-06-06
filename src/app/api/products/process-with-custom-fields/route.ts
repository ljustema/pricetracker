import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { AutoCustomFieldsService } from "@/lib/services/auto-custom-fields-service";

/**
 * API endpoint to process scraped products with automatic custom field creation
 * This can be called by workers after saving scraped data to temp tables
 */

// POST /api/products/process-with-custom-fields
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      productId, 
      scrapedData, 
      source = 'scraper' // 'scraper', 'integration', 'csv'
    } = body;

    if (!productId || !scrapedData) {
      return NextResponse.json(
        { error: 'productId and scrapedData are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify the product belongs to the user
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', productId)
      .eq('user_id', session.user.id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found or access denied' },
        { status: 404 }
      );
    }

    // Process the scraped data and create custom fields automatically
    const result = await AutoCustomFieldsService.processScrapedProductWithCustomFields(
      session.user.id,
      productId,
      scrapedData
    );

    return NextResponse.json({
      success: result.success,
      productId,
      customFieldsCreated: result.customFieldsCreated,
      errors: result.errors,
      source
    });

  } catch (error) {
    console.error('Error in process-with-custom-fields:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/products/process-with-custom-fields - Get processing status or help
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/products/process-with-custom-fields',
    description: 'Process scraped products with automatic custom field creation',
    methods: ['POST'],
    parameters: {
      productId: 'UUID of the product to process',
      scrapedData: 'Object containing all scraped data fields',
      source: 'Optional source identifier (scraper, integration, csv)'
    },
    features: [
      'Automatically detects custom fields in scraped data',
      'Creates custom field definitions if they don\'t exist',
      'Stores custom field values for the product',
      'Handles field type detection (text, number, boolean, url, date)',
      'Validates field names and skips invalid ones'
    ]
  });
}
