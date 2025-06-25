import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for current stock data
interface CurrentStockItem {
  product_name: string;
  brand: string;
  sku: string;
  current_stock: number;
  current_price: number;
  inventory_value: number;
  in_stock_flag: boolean;
}

// Cache headers for performance
const CACHE_MAX_AGE = 180; // Cache for 3 minutes (stock data changes more frequently)

/**
 * GET handler to fetch current stock analysis data
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - brand_filter: string (optional) - Filter by brand name
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

    console.time('api-stock-analysis-current-stock');

    // Call the database function
    const { data: stockData, error } = await supabase.rpc('get_current_stock_analysis', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_brand_filter: brandFilter || null
    });

    if (error) {
      console.error('Error fetching current stock analysis data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch current stock analysis data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-current-stock');

    // Extract summary from the first row (all rows have the same totals)
    const firstRow = stockData?.[0];
    const summary = {
      totalProducts: firstRow?.total_products || 0,
      productsInStock: firstRow?.products_in_stock || 0,
      inStockPercentage: firstRow?.in_stock_percentage || 0,
      totalInventoryValue: firstRow?.total_inventory_value || 0,
      avgInventoryValuePerProduct: stockData?.length > 0 
        ? (firstRow?.total_inventory_value || 0) / stockData.length 
        : 0
    };

    // Add cache headers to the response
    const response = NextResponse.json({
      data: stockData || [],
      summary
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in current stock analysis API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch current stock analysis data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting current stock data
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
    const { competitor_id, brand_filter, format = 'csv' } = body;

    // Call the database function
    const { data: stockData, error } = await supabase.rpc('get_current_stock_analysis', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null,
      p_brand_filter: brand_filter || null
    });

    if (error) {
      console.error('Error fetching current stock data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch current stock data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Product Name',
        'Brand',
        'SKU',
        'Current Stock',
        'Current Price',
        'Inventory Value',
        'In Stock'
      ];

      const typedExportData = (stockData || []) as CurrentStockItem[];
      const csvRows = [
        headers.join(','),
        ...typedExportData.map((item: CurrentStockItem) => [
          `"${item.product_name || ''}"`,
          `"${item.brand || ''}"`,
          `"${item.sku || ''}"`,
          item.current_stock || 0,
          item.current_price || 0,
          item.inventory_value || 0,
          item.in_stock_flag ? 'Yes' : 'No'
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="current-stock-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      data: stockData || [],
      exportedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in current stock export API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to export current stock data', details: errorMessage },
      { status: 500 }
    );
  }
}
