import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for sales analysis data
interface SalesAnalysisItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  total_sold: number;
  total_revenue: number;
  avg_daily_sales: number;
  avg_daily_revenue: number;
  current_price: number;
  days_tracked: number;
}

interface SalesAnalysisSummary {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  avgDailySales: number;
  avgDailyRevenue: number;
}

// Cache headers for performance
const CACHE_MAX_AGE = 300; // Cache for 5 minutes

/**
 * GET handler to fetch sales analysis data
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - start_date: ISO string (optional) - Start date for analysis period
 * - end_date: ISO string (optional) - End date for analysis period  
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
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const brandFilter = url.searchParams.get('brand_filter');

    console.time('api-stock-analysis-sales');

    // Call the database function
    const { data: salesData, error } = await supabase.rpc('get_sales_analysis_data', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_brand_filter: brandFilter || null
    });

    if (error) {
      console.error('Error fetching sales analysis data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sales analysis data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-sales');

    // Calculate summary statistics
    const typedData = (salesData || []) as SalesAnalysisItem[];
    const summary: SalesAnalysisSummary = {
      totalProducts: typedData.length,
      totalSales: typedData.reduce((sum: number, item: SalesAnalysisItem) => sum + (item.total_sold || 0), 0),
      totalRevenue: typedData.reduce((sum: number, item: SalesAnalysisItem) => sum + (item.total_revenue || 0), 0),
      avgDailySales: typedData.length > 0 ? typedData.reduce((sum: number, item: SalesAnalysisItem) => sum + (item.avg_daily_sales || 0), 0) / typedData.length : 0,
      avgDailyRevenue: typedData.length > 0 ? typedData.reduce((sum: number, item: SalesAnalysisItem) => sum + (item.avg_daily_revenue || 0), 0) / typedData.length : 0
    };

    // Add cache headers to the response
    const response = NextResponse.json({
      data: salesData || [],
      summary
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in sales analysis API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch sales analysis data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting sales analysis data
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
    const { competitor_id, start_date, end_date, brand_filter, format = 'csv' } = body;

    // Call the database function
    const { data: salesData, error } = await supabase.rpc('get_sales_analysis_data', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null,
      p_start_date: start_date || null,
      p_end_date: end_date || null,
      p_brand_filter: brand_filter || null
    });

    if (error) {
      console.error('Error fetching sales analysis data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sales analysis data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Product ID',
        'Product Name',
        'Brand',
        'SKU',
        'Total Sold',
        'Average Price',
        'Total Revenue',
        'Revenue Percentage',
        'Average Daily Sales',
        'Average Daily Revenue'
      ];

      const typedExportData = (salesData || []) as SalesAnalysisItem[];
      const csvRows = [
        headers.join(','),
        ...typedExportData.map((item: SalesAnalysisItem) => [
          `"${item.product_id || ''}"`,
          `"${item.product_name || ''}"`,
          `"${item.brand || ''}"`,
          `"${item.sku || ''}"`,
          item.total_sold || 0,
          item.current_price || 0,
          item.total_revenue || 0,
          // Calculate revenue percentage for export
          ((item.total_revenue || 0) / typedExportData.reduce((sum, i) => sum + (i.total_revenue || 0), 0) * 100) || 0,
          item.avg_daily_sales || 0,
          item.avg_daily_revenue || 0
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sales-analysis-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      data: salesData || [],
      exportedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in sales analysis export API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to export sales analysis data', details: errorMessage },
      { status: 500 }
    );
  }
}
