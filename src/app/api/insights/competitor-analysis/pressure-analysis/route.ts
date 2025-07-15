import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

interface CompetitorPressureData {
  competitor_id: string;
  competitor_name: string;
  products_where_lowest: number;
  total_products_tracked: number;
  lowest_price_percentage: number;
  avg_price_when_lowest: number;
  is_integration: boolean;
}

/**
 * GET handler to fetch competitor pressure analysis
 * This answers: "Which competitor has the lowest price on most products?"
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
    const brandFilter = url.searchParams.get('brand_filter');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.time('api-competitor-analysis-pressure');

    // Call the database function
    const { data: pressureData, error } = await supabase.rpc('get_competitor_pressure_analysis', {
      p_user_id: userId,
      p_brand_filter: brandFilter || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching competitor pressure data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch competitor pressure data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-competitor-analysis-pressure');

    // Calculate summary statistics
    const totalProductsWithLowestPrice = pressureData?.reduce((sum: number, competitor: CompetitorPressureData) =>
      sum + (competitor.products_where_lowest || 0), 0) || 0;

    const mostDominantCompetitor = pressureData?.reduce((prev: CompetitorPressureData | null, current: CompetitorPressureData) =>
      (current.products_where_lowest > (prev?.products_where_lowest || 0)) ? current : prev, null);

    return NextResponse.json({
      data: pressureData || [],
      summary: {
        totalCompetitors: pressureData?.length || 0,
        totalProductsWithLowestPrice,
        mostDominantCompetitor: mostDominantCompetitor?.competitor_name || null,
        mostDominantCompetitorProducts: mostDominantCompetitor?.products_where_lowest || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Unexpected error in competitor pressure API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
