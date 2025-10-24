import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const CONTEXT = 'API:refresh-prices';

/**
 * POST /api/products/refresh-prices
 *
 * Refreshes the materialized view containing the latest competitor prices.
 * This endpoint starts the refresh operation asynchronously and returns immediately.
 * The actual refresh happens in the background to avoid HTTP timeouts.
 *
 * Returns:
 * - 202: Accepted - refresh operation started
 * - 401: Unauthorized
 * - 500: Server error
 */

// Background refresh function that runs without blocking the HTTP response
async function performRefreshInBackground(userId: string): Promise<void> {
  const startTime = Date.now();
  console.log(`[${CONTEXT}] Starting background refresh for user ${userId}`);

  try {
    // Use admin client for background operations
    const supabase = createSupabaseAdminClient();

    console.log(`[${CONTEXT}] Calling refresh_latest_competitor_prices_mv_with_timeout with 15-minute timeout`);

    const { error } = await supabase.rpc('refresh_latest_competitor_prices_mv_with_timeout', {
      p_timeout_ms: 900000 // 15 minutes
    });

    const elapsedTime = Date.now() - startTime;

    if (error) {
      console.error(`[${CONTEXT}] RPC returned error after ${elapsedTime}ms: ${error.message}`);
      return;
    }

    console.log(`[${CONTEXT}] Refresh completed successfully in ${elapsedTime}ms (${(elapsedTime / 1000).toFixed(2)}s)`);
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${CONTEXT}] Background refresh failed after ${elapsedTime}ms: ${errorMessage}`);
  }
}

export async function POST(_request: NextRequest) {
  try {
    console.log(`[${CONTEXT}] Received refresh request`);

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn(`[${CONTEXT}] Unauthorized request - no session`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`[${CONTEXT}] Authenticated user: ${userId}`);

    // Start the refresh in the background WITHOUT awaiting it
    // This allows us to return immediately to the client
    console.log(`[${CONTEXT}] Starting background refresh task`);
    performRefreshInBackground(userId).catch((error) => {
      console.error(`[${CONTEXT}] Unhandled error in background refresh: ${error}`);
    });

    // Return immediately with 202 Accepted status
    console.log(`[${CONTEXT}] Returning 202 Accepted response to client`);
    return NextResponse.json(
      {
        success: true,
        message: 'Refresh operation started in background',
        status: 'processing',
        timestamp: new Date().toISOString()
      },
      { status: 202 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[${CONTEXT}] Unexpected error: ${errorMessage}`);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

