import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/support/unread-count - Get unread message count for current user
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

    const supabase = await createSupabaseServerClient();

    // Get unread message count for the user
    // Count messages where:
    // 1. User is part of the conversation
    // 2. Message is from admin
    // 3. Message is not read by recipient
    const { data, error } = await supabase
      .rpc('get_unread_message_count', {
        user_uuid: session.user.id
      });

    if (error) {
      console.error('Error getting unread message count:', error);
      
      // Fallback query if the function doesn't exist yet
      const { count, error: fallbackError } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_type', 'admin')
        .eq('read_by_recipient', false)
        .in('conversation_id', 
          supabase
            .from('support_conversations')
            .select('id')
            .eq('user_id', session.user.id)
        );

      if (fallbackError) {
        console.error('Error with fallback query:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to get unread count' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        count: count || 0,
        lastCheck: new Date().toISOString()
      });
    }

    return NextResponse.json({
      count: data || 0,
      lastCheck: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in unread count API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
