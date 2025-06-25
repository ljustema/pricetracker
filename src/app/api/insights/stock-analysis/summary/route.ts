import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Cache headers for performance
const CACHE_MAX_AGE = 300; // Cache for 5 minutes

/**
 * GET handler to fetch comprehensive stock analysis summary
 * Query parameters:
 * - competitor_id: UUID (optional) - Filter by specific competitor
 * - start_date: ISO string (optional) - Start date for analysis period
 * - end_date: ISO string (optional) - End date for analysis period
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
    const competitorId = url.searchParams.get('competitor_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.time('api-stock-analysis-summary');

    // Call the comprehensive summary function
    const { data: summaryData, error } = await supabase.rpc('get_comprehensive_analysis_summary', {
      p_user_id: userId,
      p_competitor_id: competitorId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching comprehensive analysis summary:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comprehensive analysis summary', details: error.message },
        { status: 500 }
      );
    }

    // Also get competitors list for the filter dropdown
    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select('id, name, website')
      .eq('user_id', userId)
      .order('name');

    if (competitorsError) {
      console.error('Error fetching competitors:', competitorsError);
      // Don't fail the request, just log the error
    }

    // Get brands list for filtering
    const { data: brands, error: brandsError } = await supabase
      .from('products')
      .select('brand')
      .eq('user_id', userId)
      .not('brand', 'is', null)
      .order('brand');

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      // Don't fail the request, just log the error
    }

    // Extract unique brands
    const uniqueBrands = [...new Set(brands?.map(b => b.brand).filter(Boolean) || [])];

    console.timeEnd('api-stock-analysis-summary');

    // Add cache headers to the response
    const response = NextResponse.json({
      summary: summaryData || {},
      competitors: competitors || [],
      brands: uniqueBrands,
      filters: {
        competitor_id: competitorId,
        start_date: startDate,
        end_date: endDate
      }
    });

    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in comprehensive analysis summary API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch comprehensive analysis summary', details: errorMessage },
      { status: 500 }
    );
  }
}
