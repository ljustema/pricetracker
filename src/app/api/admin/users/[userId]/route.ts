import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiAccess } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

interface UserUpdateData {
  subscription_tier?: string;
  is_suspended?: boolean;
  admin_role?: string | null;
  updated_at: string;
}

// GET /api/admin/users/[userId] - Get detailed user information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { userId } = await params;
    const supabase = createSupabaseAdminClient();

    // Get user profile with detailed information
    const { data: userProfile, error: profileError } = await supabase
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
      `)
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user statistics
    const [
      { count: productCount },
      { count: competitorCount },
      { count: scraperCount },
      { count: integrationCount }
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('competitors').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('scrapers').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('integrations').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    ]);

    // Get recent activity (last 10 price changes)
    const { data: recentActivity, error: activityError } = await supabase
      .from('price_changes_competitors')
      .select(`
        id,
        old_competitor_price,
        new_competitor_price,
        changed_at,
        products!inner(name, user_id)
      `)
      .eq('products.user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(10);

    if (activityError) {
      console.error('Error fetching user activity:', activityError);
    }

    // Get communication history
    const { data: communications, error: commError } = await supabase
      .from('admin_communication_log')
      .select(`
        id,
        subject,
        communication_type,
        sent_at,
        status
      `)
      .eq('target_user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(10);

    if (commError) {
      console.error('Error fetching communication history:', commError);
    }

    return NextResponse.json({
      user: userProfile,
      statistics: {
        products: productCount || 0,
        competitors: competitorCount || 0,
        scrapers: scraperCount || 0,
        integrations: integrationCount || 0
      },
      recentActivity: recentActivity || [],
      communications: communications || []
    });

  } catch (error) {
    console.error('Error in admin user detail API:', error);

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

// PUT /api/admin/users/[userId] - Update user information (Super Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Validate super admin access
    await validateAdminApiAccess('super_admin');

    const { userId } = await params;
    const body = await request.json();
    const { subscription_tier, is_suspended, admin_role } = body;

    const supabase = createSupabaseAdminClient();

    // Build update object
    const updateData: UserUpdateData = {
      updated_at: new Date().toISOString()
    };

    if (subscription_tier !== undefined) {
      updateData.subscription_tier = subscription_tier;
    }

    if (is_suspended !== undefined) {
      updateData.is_suspended = is_suspended;
    }

    if (admin_role !== undefined) {
      updateData.admin_role = admin_role;
    }

    // Update user profile
    const { data: updatedUser, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    });

  } catch (error) {
    console.error('Error in admin user update API:', error);

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
