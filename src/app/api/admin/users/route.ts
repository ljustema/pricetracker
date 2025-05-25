import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiAccess } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

// GET /api/admin/users - Get paginated list of users
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const searchQuery = searchParams.get('search') || '';
    const subscriptionFilter = searchParams.get('subscription') || '';
    const statusFilter = searchParams.get('status') || '';

    const supabase = createSupabaseAdminClient();

    // Build the query
    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        subscription_tier,
        admin_role,
        is_suspended,
        created_at,
        updated_at
      `);

    // Apply search filter
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
    }

    // Apply subscription filter
    if (subscriptionFilter) {
      query = query.eq('subscription_tier', subscriptionFilter);
    }

    // Apply status filter
    if (statusFilter === 'suspended') {
      query = query.eq('is_suspended', true);
    } else if (statusFilter === 'active') {
      query = query.eq('is_suspended', false);
    } else if (statusFilter === 'admin') {
      query = query.not('admin_role', 'is', null);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting user count:', countError);
    }

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNext: (page * limit) < (totalCount || 0),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error in admin users API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
