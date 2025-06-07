import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price change frequency data for competitors
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    const supabase = createSupabaseAdminClient();

    // Get time period from query params (default to 30 days)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.time('api-insights-competitors-change-frequency');

    // Get price change frequency data for each competitor within the time period
    // Since group() is not supported, we'll use a fallback approach
    const { data: priceChanges, error } = await supabase
      .from('price_changes_competitors')
      .select(`
        competitor_id,
        competitors(name)
      `)
      .eq('user_id', userId)
      .gte('changed_at', startDate.toISOString())
      .lte('changed_at', endDate.toISOString())
      .not('competitor_id', 'is', null);

    if (error) {
      console.error('Error fetching competitor change frequency:', error);
      return NextResponse.json(
        { error: 'Failed to fetch competitor change frequency', details: error.message },
        { status: 500 }
      );
    }

    // Process the data to count changes by competitor
    const competitorCounts = new Map();

    priceChanges.forEach(priceChange => {
      const competitorId = priceChange.competitor_id;
      const competitorName = priceChange.competitors?.name || 'Unknown';

      if (!competitorCounts.has(competitorId)) {
        competitorCounts.set(competitorId, {
          competitor_id: competitorId,
          competitor_name: competitorName,
          count: 0
        });
      }

      competitorCounts.get(competitorId).count += 1;
    });

    const processedData = Array.from(competitorCounts.values());

    console.timeEnd('api-insights-competitors-change-frequency');

    // Add cache headers to the response
    const response = NextResponse.json({
      days,
      data: processedData
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching competitor change frequency:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch competitor change frequency', details: errorMessage },
      { status: 500 }
    );
  }
}
