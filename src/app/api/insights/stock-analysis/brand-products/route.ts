import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for brand products data
interface BrandProductItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  current_stock: number;
  current_price: number | null;
  competitor_name: string | null;
  in_stock_flag: boolean;
  last_updated: string;
}

/**
 * GET handler to fetch products for a specific brand with stock information
 * Query parameters:
 * - brand: string (required) - Brand name to filter by
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - stock_status: 'in_stock' | 'out_of_stock' | 'all' (optional, default: 'all')
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
    const brand = url.searchParams.get('brand');
    const competitorId = url.searchParams.get('competitor_id');
    const stockStatus = url.searchParams.get('stock_status') || 'all';

    if (!brand) {
      return NextResponse.json({ error: 'Brand parameter is required' }, { status: 400 });
    }

    console.time('api-stock-analysis-brand-products');

    // Call the database function
    const { data: productsData, error } = await supabase.rpc('get_brand_products_with_stock', {
      p_user_id: userId,
      p_brand: brand,
      p_competitor_id: competitorId || null,
      p_stock_status: stockStatus
    });

    if (error) {
      console.error('Error fetching brand products data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand products data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-brand-products');

    // Calculate summary statistics
    const typedData = (productsData || []) as BrandProductItem[];
    const summary = {
      totalProducts: typedData.length,
      inStockProducts: typedData.filter(item => item.in_stock_flag).length,
      outOfStockProducts: typedData.filter(item => !item.in_stock_flag).length,
      totalStockValue: typedData.reduce((sum, item) => 
        sum + (item.current_stock * (item.current_price || 0)), 0
      )
    };

    return NextResponse.json({
      data: productsData || [],
      summary,
      brand,
      stockStatus
    });
  } catch (error: unknown) {
    console.error('Error in brand products API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch brand products data', details: errorMessage },
      { status: 500 }
    );
  }
}
