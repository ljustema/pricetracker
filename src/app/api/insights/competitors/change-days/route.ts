import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price change days data for competitors
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

    // Get competitor_id from query params (optional)
    const url = new URL(request.url);
    const competitorId = url.searchParams.get('competitor_id');
    
    console.time('api-insights-competitors-change-days');

    // Build the query
    let query = supabase
      .from('price_changes_competitors')
      .select(`
        competitor_id,
        competitors(name),
        changed_at
      `)
      .eq('user_id', userId)
      .not('competitor_id', 'is', null);
    
    // Add competitor filter if provided
    if (competitorId) {
      query = query.eq('competitor_id', competitorId);
    }
    
    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching competitor change days:', error);
      return NextResponse.json(
        { error: 'Failed to fetch competitor change days', details: error.message },
        { status: 500 }
      );
    }

    // Process the data to count changes by day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const competitorDays = new Map();
    
    data.forEach(priceChange => {
      const competitorId = priceChange.competitor_id;
      const competitorName = (priceChange.competitors as unknown as { name: string } | null)?.name || 'Unknown';
      const date = new Date(priceChange.changed_at);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      const key = competitorId;
      
      if (!competitorDays.has(key)) {
        competitorDays.set(key, {
          competitor_id: competitorId,
          competitor_name: competitorName,
          days: Array(7).fill(0) // Initialize counts for each day of the week
        });
      }
      
      competitorDays.get(key).days[dayOfWeek] += 1;
    });

    // Convert to array and format for response
    const processedData = Array.from(competitorDays.values()).map(item => ({
      competitor_id: item.competitor_id,
      competitor_name: item.competitor_name,
      days: item.days.map((count: number, index: number) => ({
        day: dayNames[index],
        count
      }))
    }));
    
    console.timeEnd('api-insights-competitors-change-days');

    // Add cache headers to the response
    const response = NextResponse.json(processedData);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching competitor change days:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch competitor change days', details: errorMessage },
      { status: 500 }
    );
  }
}
