import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for stock availability data
interface BrandAvailabilityItem {
  brand: string;
  total_products: number;
  in_stock_products: number;
  out_of_stock_products: number;
  in_stock_percentage: number;
  out_of_stock_percentage: number;
}

interface AvailabilitySummary {
  totalBrands: number;
  totalProducts: number;
  totalInStock: number;
  totalOutOfStock: number;
  overallInStockPercentage: number;
  bestPerformingBrand: string | null;
  bestPerformingBrandPercentage: number;
}

// Cache headers for performance
const CACHE_MAX_AGE = 300; // Cache for 5 minutes

/**
 * GET handler to fetch brand stock availability analysis data
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
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

    console.time('api-stock-analysis-availability');

    // Call the database function
    const { data: availabilityData, error } = await supabase.rpc('get_brand_stock_availability', {
      p_user_id: userId,
      p_competitor_id: competitorId || null
    });

    if (error) {
      console.error('Error fetching brand stock availability data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand stock availability data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-stock-analysis-availability');

    // Calculate summary statistics
    const typedData = (availabilityData || []) as BrandAvailabilityItem[];
    const totalProducts = typedData.reduce((sum: number, item: BrandAvailabilityItem) => sum + (item.total_products || 0), 0);
    const totalInStock = typedData.reduce((sum: number, item: BrandAvailabilityItem) => sum + (item.in_stock_products || 0), 0);

    const summary: AvailabilitySummary = {
      totalBrands: typedData.length,
      totalProducts,
      totalInStock,
      totalOutOfStock: typedData.reduce((sum: number, item: BrandAvailabilityItem) => sum + (item.out_of_stock_products || 0), 0),
      overallInStockPercentage: totalProducts > 0 ? (totalInStock / totalProducts) * 100 : 0,
      bestPerformingBrand: typedData[0]?.brand || null,
      bestPerformingBrandPercentage: typedData[0]?.in_stock_percentage || 0
    };

    // Add cache headers to the response
    const response = NextResponse.json({
      data: availabilityData || [],
      summary
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in brand stock availability analysis API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch brand stock availability data', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting brand stock availability data
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
    const { competitor_id, format = 'csv' } = body;

    // Call the database function
    const { data: availabilityData, error } = await supabase.rpc('get_brand_stock_availability', {
      p_user_id: userId,
      p_competitor_id: competitor_id || null
    });

    if (error) {
      console.error('Error fetching brand availability data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand availability data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Brand',
        'Total Products',
        'In Stock Products',
        'Out of Stock Products',
        'In Stock Percentage',
        'Out of Stock Percentage'
      ];

      const typedExportData = (availabilityData || []) as BrandAvailabilityItem[];
      const csvRows = [
        headers.join(','),
        ...typedExportData.map((item: BrandAvailabilityItem) => [
          `"${item.brand || ''}"`,
          item.total_products || 0,
          item.in_stock_products || 0,
          item.out_of_stock_products || 0,
          item.in_stock_percentage || 0,
          item.out_of_stock_percentage || 0
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="brand-availability-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      data: availabilityData || [],
      exportedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in brand availability export API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to export brand availability data', details: errorMessage },
      { status: 500 }
    );
  }
}
