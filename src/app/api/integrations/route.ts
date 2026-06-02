import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const supabase = await createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching integrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    // Validate required fields - conditional based on platform
    if (!body.platform || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, name' },
        { status: 400 }
      );
    }

    // For non-manual platforms, require API credentials
    if (body.platform !== 'manual' && !body.api_url) {
      return NextResponse.json(
        { error: 'Missing required field: api_url' },
        { status: 400 }
      );
    }

    // For platforms other than manual and google-feed, require API key
    if (body.platform !== 'manual' && body.platform !== 'google-feed' && !body.api_key) {
      return NextResponse.json(
        { error: 'Missing required field: api_key' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAdminClient();

    const dataToInsert = {
      user_id: userId,
      platform: body.platform,
      name: body.name,
      api_url: body.api_url || null,
      api_key: body.api_key || null,
      status: (body.platform === 'manual' || body.platform === 'google-feed') ? 'active' : 'pending_setup', // Manual and Google Feed integrations are immediately active
      is_active: body.is_active !== false, // Default to true
      sync_frequency: body.platform === 'manual' ? 'manual' : (body.sync_frequency || 'daily'),
      configuration: body.configuration || null,
    };

    const { data, error } = await supabase
      .from('integrations')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating integration:', error);
      return NextResponse.json(
        { error: 'Failed to create integration' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/integrations:', error);
    return NextResponse.json(
      { error: 'Failed to create integration' },
      { status: 500 }
    );
  }
}
