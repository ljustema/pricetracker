import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch recent activity for the insights dashboard
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

    console.time('api-insights-dashboard-activity');

    // Get latest 5 price changes
    const { data: latestPriceChanges, error: priceChangesError } = await supabase
      .from('price_changes_competitors')
      .select(`
        id,
        product_id,
        competitor_id,
        integration_id,
        old_competitor_price,
        new_competitor_price,
        price_change_percentage,
        changed_at,
        products(name),
        competitors(name)
      `)
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(5);

    if (priceChangesError) {
      console.error('Error fetching latest price changes:', priceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch latest price changes', details: priceChangesError.message },
        { status: 500 }
      );
    }

    // Get latest 5 new products
    const { data: latestProducts, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        ean,
        brand,
        brand_id,
        our_retail_price,
        created_at,
        brands(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (productsError) {
      console.error('Error fetching latest products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch latest products', details: productsError.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-insights-dashboard-activity');

    // Add cache headers to the response
    const response = NextResponse.json({
      latestPriceChanges: latestPriceChanges || [],
      latestProducts: latestProducts || []
    });

    // Set cache headers
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching dashboard activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch dashboard activity', details: errorMessage },
      { status: 500 }
    );
  }
}
