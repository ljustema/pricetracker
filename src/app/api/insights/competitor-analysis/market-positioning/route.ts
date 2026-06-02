import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

/**
 * GET handler to fetch market positioning overview
 * This answers: "How do we position against the market overall?"
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

    console.time('api-competitor-analysis-market-positioning');

    // Call the database function
    const { data: positioningData, error } = await supabase.rpc('get_market_positioning_overview', {
      p_user_id: userId,
      p_brand_filter: brandFilter || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching market positioning data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch market positioning data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-competitor-analysis-market-positioning');

    // The function returns a single row with overview data
    const overview = positioningData?.[0] || {};

    return NextResponse.json({
      data: overview,
      insights: {
        competitiveStrength: overview.competitive_percentage >= 60 ? 'Strong' : 
                            overview.competitive_percentage >= 40 ? 'Moderate' : 'Weak',
        marketCoverage: overview.market_coverage_percentage >= 80 ? 'Excellent' : 
                       overview.market_coverage_percentage >= 60 ? 'Good' : 
                       overview.market_coverage_percentage >= 40 ? 'Fair' : 'Limited',
        pricingStrategy: overview.avg_price_premium_percentage > 10 ? 'Premium' :
                        overview.avg_price_premium_percentage > 0 ? 'Moderate Premium' :
                        overview.avg_price_premium_percentage < -5 ? 'Aggressive' : 'Competitive'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Unexpected error in market positioning API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
