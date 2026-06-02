import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for brand product data
interface BrandProductItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  total_sold: number;
  total_revenue: number;
  avg_daily_sales: number;
  avg_daily_revenue: number;
  current_price: number;
  image_url: string | null;
  competitor_url: string | null;
  last_sale_date: string;
}

/**
 * GET handler to fetch products for a specific brand
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - start_date: ISO string (optional) - Start date for analysis period
 * - end_date: ISO string (optional) - End date for analysis period
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brand: string }> }
) {
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
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Await and decode the brand name from URL
    const { brand } = await params;
    const brandName = decodeURIComponent(brand);

    console.time('api-brand-products');
    console.log('Brand products API called with:', {
      brandName,
      competitorId,
      startDate,
      endDate,
      userId
    });

    // Calculate period days for daily averages
    const periodStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEndDate = endDate ? new Date(endDate) : new Date();
    const timeDiff = periodEndDate.getTime() - periodStartDate.getTime();
    const daysDiff = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1);

    // Query to get products for the specific brand with sales data
    const { data: productData, error } = await supabase.rpc('get_brand_products_detail', {
      p_user_id: userId,
      p_brand_name: brandName,
      p_competitor_id: competitorId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching brand products:', error);
      console.error('Function call details:', {
        p_user_id: userId,
        p_brand_name: brandName,
        p_competitor_id: competitorId || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });
      return NextResponse.json(
        { error: 'Failed to fetch brand products', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-brand-products');

    // Process the data and correct daily averages
    const typedData = (productData || []) as BrandProductItem[];
    const correctedData = typedData.map(item => ({
      ...item,
      avg_daily_sales: (item.total_sold || 0) / daysDiff,
      avg_daily_revenue: (item.total_revenue || 0) / daysDiff
    }));

    // Calculate summary for this brand
    const summary = {
      totalProducts: correctedData.length,
      totalSales: correctedData.reduce((sum, item) => sum + (item.total_sold || 0), 0),
      totalRevenue: correctedData.reduce((sum, item) => sum + (item.total_revenue || 0), 0),
      avgDailySales: correctedData.reduce((sum, item) => sum + (item.avg_daily_sales || 0), 0),
      avgDailyRevenue: correctedData.reduce((sum, item) => sum + (item.avg_daily_revenue || 0), 0)
    };

    return NextResponse.json({
      data: correctedData,
      summary,
      brand: brandName,
      period: {
        startDate: periodStartDate.toISOString().split('T')[0],
        endDate: periodEndDate.toISOString().split('T')[0],
        days: daysDiff
      }
    });

  } catch (error: unknown) {
    console.error('Error in brand products API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch brand products', details: errorMessage },
      { status: 500 }
    );
  }
}
