import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
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
 * GET handler to fetch priority products for repricing
 * This answers: "Which products need price adjustments most urgently?"
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Parse query parameters
    const url = new URL(request.url);
    const competitorId = url.searchParams.get('competitor_id');
    const brandFilter = url.searchParams.get('brand_filter');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const timerLabel = `api-competitor-analysis-priority-products-${Math.random().toString(36).substr(2, 9)}`;
    console.time(timerLabel);

    // Call the database function
    const { data: priorityProducts, error } = await supabase.rpc('get_priority_products_for_repricing', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_brand_filter: brandFilter || null,
      p_limit: limit,
      p_offset: 0 // Default offset for GET requests
    });

    if (error) {
      console.error('Error fetching priority products data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch priority products data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd(timerLabel);

    // Calculate summary statistics
    const totalPotentialSavings = priorityProducts?.reduce((sum: number, product: PriorityProductData) =>
      sum + (product.potential_savings || 0), 0) || 0;

    const avgPriceDifference = priorityProducts?.length > 0
      ? priorityProducts.reduce((sum: number, product: PriorityProductData) =>
          sum + (product.price_difference_percentage || 0), 0) / priorityProducts.length
      : 0;

    return NextResponse.json({
      data: priorityProducts || [],
      summary: {
        totalProducts: priorityProducts?.length || 0,
        totalPotentialSavings: Math.round(totalPotentialSavings * 100) / 100,
        avgPriceDifferencePercentage: Math.round(avgPriceDifference * 100) / 100,
        limit,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Unexpected error in priority products API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting priority products data
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Parse request body for export parameters
    const body = await request.json();
    const {
      competitor_id,
      brand_filter,
      limit = 1000,
      offset = 0,
      format = 'csv'
    } = body;

    // Call the database function
    const { data: priorityProducts, error } = await supabase.rpc('get_priority_products_for_repricing', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null,
      p_brand_filter: brand_filter || null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Error fetching priority products data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch priority products data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'json') {
      // Return JSON data for batch processing
      return NextResponse.json({
        success: true,
        data: priorityProducts || [],
        metadata: {
          limit,
          offset,
          count: priorityProducts?.length || 0
        }
      });
    } else if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'Product Name',
        'SKU',
        'Brand',
        'Our Price',
        'Lowest Competitor Price',
        'Price Difference',
        'Price Difference %',
        'Potential Savings',
        'Competitor Count',
        'Most Competitive Competitor'
      ];

      const csvRows = priorityProducts?.map((row: PriorityProductData) => [
        row.product_name || '',
        row.product_sku || '',
        row.product_brand || '',
        row.our_price || 0,
        row.lowest_competitor_price || 0,
        row.price_difference || 0,
        row.price_difference_percentage || 0,
        row.potential_savings || 0,
        row.competitor_count || 0,
        row.most_competitive_competitor_name || ''
      ]) || [];

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row: (string | number)[]) => row.map(cell =>
          typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(','))
      ].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="priority-products-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      data: priorityProducts || [],
      format: format
    });

  } catch (error) {
    console.error('Unexpected error in priority products export API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
