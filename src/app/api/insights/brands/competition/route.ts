import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch competition data for brands
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

    console.time('api-insights-brands-competition');

    // Try to use the count_distinct_competitors_for_brand function if it exists
    const { data: functionData, error: functionError } = await supabase.rpc(
      'count_distinct_competitors_for_brand',
      {
        p_user_id: userId
      }
    );

    if (!functionError && functionData) {
      console.timeEnd('api-insights-brands-competition');

      // Add cache headers to the response
      const response = NextResponse.json(functionData);
      response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
      response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

      return response;
    }

    // Fallback to direct query if the function doesn't exist or fails
    console.log('Falling back to direct query for brand competition');

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

    // Get competition data for each brand
    const brandCompetition = await Promise.all(
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
            competitor_count: 0,
            competitors: []
          };
        }

        if (products.length === 0) {
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            competitor_count: 0,
            competitors: []
          };
        }

        // Get all competitors for these products
        const productIds = products.map(p => p.id);

        // Process in chunks to avoid URL size limits
        const CHUNK_SIZE = 20;
        let allPriceChanges: { competitor_id: string; competitors: { name: string } | null }[] = [];
        let hasError = false;

        for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
          const chunk = productIds.slice(i, i + CHUNK_SIZE);
          const { data: priceChangesChunk, error: priceChangesError } = await supabase
            .from('price_changes_competitors')
            .select(`
              competitor_id,
              competitors(name)
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
            allPriceChanges = [...allPriceChanges, ...(priceChangesChunk as unknown as { competitor_id: string; competitors: { name: string } | null }[])];
          }
        }

        if (hasError && allPriceChanges.length === 0) {
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            competitor_count: 0,
            competitors: []
          };
        }

        // Count distinct competitors
        const competitorMap = new Map<string, { competitor_id: string; competitor_name: string }>();
        allPriceChanges.forEach(pc => {
          if (pc.competitor_id && !competitorMap.has(pc.competitor_id)) {
            competitorMap.set(pc.competitor_id, {
              competitor_id: pc.competitor_id,
              competitor_name: pc.competitors?.name || 'Unknown'
            });
          }
        });

        const competitors = Array.from(competitorMap.values());

        return {
          brand_id: brand.id,
          brand_name: brand.name,
          competitor_count: competitors.length,
          competitors
        };
      })
    );

    console.timeEnd('api-insights-brands-competition');

    // Add cache headers to the response
    const response = NextResponse.json(brandCompetition);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching brand competition data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch brand competition data', details: errorMessage },
      { status: 500 }
    );
  }
}
