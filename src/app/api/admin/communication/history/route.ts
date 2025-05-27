import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/admin/communication/history - Get communication history with pagination and filters
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";

    const offset = (page - 1) * limit;

    const supabase = createSupabaseAdminClient();

    // Build the query
    let query = supabase
      .from('admin_communication_log')
      .select(`
        id,
        admin_user_id,
        target_user_id,
        communication_type,
        subject,
        message_content,
        sent_at,
        status,
        error_message
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.ilike('subject', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('communication_type', type);
    }

    // Get total count for pagination
    const { count: totalCount } = await query;

    // Get paginated results
    const { data: communications, error } = await query
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching communication history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch communication history' },
        { status: 500 }
      );
    }

    // Get user details for each communication
    const userIds = new Set<string>();
    communications?.forEach(comm => {
      userIds.add(comm.admin_user_id);
      userIds.add(comm.target_user_id);
    });

    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', Array.from(userIds));

    // Create a map of user profiles for quick lookup
    const userProfileMap = new Map();
    userProfiles?.forEach(profile => {
      userProfileMap.set(profile.id, profile);
    });

    // Transform the data to include user names
    const transformedCommunications = communications?.map(comm => ({
      id: comm.id,
      admin_user_id: comm.admin_user_id,
      target_user_id: comm.target_user_id,
      communication_type: comm.communication_type,
      subject: comm.subject,
      message_content: comm.message_content,
      sent_at: comm.sent_at,
      status: comm.status,
      error_message: comm.error_message,
      admin_name: userProfileMap.get(comm.admin_user_id)?.name || 'Unknown Admin',
      target_user_name: userProfileMap.get(comm.target_user_id)?.name || 'Unknown User',
      target_user_email: userProfileMap.get(comm.target_user_id)?.email || 'Unknown Email',
    })) || [];

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      communications: transformedCommunications,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalCount || 0,
        limit,
      },
    });
  } catch (error) {
    console.error('Error in communication history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
