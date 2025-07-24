import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brands without our prices data
interface BrandsWithoutPricesData {
  brand_name: string;
  competitor_product_count: number;
  competitor_count: number;
  avg_competitor_price: number;
  min_competitor_price: number;
  max_competitor_price: number;
  avg_stock_level: number;
  products_in_stock: number;
  products_out_of_stock: number;
  opportunity_score: number;
}

// Database row type for the raw data from Supabase
interface BrandsWithoutPricesDataRow {
  brand_name: string;
  competitor_product_count: number;
  competitor_count: number;
  avg_competitor_price: string | null;
  min_competitor_price: string | null;
  max_competitor_price: string | null;
  avg_stock_level: string | null;
  products_in_stock: number;
  products_out_of_stock: number;
  opportunity_score: string | null;
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

    console.time('api-brand-analysis-brands-without-prices');

    const supabase = createSupabaseAdminClient();

    // Call the database function to get brands without our prices
    const { data, error } = await supabase.rpc('get_brands_without_our_prices', {
      p_user_id: userId,
      p_min_products: minProducts
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brands without our prices data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-brand-analysis-brands-without-prices');

    // Transform the data for the frontend
    const transformedData: BrandsWithoutPricesData[] = (data || []).map((row: BrandsWithoutPricesDataRow) => ({
      brand_name: row.brand_name,
      competitor_product_count: row.competitor_product_count,
      competitor_count: row.competitor_count,
      avg_competitor_price: parseFloat(row.avg_competitor_price || '0'),
      min_competitor_price: parseFloat(row.min_competitor_price || '0'),
      max_competitor_price: parseFloat(row.max_competitor_price || '0'),
      avg_stock_level: parseFloat(row.avg_stock_level || '0'),
      products_in_stock: row.products_in_stock,
      products_out_of_stock: row.products_out_of_stock,
      opportunity_score: parseFloat(row.opportunity_score || '0')
    }));

    // Calculate summary statistics
    const summary = {
      total_opportunity_brands: transformedData.length,
      total_competitor_products: transformedData.reduce((sum, brand) => sum + brand.competitor_product_count, 0),
      avg_opportunity_score: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.opportunity_score, 0) / transformedData.length 
        : 0,
      top_opportunity_brand: transformedData.length > 0 ? transformedData[0].brand_name : null,
      brands_with_high_scores: transformedData.filter(brand => brand.opportunity_score >= 100).length,
      avg_competitor_count: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.competitor_count, 0) / transformedData.length 
        : 0,
      total_products_in_stock: transformedData.reduce((sum, brand) => sum + brand.products_in_stock, 0),
      price_range: {
        min: transformedData.length > 0 ? Math.min(...transformedData.map(b => b.min_competitor_price)) : 0,
        max: transformedData.length > 0 ? Math.max(...transformedData.map(b => b.max_competitor_price)) : 0,
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
        total_opportunity_brands: transformedData.length
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
    const { min_products = 100, format = 'csv' } = body;

    const supabase = createSupabaseAdminClient();

    // Get the data for export
    const { data, error } = await supabase.rpc('get_brands_without_our_prices', {
      p_user_id: userId,
      p_min_products: min_products
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
        'Competitor Products',
        'Competitor Count',
        'Avg Price',
        'Min Price',
        'Max Price',
        'Avg Stock Level',
        'Products In Stock',
        'Products Out of Stock',
        'Opportunity Score'
      ];

      const csvRows = [
        headers.join(','),
        ...(data || []).map((row: BrandsWithoutPricesDataRow) => [
          `"${row.brand_name}"`,
          row.competitor_product_count,
          row.competitor_count,
          parseFloat(row.avg_competitor_price || '0').toFixed(2),
          parseFloat(row.min_competitor_price || '0').toFixed(2),
          parseFloat(row.max_competitor_price || '0').toFixed(2),
          parseFloat(row.avg_stock_level || '0').toFixed(2),
          row.products_in_stock,
          row.products_out_of_stock,
          parseFloat(row.opportunity_score || '0').toFixed(2)
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `brand-opportunities-${timestamp}.csv`;

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
