import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price trends data for products
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

    console.time('api-insights-products-trends');

    // Get price changes within the time period
    const { data: priceChanges, error: priceChangesError } = await supabase
      .from('price_changes')
      .select(`
        product_id,
        products(name),
        competitor_id,
        competitors(name),
        old_price,
        new_price,
        price_change_percentage,
        changed_at
      `)
      .eq('user_id', userId)
      .gte('changed_at', startDate.toISOString())
      .lte('changed_at', endDate.toISOString())
      .order('changed_at', { ascending: true });

    if (priceChangesError) {
      console.error('Error fetching price changes for trends:', priceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch price changes for trends', details: priceChangesError.message },
        { status: 500 }
      );
    }

    // Process the data to calculate trends
    const productTrends = new Map();
    
    priceChanges.forEach(priceChange => {
      const productId = priceChange.product_id;
      const productName = priceChange.products?.name || 'Unknown Product';
      const competitorId = priceChange.competitor_id;
      const _competitorName = priceChange.competitors?.name || 'Unknown Competitor';
      const priceChangePercentage = priceChange.price_change_percentage;
      const changedAt = new Date(priceChange.changed_at);
      
      if (!productTrends.has(productId)) {
        productTrends.set(productId, {
          product_id: productId,
          product_name: productName,
          total_changes: 0,
          total_percentage_change: 0,
          avg_percentage_change: 0,
          competitors: new Set(),
          first_price: priceChange.old_price,
          last_price: priceChange.new_price,
          overall_change_percentage: 0,
          last_changed_at: changedAt
        });
      }
      
      const trend = productTrends.get(productId);
      trend.total_changes += 1;
      trend.total_percentage_change += priceChangePercentage;
      trend.avg_percentage_change = trend.total_percentage_change / trend.total_changes;
      trend.competitors.add(competitorId);
      trend.last_price = priceChange.new_price;
      
      // Update last_changed_at if this change is more recent
      if (changedAt > trend.last_changed_at) {
        trend.last_changed_at = changedAt;
      }
      
      // Calculate overall change percentage from first to last price
      trend.overall_change_percentage = ((trend.last_price - trend.first_price) / trend.first_price) * 100;
    });

    // Convert to array, add competitor count, and sort by overall change percentage
    const processedTrends = Array.from(productTrends.values())
      .map(trend => ({
        ...trend,
        competitor_count: trend.competitors.size,
        competitors: Array.from(trend.competitors)
      }))
      .sort((a, b) => Math.abs(b.overall_change_percentage) - Math.abs(a.overall_change_percentage))
      .slice(0, limit);

    console.timeEnd('api-insights-products-trends');

    // Add cache headers to the response
    const response = NextResponse.json({
      days,
      trends: processedTrends
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching product trends:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch product trends', details: errorMessage },
      { status: 500 }
    );
  }
}
