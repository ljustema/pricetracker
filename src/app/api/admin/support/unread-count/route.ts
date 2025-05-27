import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiAccess } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// GET /api/admin/support/unread-count - Get unread user message count for admin
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const supabase = createSupabaseAdminClient();

    // Count unread user messages (messages from users that admin hasn't read)
    const { count, error } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_type', 'user')
      .eq('read_by_recipient', false);

    if (error) {
      console.error('Error getting admin unread message count:', error);
      return NextResponse.json(
        { error: 'Failed to get unread count' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      count: count || 0,
      lastCheck: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in admin unread count API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
