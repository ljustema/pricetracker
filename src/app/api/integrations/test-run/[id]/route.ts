import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Reason: Explicitly force dynamic execution for this route.
// This can resolve the "params should be awaited" error by ensuring
// the route is not statically optimized or cached in a way that causes issues.
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest
  // Removed context parameter as we'll parse the ID from the request URL
) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reason: Extracting runId directly from the request URL path.
    // This bypasses the context.params object entirely, avoiding the "params should be awaited" error.
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const runId = pathSegments[pathSegments.length - 1];

    if (!runId) {
      return NextResponse.json({ error: 'Missing run ID in URL' }, { status: 400 });
    }

    // Continue with existing logic...
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const supabase = await createSupabaseAdminClient();

    // Get the test run
    const { data: run, error: runError } = await supabase
      .from('integration_runs')
      .select(`
        *,
        integrations (
          id,
          name,
          platform,
          api_url,
          api_key
        )
      `)
      .eq('id', runId)
      .eq('user_id', userId)
      .single();

    if (runError) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
    }

    // Check if this is a test run
    const isTestRun = run.configuration?.is_test_run === true;
    if (!isTestRun) {
      return NextResponse.json({ error: 'Not a test run' }, { status: 400 });
    }

    // If the run is completed, return the test products
    if (run.status === 'completed') {
      // The test products should be stored in the log_details
      const testProducts = run.test_products || [];

      return NextResponse.json({
        id: run.id,
        status: run.status,
        products: testProducts,
        products_processed: run.products_processed,
        completed_at: run.completed_at,
      });
    }

    // If the run failed, return the error
    if (run.status === 'failed') {
      return NextResponse.json({
        id: run.id,
        status: run.status,
        error_message: run.error_message,
        completed_at: run.completed_at,
      });
    }

    // If the run is still in progress, return the status
    return NextResponse.json({
      id: run.id,
      status: run.status,
      started_at: run.started_at,
    });
  } catch (error) {
    console.error('Error in GET /api/integrations/test-run/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to get test run' },
      { status: 500 }
    );
  }
}
