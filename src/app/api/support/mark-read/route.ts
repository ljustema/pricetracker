import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /api/support/mark-read - Mark messages as read
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

    const body = await request.json();
    const { conversationId, messageIds } = body;

    const supabase = await createSupabaseServerClient();

    if (conversationId) {
      // Mark all unread admin messages in a conversation as read
      const { data: conversation, error: conversationError } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', session.user.id)
        .single();

      if (conversationError || !conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }

      // Mark admin messages as read
      const { error: updateError } = await supabase
        .from('support_messages')
        .update({ read_by_recipient: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'admin')
        .eq('read_by_recipient', false);

      if (updateError) {
        console.error('Error marking conversation messages as read:', updateError);
        return NextResponse.json(
          { error: 'Failed to mark messages as read' },
          { status: 500 }
        );
      }

      // Update last read timestamp
      await supabase
        .from('support_conversations')
        .update({ last_read_by_user: new Date().toISOString() })
        .eq('id', conversationId);

    } else if (messageIds && Array.isArray(messageIds)) {
      // Mark specific messages as read
      // First verify all messages belong to user's conversations
      const { data: userMessages, error: verifyError } = await supabase
        .from('support_messages')
        .select(`
          id,
          conversation_id,
          support_conversations!inner(user_id)
        `)
        .in('id', messageIds)
        .eq('support_conversations.user_id', session.user.id);

      if (verifyError) {
        console.error('Error verifying message ownership:', verifyError);
        return NextResponse.json(
          { error: 'Failed to verify message ownership' },
          { status: 500 }
        );
      }

      if (!userMessages || userMessages.length !== messageIds.length) {
        return NextResponse.json(
          { error: 'Some messages not found or not accessible' },
          { status: 404 }
        );
      }

      // Mark messages as read
      const { error: updateError } = await supabase
        .from('support_messages')
        .update({ read_by_recipient: true })
        .in('id', messageIds);

      if (updateError) {
        console.error('Error marking specific messages as read:', updateError);
        return NextResponse.json(
          { error: 'Failed to mark messages as read' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Either conversationId or messageIds must be provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Error in mark-read API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
