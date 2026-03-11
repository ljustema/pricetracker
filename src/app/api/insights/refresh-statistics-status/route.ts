import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const CONTEXT = 'API:refresh-statistics-status';

/**
 * GET /api/insights/refresh-statistics-status
 *
 * Gets the current status of the brand statistics materialized view refresh operation.
 *
 * Returns:
 * - 200: OK with status data
 * - 401: Unauthorized
 * - 500: Server error
 */

export async function GET(_request: NextRequest) {
  try {
    console.log(`[${CONTEXT}] Received status request`);

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn(`[${CONTEXT}] Unauthorized request - no session`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get refresh status from database
    const { data, error } = await supabase
      .from('mv_refresh_status')
      .select('*')
      .eq('view_name', 'brand_statistics_mv')
      .single();

    if (error) {
      console.error(`[${CONTEXT}] Error fetching refresh status: ${error.message}`);
      return NextResponse.json(
        { error: 'Failed to fetch refresh status', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[${CONTEXT}] Returning refresh status: is_refreshing=${data?.is_refreshing}`);

    return NextResponse.json({
      success: true,
      status: {
        is_refreshing: data?.is_refreshing || false,
        last_refresh_started_at: data?.last_refresh_started_at,
        last_refresh_completed_at: data?.last_refresh_completed_at,
        refresh_duration_ms: data?.refresh_duration_ms,
        last_error: data?.last_error,
        updated_at: data?.updated_at
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[${CONTEXT}] Unexpected error: ${errorMessage}`);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

