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
    const startTime = Date.now();

    try {
      // Set a longer statement timeout (15 minutes = 900000 ms)
      // Materialized view refresh can take a long time with many products
      await supabase.rpc('set_statement_timeout', { p_milliseconds: 900000 });

      // Call the database function to refresh the materialized view
      const { error } = await supabase.rpc('refresh_latest_competitor_prices_mv', {});

      if (error) {
        return NextResponse.json(
          { error: 'Failed to refresh prices', details: error.message },
          { status: 500 }
        );
      }
    } catch (rpcError: unknown) {
      // Check if it's a timeout error
      const errorMessage = rpcError instanceof Error ? rpcError.message : 'Unknown error';
      if (errorMessage.includes('statement timeout') || errorMessage.includes('canceling statement')) {
        return NextResponse.json(
          { error: 'Refresh request timed out', details: 'The refresh operation took too long to complete. This may happen if there are many products to process.' },
          { status: 504 }
        );
      }
      throw rpcError;
    }

    const refreshTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Prices refreshed successfully',
      refreshTime: `${(refreshTime / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

