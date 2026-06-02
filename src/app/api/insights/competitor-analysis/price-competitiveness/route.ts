import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

interface PriceCompetitivenessData {
  competitor_id: string;
  competitor_name: string;
  competitor_website: string;
  total_matching_products: number;
  our_products_cheaper: number;
  our_products_more_expensive: number;
  our_products_same_price: number;
  avg_price_difference_percentage: number;
  avg_our_price: number;
  avg_competitor_price: number;
  market_coverage_percentage: number;
}

/**
 * GET handler to fetch price competitiveness analysis per competitor
 * This answers: "How many of our products are cheaper/more expensive than each competitor?"
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Parse query parameters
    const url = new URL(request.url);
    const competitorIds = url.searchParams.get('competitor_ids');
    const brandFilter = url.searchParams.get('brand_filter');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.time('api-competitor-analysis-price-competitiveness');

    // Parse competitor IDs if provided
    let competitorIdsArray = null;
    if (competitorIds) {
      try {
        competitorIdsArray = JSON.parse(competitorIds);
      } catch (error) {
        console.error('Error parsing competitor_ids:', error);
        return NextResponse.json(
          { error: 'Invalid competitor_ids format. Expected JSON array.' },
          { status: 400 }
        );
      }
    }

    // Call the database function
    const { data: competitivenessData, error } = await supabase.rpc('get_competitor_price_analysis', {
      p_user_id: userId,
      p_competitor_ids: competitorIdsArray,
      p_brand_filter: brandFilter || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('Error fetching price competitiveness data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price competitiveness data', details: error.message },
        { status: 500 }
      );
    }

    console.timeEnd('api-competitor-analysis-price-competitiveness');

    return NextResponse.json({
      data: competitivenessData || [],
      summary: {
        totalCompetitors: competitivenessData?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Unexpected error in price competitiveness API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for exporting price competitiveness data
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Parse request body for export parameters
    const body = await request.json();
    const { 
      competitor_ids, 
      brand_filter, 
      start_date, 
      end_date, 
      format = 'csv' 
    } = body;

    // Call the database function
    const { data: competitivenessData, error } = await supabase.rpc('get_competitor_price_analysis', {
      p_user_id: userId,
      p_competitor_ids: competitor_ids || null,
      p_brand_filter: brand_filter || null,
      p_start_date: start_date || null,
      p_end_date: end_date || null
    });

    if (error) {
      console.error('Error fetching price competitiveness data for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price competitiveness data for export', details: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'Competitor Name',
        'Website',
        'Total Matching Products',
        'Our Products Cheaper',
        'Our Products More Expensive',
        'Our Products Same Price',
        'Avg Price Difference %',
        'Avg Our Price',
        'Avg Competitor Price',
        'Market Coverage %'
      ];

      const csvRows = competitivenessData?.map((row: PriceCompetitivenessData) => [
        row.competitor_name || '',
        row.competitor_website || '',
        row.total_matching_products || 0,
        row.our_products_cheaper || 0,
        row.our_products_more_expensive || 0,
        row.our_products_same_price || 0,
        row.avg_price_difference_percentage || 0,
        row.avg_our_price || 0,
        row.avg_competitor_price || 0,
        row.market_coverage_percentage || 0
      ]) || [];

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row: (string | number)[]) => row.map(cell =>
          typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(','))
      ].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="price-competitiveness-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      data: competitivenessData || [],
      format: format
    });

  } catch (error) {
    console.error('Unexpected error in price competitiveness export API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
