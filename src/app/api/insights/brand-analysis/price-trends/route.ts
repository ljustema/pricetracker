import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brand price trends data
interface BrandPriceTrendData {
  snapshot_date: string;
  brand_name: string | null;
  total_products: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: number;
  same_price_percentage: number;
  more_expensive_percentage: number;
  avg_price_difference_when_higher: number;
  total_potential_savings: number;
}

// Database row type for the raw data from Supabase
interface BrandPriceTrendDataRow {
  snapshot_date: string;
  competitor_id: string | null;
  competitor_name: string | null;
  brand_filter: string | null;
  total_products: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: string | null;
  same_price_percentage: string | null;
  more_expensive_percentage: string | null;
  avg_price_difference_when_higher: string | null;
  total_potential_savings: string | null;
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
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const brandFilter = searchParams.get('brand_filter') || null;

    const timerLabel = `api-brand-analysis-price-trends-${Date.now()}`;
    console.time(timerLabel);

    const supabase = createSupabaseAdminClient();

    // Call the database function to get brand price trends
    const { data, error } = await supabase.rpc('get_price_competitiveness_trends', {
      p_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_competitor_id: null, // We don't filter by competitor for brand analysis
      p_brand_filter: brandFilter
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand price trends data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd(timerLabel);

    // Transform the data for the frontend
    const transformedData: BrandPriceTrendData[] = (data || []).map((row: BrandPriceTrendDataRow) => ({
      snapshot_date: row.snapshot_date,
      brand_name: row.brand_filter, // Use brand_filter from database
      total_products: row.total_products,
      products_we_are_cheapest: row.products_we_are_cheapest,
      products_we_are_same_price: row.products_we_are_same_price,
      products_we_are_more_expensive: row.products_we_are_more_expensive,
      cheapest_percentage: parseFloat(row.cheapest_percentage || '0'),
      same_price_percentage: parseFloat(row.same_price_percentage || '0'),
      more_expensive_percentage: parseFloat(row.more_expensive_percentage || '0'),
      avg_price_difference_when_higher: parseFloat(row.avg_price_difference_when_higher || '0'),
      total_potential_savings: parseFloat(row.total_potential_savings || '0')
    }));

    // Calculate summary statistics
    const summary = {
      total_snapshots: transformedData.length,
      date_range: {
        start: startDate,
        end: endDate
      },
      brand_filter: brandFilter,
      avg_competitiveness: transformedData.length > 0
        ? transformedData.reduce((sum, item) => sum + item.cheapest_percentage, 0) / transformedData.length
        : 0
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      metadata: {
        brand_filter: brandFilter,
        start_date: startDate,
        end_date: endDate,
        total_records: transformedData.length
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
