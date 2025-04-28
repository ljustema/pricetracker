import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price history for a specific product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    const supabase = createSupabaseAdminClient();

    // Get the product ID from the route params
    const { productId } = params;

    // Get time period from query params (default to 90 days)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '90', 10);
    
    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.time('api-insights-products-price-history');

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        our_price,
        currency_code
      `)
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (productError) {
      console.error('Error fetching product details:', productError);
      return NextResponse.json(
        { error: 'Failed to fetch product details', details: productError.message },
        { status: 500 }
      );
    }

    // Get price changes for this product
    const { data: priceChanges, error: priceChangesError } = await supabase
      .from('price_changes')
      .select(`
        id,
        competitor_id,
        competitors(name),
        integration_id,
        old_price,
        new_price,
        price_change_percentage,
        changed_at,
        currency_code
      `)
      .eq('product_id', productId)
      .eq('user_id', userId)
      .gte('changed_at', startDate.toISOString())
      .lte('changed_at', endDate.toISOString())
      .order('changed_at', { ascending: true });

    if (priceChangesError) {
      console.error('Error fetching price changes:', priceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch price changes', details: priceChangesError.message },
        { status: 500 }
      );
    }

    // Get integration details for integration_id values
    const integrationIds = [...new Set(priceChanges
      .filter(pc => pc.integration_id)
      .map(pc => pc.integration_id))];
    
    let integrations = {};
    
    if (integrationIds.length > 0) {
      const { data: integrationsData, error: integrationsError } = await supabase
        .from('integrations')
        .select(`
          id,
          name
        `)
        .in('id', integrationIds as string[]);

      if (!integrationsError && integrationsData) {
        integrations = integrationsData.reduce((acc, integration) => {
          acc[integration.id] = integration.name;
          return acc;
        }, {});
      }
    }

    console.timeEnd('api-insights-products-price-history');

    // Add cache headers to the response
    const response = NextResponse.json({
      product,
      priceChanges: priceChanges.map(pc => ({
        ...pc,
        source_name: pc.integration_id 
          ? (integrations[pc.integration_id] || 'Unknown Integration')
          : (pc.competitors?.name || 'Unknown Competitor'),
        source_type: pc.integration_id ? 'integration' : 'competitor'
      }))
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching product price history:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch product price history', details: errorMessage },
      { status: 500 }
    );
  }
}
