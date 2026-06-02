import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for brand performance data
interface BrandPerformanceItem {
  brand: string;
  products_tracked: number;
  total_sold: number;
  total_revenue: number;
  avg_sales_per_product: number;
  active_days: number;
  revenue_percentage: number;
  avg_daily_sales: number;
  avg_daily_revenue: number;
}

interface BrandPerformanceSummary {
  totalBrands: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  topBrand: string | null;
  topBrandRevenue: number;
}

// Cache headers for performance
const CACHE_MAX_AGE = 300; // Cache for 5 minutes

/**
 * GET handler to fetch brand performance analysis data
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

    console.time('api-stock-analysis-brands');

    // Call the database function
    const { data: brandData, error } = await supabase.rpc('get_brand_performance_data', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching brand performance data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand performance data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-brands');

    // Calculate period days (inclusive of both start and end dates)
    const periodStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEndDate = endDate ? new Date(endDate) : new Date();
    const timeDiff = periodEndDate.getTime() - periodStartDate.getTime();
    const daysDiff = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1);

    // Calculate summary statistics
    const typedData = (brandData || []) as BrandPerformanceItem[];

    // Recalculate daily averages using correct period days
    const correctedData = typedData.map(item => ({
      ...item,
      avg_daily_sales: (item.total_sold || 0) / daysDiff,
      avg_daily_revenue: (item.total_revenue || 0) / daysDiff
    }));

    const summary: BrandPerformanceSummary = {
      totalBrands: correctedData.length,
      totalProducts: correctedData.reduce((sum: number, item: BrandPerformanceItem) => sum + (item.products_tracked || 0), 0),
      totalSales: correctedData.reduce((sum: number, item: BrandPerformanceItem) => sum + (item.total_sold || 0), 0),
      totalRevenue: correctedData.reduce((sum: number, item: BrandPerformanceItem) => sum + (item.total_revenue || 0), 0),
      topBrand: correctedData[0]?.brand || null,
      topBrandRevenue: correctedData[0]?.total_revenue || 0
    };

    // Add cache headers to the response
    const response = NextResponse.json({
      data: correctedData || [],
      summary
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in brand performance analysis API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch brand performance data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting brand performance data
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
    const { data: brandData, error } = await supabase.rpc('get_brand_performance_data', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null,
      p_start_date: start_date || null,
      p_end_date: end_date || null
    });

    if (error) {
      console.error('Error fetching brand performance data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand performance data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Calculate period days for export (inclusive of both start and end dates)
      const periodStartDate = start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const periodEndDate = end_date ? new Date(end_date) : new Date();
      const timeDiff = periodEndDate.getTime() - periodStartDate.getTime();
      const daysDiff = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1);

      // Generate CSV content
      const headers = [
        'Brand',
        'Products Tracked',
        'Total Sold',
        'Total Revenue',
        'Average Sales Per Product',
        'Revenue Percentage',
        'Average Daily Sales',
        'Average Daily Revenue'
      ];

      const typedExportData = (brandData || []) as BrandPerformanceItem[];
      // Correct daily averages for export
      const correctedExportData = typedExportData.map(item => ({
        ...item,
        avg_daily_sales: (item.total_sold || 0) / daysDiff,
        avg_daily_revenue: (item.total_revenue || 0) / daysDiff
      }));
      const csvRows = [
        headers.join(','),
        ...correctedExportData.map((item: BrandPerformanceItem) => [
          `"${item.brand || ''}"`,
          item.products_tracked || 0,
          item.total_sold || 0,
          item.total_revenue || 0,
          item.avg_sales_per_product || 0,
          item.revenue_percentage || 0,
          item.avg_daily_sales || 0,
          item.avg_daily_revenue || 0
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="brand-performance-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      data: brandData || [],
      exportedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in brand performance export API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to export brand performance data', details: errorMessage },
      { status: 500 }
    );
  }
}
