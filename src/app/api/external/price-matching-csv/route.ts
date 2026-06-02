import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

interface PriorityProductData {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_brand: string;
  product_ean: string;
  our_price: number;
  lowest_competitor_price: number;
  price_difference: number;
  price_difference_percentage: number;
  potential_savings: number;
  competitor_count: number;
  most_competitive_competitor_name: string;
}

/**
 * External API endpoint for downloading price matching CSV
 * Requires API key authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Validate API key and get user
    const { data: keyValidation, error: keyError } = await supabase.rpc('validate_api_key', {
      p_api_key: apiKey
    });

    if (keyError || !keyValidation || keyValidation.length === 0 || !keyValidation[0].is_valid) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userId = ensureUUID(keyValidation[0].user_id);

    // Update last_used_at timestamp for this API key
    await supabase.rpc('update_api_key_usage', {
      p_api_key: apiKey
    });

    // Parse query parameters for filtering
    const url = new URL(request.url);
    const competitorId = url.searchParams.get('competitor_id');
    const brandFilter = url.searchParams.get('brand_filter');
    const limit = parseInt(url.searchParams.get('limit') || '10000');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log(`External API: Fetching price matching data for user ${userId}`);

    // Fetch all products in batches to avoid Supabase limits
    let allProducts: PriorityProductData[] = [];
    let currentOffset = offset;
    const batchSize = 1000;
    let hasMore = true;

    // Set a longer statement timeout for complex product queries (especially after cold starts)
    await supabase.rpc('set_statement_timeout', { p_milliseconds: 45000 }); // 45 seconds

    while (hasMore && allProducts.length < limit) {
      const remainingLimit = Math.min(batchSize, limit - allProducts.length);

      const { data: priorityProducts, error } = await supabase.rpc('get_priority_products_for_repricing', {
        p_user_id: userId,
        p_competitor_id: competitorId || null,
        p_brand_filter: brandFilter || null,
        p_limit: remainingLimit,
        p_offset: currentOffset
      });

      if (error) {
        console.error('Error fetching priority products data:', error);

        // Handle timeout errors specifically
        if (error.code === '57014') {
          return NextResponse.json(
            {
              error: 'The priority products query timed out. This usually happens after periods of inactivity.',
              details: 'The database query took too long to complete. This is common after the database has been idle. Please try again in a few minutes.',
              code: error.code,
              retryable: true
            },
            { status: 504 } // Gateway Timeout status
          );
        }

        // Handle connection errors
        if (error.code === '08006' || error.code === '08000') {
          return NextResponse.json(
            {
              error: 'Database connection error. Please try again in a moment.',
              details: 'The database connection was interrupted. This is common after periods of inactivity.',
              code: error.code,
              retryable: true
            },
            { status: 503 } // Service Unavailable
          );
        }

        return NextResponse.json(
          {
            error: 'Failed to fetch priority products data',
            details: error.message,
            code: error.code,
            retryable: false
          },
          { status: 500 }
        );
      }

      const batchProducts = priorityProducts || [];
      allProducts = allProducts.concat(batchProducts);
      
      // Check if we got a full batch (indicating there might be more)
      hasMore = batchProducts.length === remainingLimit;
      currentOffset += batchSize;

      // Safety check to prevent infinite loops
      if (currentOffset > 50000) {
        console.warn('Reached safety limit of 50,000 products');
        break;
      }
    }

    // Convert to CSV
    if (allProducts.length === 0) {
      return NextResponse.json(
        { error: 'No products found that need price matching' },
        { status: 404 }
      );
    }

    const headers = [
      'Product Name',
      'SKU',
      'Brand',
      'EAN',
      'Our Price',
      'Lowest Competitor Price',
      'Price Difference',
      'Price Difference %',
      'Competitor Count',
      'Competitor with lowest price'
    ];

    const csvContent = [
      headers.join(','),
      ...allProducts.map(product => [
        `"${product.product_name?.replace(/"/g, '""') || ''}"`,
        `"${product.product_sku || ''}"`,
        `"${product.product_brand?.replace(/"/g, '""') || ''}"`,
        `"${product.product_ean || ''}"`,
        product.our_price || '',
        product.lowest_competitor_price || '',
        product.price_difference || '',
        product.price_difference_percentage || '',
        product.competitor_count || '',
        `"${product.most_competitive_competitor_name?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    // Set response headers for CSV download
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'text/csv;charset=utf-8');
    responseHeaders.set('Content-Disposition', `attachment; filename=price-matching-list-${new Date().toISOString().split('T')[0]}.csv`);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET');
    responseHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    console.log(`External API: Successfully exported ${allProducts.length} products for user ${userId}`);

    return new NextResponse(csvContent, {
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Error in external price matching CSV API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
