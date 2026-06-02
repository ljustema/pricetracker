import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch uniqueness data for brands
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

    console.time('api-insights-brands-uniqueness');

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

    // Get uniqueness data for each brand
    const brandUniqueness = await Promise.all(
      brands.map(async (brand) => {
        // Get all products for this brand
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .eq('brand_id', brand.id);

        if (productsError) {
          console.error(`Error fetching products for brand ${brand.id}:`, productsError);
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            total_products: 0,
            unique_products: 0,
            uniqueness_percentage: 0
          };
        }

        if (products.length === 0) {
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            total_products: 0,
            unique_products: 0,
            uniqueness_percentage: 0
          };
        }

        const totalProducts = products.length;
        const productIds = products.map(p => p.id);

        // Try to use the get_unique_competitor_products function if it exists
        let uniqueProducts = 0;

        // Get all price changes for these products
        // Process in chunks to avoid URL size limits
        const CHUNK_SIZE = 20;
        let allPriceChanges: { product_id: string; competitor_id: string }[] = [];
        let hasError = false;

        for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
          const chunk = productIds.slice(i, i + CHUNK_SIZE);
          const { data: priceChangesChunk, error: priceChangesError } = await supabase
            .from('price_changes_competitors')
            .select(`
              product_id,
              competitor_id
            `)
            .eq('user_id', userId)
            .in('product_id', chunk)
            .not('competitor_id', 'is', null);

          if (priceChangesError) {
            console.error(`Error fetching price changes for brand ${brand.id} chunk ${i}:`, priceChangesError);
            hasError = true;
            continue;
          }

          if (priceChangesChunk) {
            allPriceChanges = [...allPriceChanges, ...(priceChangesChunk as unknown as { product_id: string; competitor_id: string }[])];
          }
        }

        if (hasError && allPriceChanges.length === 0) {
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            total_products: totalProducts,
            unique_products: 0,
            uniqueness_percentage: 0
          };
        }

        // Count products with only one competitor
        const productCompetitorCount = new Map<string, Set<string>>();

        allPriceChanges.forEach(pc => {
          if (!productCompetitorCount.has(pc.product_id)) {
            productCompetitorCount.set(pc.product_id, new Set());
          }
          productCompetitorCount.get(pc.product_id)!.add(pc.competitor_id);
        });

        // Count products with 0 or 1 competitors
        uniqueProducts = productIds.filter(productId => {
          const competitors = productCompetitorCount.get(productId);
          return !competitors || competitors.size <= 1;
        }).length;

        const uniquenessPercentage = totalProducts > 0 ? (uniqueProducts / totalProducts) * 100 : 0;

        return {
          brand_id: brand.id,
          brand_name: brand.name,
          total_products: totalProducts,
          unique_products: uniqueProducts,
          uniqueness_percentage: uniquenessPercentage
        };
      })
    );

    console.timeEnd('api-insights-brands-uniqueness');

    // Add cache headers to the response
    const response = NextResponse.json(brandUniqueness);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching brand uniqueness data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch brand uniqueness data', details: errorMessage },
      { status: 500 }
    );
  }
}
