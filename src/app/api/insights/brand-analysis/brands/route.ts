import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brand data
interface BrandData {
  name: string;
  product_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const minProducts = parseInt(searchParams.get('min_products') || '10');

    const supabase = createSupabaseAdminClient();

    // Get brands we have products for
    const { data, error } = await supabase
      .from('products')
      .select('brand')
      .eq('user_id', userId)
      .not('brand', 'is', null)
      .or('our_wholesale_price.not.is.null,our_retail_price.not.is.null');

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brands data', details: error.message },
        { status: 500 }
      );
    }

    // Count products per brand
    const brandCounts = (data || []).reduce((acc: Record<string, number>, item) => {
      if (item.brand) {
        acc[item.brand] = (acc[item.brand] || 0) + 1;
      }
      return acc;
    }, {});

    // Transform to array and filter by minimum products
    const transformedData: BrandData[] = Object.entries(brandCounts)
      .filter(([_, count]) => count >= minProducts)
      .map(([name, count]) => ({
        name,
        product_count: count
      }))
      .sort((a, b) => b.product_count - a.product_count);

    return NextResponse.json({
      success: true,
      data: transformedData,
      metadata: {
        total_brands: transformedData.length,
        min_products: minProducts
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
