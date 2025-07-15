import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

interface PriceChangeFrequencyData {
  competitor_id: string;
  competitor_name: string;
  total_price_changes: number;
  products_with_changes: number;
  avg_changes_per_product: number;
  price_increases: number;
  price_decreases: number;
  avg_change_percentage: number;
  most_active_day: string;
  is_integration: boolean;
}

/**
 * GET handler to fetch competitor price change frequency analysis
 * This answers: "How often do competitors change their prices?"
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
    const days = parseInt(url.searchParams.get('days') || '30');
    const competitorIds = url.searchParams.get('competitor_ids');

    console.time('api-competitor-analysis-price-change-frequency');

    // Parse competitor IDs if provided
    let competitorIdsArray = null;
    if (competitorIds) {
      try {
        competitorIdsArray = JSON.parse(competitorIds);
      } catch (error) {
        console.error('Error parsing competitor_ids:', error);
        return NextResponse.json(
          { error: 'Invalid competitor_ids format. Expected JSON array.' },
          { status: 400 }
        );
      }
    }

    // Call the database function
    const { data: frequencyData, error } = await supabase.rpc('get_competitor_price_change_frequency', {
      p_user_id: userId,
      p_days: days,
      p_competitor_ids: competitorIdsArray
    });

    if (error) {
      console.error('Error fetching price change frequency data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price change frequency data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-competitor-analysis-price-change-frequency');

    // Calculate summary statistics
    const totalPriceChanges = frequencyData?.reduce((sum: number, competitor: PriceChangeFrequencyData) =>
      sum + (competitor.total_price_changes || 0), 0) || 0;

    const mostActiveCompetitor = frequencyData?.reduce((prev: PriceChangeFrequencyData | null, current: PriceChangeFrequencyData) =>
      (current.total_price_changes > (prev?.total_price_changes || 0)) ? current : prev, null);

    const avgChangesPerCompetitor = frequencyData?.length > 0
      ? frequencyData.reduce((sum: number, competitor: PriceChangeFrequencyData) =>
          sum + (competitor.total_price_changes || 0), 0) / frequencyData.length
      : 0;

    // Calculate most common day across all competitors
    const dayFrequency: { [key: string]: number } = {};
    frequencyData?.forEach((competitor: PriceChangeFrequencyData) => {
      if (competitor.most_active_day && competitor.most_active_day !== 'Unknown') {
        dayFrequency[competitor.most_active_day] = (dayFrequency[competitor.most_active_day] || 0) + 1;
      }
    });

    const mostCommonDay = Object.keys(dayFrequency).reduce((a, b) => 
      dayFrequency[a] > dayFrequency[b] ? a : b, 'Unknown');

    return NextResponse.json({
      data: frequencyData || [],
      summary: {
        totalCompetitors: frequencyData?.length || 0,
        totalPriceChanges,
        avgChangesPerCompetitor: Math.round(avgChangesPerCompetitor * 100) / 100,
        mostActiveCompetitor: mostActiveCompetitor?.competitor_name || null,
        mostActiveCompetitorChanges: mostActiveCompetitor?.total_price_changes || 0,
        mostCommonDay,
        analysisPeriodDays: days,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Unexpected error in price change frequency API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
