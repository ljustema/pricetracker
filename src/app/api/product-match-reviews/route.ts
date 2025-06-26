import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get product match reviews for the user
    const { data: reviews, error } = await supabase
      .from('product_match_reviews')
      .select(`
        *,
        existing_product:products!existing_product_id(
          id,
          name,
          sku,
          brand,
          our_retail_price,
          our_wholesale_price,
          our_url
        )
      `)
      .eq('user_id', session.user.id)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching product match reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch product match reviews', details: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('product_match_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', status);

    if (countError) {
      console.error('Error counting product match reviews:', countError);
      return NextResponse.json(
        { error: 'Failed to count product match reviews', details: countError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviews: reviews || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Unexpected error in product match reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reviewId, reviewIds } = body;

    if (!action || (!reviewId && !reviewIds)) {
      return NextResponse.json(
        { error: 'Action and reviewId or reviewIds are required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    if (action === 'approve_match') {
      // Approve the match - process the temp record and mark review as approved
      const { data: review, error: reviewError } = await supabase
        .from('product_match_reviews')
        .select('*')
        .eq('id', reviewId)
        .eq('user_id', session.user.id)
        .single();

      if (reviewError || !review) {
        return NextResponse.json(
          { error: 'Review not found' },
          { status: 404 }
        );
      }

      // Process the temp record by calling the appropriate processing function
      let processResult;
      if (review.source_table === 'temp_competitors_scraped_data') {
        const { data, error } = await supabase.rpc('process_temp_competitors_batch_with_conflict_detection', {
          p_competitor_id: null,
          batch_size: 1
        });
        processResult = { data, error };
      } else if (review.source_table === 'temp_suppliers_scraped_data') {
        // TODO: Implement supplier processing
        processResult = { data: null, error: { message: 'Supplier processing not yet implemented' } };
      } else if (review.source_table === 'temp_integrations_scraped_data') {
        // TODO: Implement integration processing
        processResult = { data: null, error: { message: 'Integration processing not yet implemented' } };
      }

      if (processResult?.error) {
        return NextResponse.json(
          { error: 'Failed to process approved match', details: processResult.error.message },
          { status: 500 }
        );
      }

      // Mark review as approved
      const { error: updateError } = await supabase
        .from('product_match_reviews')
        .update({
          status: 'approved_match',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id
        })
        .eq('id', reviewId)
        .eq('user_id', session.user.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update review status', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: 'Match approved and processed' });

    } else if (action === 'decline_match') {
      // Decline the match - create new product and mark review as declined
      const { data: review, error: reviewError } = await supabase
        .from('product_match_reviews')
        .select('*')
        .eq('id', reviewId)
        .eq('user_id', session.user.id)
        .single();

      if (reviewError || !review) {
        return NextResponse.json(
          { error: 'Review not found' },
          { status: 404 }
        );
      }

      // Create new product from the new product data
      const newProductData = review.new_product_data as Record<string, unknown>;
      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert({
          user_id: session.user.id,
          name: review.new_product_name,
          sku: review.new_product_sku,
          brand: review.new_product_brand,
          ean: review.ean,
          image_url: newProductData.image_url,
          currency_code: newProductData.currency_code || 'SEK'
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: 'Failed to create new product', details: createError.message },
          { status: 500 }
        );
      }

      // Update the temp record to point to the new product
      if (review.source_table === 'temp_competitors_scraped_data') {
        await supabase
          .from('temp_competitors_scraped_data')
          .update({ product_id: newProduct.id })
          .eq('id', review.source_record_id);
      }

      // Mark review as declined
      const { error: updateError } = await supabase
        .from('product_match_reviews')
        .update({
          status: 'declined_match',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id
        })
        .eq('id', reviewId)
        .eq('user_id', session.user.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update review status', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Match declined and new product created',
        newProduct 
      });

    } else if (action === 'approve_all') {
      // Approve multiple reviews at once
      if (!reviewIds || !Array.isArray(reviewIds)) {
        return NextResponse.json(
          { error: 'reviewIds array is required for approve_all action' },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from('product_match_reviews')
        .update({
          status: 'approved_match',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id
        })
        .in('id', reviewIds)
        .eq('user_id', session.user.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to approve reviews', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: `${reviewIds.length} reviews approved` 
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in product match reviews POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
