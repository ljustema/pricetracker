import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiAccess } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// POST /api/admin/support/mark-all-read - Mark all unread user messages as read by admin
export async function POST(_request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const supabase = createSupabaseAdminClient();

    // Mark all unread user messages as read by admin
    const { error: updateError } = await supabase
      .from('support_messages')
      .update({ read_by_recipient: true })
      .eq('sender_type', 'user')
      .eq('read_by_recipient', false);

    if (updateError) {
      console.error('Error marking admin messages as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'All user messages marked as read by admin'
    });

  } catch (error) {
    console.error('Error in admin mark-all-read API:', error);
    
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
