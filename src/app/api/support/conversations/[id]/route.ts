import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/support/conversations/[id] - Get conversation details with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get conversation with messages (RLS will ensure user can only see their own)
    const { data: conversation, error } = await supabase
      .from('support_conversations')
      .select(`
        *,
        support_messages (
          id,
          sender_id,
          sender_type,
          message_content,
          is_internal,
          read_by_recipient,
          created_at,
          user_profiles!support_messages_sender_id_fkey (
            id,
            name,
            email
          )
        )
      `)
      .eq('id', conversationId)
      .eq('user_id', session.user.id) // Ensure user owns this conversation
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Filter out internal messages (admin-only notes)
    const publicMessages = conversation.support_messages?.filter(msg => !msg.is_internal) || [];

    // Mark admin messages as read
    const unreadAdminMessages = publicMessages.filter(msg =>
      msg.sender_type === 'admin' && !msg.read_by_recipient
    );

    console.log(`User ${session.user.id} viewing conversation ${conversationId}`);
    console.log(`Found ${unreadAdminMessages.length} unread admin messages`);

    if (unreadAdminMessages.length > 0) {
      console.log(`Marking admin messages as read using database function`);

      // Use database function to mark messages as read (bypasses RLS)
      const { data: updateCount, error: markReadError } = await supabase
        .rpc('mark_conversation_messages_read', {
          conversation_uuid: conversationId,
          reader_type: 'user'
        });

      if (markReadError) {
        console.error('Error marking admin messages as read:', markReadError);
      } else {
        console.log(`Successfully marked ${updateCount} admin messages as read`);
      }
    }

    // Sort messages by creation time
    const sortedMessages = publicMessages.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return NextResponse.json({
      conversation: {
        ...conversation,
        support_messages: sortedMessages
      }
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/support/conversations/[id] - Add message to conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message } = body;

    // Validate message
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length < 5 || message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be between 5 and 2000 characters' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify user owns this conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .select('id, subject, status')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Don't allow messages to closed conversations
    if (conversation.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot add messages to closed conversations' },
        { status: 400 }
      );
    }

    // Add message
    const { data: newMessage, error: messageError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        sender_type: 'user',
        message_content: message.trim()
      })
      .select(`
        *,
        user_profiles!support_messages_sender_id_fkey (
          id,
          name,
          email
        )
      `)
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Update conversation status to 'open' if it was resolved
    if (conversation.status === 'resolved') {
      await supabase
        .from('support_conversations')
        .update({ status: 'open' })
        .eq('id', conversationId);
    }

    // Send email notification to admin
    try {
      const { sendEmail } = await import("@/lib/services/email-service");

      await sendEmail({
        to: 'admin@info.pricetracker.se', // Replace with actual admin email
        subject: `Support Reply: ${conversation.subject}`,
        content: `A user has replied to a support conversation:

Subject: ${conversation.subject}
Conversation ID: ${conversationId}

New Message:
${message}

User: ${session.user.name || 'Unknown'} (${session.user.email || 'Unknown'})

Please respond via the admin panel.`,
        fromName: 'PriceTracker Support System'
      });
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: newMessage
    });

  } catch (error) {
    console.error('Error adding message to conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
