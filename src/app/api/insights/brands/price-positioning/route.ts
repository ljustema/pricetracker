import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price positioning data for brands
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

    console.time('api-insights-brands-price-positioning');

    // Get all active brands
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select(`
        id,
        name,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return NextResponse.json(
        { error: 'Failed to fetch brands', details: brandsError.message },
        { status: 500 }
      );
    }

    // Get price positioning data for each brand
    const brandPositioning = await Promise.all(
      brands.map(async (brand) => {
        // Get all products for this brand
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            our_retail_price
          `)
          .eq('user_id', userId)
          .eq('brand_id', brand.id)
          .not('our_retail_price', 'is', null);

        if (productsError) {
          console.error(`Error fetching products for brand ${brand.id}:`, productsError);
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            total_products: 0,
            cheaper_count: 0,
            same_count: 0,
            more_expensive_count: 0,
            avg_price_difference: 0
          };
        }

        if (products.length === 0) {
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            total_products: 0,
            cheaper_count: 0,
            same_count: 0,
            more_expensive_count: 0,
            avg_price_difference: 0
          };
        }

        const totalProducts = products.length;
        const productIds = products.map(p => p.id);
        const productPrices = products.reduce((acc, p) => {
          acc[p.id] = p.our_retail_price;
          return acc;
        }, {});

        // Get latest price changes for these products
        // Process in chunks to avoid URL size limits
        const CHUNK_SIZE = 20;
        let allPriceChanges = [];
        let hasError = false;

        for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
          const chunk = productIds.slice(i, i + CHUNK_SIZE);
          const { data: priceChangesChunk, error: priceChangesError } = await supabase
            .from('price_changes_competitors')
            .select(`
              product_id,
              competitor_id,
              new_competitor_price,
              changed_at
            `)
            .eq('user_id', userId)
            .in('product_id', chunk)
            .not('competitor_id', 'is', null)
            .order('changed_at', { ascending: false });

          if (priceChangesError) {
            console.error(`Error fetching price changes for brand ${brand.id} chunk ${i}:`, priceChangesError);
            hasError = true;
            continue;
          }

          if (priceChangesChunk) {
            allPriceChanges = [...allPriceChanges, ...priceChangesChunk];
          }
        }

        if (hasError && allPriceChanges.length === 0) {
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            total_products: totalProducts,
            cheaper_count: 0,
            same_count: 0,
            more_expensive_count: 0,
            avg_price_difference: 0
          };
        }

        // Get the latest price for each product-competitor pair
        const latestPrices = new Map();

        allPriceChanges.forEach(pc => {
          const key = `${pc.product_id}_${pc.competitor_id}`;
          if (!latestPrices.has(key)) {
            latestPrices.set(key, pc.new_competitor_price);
          }
        });

        // Calculate price positioning
        let cheaperCount = 0;
        let sameCount = 0;
        let moreExpensiveCount = 0;
        let totalDifference = 0;
        let comparisonCount = 0;

        for (const productId of productIds) {
          const ourPrice = productPrices[productId];
          if (!ourPrice) continue;

          // Find all competitor prices for this product
          const competitorPrices = [];

          for (const [key, price] of latestPrices.entries()) {
            if (key.startsWith(`${productId}_`)) {
              competitorPrices.push(price);
            }
          }

          if (competitorPrices.length === 0) continue;

          // Calculate the average competitor price
          const avgCompetitorPrice = competitorPrices.reduce((sum, price) => sum + price, 0) / competitorPrices.length;

          // Calculate price difference percentage
          const priceDiff = ((ourPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

          // Update counts
          if (Math.abs(priceDiff) < 1) { // Within 1% is considered the same
            sameCount++;
          } else if (priceDiff < 0) {
            cheaperCount++;
          } else {
            moreExpensiveCount++;
          }

          totalDifference += priceDiff;
          comparisonCount++;
        }

        const avgPriceDifference = comparisonCount > 0 ? totalDifference / comparisonCount : 0;

        return {
          brand_id: brand.id,
          brand_name: brand.name,
          total_products: totalProducts,
          cheaper_count: cheaperCount,
          same_count: sameCount,
          more_expensive_count: moreExpensiveCount,
          avg_price_difference: avgPriceDifference
        };
      })
    );

    console.timeEnd('api-insights-brands-price-positioning');

    // Add cache headers to the response
    const response = NextResponse.json(brandPositioning);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching brand price positioning data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch brand price positioning data', details: errorMessage },
      { status: 500 }
    );
  }
}
