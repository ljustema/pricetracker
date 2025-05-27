import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/admin/support/conversations/[id] - Get conversation details for admin
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { id: conversationId } = await params;
    const supabase = createSupabaseAdminClient();

    // Get conversation with all messages (including internal admin notes)
    const { data: conversation, error } = await supabase
      .from('support_conversations')
      .select(`
        id,
        subject,
        status,
        priority,
        category,
        created_at,
        updated_at,
        resolved_at,
        user_id,
        admin_user_id,
        user_profiles!support_conversations_user_id_fkey (
          id,
          name,
          email,
          subscription_tier
        ),
        admin_profiles:user_profiles!support_conversations_admin_user_id_fkey (
          id,
          name,
          email
        ),
        support_messages (
          id,
          message_content,
          sender_type,
          sender_id,
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
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Mark user messages as read by admin
    const unreadUserMessages = conversation.support_messages?.filter(msg =>
      msg.sender_type === 'user' && !msg.read_by_recipient
    ) || [];

    if (unreadUserMessages.length > 0) {
      const messageIds = unreadUserMessages.map(msg => msg.id);
      await supabase
        .from('support_messages')
        .update({ read_by_recipient: true })
        .in('id', messageIds);
    }

    // Sort messages by creation time
    const sortedMessages = conversation.support_messages?.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ) || [];

    return NextResponse.json({
      conversation: {
        ...conversation,
        support_messages: sortedMessages
      }
    });

  } catch (error) {
    console.error('Error fetching admin conversation details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/support/conversations/[id] - Update conversation (status, priority, assignment)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { id: conversationId } = await params;
    const body = await request.json();
    const { status, priority, admin_user_id } = body;

    const supabase = createSupabaseAdminClient();

    // Prepare update data
    const updateData: {
      updated_at: string;
      status?: string;
      priority?: string;
      admin_user_id?: string;
      resolved_at?: string | null;
    } = {
      updated_at: new Date().toISOString()
    };

    if (status) {
      updateData.status = status;
      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (priority) {
      updateData.priority = priority;
    }

    if (admin_user_id !== undefined) {
      updateData.admin_user_id = admin_user_id;
    }

    // Update conversation
    const { data: conversation, error } = await supabase
      .from('support_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select(`
        id,
        subject,
        status,
        priority,
        category,
        created_at,
        updated_at,
        resolved_at,
        user_id,
        admin_user_id,
        user_profiles!support_conversations_user_id_fkey (
          id,
          name,
          email
        ),
        admin_profiles:user_profiles!support_conversations_admin_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('Error in admin conversation update endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
