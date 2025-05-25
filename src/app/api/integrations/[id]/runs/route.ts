import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // In NextJS 13+, we need to await params
  const { id: integrationId } = await params;

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

    // Get the integration runs
    const { data, error } = await supabase
      .from('integration_runs')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching integration runs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch integration runs' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/integrations/[id]/runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration runs' },
      { status: 500 }
    );
  }
}
