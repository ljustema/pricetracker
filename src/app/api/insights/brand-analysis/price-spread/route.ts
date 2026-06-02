import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brand price spread data
interface BrandPriceSpreadData {
  brand_name: string;
  total_products: number;
  avg_price_spread_amount: number;
  avg_price_spread_percentage: number;
  max_price_spread_amount: number;
  max_price_spread_percentage: number;
  min_competitor_price: number;
  max_competitor_price: number;
  avg_our_price: number;
  avg_competitor_price: number;
  price_volatility_score: number;
}

// Database row type for the raw data from Supabase
interface BrandPriceSpreadDataRow {
  brand_name: string;
  total_products: number;
  avg_price_spread_amount: string | null;
  avg_price_spread_percentage: string | null;
  max_price_spread_amount: string | null;
  max_price_spread_percentage: string | null;
  min_competitor_price: string | null;
  max_competitor_price: string | null;
  avg_our_price: string | null;
  avg_competitor_price: string | null;
  price_volatility_score: string | null;
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
    const competitorId = searchParams.get('competitor_id') || null;

    console.time('api-brand-analysis-price-spread');

    const supabase = createSupabaseAdminClient();

    // Call the database function to get brand price spread data
    const { data, error } = await supabase.rpc('get_brand_price_spread_analysis', {
      p_user_id: userId,
      p_competitor_id: competitorId
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand price spread data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-brand-analysis-price-spread');

    // Transform the data for the frontend
    const transformedData: BrandPriceSpreadData[] = (data || []).map((row: BrandPriceSpreadDataRow) => ({
      brand_name: row.brand_name,
      total_products: row.total_products,
      avg_price_spread_amount: parseFloat(row.avg_price_spread_amount || '0'),
      avg_price_spread_percentage: parseFloat(row.avg_price_spread_percentage || '0'),
      max_price_spread_amount: parseFloat(row.max_price_spread_amount || '0'),
      max_price_spread_percentage: parseFloat(row.max_price_spread_percentage || '0'),
      min_competitor_price: parseFloat(row.min_competitor_price || '0'),
      max_competitor_price: parseFloat(row.max_competitor_price || '0'),
      avg_our_price: parseFloat(row.avg_our_price || '0'),
      avg_competitor_price: parseFloat(row.avg_competitor_price || '0'),
      price_volatility_score: parseFloat(row.price_volatility_score || '0')
    }));

    // Calculate summary statistics
    const summary = {
      total_brands: transformedData.length,
      total_products: transformedData.reduce((sum, brand) => sum + brand.total_products, 0),
      avg_price_spread_percentage: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.avg_price_spread_percentage, 0) / transformedData.length 
        : 0,
      highest_volatility_brand: transformedData.length > 0 
        ? transformedData.sort((a, b) => b.price_volatility_score - a.price_volatility_score)[0].brand_name 
        : null,
      highest_spread_brand: transformedData.length > 0 
        ? transformedData.sort((a, b) => b.avg_price_spread_percentage - a.avg_price_spread_percentage)[0].brand_name 
        : null,
      avg_volatility_score: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.price_volatility_score, 0) / transformedData.length 
        : 0
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      metadata: {
        competitor_id: competitorId,
        total_brands: transformedData.length
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
