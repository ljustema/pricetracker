import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch brand focus data for competitors
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

    // Get competitor_id from query params (optional)
    const url = new URL(request.url);
    const competitorId = url.searchParams.get('competitor_id');
    const limit = parseInt(url.searchParams.get('limit') || '5', 10); // Default to top 5 brands

    console.time('api-insights-competitors-brand-focus');

    // If a specific competitor is requested, get their top brands
    if (competitorId) {
      // Try to use the get_brands_for_competitor function if it exists
      const { data: functionData, error: functionError } = await supabase.rpc(
        'get_brands_for_competitor',
        {
          p_user_id: userId,
          p_competitor_id: competitorId
        }
      );

      if (!functionError && functionData) {
        // Process the data to get top brands by product count
        const brandCounts = new Map();
        
        functionData.forEach((item: any) => {
          const brandId = item.brand_id;
          const brandName = item.brand_name;
          
          if (!brandCounts.has(brandId)) {
            brandCounts.set(brandId, {
              brand_id: brandId,
              brand_name: brandName,
              product_count: 0
            });
          }
          
          brandCounts.get(brandId).product_count += 1;
        });

        // Convert to array, sort by count, and limit
        const topBrands = Array.from(brandCounts.values())
          .sort((a, b) => b.product_count - a.product_count)
          .slice(0, limit);
        
        console.timeEnd('api-insights-competitors-brand-focus');

        // Add cache headers to the response
        const response = NextResponse.json({
          competitor_id: competitorId,
          top_brands: topBrands
        });
        response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
        response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

        return response;
      }

      // Fallback to direct query if the function doesn't exist or fails
      console.log('Falling back to direct query for brand focus');
      
      // Get all price changes for this competitor
      const { data: priceChanges, error: priceChangesError } = await supabase
        .from('price_changes')
        .select(`
          product_id
        `)
        .eq('user_id', userId)
        .eq('competitor_id', competitorId);

      if (priceChangesError) {
        console.error('Error fetching price changes for brand focus:', priceChangesError);
        return NextResponse.json(
          { error: 'Failed to fetch price changes for brand focus', details: priceChangesError.message },
          { status: 500 }
        );
      }

      // Get unique product IDs
      const productIds = [...new Set(priceChanges.map(pc => pc.product_id))];

      // Get brand information for these products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          brand_id,
          brands(name)
        `)
        .eq('user_id', userId)
        .in('id', productIds);

      if (productsError) {
        console.error('Error fetching products for brand focus:', productsError);
        return NextResponse.json(
          { error: 'Failed to fetch products for brand focus', details: productsError.message },
          { status: 500 }
        );
      }

      // Count products by brand
      const brandCounts = new Map();
      
      products.forEach(product => {
        if (!product.brand_id) return;
        
        const brandId = product.brand_id;
        const brandName = product.brands?.name || 'Unknown';
        
        if (!brandCounts.has(brandId)) {
          brandCounts.set(brandId, {
            brand_id: brandId,
            brand_name: brandName,
            product_count: 0
          });
        }
        
        brandCounts.get(brandId).product_count += 1;
      });

      // Convert to array, sort by count, and limit
      const topBrands = Array.from(brandCounts.values())
        .sort((a, b) => b.product_count - a.product_count)
        .slice(0, limit);
      
      console.timeEnd('api-insights-competitors-brand-focus');

      // Add cache headers to the response
      const response = NextResponse.json({
        competitor_id: competitorId,
        top_brands: topBrands
      });
      response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
      response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

      return response;
    } else {
      // Get all competitors
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
        console.error('Error fetching competitors for brand focus:', competitorsError);
        return NextResponse.json(
          { error: 'Failed to fetch competitors for brand focus', details: competitorsError.message },
          { status: 500 }
        );
      }

      // Get top brand for each competitor
      const competitorBrands = await Promise.all(
        competitors.map(async (competitor) => {
          // Try to use the get_brands_for_competitor function if it exists
          const { data: functionData, error: functionError } = await supabase.rpc(
            'get_brands_for_competitor',
            {
              p_user_id: userId,
              p_competitor_id: competitor.id
            }
          );

          if (!functionError && functionData) {
            // Process the data to get top brand by product count
            const brandCounts = new Map();
            
            functionData.forEach((item: any) => {
              const brandId = item.brand_id;
              const brandName = item.brand_name;
              
              if (!brandCounts.has(brandId)) {
                brandCounts.set(brandId, {
                  brand_id: brandId,
                  brand_name: brandName,
                  product_count: 0
                });
              }
              
              brandCounts.get(brandId).product_count += 1;
            });

            // Convert to array, sort by count, and get top brand
            const topBrands = Array.from(brandCounts.values())
              .sort((a, b) => b.product_count - a.product_count)
              .slice(0, 1);
            
            return {
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              top_brand: topBrands.length > 0 ? topBrands[0] : null
            };
          }

          // Fallback to direct query if the function doesn't exist or fails
          // Get all price changes for this competitor
          const { data: priceChanges, error: priceChangesError } = await supabase
            .from('price_changes')
            .select(`
              product_id
            `)
            .eq('user_id', userId)
            .eq('competitor_id', competitor.id);

          if (priceChangesError) {
            console.error(`Error fetching price changes for competitor ${competitor.id}:`, priceChangesError);
            return {
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              top_brand: null
            };
          }

          // Get unique product IDs
          const productIds = [...new Set(priceChanges.map(pc => pc.product_id))];

          if (productIds.length === 0) {
            return {
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              top_brand: null
            };
          }

          // Get brand information for these products
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select(`
              id,
              brand_id,
              brands(name)
            `)
            .eq('user_id', userId)
            .in('id', productIds);

          if (productsError) {
            console.error(`Error fetching products for competitor ${competitor.id}:`, productsError);
            return {
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              top_brand: null
            };
          }

          // Count products by brand
          const brandCounts = new Map();
          
          products.forEach(product => {
            if (!product.brand_id) return;
            
            const brandId = product.brand_id;
            const brandName = product.brands?.name || 'Unknown';
            
            if (!brandCounts.has(brandId)) {
              brandCounts.set(brandId, {
                brand_id: brandId,
                brand_name: brandName,
                product_count: 0
              });
            }
            
            brandCounts.get(brandId).product_count += 1;
          });

          // Convert to array, sort by count, and get top brand
          const topBrands = Array.from(brandCounts.values())
            .sort((a, b) => b.product_count - a.product_count)
            .slice(0, 1);
          
          return {
            competitor_id: competitor.id,
            competitor_name: competitor.name,
            top_brand: topBrands.length > 0 ? topBrands[0] : null
          };
        })
      );

      console.timeEnd('api-insights-competitors-brand-focus');

      // Add cache headers to the response
      const response = NextResponse.json(competitorBrands);
      response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
      response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

      return response;
    }
  } catch (error: unknown) {
    console.error('Error fetching competitor brand focus:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch competitor brand focus', details: errorMessage },
      { status: 500 }
    );
  }
}
