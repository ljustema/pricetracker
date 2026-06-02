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

    // Get the integration
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in GET /api/integrations/${integrationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const supabase = await createSupabaseAdminClient();

    // Check if the integration exists
    const { data: _existingIntegration, error: checkError } = await supabase
      .from('integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    if (checkError) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Update the integration
    const { data, error } = await supabase
      .from('integrations')
      .update({
        name: body.name,
        api_url: body.api_url,
        api_key: body.api_key,
        sync_frequency: body.sync_frequency,
        is_active: body.is_active,
        configuration: body.configuration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating integration:', error);
      return NextResponse.json(
        { error: 'Failed to update integration' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in PUT /api/integrations/${integrationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update integration' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  // Reason: Declare integrationId outside the try block so it's accessible in the catch block.
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  // The ID is the last segment in the path /api/integrations/[id]
  const integrationId = pathSegments[pathSegments.length - 1];

  if (!integrationId) {
    return NextResponse.json({ error: 'Missing integration ID in URL' }, { status: 400 });
  }

  // Reason: Define a type for the update data to replace 'any' and satisfy ESLint.
  interface IntegrationUpdateData {
    status?: string;
    last_sync_status?: string;
    name?: string;
    api_url?: string;
    api_key?: string;
    sync_frequency?: string;
    is_active?: boolean;
    configuration?: object; // Reason: Replaced 'any' with 'object' to satisfy ESLint rule.
    updated_at: string;
  }

  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const supabase = await createSupabaseAdminClient();

    // Check if the integration exists
    const { data: _existingIntegration, error: checkError } = await supabase
      .from('integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    if (checkError) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: IntegrationUpdateData = { // Use the defined type
      updated_at: new Date().toISOString(), // Always update the updated_at timestamp
    };

    // Only update fields that are provided
    if (body.status) updateData.status = body.status;
    if (body.last_sync_status) updateData.last_sync_status = body.last_sync_status;
    if (body.name) updateData.name = body.name;
    if (body.api_url) updateData.api_url = body.api_url;
    if (body.api_key) updateData.api_key = body.api_key;
    if (body.sync_frequency) updateData.sync_frequency = body.sync_frequency;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.configuration) updateData.configuration = body.configuration;


    // Update the integration
    const { data, error } = await supabase
      .from('integrations')
      .update(updateData)
      .eq('id', integrationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating integration ${integrationId}:`, error); // Corrected console.error
      return NextResponse.json(
        { error: 'Failed to update integration' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in PATCH /api/integrations/${integrationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update integration' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { data: _existingIntegration, error: checkError } = await supabase
      .from('integrations')
      .select('id')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    if (checkError) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // First, delete all associated integration runs
    const { error: runsError } = await supabase
      .from('integration_runs')
      .delete()
      .eq('integration_id', integrationId)
      .eq('user_id', userId);

    if (runsError) {
      console.error('Error deleting integration runs:', runsError);
      return NextResponse.json(
        { error: 'Failed to delete integration runs' },
        { status: 500 }
      );
    }

    // Delete any temp_integrations_scraped_data records
    const { error: tempDataError } = await supabase
      .from('temp_integrations_scraped_data')
      .delete()
      .eq('integration_id', integrationId)
      .eq('user_id', userId);

    if (tempDataError) {
      console.error('Error deleting temp integration data:', tempDataError);
      return NextResponse.json(
        { error: 'Failed to delete temp integration data' },
        { status: 500 }
      );
    }

    // Delete the integration (price_changes will be automatically deleted via CASCADE)
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', integrationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting integration:', error);
      return NextResponse.json(
        { error: 'Failed to delete integration' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error in DELETE /api/integrations/${integrationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete integration' },
      { status: 500 }
    );
  }
}
