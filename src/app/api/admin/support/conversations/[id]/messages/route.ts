import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// POST /api/admin/support/conversations/[id]/messages - Send message as admin
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { id: conversationId } = await params;
    const body = await request.json();
    const { message_content, is_internal = false } = body;

    if (!message_content?.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify conversation exists
    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .select('id, user_id, status')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Create the message
    const { data: message, error: messageError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: adminUser.id,
        sender_type: 'admin',
        message_content: message_content.trim(),
        is_internal: is_internal,
        read_by_recipient: false
      })
      .select(`
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
      `)
      .single();

    if (messageError) {
      console.error('Error creating admin message:', messageError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Update conversation timestamp and status if needed
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // If conversation was resolved/closed and admin sends a non-internal message, reopen it
    if (!is_internal && (conversation.status === 'resolved' || conversation.status === 'closed')) {
      updateData.status = 'in_progress';
      updateData.resolved_at = null;
    }

    await supabase
      .from('support_conversations')
      .update(updateData)
      .eq('id', conversationId);

    // TODO: Send email notification to user if not internal message
    if (!is_internal) {
      // Email notification logic would go here
      console.log(`Should send email notification to user for conversation ${conversationId}`);
    }

    return NextResponse.json({ message });

  } catch (error) {
    console.error('Error in admin message creation endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
