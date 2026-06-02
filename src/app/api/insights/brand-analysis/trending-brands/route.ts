import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for trending brands data
interface TrendingBrandsData {
  brand_name: string;
  first_seen_date: string;
  days_since_first_seen: number;
  current_product_count: number;
  competitor_count: number;
  product_growth_rate: number;
  avg_competitor_price: number;
  price_trend: string;
  avg_stock_level: number;
  trending_score: number;
  trend_category: string;
}

// Database row type for the raw data from Supabase
interface TrendingBrandsDataRow {
  brand_name: string;
  first_seen_date: string;
  days_since_first_seen: number;
  current_product_count: number;
  competitor_count: number;
  product_growth_rate: string | null;
  avg_competitor_price: string | null;
  price_trend: string;
  avg_stock_level: string | null;
  trending_score: string | null;
  trend_category: string;
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
    const daysBack = parseInt(searchParams.get('days_back') || '90');

    console.time('api-brand-analysis-trending-brands');

    const supabase = createSupabaseAdminClient();

    // Call the database function to get trending brands
    const { data, error } = await supabase.rpc('get_trending_new_brands', {
      p_user_id: userId,
      p_days_back: daysBack
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trending brands data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-brand-analysis-trending-brands');

    // Transform the data for the frontend
    const transformedData: TrendingBrandsData[] = (data || []).map((row: TrendingBrandsDataRow) => ({
      brand_name: row.brand_name,
      first_seen_date: row.first_seen_date,
      days_since_first_seen: row.days_since_first_seen,
      current_product_count: row.current_product_count,
      competitor_count: row.competitor_count,
      product_growth_rate: parseFloat(row.product_growth_rate || '0'),
      avg_competitor_price: parseFloat(row.avg_competitor_price || '0'),
      price_trend: row.price_trend,
      avg_stock_level: parseFloat(row.avg_stock_level || '0'),
      trending_score: parseFloat(row.trending_score || '0'),
      trend_category: row.trend_category
    }));

    // Calculate summary statistics
    const trendCategoryCounts = transformedData.reduce((acc, brand) => {
      acc[brand.trend_category] = (acc[brand.trend_category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priceTrendCounts = transformedData.reduce((acc, brand) => {
      acc[brand.price_trend] = (acc[brand.price_trend] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = {
      total_trending_brands: transformedData.length,
      total_products: transformedData.reduce((sum, brand) => sum + brand.current_product_count, 0),
      avg_trending_score: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.trending_score, 0) / transformedData.length 
        : 0,
      hottest_new_brand: transformedData.length > 0 ? transformedData[0].brand_name : null,
      hot_new_brands: transformedData.filter(brand => brand.trend_category === 'Hot New Brand').length,
      rapidly_growing_brands: transformedData.filter(brand => brand.trend_category === 'Rapidly Growing').length,
      avg_growth_rate: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.product_growth_rate, 0) / transformedData.length 
        : 0,
      newest_brand: transformedData.length > 0 
        ? transformedData.sort((a, b) => a.days_since_first_seen - b.days_since_first_seen)[0]
        : null,
      trend_category_distribution: trendCategoryCounts,
      price_trend_distribution: priceTrendCounts,
      avg_days_since_first_seen: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.days_since_first_seen, 0) / transformedData.length 
        : 0
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      metadata: {
        days_back: daysBack,
        total_trending_brands: transformedData.length
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
    const { days_back = 90, format = 'csv' } = body;

    const supabase = createSupabaseAdminClient();

    // Get the data for export
    const { data, error } = await supabase.rpc('get_trending_new_brands', {
      p_user_id: userId,
      p_days_back: days_back
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
        'First Seen Date',
        'Days Since First Seen',
        'Current Products',
        'Competitor Count',
        'Growth Rate %',
        'Avg Price',
        'Price Trend',
        'Avg Stock Level',
        'Trending Score',
        'Trend Category'
      ];

      const csvRows = [
        headers.join(','),
        ...(data || []).map((row: TrendingBrandsDataRow) => [
          `"${row.brand_name}"`,
          row.first_seen_date,
          row.days_since_first_seen,
          row.current_product_count,
          row.competitor_count,
          parseFloat(row.product_growth_rate || '0').toFixed(2),
          parseFloat(row.avg_competitor_price || '0').toFixed(2),
          `"${row.price_trend}"`,
          parseFloat(row.avg_stock_level || '0').toFixed(2),
          parseFloat(row.trending_score || '0').toFixed(2),
          `"${row.trend_category}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `trending-brands-${timestamp}.csv`;

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
