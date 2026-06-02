import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

interface CompetitorStatistic {
  competitor_id: string;
  product_count: number;
  brand_count: number;
}

/**
 * GET handler to fetch integration and competitor statistics for the brands page
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

    console.time('api-brands-integration-competitor-stats');

    // Get all integrations with product counts
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select(`
        id,
        name,
        platform
      `)
      .eq('user_id', userId);

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError);
      return NextResponse.json(
        { error: 'Failed to fetch integrations', details: integrationsError.message },
        { status: 500 }
      );
    }

    // Get all competitors
    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select(`
        id,
        name
      `)
      .eq('user_id', userId);

    if (competitorsError) {
      console.error('Error fetching competitors:', competitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitors', details: competitorsError.message },
        { status: 500 }
      );
    }

    // Get total product count
    const { count: totalProductCount, error: totalProductError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (totalProductError) {
      console.error('Error fetching total product count:', totalProductError);
      return NextResponse.json(
        { error: 'Failed to fetch total product count', details: totalProductError.message },
        { status: 500 }
      );
    }

    // Get integration product counts
    const integrationStats = await Promise.all(
      integrations.map(async (integration) => {
        // Get total products for this integration
        const { count: totalCount, error: totalError } = await supabase
          .from('price_changes_competitors')
          .select('product_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('integration_id', integration.id);

        if (totalError) {
          console.error(`Error fetching product count for integration ${integration.id}:`, totalError);
          return {
            ...integration,
            totalProducts: 0,
            uniqueProducts: 0
          };
        }

        // Get unique products (products that only this integration has)
        const { data: uniqueData, error: uniqueError } = await supabase.rpc(
          'get_unique_integration_products',
          {
            p_user_id: userId,
            p_integration_id: integration.id
          }
        );

        let uniqueCount = 0;
        if (uniqueError) {
          console.error(`Error fetching unique products for integration ${integration.id}:`, uniqueError);

          // Fallback query if RPC fails - simplified approach
          const { count, error: fallbackError } = await supabase
            .from('price_changes_competitors')
            .select('product_id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('integration_id', integration.id);

          if (fallbackError) {
            console.error(`Fallback query also failed for integration ${integration.id}:`, fallbackError);
          } else {
            uniqueCount = count || 0;
          }
        } else {
          uniqueCount = uniqueData || 0;
        }

        return {
          ...integration,
          totalProducts: totalCount || 0,
          uniqueProducts: uniqueCount
        };
      })
    );

    // Get competitor product counts using the same method as competitors page
    // Use the get_competitor_statistics function for consistency
    const { data: competitorStatsData, error: competitorStatsError } = await supabase
      .rpc('get_competitor_statistics', { p_user_id: userId });

    if (competitorStatsError) {
      console.error('Error fetching competitor statistics:', competitorStatsError);
    }

    // Create a map of competitor_id to stats for quick lookup
    const statsMap = new Map<string, { product_count: number, brand_count: number }>();
    if (competitorStatsData) {
      competitorStatsData.forEach((stat: CompetitorStatistic) => {
        statsMap.set(stat.competitor_id, {
          product_count: stat.product_count || 0,
          brand_count: stat.brand_count || 0
        });
      });
    }

    // Get competitor product counts
    const competitorStats = await Promise.all(
      competitors.map(async (competitor) => {
        // Get stats from the map (consistent with competitors page)
        const stats = statsMap.get(competitor.id) || { product_count: 0, brand_count: 0 };
        const totalCount = stats.product_count;

        // Get unique products (products that only this competitor has)
        const { data: uniqueData, error: uniqueError } = await supabase.rpc(
          'get_unique_competitor_products',
          {
            p_user_id: userId,
            p_competitor_id: competitor.id
          }
        );

        let uniqueCount = 0;
        if (uniqueError) {
          console.error(`Error fetching unique products for competitor ${competitor.id}:`, uniqueError);

          // Fallback query if RPC fails - simplified approach
          const { count, error: fallbackError } = await supabase
            .from('price_changes_competitors')
            .select('product_id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('competitor_id', competitor.id);

          if (fallbackError) {
            console.error(`Fallback query also failed for competitor ${competitor.id}:`, fallbackError);
          } else {
            uniqueCount = count || 0;
          }
        } else {
          uniqueCount = uniqueData || 0;
        }

        return {
          ...competitor,
          totalProducts: totalCount,
          uniqueProducts: uniqueCount
        };
      })
    );

    console.timeEnd('api-brands-integration-competitor-stats');

    // Add cache headers to the response
    const response = NextResponse.json({
      totalProducts: totalProductCount || 0,
      integrations: integrationStats,
      competitors: competitorStats
    });

    // Set cache headers
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching integration and competitor stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch integration and competitor stats', details: errorMessage },
      { status: 500 }
    );
  }
}
