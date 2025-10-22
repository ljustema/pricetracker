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

    // Call the database function to refresh the materialized view with extended timeout
    const { error } = await supabase.rpc('refresh_latest_competitor_prices_mv', {}, {
      timeout: 300000 // 5 minutes timeout
    });

    if (error) {
      console.error('❌ [REFRESH PRICES] Error refreshing prices:', error);
      return NextResponse.json(
        { error: 'Failed to refresh prices', details: error.message },
        { status: 500 }
      );
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

