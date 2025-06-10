import { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { notFound } from "next/navigation";
import { UserDetailsView } from "@/components/admin/UserDetailsView";

export const metadata: Metadata = {
  title: "User Details - Admin Panel",
  description: "View and manage individual user account",
};

interface UserDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  // Require admin access
  const adminUser = await requireAdmin();

  // Await params
  const { userId } = await params;

  // Validate userId format (basic UUID check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    notFound();
  }

  // Fetch user data directly from Supabase instead of API call
  // This avoids issues with API calls in server components
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
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
    console.error('Error fetching user profile:', profileError);
    notFound();
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
  const { data: recentActivity, error: _activityError } = await supabase
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

  // Get communication history
  const { data: communications, error: _commError } = await supabase
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

  const userData = {
    user: userProfile,
    statistics: {
      products: productCount || 0,
      competitors: competitorCount || 0,
      scrapers: scraperCount || 0,
      integrations: integrationCount || 0
    },
    recentActivity: (recentActivity || []).map(activity => ({
      ...activity,
      products: {
        name: (activity.products as unknown as { name: string }[])[0]?.name || 'Unknown Product'
      }
    })),
    communications: communications || []
  };

  return (
    <div className="space-y-6">
      <UserDetailsView
        userData={userData}
        adminUser={adminUser}
        userId={userId}
      />
    </div>
  );
}
