import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for turnover analysis data
interface TurnoverAnalysisItem {
  product_name: string;
  brand: string;
  sku: string;
  current_stock: number;
  stock_turnover_ratio: number;
  velocity_category: string;
  stock_status: string;
  days_without_sales: number;
  avg_daily_sales: number;
}

interface TurnoverAnalysisSummary {
  totalProducts: number;
  deadStockCount: number;
  deadStockPercentage: number;
  fastMovers: number;
  mediumMovers: number;
  slowMovers: number;
  avgTurnoverRatio: number;
  velocityDistribution: {
    fast: number;
    medium: number;
    slow: number;
  };
}

// Cache headers for performance
const CACHE_MAX_AGE = 300; // Cache for 5 minutes

/**
 * GET handler to fetch stock turnover analysis data
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - start_date: ISO string (optional) - Start date for analysis period
 * - end_date: ISO string (optional) - End date for analysis period
 * - dead_stock_days: number (optional) - Days to consider stock as dead (default: 30)
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
    const deadStockDays = parseInt(url.searchParams.get('dead_stock_days') || '30', 10);

    console.time('api-stock-analysis-turnover');

    // Call the database function
    const { data: turnoverData, error } = await supabase.rpc('get_stock_turnover_analysis', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_dead_stock_days: deadStockDays
    });

    if (error) {
      console.error('Error fetching stock turnover analysis data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stock turnover analysis data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-turnover');

    // Calculate summary statistics
    const typedData = (turnoverData || []) as TurnoverAnalysisItem[];
    const deadStockCount = typedData.filter((item: TurnoverAnalysisItem) => item.stock_status === 'Dead Stock').length;
    const fastMovers = typedData.filter((item: TurnoverAnalysisItem) => item.velocity_category === 'Fast Mover').length;
    const mediumMovers = typedData.filter((item: TurnoverAnalysisItem) => item.velocity_category === 'Medium Mover').length;
    const slowMovers = typedData.filter((item: TurnoverAnalysisItem) => item.velocity_category === 'Slow Mover').length;

    const summary: TurnoverAnalysisSummary = {
      totalProducts: typedData.length,
      deadStockCount,
      deadStockPercentage: typedData.length > 0 ? (deadStockCount / typedData.length) * 100 : 0,
      fastMovers,
      mediumMovers,
      slowMovers,
      avgTurnoverRatio: typedData.length > 0
        ? typedData.reduce((sum: number, item: TurnoverAnalysisItem) => sum + (item.stock_turnover_ratio || 0), 0) / typedData.length
        : 0,
      velocityDistribution: {
        fast: fastMovers,
        medium: mediumMovers,
        slow: slowMovers
      }
    };

    // Add cache headers to the response
    const response = NextResponse.json({
      data: turnoverData || [],
      summary
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in stock turnover analysis API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch stock turnover analysis data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting stock turnover data
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
    const { competitor_id, start_date, end_date, dead_stock_days = 30, format = 'csv' } = body;

    // Call the database function
    const { data: turnoverData, error } = await supabase.rpc('get_stock_turnover_analysis', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null,
      p_start_date: start_date || null,
      p_end_date: end_date || null,
      p_dead_stock_days: dead_stock_days
    });

    if (error) {
      console.error('Error fetching turnover data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch turnover data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Product Name',
        'Brand',
        'SKU',
        'Total Sales',
        'Average Stock Level',
        'Current Stock',
        'Stock Turnover Ratio',
        'Stock Status',
        'Days Since Last Sale',
        'Velocity Category',
        'Last Sale Date'
      ];

      const typedExportData = (turnoverData || []) as TurnoverAnalysisItem[];
      const csvRows = [
        headers.join(','),
        ...typedExportData.map((item: TurnoverAnalysisItem) => [
          `"${item.product_name || ''}"`,
          `"${item.brand || ''}"`,
          `"${item.sku || ''}"`,
          0, // total_sales - not in our interface, using 0
          0, // avg_stock_level - not in our interface, using 0
          item.current_stock || 0,
          item.stock_turnover_ratio || 0,
          `"${item.stock_status || ''}"`,
          item.days_without_sales || 0,
          `"${item.velocity_category || ''}"`,
          '' // last_sale_date - not in our interface, using empty string
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="stock-turnover-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      data: turnoverData || [],
      exportedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in stock turnover export API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to export stock turnover data', details: errorMessage },
      { status: 500 }
    );
  }
}
