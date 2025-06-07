import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch price change activity data for brands
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
    
    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.time('api-insights-brands-change-activity');

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

    // Get all products grouped by brand
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        brand_id
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: productsError.message },
        { status: 500 }
      );
    }

    // Group products by brand
    const productsByBrand = products.reduce((acc, product) => {
      if (!acc[product.brand_id]) {
        acc[product.brand_id] = [];
      }
      acc[product.brand_id].push(product.id);
      return acc;
    }, {});

    // Get price changes within the time period
    const { data: priceChanges, error: priceChangesError } = await supabase
      .from('price_changes_competitors')
      .select(`
        product_id,
        changed_at
      `)
      .eq('user_id', userId)
      .gte('changed_at', startDate.toISOString())
      .lte('changed_at', endDate.toISOString());

    if (priceChangesError) {
      console.error('Error fetching price changes:', priceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch price changes', details: priceChangesError.message },
        { status: 500 }
      );
    }

    // Calculate change activity for each brand
    const brandActivity = brands.map(brand => {
      const brandProductIds = productsByBrand[brand.id] || [];
      const totalProducts = brandProductIds.length;
      
      // Count price changes for this brand's products
      const changes = priceChanges.filter(pc => brandProductIds.includes(pc.product_id));
      const totalChanges = changes.length;
      
      // Calculate changes per product
      const changesPerProduct = totalProducts > 0 ? totalChanges / totalProducts : 0;
      
      return {
        brand_id: brand.id,
        brand_name: brand.name,
        total_products: totalProducts,
        total_changes: totalChanges,
        changes_per_product: changesPerProduct
      };
    });

    // Sort by changes per product (descending)
    brandActivity.sort((a, b) => b.changes_per_product - a.changes_per_product);

    console.timeEnd('api-insights-brands-change-activity');

    // Add cache headers to the response
    const response = NextResponse.json({
      days,
      brands: brandActivity
    });
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching brand change activity data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch brand change activity data', details: errorMessage },
      { status: 500 }
    );
  }
}
