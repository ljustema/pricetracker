import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceIntegrationName, targetIntegrationName } = body;

    if (!sourceIntegrationName || !targetIntegrationName) {
      return NextResponse.json(
        { error: 'Source and target integration names are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify that both integrations belong to the current user
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('id, name, user_id')
      .in('name', [sourceIntegrationName, targetIntegrationName])
      .eq('user_id', session.user.id);

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    if (!integrations || integrations.length !== 2) {
      return NextResponse.json(
        { error: 'One or both integrations not found or not owned by user' },
        { status: 404 }
      );
    }

    // Call the merge function
    const { data: mergeResult, error: mergeError } = await supabase.rpc(
      'merge_integration_price_changes',
      {
        source_integration_name: sourceIntegrationName,
        target_integration_name: targetIntegrationName,
      }
    );

    if (mergeError) {
      console.error('Error merging price changes:', mergeError);
      return NextResponse.json(
        { error: 'Failed to merge price changes' },
        { status: 500 }
      );
    }

    if (!mergeResult?.success) {
      return NextResponse.json(
        { error: mergeResult?.error || 'Merge operation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: mergeResult,
    });
  } catch (error) {
    console.error('Error in merge price changes API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
