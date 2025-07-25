import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils/uuid';

interface RouteParams {
  params: Promise<{ keyId: string }>;
}

/**
 * DELETE - Delete an API key
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { keyId } = await params;
    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Verify the API key belongs to the user and delete it
    const { data: deletedKey, error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId)
      .select('id, key_name')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'API key not found or access denied' },
          { status: 404 }
        );
      }
      console.error('Error deleting API key:', error);
      return NextResponse.json(
        { error: 'Failed to delete API key', details: error.message },
        { status: 500 }
      );
    }

    if (!deletedKey) {
      return NextResponse.json(
        { error: 'API key not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'API key deleted successfully',
      deleted_key: deletedKey
    });
  } catch (error) {
    console.error('Error in DELETE /api/settings/api-keys/[keyId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
