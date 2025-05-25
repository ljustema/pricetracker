import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AdminRole = 'super_admin' | 'support_admin';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  adminRole: AdminRole;
  isSuspended: boolean;
}

/**
 * Check if the current user is an admin and return their admin role
 * Redirects to login if not authenticated, or to not-authorized if not an admin
 */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth-routes/login");
  }

  const supabase = createSupabaseAdminClient();

  // Get user profile with admin role
  const { data: userProfile, error } = await supabase
    .from('user_profiles')
    .select('admin_role, is_suspended, email, name')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile for admin check:', error);
    redirect("/app-routes/dashboard");
  }

  if (!userProfile?.admin_role || userProfile.is_suspended) {
    redirect("/app-routes/not-authorized");
  }

  return {
    id: session.user.id,
    email: userProfile.email || session.user.email || '',
    name: userProfile.name || session.user.name || '',
    adminRole: userProfile.admin_role as AdminRole,
    isSuspended: userProfile.is_suspended || false,
  };
}

/**
 * Check if the current user is a super admin
 */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const adminUser = await requireAdmin();

  if (adminUser.adminRole !== 'super_admin') {
    redirect("/app-routes/not-authorized");
  }

  return adminUser;
}

/**
 * Check if the current user has admin access (either super_admin or support_admin)
 * Returns null if not an admin, otherwise returns the admin user
 */
export async function checkAdminAccess(): Promise<AdminUser | null> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return null;
    }

    const supabase = createSupabaseAdminClient();

    // Get user profile with admin role
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('admin_role, is_suspended, email, name')
      .eq('id', session.user.id)
      .single();

    if (error || !userProfile?.admin_role || userProfile.is_suspended) {
      return null;
    }

    return {
      id: session.user.id,
      email: userProfile.email || session.user.email || '',
      name: userProfile.name || session.user.name || '',
      adminRole: userProfile.admin_role as AdminRole,
      isSuspended: userProfile.is_suspended || false,
    };
  } catch (error) {
    console.error('Error checking admin access:', error);
    return null;
  }
}

/**
 * Validate admin role for API endpoints
 * Returns the admin user if valid, throws error if not
 */
export async function validateAdminApiAccess(requiredRole?: AdminRole): Promise<AdminUser> {
  const adminUser = await checkAdminAccess();

  if (!adminUser) {
    throw new Error('Unauthorized: Admin access required');
  }

  if (requiredRole && adminUser.adminRole !== requiredRole) {
    throw new Error(`Unauthorized: ${requiredRole} role required`);
  }

  return adminUser;
}

/**
 * Check if a user has permission to perform a specific action
 */
export function hasPermission(adminRole: AdminRole, action: string): boolean {
  const permissions = {
    super_admin: [
      'view_users',
      'edit_users',
      'suspend_users',
      'change_subscriptions',
      'view_stats',
      'send_emails',
      'view_communication_logs',
      'manage_scheduling',
      'system_admin'
    ],
    support_admin: [
      'view_users',
      'view_stats',
      'send_emails',
      'view_communication_logs'
    ]
  };

  return permissions[adminRole]?.includes(action) || false;
}
