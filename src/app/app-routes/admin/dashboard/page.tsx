import { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Crown, 
  Shield, 
  UserX,
  TrendingUp,
  Calendar,
  MessageSquare
} from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Dashboard - PriceTracker",
  description: "Administrative dashboard for PriceTracker",
};

interface UserStats {
  total_users: number;
  active_users_last_30_days: number;
  new_users_last_30_days: number;
  free_users: number;
  premium_users: number;
  enterprise_users: number;
  suspended_users: number;
}

export default async function AdminDashboardPage() {
  const adminUser = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // Fetch user statistics
  const { data: userStats, error: statsError } = await supabase
    .rpc('get_admin_user_stats') as { data: UserStats[] | null, error: unknown };

  const stats = userStats?.[0] || {
    total_users: 0,
    active_users_last_30_days: 0,
    new_users_last_30_days: 0,
    free_users: 0,
    premium_users: 0,
    enterprise_users: 0,
    suspended_users: 0,
  };

  if (statsError) {
    console.error('Error fetching user stats:', statsError);
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.total_users.toLocaleString(),
      description: "All registered users",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Active Users (30d)",
      value: stats.active_users_last_30_days.toLocaleString(),
      description: "Users active in last 30 days",
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "New Users (30d)",
      value: stats.new_users_last_30_days.toLocaleString(),
      description: "New signups in last 30 days",
      icon: UserPlus,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Free Users",
      value: stats.free_users.toLocaleString(),
      description: "Users on free plan",
      icon: Users,
      color: "text-gray-600",
      bgColor: "bg-gray-50"
    },
    {
      title: "Premium Users",
      value: stats.premium_users.toLocaleString(),
      description: "Users on premium plan",
      icon: Crown,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Enterprise Users",
      value: stats.enterprise_users.toLocaleString(),
      description: "Users on enterprise plan",
      icon: Shield,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    }
  ];

  if (stats.suspended_users > 0) {
    statCards.push({
      title: "Suspended Users",
      value: stats.suspended_users.toLocaleString(),
      description: "Currently suspended accounts",
      icon: UserX,
      color: "text-red-600",
      bgColor: "bg-red-50"
    });
  }

  const quickActions = [
    {
      title: "Manage Users",
      description: "View and manage user accounts",
      href: "/app-routes/admin/users",
      icon: Users,
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      title: "Scheduling Dashboard",
      description: "Monitor automated tasks and jobs",
      href: "/app-routes/admin/scheduling",
      icon: Calendar,
      color: "bg-green-500 hover:bg-green-600"
    },
    {
      title: "Communication Logs",
      description: "View admin communication history",
      href: "/app-routes/admin/communication",
      icon: MessageSquare,
      color: "bg-purple-500 hover:bg-purple-600"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {adminUser.name}. Here's an overview of your system.
        </p>
      </div>

      {/* User Statistics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">User Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{action.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${action.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button asChild className="w-full">
                      <Link href={action.href}>
                        Open
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Admin Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Admin Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Admin Role:</span>
              <Badge variant={adminUser.adminRole === 'super_admin' ? 'default' : 'secondary'}>
                {adminUser.adminRole === 'super_admin' ? 'Super Admin' : 'Support Admin'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Email:</span>
              <span className="text-sm font-medium">{adminUser.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Access Level:</span>
              <span className="text-sm font-medium">
                {adminUser.adminRole === 'super_admin' ? 'Full Access' : 'Support Access'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
