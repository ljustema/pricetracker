import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch market coverage data for competitors
 */
export async function GET(_request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    const supabase = createSupabaseAdminClient();

    console.time('api-insights-competitors-market-coverage');

    // Get total number of active products for the user
    const { count: totalProducts, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching total products count:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch total products count', details: productsError.message },
        { status: 500 }
      );
    }

    // Get product counts per competitor
    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select(`
        id,
        name,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (competitorsError) {
      console.error('Error fetching competitors:', competitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitors', details: competitorsError.message },
        { status: 500 }
      );
    }

    // Get product counts for each competitor
    const competitorCoverage = await Promise.all(
      competitors.map(async (competitor) => {
        // Count distinct products for this competitor
        const { count: productCount, error: countError } = await supabase
          .from('price_changes')
          .select('product_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('competitor_id', competitor.id);

        if (countError) {
          console.error(`Error fetching product count for competitor ${competitor.id}:`, countError);
          return {
            competitor_id: competitor.id,
            competitor_name: competitor.name,
            product_count: 0,
            coverage_percentage: 0
          };
        }

        // Calculate coverage percentage
        const coveragePercentage = totalProducts ? (productCount / totalProducts) * 100 : 0;

        return {
          competitor_id: competitor.id,
          competitor_name: competitor.name,
          product_count: productCount || 0,
          coverage_percentage: coveragePercentage
        };
      })
    );

    console.timeEnd('api-insights-competitors-market-coverage');

    // Add cache headers to the response
    const response = NextResponse.json({
      total_products: totalProducts || 0,
      competitors: competitorCoverage
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching competitor market coverage:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch competitor market coverage', details: errorMessage },
      { status: 500 }
    );
  }
}
