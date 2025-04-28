import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price comparison data for competitors
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

    console.time('api-insights-competitors-price-comparison');

    // Get all active competitors first
    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (competitorsError) {
      console.error('Error fetching competitors:', competitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitors', details: competitorsError.message },
        { status: 500 }
      );
    }

    // If there are no competitors, return an empty array
    if (!competitors || competitors.length === 0) {
      console.log('No active competitors found');
      return NextResponse.json([]);
    }

    // Process each competitor separately to avoid large queries
    const competitorResults = await Promise.all(
      competitors.map(async (competitor) => {
        try {
          // Get the latest price change for each product for this competitor
          const { data: latestPriceChanges, error: priceChangesError } = await supabase
            .from('price_changes')
            .select(`
              product_id,
              new_price
            `)
            .eq('user_id', userId)
            .eq('competitor_id', competitor.id)
            .order('changed_at', { ascending: false });

          if (priceChangesError) {
            console.error(`Error fetching price changes for competitor ${competitor.id}:`, priceChangesError);
            return {
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              total_products: 0,
              avg_diff_percentage: 0
            };
          }

          // Get unique product IDs
          const productMap = new Map();
          latestPriceChanges.forEach(pc => {
            if (!productMap.has(pc.product_id)) {
              productMap.set(pc.product_id, pc.new_price);
            }
          });

          const productIds = Array.from(productMap.keys());

          if (productIds.length === 0) {
            return {
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              total_products: 0,
              avg_diff_percentage: 0
            };
          }

          // Get our prices for these products
          // Split into chunks to avoid URL size limits
          const CHUNK_SIZE = 20;
          let allProducts = [];
          
          for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
            const chunk = productIds.slice(i, i + CHUNK_SIZE);
            const { data: productsChunk, error: productsError } = await supabase
              .from('products')
              .select('id, our_price')
              .eq('user_id', userId)
              .in('id', chunk)
              .not('our_price', 'is', null);

            if (productsError) {
              console.error(`Error fetching products for competitor ${competitor.id}:`, productsError);
              continue;
            }

            if (productsChunk) {
              allProducts = [...allProducts, ...productsChunk];
            }
          }

          // Calculate price differences
          let totalDiff = 0;
          let comparisonCount = 0;

          allProducts.forEach(product => {
            const competitorPrice = productMap.get(product.id);
            const ourPrice = product.our_price;

            if (competitorPrice && ourPrice && ourPrice > 0) {
              const priceDiff = ((competitorPrice - ourPrice) / ourPrice) * 100;
              totalDiff += priceDiff;
              comparisonCount++;
            }
          });

          return {
            competitor_id: competitor.id,
            competitor_name: competitor.name,
            total_products: comparisonCount,
            avg_diff_percentage: comparisonCount > 0 ? totalDiff / comparisonCount : 0
          };
        } catch (err) {
          console.error(`Error processing competitor ${competitor.id}:`, err);
          return {
            competitor_id: competitor.id,
            competitor_name: competitor.name,
            total_products: 0,
            avg_diff_percentage: 0
          };
        }
      })
    );

    // Filter out competitors with no products
    const filteredResults = competitorResults.filter(result => result.total_products > 0);
    
    console.timeEnd('api-insights-competitors-price-comparison');

    // Add cache headers to the response
    const response = NextResponse.json(filteredResults);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching competitor price comparison:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch competitor price comparison', details: errorMessage },
      { status: 500 }
    );
  }
}
