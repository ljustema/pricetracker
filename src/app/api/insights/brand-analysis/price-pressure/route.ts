import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

// Types for brand price pressure data
interface BrandPricePressureData {
  brand_name: string;
  total_products: number;
  total_price_changes: number;
  avg_price_changes_per_product: number;
  price_change_frequency_score: number;
  avg_price_change_percentage: number;
  price_increases: number;
  price_decreases: number;
  net_price_direction: string;
  most_volatile_product_name: string;
  most_volatile_product_changes: number;
  pressure_level: string;
}

// Database row type for the raw data from Supabase
interface BrandPricePressureDataRow {
  brand_name: string;
  total_products: number;
  total_price_changes: number;
  avg_price_changes_per_product: string | null;
  price_change_frequency_score: string | null;
  avg_price_change_percentage: string | null;
  price_increases: number;
  price_decreases: number;
  net_price_direction: string;
  most_volatile_product_name: string;
  most_volatile_product_changes: number;
  pressure_level: string;
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
    const daysBack = parseInt(searchParams.get('days_back') || '30');

    console.time('api-brand-analysis-price-pressure');

    const supabase = createSupabaseAdminClient();

    // Call the database function to get brand price pressure data
    const { data, error } = await supabase.rpc('get_brand_price_pressure_analysis', {
      p_user_id: userId,
      p_competitor_id: competitorId,
      p_days_back: daysBack
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brand price pressure data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-brand-analysis-price-pressure');

    // Transform the data for the frontend
    const transformedData: BrandPricePressureData[] = (data || []).map((row: BrandPricePressureDataRow) => ({
      brand_name: row.brand_name,
      total_products: row.total_products,
      total_price_changes: row.total_price_changes,
      avg_price_changes_per_product: parseFloat(row.avg_price_changes_per_product || '0'),
      price_change_frequency_score: parseFloat(row.price_change_frequency_score || '0'),
      avg_price_change_percentage: parseFloat(row.avg_price_change_percentage || '0'),
      price_increases: row.price_increases,
      price_decreases: row.price_decreases,
      net_price_direction: row.net_price_direction,
      most_volatile_product_name: row.most_volatile_product_name,
      most_volatile_product_changes: row.most_volatile_product_changes,
      pressure_level: row.pressure_level
    }));

    // Calculate summary statistics
    const pressureLevelCounts = transformedData.reduce((acc, brand) => {
      acc[brand.pressure_level] = (acc[brand.pressure_level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priceDirectionCounts = transformedData.reduce((acc, brand) => {
      acc[brand.net_price_direction] = (acc[brand.net_price_direction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summary = {
      total_brands: transformedData.length,
      total_products: transformedData.reduce((sum, brand) => sum + brand.total_products, 0),
      total_price_changes: transformedData.reduce((sum, brand) => sum + brand.total_price_changes, 0),
      avg_frequency_score: transformedData.length > 0 
        ? transformedData.reduce((sum, brand) => sum + brand.price_change_frequency_score, 0) / transformedData.length 
        : 0,
      highest_pressure_brand: transformedData.length > 0 
        ? transformedData.sort((a, b) => b.price_change_frequency_score - a.price_change_frequency_score)[0].brand_name 
        : null,
      pressure_level_distribution: pressureLevelCounts,
      price_direction_distribution: priceDirectionCounts,
      brands_under_high_pressure: transformedData.filter(brand => 
        brand.pressure_level === 'Very High' || brand.pressure_level === 'High'
      ).length
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      metadata: {
        competitor_id: competitorId,
        days_back: daysBack,
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
