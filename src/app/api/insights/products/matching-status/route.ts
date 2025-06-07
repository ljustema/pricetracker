import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch product matching status data
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

    console.time('api-insights-products-matching-status');

    // Get total number of active products
    const { count: totalProducts, error: totalProductsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (totalProductsError) {
      console.error('Error fetching total products count:', totalProductsError);
      return NextResponse.json(
        { error: 'Failed to fetch total products count', details: totalProductsError.message },
        { status: 500 }
      );
    }

    // Get products with at least one price change (matched products)
    const { data: _matchedProductsData, error: matchedProductsError } = await supabase
      .from('price_changes_competitors')
      .select('product_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('competitor_id', 'is', null);

    if (matchedProductsError) {
      console.error('Error fetching matched products count:', matchedProductsError);
      return NextResponse.json(
        { error: 'Failed to fetch matched products count', details: matchedProductsError.message },
        { status: 500 }
      );
    }

    // Get count of distinct product IDs in price_changes_competitors
    const { count: matchedProducts } = await supabase
      .from('price_changes_competitors')
      .select('product_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('competitor_id', 'is', null);

    // Calculate unmatched products
    const unmatchedProducts = totalProducts - matchedProducts;

    // Get matching status by brand
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        brand_id,
        brands(name)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products for brand matching:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products for brand matching', details: productsError.message },
        { status: 500 }
      );
    }

    // Get all price changes to determine which products have matches
    const { data: priceChanges, error: priceChangesError } = await supabase
      .from('price_changes_competitors')
      .select('product_id')
      .eq('user_id', userId)
      .not('competitor_id', 'is', null);

    if (priceChangesError) {
      console.error('Error fetching price changes for matching:', priceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch price changes for matching', details: priceChangesError.message },
        { status: 500 }
      );
    }

    // Create a set of matched product IDs
    const matchedProductIds = new Set(priceChanges.map(pc => pc.product_id));

    // Group products by brand and count matched/unmatched
    const brandMatchingStatus = new Map();
    
    products.forEach(product => {
      if (!product.brand_id) return;
      
      const brandId = product.brand_id;
      const brandName = product.brands?.name || 'Unknown Brand';
      const isMatched = matchedProductIds.has(product.id);
      
      if (!brandMatchingStatus.has(brandId)) {
        brandMatchingStatus.set(brandId, {
          brand_id: brandId,
          brand_name: brandName,
          total_products: 0,
          matched_products: 0,
          unmatched_products: 0,
          matching_percentage: 0
        });
      }
      
      const status = brandMatchingStatus.get(brandId);
      status.total_products += 1;
      
      if (isMatched) {
        status.matched_products += 1;
      } else {
        status.unmatched_products += 1;
      }
      
      status.matching_percentage = (status.matched_products / status.total_products) * 100;
    });

    // Convert to array and sort by matching percentage
    const brandMatching = Array.from(brandMatchingStatus.values())
      .sort((a, b) => b.matching_percentage - a.matching_percentage);

    console.timeEnd('api-insights-products-matching-status');

    // Add cache headers to the response
    const response = NextResponse.json({
      total_products: totalProducts,
      matched_products: matchedProducts,
      unmatched_products: unmatchedProducts,
      matching_percentage: totalProducts > 0 ? (matchedProducts / totalProducts) * 100 : 0,
      brand_matching: brandMatching
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching product matching status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch product matching status', details: errorMessage },
      { status: 500 }
    );
  }
}
