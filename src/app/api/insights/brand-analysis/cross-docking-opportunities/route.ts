import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for cross-docking opportunities data
interface CrossDockingOpportunitiesData {
  brand_name: string;
  total_products: number;
  competitor_count: number;
  avg_stock_level: number;
  products_with_low_stock: number;
  low_stock_percentage: number;
  avg_competitor_price: number;
  stock_turnover_indicator: string;
  cross_docking_suitability_score: number;
  suitability_reason: string;
}

// Database row type for the raw data from Supabase
interface CrossDockingOpportunitiesDataRow {
  brand_name: string;
  total_products: number;
  competitor_count: number;
  avg_stock_level: string | null;
  products_with_low_stock: number;
  low_stock_percentage: string | null;
  avg_competitor_price: string | null;
  stock_turnover_indicator: string;
  cross_docking_suitability_score: string | null;
  suitability_reason: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const minProducts = parseInt(searchParams.get('min_products') || '100');
    const maxAvgStock = parseFloat(searchParams.get('max_avg_stock') || '50.0');

    console.time('api-brand-analysis-cross-docking-opportunities');

    const supabase = createSupabaseAdminClient();

    // Call the database function to get cross-docking friendly brands
    const { data, error } = await supabase.rpc('get_cross_docking_friendly_brands', {
      p_user_id: userId,
      p_min_products: minProducts,
      p_max_avg_stock: maxAvgStock
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cross-docking opportunities data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-brand-analysis-cross-docking-opportunities');

    // Transform the data for the frontend
    const transformedData: CrossDockingOpportunitiesData[] = (data || []).map((row: CrossDockingOpportunitiesDataRow) => ({
      brand_name: row.brand_name,
      total_products: row.total_products,
      competitor_count: row.competitor_count,
      avg_stock_level: parseFloat(row.avg_stock_level || '0'),
      products_with_low_stock: row.products_with_low_stock,
      low_stock_percentage: parseFloat(row.low_stock_percentage || '0'),
      avg_competitor_price: parseFloat(row.avg_competitor_price || '0'),
      stock_turnover_indicator: row.stock_turnover_indicator,
      cross_docking_suitability_score: parseFloat(row.cross_docking_suitability_score || '0'),
      suitability_reason: row.suitability_reason
    }));

    // Calculate summary statistics
    const turnoverIndicatorCounts = transformedData.reduce((acc, brand) => {
      acc[brand.stock_turnover_indicator] = (acc[brand.stock_turnover_indicator] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = {
      total_suitable_brands: transformedData.length,
      total_products: transformedData.reduce((sum, brand) => sum + brand.total_products, 0),
      avg_suitability_score: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.cross_docking_suitability_score, 0) / transformedData.length 
        : 0,
      top_suitable_brand: transformedData.length > 0 ? transformedData[0].brand_name : null,
      high_suitability_brands: transformedData.filter(brand => brand.cross_docking_suitability_score >= 70).length,
      avg_stock_level: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.avg_stock_level, 0) / transformedData.length 
        : 0,
      avg_low_stock_percentage: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.low_stock_percentage, 0) / transformedData.length 
        : 0,
      turnover_distribution: turnoverIndicatorCounts,
      price_range: {
        min: transformedData.length > 0 ? Math.min(...transformedData.map(b => b.avg_competitor_price)) : 0,
        max: transformedData.length > 0 ? Math.max(...transformedData.map(b => b.avg_competitor_price)) : 0,
        avg: transformedData.length > 0 
          ? transformedData.reduce((sum, brand) => sum + brand.avg_competitor_price, 0) / transformedData.length 
          : 0
      }
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      metadata: {
        min_products: minProducts,
        max_avg_stock: maxAvgStock,
        total_suitable_brands: transformedData.length
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint for exporting data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const body = await request.json();
    const { min_products = 100, max_avg_stock = 50.0, format = 'csv' } = body;

    const supabase = createSupabaseAdminClient();

    // Get the data for export
    const { data, error } = await supabase.rpc('get_cross_docking_friendly_brands', {
      p_user_id: userId,
      p_min_products: min_products,
      p_max_avg_stock: max_avg_stock
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Convert to CSV format
      const headers = [
        'Brand Name',
        'Total Products',
        'Competitor Count',
        'Avg Stock Level',
        'Low Stock Products',
        'Low Stock %',
        'Avg Price',
        'Turnover Indicator',
        'Suitability Score',
        'Suitability Reason'
      ];

      const csvRows = [
        headers.join(','),
        ...(data || []).map((row: CrossDockingOpportunitiesDataRow) => [
          `"${row.brand_name}"`,
          row.total_products,
          row.competitor_count,
          parseFloat(row.avg_stock_level || '0').toFixed(2),
          row.products_with_low_stock,
          parseFloat(row.low_stock_percentage || '0').toFixed(2),
          parseFloat(row.avg_competitor_price || '0').toFixed(2),
          `"${row.stock_turnover_indicator}"`,
          parseFloat(row.cross_docking_suitability_score || '0').toFixed(2),
          `"${row.suitability_reason}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `cross-docking-opportunities-${timestamp}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
