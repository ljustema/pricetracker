import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiAccess } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const supabase = createSupabaseAdminClient();
    
    // Get the request body to check for confirmation
    const body = await request.json();
    if (!body.confirmed || body.confirmationText !== 'DELETE ALL PRODUCTS') {
      return NextResponse.json(
        { error: 'Confirmation required. Please type "DELETE ALL PRODUCTS" to confirm.' },
        { status: 400 }
      );
    }

    // Get user ID from request body (admin can specify which user's products to delete)
    const { userId } = body;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const deletedCounts = {
      custom_field_values: 0,
      price_changes_competitors: 0,
      price_changes_suppliers: 0,
      stock_changes_competitors: 0,
      stock_changes_suppliers: 0,
      temp_competitors_data: 0,
      product_match_reviews: 0,
      dismissed_duplicates: 0,
      products: 0,
      brands: 0
    };

    // Step 1: Delete data in the correct order to avoid foreign key constraints
    // We'll delete everything by user_id directly where possible

    // First, let's try to delete custom field values using a database function
    const { error: customFieldError } = await supabase.rpc('delete_user_product_data', {
      target_user_id: userId
    });

    // If the function doesn't exist, we'll skip custom fields for now and delete them after products
    if (customFieldError) {
      console.log('Database function not available, will delete custom fields after products');
    }

    // Step 2: Delete price changes (competitors)
    const { error: priceCompError } = await supabase
      .from('price_changes_competitors')
      .delete()
      .eq('user_id', userId);

    if (priceCompError) {
      console.error('Error deleting competitor price changes:', priceCompError);
      return NextResponse.json(
        { error: 'Failed to delete competitor price changes' },
        { status: 500 }
      );
    }

    // Step 3: Delete price changes (suppliers)
    const { error: priceSupError } = await supabase
      .from('price_changes_suppliers')
      .delete()
      .eq('user_id', userId);

    if (priceSupError) {
      console.error('Error deleting supplier price changes:', priceSupError);
      return NextResponse.json(
        { error: 'Failed to delete supplier price changes' },
        { status: 500 }
      );
    }

    // Step 4: Delete stock changes (competitors)
    const { error: stockCompError } = await supabase
      .from('stock_changes_competitors')
      .delete()
      .eq('user_id', userId);

    if (stockCompError) {
      console.error('Error deleting competitor stock changes:', stockCompError);
      return NextResponse.json(
        { error: 'Failed to delete competitor stock changes' },
        { status: 500 }
      );
    }

    // Step 5: Delete stock changes (suppliers)
    const { error: stockSupError } = await supabase
      .from('stock_changes_suppliers')
      .delete()
      .eq('user_id', userId);

    if (stockSupError) {
      console.error('Error deleting supplier stock changes:', stockSupError);
      return NextResponse.json(
        { error: 'Failed to delete supplier stock changes' },
        { status: 500 }
      );
    }

    // Step 6: Delete temp_competitors_scraped_data records (if table exists)
    const { error: tempCompetitorsError } = await supabase
      .from('temp_competitors_scraped_data')
      .delete()
      .eq('user_id', userId);

    if (tempCompetitorsError && tempCompetitorsError.code !== '42P01') {
      // Only fail if it's not a "table doesn't exist" error
      console.error('Error deleting temp competitors data:', tempCompetitorsError);
      return NextResponse.json(
        { error: 'Failed to delete temp competitors data' },
        { status: 500 }
      );
    } else if (tempCompetitorsError?.code === '42P01') {
      console.log('temp_competitors_scraped_data table does not exist, skipping');
    }

    // Step 7: Delete product_match_reviews records (if table exists)
    const { error: matchReviewsError } = await supabase
      .from('product_match_reviews')
      .delete()
      .eq('user_id', userId);

    if (matchReviewsError && matchReviewsError.code !== '42P01') {
      // Only fail if it's not a "table doesn't exist" error
      console.error('Error deleting product match reviews:', matchReviewsError);
      return NextResponse.json(
        { error: 'Failed to delete product match reviews' },
        { status: 500 }
      );
    } else if (matchReviewsError?.code === '42P01') {
      console.log('product_match_reviews table does not exist, skipping');
    }

    // Step 8: Delete products_dismissed_duplicates records (if table exists)
    const { error: dismissedDuplicatesError } = await supabase
      .from('products_dismissed_duplicates')
      .delete()
      .eq('user_id', userId);

    if (dismissedDuplicatesError && dismissedDuplicatesError.code !== '42P01') {
      // Only fail if it's not a "table doesn't exist" error
      console.error('Error deleting dismissed duplicates:', dismissedDuplicatesError);
      return NextResponse.json(
        { error: 'Failed to delete dismissed duplicates' },
        { status: 500 }
      );
    } else if (dismissedDuplicatesError?.code === '42P01') {
      console.log('products_dismissed_duplicates table does not exist, skipping');
    }

    // Step 9: Delete all products (this will cascade delete custom field values if FK is set up correctly)
    const { error: productsError } = await supabase
      .from('products')
      .delete()
      .eq('user_id', userId);

    if (productsError) {
      console.error('Error deleting products:', productsError);
      return NextResponse.json(
        { error: 'Failed to delete products' },
        { status: 500 }
      );
    }

    // Step 10: Clean up any remaining custom field values (in case cascade didn't work)
    const { error: remainingCustomFieldError } = await supabase
      .from('product_custom_field_values')
      .delete()
      .is('product_id', null); // This will clean up orphaned records

    if (remainingCustomFieldError) {
      console.log('Note: Could not clean up orphaned custom field values:', remainingCustomFieldError);
      // Don't fail the request for this
    }

    // Step 11: Delete brands for this user (since all products are gone)
    const { error: brandsError } = await supabase
      .from('brands')
      .delete()
      .eq('user_id', userId);

    if (brandsError) {
      console.error('Error deleting brands:', brandsError);
      // Don't fail the request for this, just log it
    }

    // Step 12: Clean up remaining temp tables
    await supabase.from('temp_integrations_scraped_data').delete().eq('user_id', userId);
    await supabase.from('temp_suppliers_scraped_data').delete().eq('user_id', userId);

    return NextResponse.json({
      success: true,
      message: 'All products and related data have been successfully deleted',
      deletedCounts
    });

  } catch (error) {
    console.error('Error in delete all products API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
