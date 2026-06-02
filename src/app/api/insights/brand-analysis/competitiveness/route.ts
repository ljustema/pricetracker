import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brand competitiveness data
interface BrandCompetitivenessData {
  brand_name: string;
  total_products_with_prices: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: number;
  same_price_percentage: number;
  more_expensive_percentage: number;
  avg_price_difference_when_higher: number;
  avg_price_difference_percentage_when_higher: number;
  market_dominance_percentage: number;
}

// Database row type for the raw data from Supabase
interface BrandCompetitivenessDataRow {
  brand_name: string;
  total_products_with_prices: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: string | null;
  same_price_percentage: string | null;
  more_expensive_percentage: string | null;
  avg_price_difference_when_higher: number;
  avg_price_difference_percentage_when_higher: string | null;
  market_dominance_percentage: string | null;
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

    const timerLabel = `api-brand-analysis-competitiveness-${Date.now()}`;
    console.time(timerLabel);

    const supabase = createSupabaseAdminClient();

    // Call the database function to get brand competitiveness data
    const { data, error } = await supabase.rpc('get_brand_price_competitiveness', {
      p_user_id: userId,
      p_competitor_id: competitorId
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand competitiveness data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd(timerLabel);

    // Transform the data for the frontend
    const transformedData: BrandCompetitivenessData[] = (data || []).map((row: BrandCompetitivenessDataRow) => ({
      brand_name: row.brand_name,
      total_products_with_prices: row.total_products_with_prices,
      products_we_are_cheapest: row.products_we_are_cheapest,
      products_we_are_same_price: row.products_we_are_same_price,
      products_we_are_more_expensive: row.products_we_are_more_expensive,
      cheapest_percentage: parseFloat(row.cheapest_percentage || '0'),
      same_price_percentage: parseFloat(row.same_price_percentage || '0'),
      more_expensive_percentage: parseFloat(row.more_expensive_percentage || '0'),
      avg_price_difference_when_higher: row.avg_price_difference_when_higher || 0,
      avg_price_difference_percentage_when_higher: parseFloat(row.avg_price_difference_percentage_when_higher || '0'),
      market_dominance_percentage: parseFloat(row.market_dominance_percentage || '0')
    }));

    // Calculate summary statistics
    const summary = {
      total_brands: transformedData.length,
      total_products: transformedData.reduce((sum, brand) => sum + brand.total_products_with_prices, 0),
      avg_market_dominance: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.market_dominance_percentage, 0) / transformedData.length 
        : 0,
      top_performing_brand: transformedData.length > 0 ? transformedData[0].brand_name : null,
      worst_performing_brand: transformedData.length > 0 
        ? transformedData.sort((a, b) => a.market_dominance_percentage - b.market_dominance_percentage)[0].brand_name 
        : null
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
