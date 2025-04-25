import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(
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

    // Reason: Extracting integrationId directly from the request URL path.
    // This bypasses the context.params object entirely, avoiding the "params should be awaited" error.
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    // The ID is the second to last segment in the path /api/integrations/[id]/test-run
    const integrationId = pathSegments[pathSegments.length - 2];

    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integration ID in URL' }, { status: 400 });
    }

    // Continue with existing logic...

    // Get the request body
    const body = await request.json().catch(() => ({}));
    const { activeOnly = true } = body;

    const userId = session.user.id;
    const supabase = await createSupabaseAdminClient();

    // Check if the integration exists
    const { data: _integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    if (integrationError) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Create a new integration run (test run)
    const { data, error } = await supabase
      .from('integration_runs')
      .insert({
        integration_id: integrationId,
        user_id: userId,
        status: 'pending',
        products_processed: 0,
        products_updated: 0,
        products_created: 0,
        log_details: JSON.stringify([{
          timestamp: new Date().toISOString(),
          level: 'info',
          phase: 'TEST_RUN',
          message: 'Test run initiated'
        }]),
        // Add a flag to indicate this is a test run
        configuration: { is_test_run: true, limit: 10, activeOnly }
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating test run:', error);
      return NextResponse.json(
        { error: 'Failed to create test run' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test run created successfully',
      run: data,
    });
  } catch (error) {
    console.error('Error in POST /api/integrations/[id]/test-run:', error);
    return NextResponse.json(
      { error: 'Failed to create test run' },
      { status: 500 }
    );
  }
}
