import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { ensureUUID } from '@/lib/utils/uuid-utils';

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
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    console.log(`🔄 [REFRESH PRICES] Starting refresh for user ${userId}`);
    const startTime = Date.now();

    // Call the database function to refresh the materialized view
    const { data, error } = await supabase.rpc('refresh_latest_competitor_prices_mv');

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
      refreshTime: `${refreshTime}ms`,
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

