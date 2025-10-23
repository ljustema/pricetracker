import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/products/refresh-prices
 * 
 * Refreshes the materialized view containing the latest competitor prices.
 * This endpoint should be called when the user wants to see the most up-to-date prices.
 * 
 * Returns:
 * - 200: Success with refresh time
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function POST(_request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    console.log(`🔄 [REFRESH PRICES] Starting refresh for user ${session.user.id}`);
    const startTime = Date.now();

    try {
      // First, set a longer statement timeout (5 minutes = 300000 ms)
      console.log('⏱️ [REFRESH PRICES] Setting statement timeout to 5 minutes...');
      await supabase.rpc('set_statement_timeout', { p_milliseconds: 300000 });
      console.log('✅ [REFRESH PRICES] Statement timeout set');

      // Call the database function to refresh the materialized view
      console.log('🔄 [REFRESH PRICES] Calling refresh_latest_competitor_prices_mv...');
      const { error } = await supabase.rpc('refresh_latest_competitor_prices_mv', {});

      if (error) {
        console.error('❌ [REFRESH PRICES] Error refreshing prices:', error);
        return NextResponse.json(
          { error: 'Failed to refresh prices', details: error.message },
          { status: 500 }
        );
      }
    } catch (rpcError: unknown) {
      console.error('❌ [REFRESH PRICES] Error during refresh:', rpcError);

      // Check if it's a timeout error
      const errorMessage = rpcError instanceof Error ? rpcError.message : 'Unknown error';
      if (errorMessage.includes('statement timeout') || errorMessage.includes('canceling statement')) {
        console.error('❌ [REFRESH PRICES] Request timed out');
        return NextResponse.json(
          { error: 'Refresh request timed out', details: 'The refresh operation took too long to complete. This may happen if there are many products to process.' },
          { status: 504 }
        );
      }
      throw rpcError;
    }

    const refreshTime = Date.now() - startTime;
    console.log(`✅ [REFRESH PRICES] Refresh completed in ${refreshTime}ms`);

    return NextResponse.json({
      success: true,
      message: 'Prices refreshed successfully',
      refreshTime: `${(refreshTime / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('❌ [REFRESH PRICES] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

