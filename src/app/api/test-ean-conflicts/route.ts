import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Helper function to ensure user ID is a valid UUID
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID from the ID
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { testType = 'multiple_ean' } = body;
    const userId = ensureUUID(session.user.id);

    // First, get or create a test competitor
    let testCompetitor;
    const { data: existingCompetitors, error: competitorFetchError } = await supabase
      .from('competitors')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (competitorFetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch competitors', details: competitorFetchError.message },
        { status: 500 }
      );
    }

    if (existingCompetitors && existingCompetitors.length > 0) {
      testCompetitor = existingCompetitors[0];
    } else {
      // Create a test competitor
      const { data: newCompetitor, error: competitorError } = await supabase
        .from('competitors')
        .insert({
          user_id: userId,
          name: 'Test Competitor',
          website: 'https://test-competitor.com',
          is_active: true
        })
        .select()
        .single();

      if (competitorError) {
        return NextResponse.json(
          { error: 'Failed to create test competitor', details: competitorError.message },
          { status: 500 }
        );
      }
      testCompetitor = newCompetitor;
    }

    // Create test data based on test type
    if (testType === 'multiple_ean') {
      // Test case: Multiple products with same EAN in one batch
      const testEAN = '1234567890123';

      // First, create a product with this EAN
      const { data: existingProduct, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          name: 'Existing Product',
          sku: 'EXISTING-001',
          brand: 'TestBrand',
          ean: testEAN,
          our_retail_price: 100
        })
        .select()
        .single();

      if (productError) {
        return NextResponse.json(
          { error: 'Failed to create test product', details: productError.message },
          { status: 500 }
        );
      }

      // Now insert multiple temp records with the same EAN
      const tempRecords = [
        {
          user_id: userId,
          competitor_id: testCompetitor.id,
          name: 'New Product 1 - Used',
          sku: 'NEW-001-USED',
          brand: 'TestBrand',
          ean: testEAN,
          competitor_price: 80,
          currency_code: 'SEK',
          processed: false
        },
        {
          user_id: userId,
          competitor_id: testCompetitor.id,
          name: 'New Product 2 - Refurbished',
          sku: 'NEW-002-REFURB',
          brand: 'TestBrand',
          ean: testEAN,
          competitor_price: 90,
          currency_code: 'SEK',
          processed: false
        }
      ];

      const { data: tempData, error: tempError } = await supabase
        .from('temp_competitors_scraped_data')
        .insert(tempRecords)
        .select();

      if (tempError) {
        return NextResponse.json(
          { error: 'Failed to create temp records', details: tempError.message },
          { status: 500 }
        );
      }

      // Run conflict detection
      const { data: conflictResult, error: conflictError } = await supabase.rpc(
        'detect_ean_conflicts_and_create_reviews',
        {
          p_user_id: userId,
          p_source_table: 'temp_competitors_scraped_data',
          p_batch_ids: tempData.map(r => r.id)
        }
      );

      if (conflictError) {
        return NextResponse.json(
          { error: 'Failed to detect conflicts', details: conflictError.message },
          { status: 500 }
        );
      }

      // Get the created reviews
      const { data: reviews, error: _reviewsError } = await supabase
        .from('product_match_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('ean', testEAN);

      return NextResponse.json({
        success: true,
        message: 'Test completed successfully',
        existingProduct,
        tempRecords: tempData,
        conflictResult,
        reviews: reviews || []
      });

    } else if (testType === 'price_difference') {
      // Test case: Large price difference
      const testEAN = '9876543210987';
      
      // Create a product with high price
      const { data: existingProduct, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          name: 'Expensive Product',
          sku: 'EXPENSIVE-001',
          brand: 'PremiumBrand',
          ean: testEAN,
          our_retail_price: 1000
        })
        .select()
        .single();

      if (productError) {
        return NextResponse.json(
          { error: 'Failed to create test product', details: productError.message },
          { status: 500 }
        );
      }

      // Insert temp record with much lower price (>50% difference)
      const tempRecord = {
        user_id: userId,
        competitor_id: testCompetitor.id,
        name: 'Cheap Version',
        sku: 'CHEAP-001',
        brand: 'PremiumBrand',
        ean: testEAN,
        competitor_price: 300, // 70% lower than existing price
        currency_code: 'SEK',
        processed: false
      };

      const { data: tempData, error: tempError } = await supabase
        .from('temp_competitors_scraped_data')
        .insert(tempRecord)
        .select()
        .single();

      if (tempError) {
        return NextResponse.json(
          { error: 'Failed to create temp record', details: tempError.message },
          { status: 500 }
        );
      }

      // Run conflict detection
      const { data: conflictResult, error: conflictError } = await supabase.rpc(
        'detect_ean_conflicts_and_create_reviews',
        {
          p_user_id: userId,
          p_source_table: 'temp_competitors_scraped_data',
          p_batch_ids: [tempData.id]
        }
      );

      if (conflictError) {
        return NextResponse.json(
          { error: 'Failed to detect conflicts', details: conflictError.message },
          { status: 500 }
        );
      }

      // Get the created reviews
      const { data: reviews, error: _reviewsError } = await supabase
        .from('product_match_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('ean', testEAN);

      return NextResponse.json({
        success: true,
        message: 'Price difference test completed successfully',
        existingProduct,
        tempRecord: tempData,
        conflictResult,
        reviews: reviews || []
      });
    }

    return NextResponse.json(
      { error: 'Invalid test type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Unexpected error in test EAN conflicts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = ensureUUID(session.user.id);

    // Clean up test data
    await supabase
      .from('product_match_reviews')
      .delete()
      .eq('user_id', userId)
      .in('ean', ['1234567890123', '9876543210987']);

    await supabase
      .from('temp_competitors_scraped_data')
      .delete()
      .eq('user_id', userId)
      .in('ean', ['1234567890123', '9876543210987']);

    await supabase
      .from('products')
      .delete()
      .eq('user_id', userId)
      .in('ean', ['1234567890123', '9876543210987']);

    return NextResponse.json({
      success: true,
      message: 'Test data cleaned up successfully'
    });

  } catch (error) {
    console.error('Unexpected error cleaning up test data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
