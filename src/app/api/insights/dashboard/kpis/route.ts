import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch key performance indicators for the insights dashboard
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

    console.time('api-insights-dashboard-kpis');

    // Get total products count
    const { count: productsCount, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products count:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products count', details: productsError.message },
        { status: 500 }
      );
    }

    // Get total active competitors count
    const { count: competitorsCount, error: competitorsError } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (competitorsError) {
      console.error('Error fetching competitors count:', competitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitors count', details: competitorsError.message },
        { status: 500 }
      );
    }

    // Get total active brands count
    const { count: brandsCount, error: brandsError } = await supabase
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (brandsError) {
      console.error('Error fetching brands count:', brandsError);
      return NextResponse.json(
        { error: 'Failed to fetch brands count', details: brandsError.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-insights-dashboard-kpis');

    // Add cache headers to the response
    const response = NextResponse.json({
      productsCount: productsCount || 0,
      competitorsCount: competitorsCount || 0,
      brandsCount: brandsCount || 0
    });

    // Set cache headers
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching dashboard KPIs:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch dashboard KPIs', details: errorMessage },
      { status: 500 }
    );
  }
}
