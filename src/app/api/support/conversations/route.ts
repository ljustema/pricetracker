import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/support/conversations - List user's conversations
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = await createSupabaseServerClient();

    // Get user's conversations with message counts and latest message
    const { data: conversations, error } = await supabase
      .from('support_conversations')
      .select(`
        *,
        support_messages (
          id,
          message_content,
          sender_type,
          read_by_recipient,
          created_at
        )
      `)
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    // Process conversations to add metadata
    const processedConversations = conversations?.map(conversation => {
      const messages = conversation.support_messages || [];
      const unreadCount = messages.filter((msg: { sender_type: string; read_by_recipient: boolean }) =>
        msg.sender_type === 'admin' && !msg.read_by_recipient
      ).length;
      
      const latestMessage = messages.length > 0
        ? messages.sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

      return {
        ...conversation,
        message_count: messages.length,
        unread_count: unreadCount,
        latest_message: latestMessage,
        support_messages: undefined // Remove full messages array to reduce payload
      };
    }) || [];

    // Get total count for pagination
    const { count } = await supabase
      .from('support_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      conversations: processedConversations,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count || 0,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Error in conversations API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/support/conversations - Create new conversation
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
    const { subject, message, category = 'general', priority = 'medium' } = body;

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    // Validate subject and message length
    if (subject.length < 5 || subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject must be between 5 and 200 characters' },
        { status: 400 }
      );
    }

    if (message.length < 10 || message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be between 10 and 2000 characters' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Create conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .insert({
        user_id: session.user.id,
        subject,
        category,
        priority,
        status: 'open'
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    // Add initial message
    const { data: initialMessage, error: messageError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: session.user.id,
        sender_type: 'user',
        message_content: message
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating initial message:', messageError);
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Send email notification to admin
    try {
      const { sendEmail } = await import("@/lib/services/email-service");
      
      await sendEmail({
        to: 'admin@info.pricetracker.se', // Replace with actual admin email
        subject: `New Support Ticket: ${subject}`,
        content: `A new support ticket has been created:

Subject: ${subject}
Category: ${category}
Priority: ${priority}

Message:
${message}

User: ${session.user.name || 'Unknown'} (${session.user.email || 'Unknown'})
Conversation ID: ${conversation.id}

Please respond via the admin panel.`,
        fromName: 'PriceTracker Support System'
      });
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      conversation: {
        ...conversation,
        latest_message: initialMessage,
        message_count: 1,
        unread_count: 0
      }
    });

  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
