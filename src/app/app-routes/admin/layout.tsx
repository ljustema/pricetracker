import { requireAdmin } from "@/lib/admin/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserMenu from "@/components/layout/user-menu";
import {
  Users,
  BarChart3,
  Calendar,
  MessageSquare,
  Settings,
  Shield,
  Home
} from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require admin access - this will redirect if not authorized
  const adminUser = await requireAdmin();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/app-routes/admin/dashboard",
      icon: BarChart3,
      description: "Overview and statistics",
      roles: ["super_admin", "support_admin"]
    },
    {
      name: "Users",
      href: "/app-routes/admin/users",
      icon: Users,
      description: "Manage user accounts",
      roles: ["super_admin", "support_admin"]
    },
    {
      name: "Scheduling",
      href: "/app-routes/admin/scheduling",
      icon: Calendar,
      description: "Monitor automated tasks",
      roles: ["super_admin", "support_admin"]
    },
    {
      name: "Communication",
      href: "/app-routes/admin/communication",
      icon: MessageSquare,
      description: "Message history",
      roles: ["super_admin", "support_admin"]
    },
    {
      name: "Settings",
      href: "/app-routes/admin/settings",
      icon: Settings,
      description: "Admin configuration",
      roles: ["super_admin"]
    }
  ];

  // Filter navigation items based on user role
  const allowedNavItems = navigationItems.filter(item =>
    item.roles.includes(adminUser.adminRole)
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-shrink-0 bg-slate-900 shadow-lg md:flex md:flex-col">
        {/* Header */}
        <div className="flex h-16 flex-shrink-0 items-center px-4 bg-slate-800">
          <Link href="/app-routes/admin/dashboard" className="flex items-center">
            <Shield className="h-8 w-8 text-indigo-400 mr-2" />
            <span className="text-xl font-bold text-white">Admin Panel</span>
          </Link>
        </div>

        {/* Admin User Info */}
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {adminUser.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{adminUser.name}</p>
              <Badge variant="secondary" className="text-xs">
                {adminUser.adminRole === 'super_admin' ? 'Super Admin' : 'Support Admin'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="flex-1 space-y-1 px-2 py-4">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <Icon className="mr-3 h-5 w-5 text-slate-400 group-hover:text-white" />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-xs text-slate-500 group-hover:text-slate-300">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Return to App */}
          <div className="px-2 pb-4">
            <Link href="/app-routes/dashboard">
              <Button variant="outline" className="w-full text-slate-300 border-slate-600 hover:bg-slate-700">
                <Home className="mr-2 h-4 w-4" />
                Return to App
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-lg font-semibold text-gray-900">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <UserMenu user={{
                name: adminUser.name,
                email: adminUser.email,
                image: null // Admin users don't have profile images in our current setup
              }} />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
