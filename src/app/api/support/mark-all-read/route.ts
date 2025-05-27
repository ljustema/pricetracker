import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /api/support/mark-all-read - Mark all unread messages as read for current user
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Mark all unread admin messages for this user as read
    const { error: updateError } = await supabase
      .from('support_messages')
      .update({ read_by_recipient: true })
      .eq('sender_type', 'admin')
      .eq('read_by_recipient', false)
      .in('conversation_id', 
        supabase
          .from('support_conversations')
          .select('id')
          .eq('user_id', session.user.id)
      );

    if (updateError) {
      console.error('Error marking all messages as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      );
    }

    // Update last read timestamp for all user's conversations
    await supabase
      .from('support_conversations')
      .update({ last_read_by_user: new Date().toISOString() })
      .eq('user_id', session.user.id);

    return NextResponse.json({
      success: true,
      message: 'All messages marked as read'
    });

  } catch (error) {
    console.error('Error in mark-all-read API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
