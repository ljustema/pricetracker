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

// Trigger refresh function that returns immediately without waiting
async function triggerRefreshInDatabase(userId: string): Promise<void> {
  const startTime = Date.now();
  console.log(`[${CONTEXT}] Triggering refresh for user ${userId}`);

  try {
    // Use admin client for background operations
    const supabase = createSupabaseAdminClient();

    console.log(`[${CONTEXT}] Calling trigger_mv_refresh_async to start refresh in database`);

    const { data, error } = await supabase.rpc('trigger_mv_refresh_async', {
      p_view_name: 'latest_product_data_mv'
    });

    const elapsedTime = Date.now() - startTime;

    if (error) {
      console.error(`[${CONTEXT}] Failed to trigger refresh after ${elapsedTime}ms: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      const result = data[0];
      if (result.is_already_refreshing) {
        console.log(`[${CONTEXT}] Refresh already in progress, skipping trigger`);
      } else {
        console.log(`[${CONTEXT}] Refresh triggered successfully in ${elapsedTime}ms`);
      }
    }
  } catch (error: unknown) {
    const elapsedTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${CONTEXT}] Failed to trigger refresh after ${elapsedTime}ms: ${errorMessage}`);
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

    // Trigger the refresh in the database WITHOUT awaiting it
    // This allows us to return immediately to the client
    console.log(`[${CONTEXT}] Triggering refresh task in database`);
    triggerRefreshInDatabase(userId).catch((error) => {
      console.error(`[${CONTEXT}] Unhandled error triggering refresh: ${error}`);
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

