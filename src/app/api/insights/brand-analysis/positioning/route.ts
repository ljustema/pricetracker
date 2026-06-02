import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brand market positioning data
interface BrandMarketPositioningData {
  brand_name: string;
  total_products: number;
  market_position_score: number;
  competitive_strength: string;
  cheapest_percentage: number;
  same_price_percentage: number;
  more_expensive_percentage: number;
  avg_competitor_count: number;
  positioning_category: string;
}

// Database row type for the raw data from Supabase
interface BrandMarketPositioningDataRow {
  brand_name: string;
  total_products: number;
  market_position_score: string | null;
  competitive_strength: string;
  cheapest_percentage: string | null;
  same_price_percentage: string | null;
  more_expensive_percentage: string | null;
  avg_competitor_count: string | null;
  positioning_category: string;
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
    const competitorId = searchParams.get('competitor_id') || null;

    const timerLabel = `api-brand-analysis-positioning-${Date.now()}`;
    console.time(timerLabel);

    const supabase = createSupabaseAdminClient();

    // Call the database function to get brand market positioning data
    const { data, error } = await supabase.rpc('get_brand_market_positioning', {
      p_user_id: userId,
      p_competitor_id: competitorId
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand market positioning data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd(timerLabel);

    // Transform the data for the frontend
    const transformedData: BrandMarketPositioningData[] = (data || []).map((row: BrandMarketPositioningDataRow) => ({
      brand_name: row.brand_name,
      total_products: row.total_products,
      market_position_score: parseFloat(row.market_position_score || '0'),
      competitive_strength: row.competitive_strength,
      cheapest_percentage: parseFloat(row.cheapest_percentage || '0'),
      same_price_percentage: parseFloat(row.same_price_percentage || '0'),
      more_expensive_percentage: parseFloat(row.more_expensive_percentage || '0'),
      avg_competitor_count: parseFloat(row.avg_competitor_count || '0'),
      positioning_category: row.positioning_category
    }));

    // Calculate summary statistics by positioning category
    const categoryStats = transformedData.reduce((acc, brand) => {
      const category = brand.positioning_category;
      if (!acc[category]) {
        acc[category] = { count: 0, total_products: 0, avg_score: 0 };
      }
      acc[category].count += 1;
      acc[category].total_products += brand.total_products;
      acc[category].avg_score += brand.market_position_score;
      return acc;
    }, {} as Record<string, { count: number; total_products: number; avg_score: number }>);

    // Calculate averages for category stats
    Object.keys(categoryStats).forEach(category => {
      categoryStats[category].avg_score = categoryStats[category].avg_score / categoryStats[category].count;
    });

    const summary = {
      total_brands: transformedData.length,
      total_products: transformedData.reduce((sum, brand) => sum + brand.total_products, 0),
      avg_market_position_score: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.market_position_score, 0) / transformedData.length 
        : 0,
      best_positioned_brand: transformedData.length > 0 ? transformedData[0].brand_name : null,
      category_breakdown: categoryStats,
      competitive_strength_distribution: transformedData.reduce((acc, brand) => {
        acc[brand.competitive_strength] = (acc[brand.competitive_strength] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      metadata: {
        competitor_id: competitorId,
        total_brands: transformedData.length
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
