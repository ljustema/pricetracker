import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/admin/support/conversations - List all support conversations for admin
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';

    const supabase = createSupabaseAdminClient();

    // Build query
    let query = supabase
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
          email
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
          created_at,
          is_internal,
          read_by_recipient
        )
      `)
      .order('updated_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`subject.ilike.%${search}%,user_profiles.name.ilike.%${search}%,user_profiles.email.ilike.%${search}%`);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('support_conversations')
      .select('*', { count: 'exact', head: true });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: conversations, error } = await query;

    if (error) {
      console.error('Error fetching admin support conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    // Process conversations to add message counts and latest message info
    const processedConversations = conversations?.map(conversation => {
      const messages = conversation.support_messages || [];
      const publicMessages = messages.filter(msg => !msg.is_internal);
      const latestMessage = publicMessages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      // Count unread user messages (messages from users that admin hasn't read)
      const unreadUserMessages = messages.filter(msg => 
        msg.sender_type === 'user' && !msg.read_by_recipient
      );

      return {
        ...conversation,
        message_count: publicMessages.length,
        unread_count: unreadUserMessages.length,
        latest_message: latestMessage ? {
          id: latestMessage.id,
          message_content: latestMessage.message_content,
          sender_type: latestMessage.sender_type,
          created_at: latestMessage.created_at
        } : null,
        support_messages: undefined // Remove messages from response to reduce payload
      };
    }) || [];

    return NextResponse.json({
      conversations: processedConversations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error in admin support conversations endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
