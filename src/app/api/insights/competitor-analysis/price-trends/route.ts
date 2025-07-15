import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for the price trends data
interface PriceTrendData {
  snapshot_date: string;
  competitor_id: string | null;
  competitor_name: string;
  brand_filter: string | null;
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
interface PriceTrendDataRow {
  snapshot_date: string;
  competitor_id: string | null;
  competitor_name: string;
  brand_filter: string | null;
  total_products: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: string | null;
  same_price_percentage: string | null;
  more_expensive_percentage: string | null;
  avg_price_difference_when_higher: number;
  total_potential_savings: number;
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
    const competitorId = searchParams.get('competitor_id') || null;
    const brandFilter = searchParams.get('brand_filter') || null;

    const supabase = createSupabaseAdminClient();

    // Call the database function to get price trends
    const { data, error } = await supabase.rpc('get_price_competitiveness_trends', {
      p_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_competitor_id: competitorId,
      p_brand_filter: brandFilter
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price trends data' },
        { status: 500 }
      );
    }

    // Transform the data for the frontend
    const transformedData: PriceTrendData[] = (data || []).map((row: PriceTrendDataRow) => ({
      snapshot_date: row.snapshot_date,
      competitor_id: row.competitor_id,
      competitor_name: row.competitor_name,
      brand_filter: row.brand_filter,
      total_products: row.total_products,
      products_we_are_cheapest: row.products_we_are_cheapest,
      products_we_are_same_price: row.products_we_are_same_price,
      products_we_are_more_expensive: row.products_we_are_more_expensive,
      cheapest_percentage: parseFloat(row.cheapest_percentage || '0'),
      same_price_percentage: parseFloat(row.same_price_percentage || '0'),
      more_expensive_percentage: parseFloat(row.more_expensive_percentage || '0'),
      avg_price_difference_when_higher: row.avg_price_difference_when_higher || 0,
      total_potential_savings: row.total_potential_savings || 0
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        competitor_id: competitorId,
        brand_filter: brandFilter,
        total_snapshots: transformedData.length
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

// POST endpoint for triggering snapshot calculation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const body = await request.json();
    const {
      snapshot_date = new Date().toISOString().split('T')[0],
      competitor_id = null,
      brand_filter = null,
      calculate_all = false
    } = body;

    const supabase = createSupabaseAdminClient();

    if (calculate_all) {
      // Calculate snapshots for all combinations
      const { data, error } = await supabase.rpc('calculate_all_daily_snapshots', {
        p_user_id: userId,
        p_snapshot_date: snapshot_date
      });

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Failed to calculate all snapshots' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'All snapshots calculated successfully',
        data: data
      });
    } else {
      // Calculate a specific snapshot
      const { data, error } = await supabase.rpc('calculate_daily_price_competitiveness_snapshot', {
        p_user_id: userId,
        p_snapshot_date: snapshot_date,
        p_competitor_id: competitor_id,
        p_brand_filter: brand_filter
      });

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Failed to calculate snapshot' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Snapshot calculated successfully',
        data: data
      });
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
