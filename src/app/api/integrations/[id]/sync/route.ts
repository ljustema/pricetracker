import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest
  // Removed context parameter as we'll parse the ID from the request URL
) {
  // Reason: Declare integrationId outside the try block so it's accessible in the catch block.
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  // The ID is the second to last segment in the path /api/integrations/[id]/sync
  const integrationId = pathSegments[pathSegments.length - 2];

  if (!integrationId) {
    return NextResponse.json({ error: 'Missing integration ID in URL' }, { status: 400 });
  }

  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Check if a test run has been completed successfully
    // First, get all completed runs for this integration
    const { data: allRuns, error: runsError } = await supabase
      .from('integration_runs')
      .select('id, status, configuration')
      .eq('integration_id', integrationId)
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (runsError) {
      console.error('Error fetching integration runs:', runsError);
      return NextResponse.json(
        { error: 'Failed to check for test runs' },
        { status: 500 }
      );
    }

    // Manually filter for test runs since the JSONB filtering is causing issues
    const testRuns = allRuns?.filter(run => {
      return run.configuration && typeof run.configuration === 'object' && run.configuration.is_test_run === true;
    }) || [];

    // Log the number of test runs found
    console.log(`Found ${testRuns.length} completed test runs for integration ${integrationId}`);

    // If no successful test run exists, return an error
    if (!testRuns || testRuns.length === 0) {
      return NextResponse.json(
        {
          error: 'Test run required',
          message: 'You must complete a test run and approve the data before proceeding with a full sync'
        },
        { status: 400 }
      );
    }

    // Create a new integration run (sync job)
    const { data, error } = await supabase
      .from('integration_runs')
      .insert({
        integration_id: integrationId,
        user_id: userId,
        status: 'pending',
        products_processed: 0,
        products_updated: 0,
        products_created: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating integration run:', error);
      return NextResponse.json(
        { error: 'Failed to create integration run' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Integration run created successfully',
      run: data,
    });
  } catch (error) {
    console.error('Error in POST /api/integrations/[id]/sync:', error);
    return NextResponse.json(
      { error: 'Failed to create integration run' },
      { status: 500 }
    );
  }
}
