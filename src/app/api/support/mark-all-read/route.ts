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

    // First get the conversation IDs for this user
    const { data: conversations, error: conversationError } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', session.user.id);

    if (conversationError) {
      console.error('Error fetching user conversations:', conversationError);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      // No conversations, nothing to mark as read
      return NextResponse.json({
        success: true,
        message: 'No conversations found for user'
      });
    }

    const conversationIds = conversations.map(c => c.id);

    // Mark all unread admin messages for this user as read
    const { error: updateError } = await supabase
      .from('support_messages')
      .update({ read_by_recipient: true })
      .eq('sender_type', 'admin')
      .eq('read_by_recipient', false)
      .in('conversation_id', conversationIds);

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
