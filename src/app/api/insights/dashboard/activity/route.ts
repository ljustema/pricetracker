import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch recent activity for the insights dashboard
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

    // Get limit from query parameters (default to 5)
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5');

    console.time('api-insights-dashboard-activity');

    // Get latest price changes (only actual changes, not new prices)
    const { data: latestPriceChanges, error: priceChangesError } = await supabase
      .from('price_changes_competitors')
      .select(`
        id,
        product_id,
        competitor_id,
        integration_id,
        old_competitor_price,
        new_competitor_price,
        old_our_retail_price,
        new_our_retail_price,
        price_change_percentage,
        changed_at,
        products(name),
        competitors(name)
      `)
      .eq('user_id', userId)
      .or('old_competitor_price.not.is.null,old_our_retail_price.not.is.null')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (priceChangesError) {
      console.error('Error fetching latest price changes:', priceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch latest price changes', details: priceChangesError.message },
        { status: 500 }
      );
    }

    // Get latest new products
    const { data: latestProducts, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        ean,
        brand,
        brand_id,
        our_retail_price,
        created_at,
        brands(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (productsError) {
      console.error('Error fetching latest products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch latest products', details: productsError.message },
        { status: 500 }
      );
    }

    // Get latest stock changes (only actual quantity changes, not status-only changes)
    const { data: latestStockChanges, error: stockChangesError } = await supabase
      .from('stock_changes_competitors')
      .select(`
        id,
        product_id,
        competitor_id,
        old_stock_quantity,
        new_stock_quantity,
        old_stock_status,
        new_stock_status,
        stock_change_quantity,
        changed_at,
        products(name),
        competitors(name)
      `)
      .eq('user_id', userId)
      .not('stock_change_quantity', 'is', null)
      .neq('stock_change_quantity', 0)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (stockChangesError) {
      console.error('Error fetching latest stock changes:', stockChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch latest stock changes', details: stockChangesError.message },
        { status: 500 }
      );
    }

    // Get latest supplier price changes (includes both supplier and integration changes)
    const { data: latestSupplierPriceChanges, error: supplierPriceChangesError } = await supabase
      .from('price_changes_suppliers')
      .select(`
        id,
        product_id,
        supplier_id,
        integration_id,
        old_supplier_price,
        new_supplier_price,
        old_our_wholesale_price,
        new_our_wholesale_price,
        price_change_percentage,
        changed_at,
        products(name),
        suppliers(name),
        integrations(name)
      `)
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (supplierPriceChangesError) {
      console.error('Error fetching latest supplier price changes:', supplierPriceChangesError);
      return NextResponse.json(
        { error: 'Failed to fetch latest supplier price changes', details: supplierPriceChangesError.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-insights-dashboard-activity');

    // Add cache headers to the response
    const response = NextResponse.json({
      latestPriceChanges: latestPriceChanges || [],
      latestProducts: latestProducts || [],
      latestStockChanges: latestStockChanges || [],
      latestSupplierPriceChanges: latestSupplierPriceChanges || []
    });

    // Set cache headers
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching dashboard activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch dashboard activity', details: errorMessage },
      { status: 500 }
    );
  }
}
