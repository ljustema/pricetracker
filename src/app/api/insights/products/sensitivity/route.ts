import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price sensitivity data for products
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
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.time('api-insights-products-sensitivity');

    // Since group() is not supported, we'll use a fallback approach
    const { data: priceChanges, error } = await supabase
      .from('price_changes_competitors')
      .select(`
        product_id,
        products(name, our_retail_price)
      `)
      .eq('user_id', userId)
      .gte('changed_at', startDate.toISOString())
      .lte('changed_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching product sensitivity data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch product sensitivity data', details: error.message },
        { status: 500 }
      );
    }

    // Process the data to count changes by product
    const productCounts = new Map();

    priceChanges.forEach(priceChange => {
      const productId = priceChange.product_id;
      const productName = priceChange.products?.name || 'Unknown Product';
      const ourPrice = priceChange.products?.our_retail_price || null;

      if (!productCounts.has(productId)) {
        productCounts.set(productId, {
          product_id: productId,
          product_name: productName,
          our_retail_price: ourPrice,
          count: 0
        });
      }

      productCounts.get(productId).count += 1;
    });

    // Convert to array, sort by count, and limit
    const processedData = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    console.timeEnd('api-insights-products-sensitivity');

    // Add cache headers to the response
    const response = NextResponse.json({
      days,
      products: processedData
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching product sensitivity data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch product sensitivity data', details: errorMessage },
      { status: 500 }
    );
  }
}
