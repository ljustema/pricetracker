import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';
import { randomBytes } from 'crypto';

/**
 * GET - Fetch user's API keys
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    const { data: apiKeys, error } = await supabase
      .from('api_keys')
      .select('id, key_name, api_key, created_at, last_used_at, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch API keys', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(apiKeys || []);
  } catch (error) {
    console.error('Error in GET /api/settings/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new API key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const body = await request.json();
    const { key_name } = body;

    if (!key_name || typeof key_name !== 'string' || key_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'key_name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Generate a secure API key
    const apiKey = 'pt_' + randomBytes(32).toString('hex');

    const supabase = createSupabaseAdminClient();

    // Check if user already has an API key with this name
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', userId)
      .eq('key_name', key_name.trim())
      .eq('is_active', true)
      .single();

    if (existingKey) {
      return NextResponse.json(
        { error: 'An API key with this name already exists' },
        { status: 409 }
      );
    }

    // Create the new API key
    const { data: newApiKey, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key_name: key_name.trim(),
        api_key: apiKey,
        is_active: true,
        permissions: {}
      })
      .select('id, key_name, api_key, created_at, last_used_at, is_active')
      .single();

    if (error) {
      console.error('Error creating API key:', error);
      return NextResponse.json(
        { error: 'Failed to create API key', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(newApiKey, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/settings/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
