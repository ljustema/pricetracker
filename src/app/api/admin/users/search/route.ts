import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/admin/users/search - Search users for email composition
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const supabase = createSupabaseAdminClient();

    // Search users by name or email
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        subscription_tier,
        is_suspended
      `)
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('name')
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    return NextResponse.json(users || []);
  } catch (error) {
    console.error('Error in user search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
