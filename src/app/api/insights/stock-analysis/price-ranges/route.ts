import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for price range data
interface PriceRangeItem {
  price_range: string;
  unique_products: number;
  total_units_sold: number;
  total_revenue: number;
  avg_price_in_range: number;
  revenue_percentage: number;
  range_order: number;
}

interface PriceRangeSummary {
  totalRanges: number;
  totalRevenue: number;
  totalUnits: number;
  avgPriceOverall: number;
  mostPopularRange: string | null;
  mostPopularRangeUnits: number;
  highestRevenueRange: string | null;
  highestRevenueRangeAmount: number;
}

// Cache headers for performance
const CACHE_MAX_AGE = 300; // Cache for 5 minutes

/**
 * GET handler to fetch price range analysis data
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - start_date: ISO string (optional) - Start date for analysis period
 * - end_date: ISO string (optional) - End date for analysis period
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
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.time('api-stock-analysis-price-ranges');

    // Call the database function
    const { data: priceRangeData, error } = await supabase.rpc('get_price_range_analysis', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching price range analysis data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price range analysis data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-price-ranges');

    // Calculate summary statistics
    const typedData = (priceRangeData || []) as PriceRangeItem[];
    const totalRevenue = typedData.reduce((sum: number, item: PriceRangeItem) => sum + (item.total_revenue || 0), 0);
    const totalUnits = typedData.reduce((sum: number, item: PriceRangeItem) => sum + (item.total_units_sold || 0), 0);
    const mostPopularRange = typedData.length > 0 ? typedData.reduce((prev: PriceRangeItem, current: PriceRangeItem) =>
      (current.total_units_sold > prev.total_units_sold) ? current : prev, typedData[0]) : null;
    const highestRevenueRange = typedData.length > 0 ? typedData.reduce((prev: PriceRangeItem, current: PriceRangeItem) =>
      (current.total_revenue > prev.total_revenue) ? current : prev, typedData[0]) : null;

    const summary: PriceRangeSummary = {
      totalRanges: typedData.length,
      totalRevenue,
      totalUnits,
      avgPriceOverall: totalUnits > 0 ? totalRevenue / totalUnits : 0,
      mostPopularRange: mostPopularRange?.price_range || null,
      mostPopularRangeUnits: mostPopularRange?.total_units_sold || 0,
      highestRevenueRange: highestRevenueRange?.price_range || null,
      highestRevenueRangeAmount: highestRevenueRange?.total_revenue || 0
    };

    // Add cache headers to the response
    const response = NextResponse.json({
      data: priceRangeData || [],
      summary
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in price range analysis API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch price range analysis data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting price range data
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
    const { competitor_id, start_date, end_date, format = 'csv' } = body;

    // Call the database function
    const { data: priceRangeData, error } = await supabase.rpc('get_price_range_analysis', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null,
      p_start_date: start_date || null,
      p_end_date: end_date || null
    });

    if (error) {
      console.error('Error fetching price range data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price range data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Price Range',
        'Unique Products',
        'Total Units Sold',
        'Total Revenue',
        'Average Price in Range',
        'Revenue Percentage'
      ];

      const typedExportData = (priceRangeData || []) as PriceRangeItem[];
      const csvRows = [
        headers.join(','),
        ...typedExportData.map((item: PriceRangeItem) => [
          `"${item.price_range || ''}"`,
          item.unique_products || 0,
          item.total_units_sold || 0,
          item.total_revenue || 0,
          item.avg_price_in_range || 0,
          item.revenue_percentage || 0
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="price-range-analysis-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      data: priceRangeData || [],
      exportedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in price range export API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to export price range data', details: errorMessage },
      { status: 500 }
    );
  }
}
