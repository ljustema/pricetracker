import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";

// GET /api/admin/marketing/newsletter - Get all newsletter subscribers
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const activeOnly = searchParams.get('active_only') === 'true';
    const search = searchParams.get('search');

    const supabase = createSupabaseAdminClient();

    // Build query
    let query = supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact' })
      .order('subscribed_at', { ascending: false });

    // Apply filters
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: subscribers, error, count } = await query;

    if (error) {
      console.error('Database error fetching subscribers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscribers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscribers: subscribers || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching newsletter subscribers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/marketing/newsletter - Unsubscribe user (admin action)
export async function DELETE(request: NextRequest) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Update subscription to inactive
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email', email.toLowerCase());

    if (error) {
      console.error('Database error unsubscribing user:', error);
      return NextResponse.json(
        { error: 'Failed to unsubscribe user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User unsubscribed successfully'
    });

  } catch (error) {
    console.error('Error unsubscribing user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
