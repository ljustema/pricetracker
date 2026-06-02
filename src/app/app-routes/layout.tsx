import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import Link from "next/link";
import UserMenu from "@/components/layout/user-menu";
import PageTitle from "@/components/layout/page-title";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { checkAdminAccess } from "@/lib/admin/auth";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current user from the session
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/auth-routes/login");
  }

  // Check if user has admin access
  const adminUser = await checkAdminAccess();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-shrink-0 bg-indigo-700 shadow-lg md:flex md:flex-col">
        <div className="flex h-16 flex-shrink-0 items-center px-4">
          <Link href="/app-routes/dashboard" className="flex items-center">
            <span className="text-xl font-bold text-white">PriceTracker</span>
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="flex-1 space-y-1 px-2 py-4">
            <Link
              href="/app-routes/dashboard"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/app-routes/competitors"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Competitors
            </Link>
            <Link
              href="/app-routes/suppliers"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Suppliers
            </Link>
            <Link
              href="/app-routes/products"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Products
            </Link>
            <Link
              href="/app-routes/brands"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Brands
            </Link>
            <Link
              href="/app-routes/insights"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Insights
            </Link>
            <Link
              href="/app-routes/scrapers"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              Scrapers
            </Link>

            <Link
              href="/app-routes/integrations"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Integrations
            </Link>

            <Link
              href="/app-routes/custom-fields"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Custom Fields
            </Link>

            <Link
              href="/app-routes/support"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Support
            </Link>

            <Link
              href="/app-routes/settings"
              className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
            >
              <svg
                className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </Link>

            {/* Admin Panel Link - Only show for admin users */}
            {adminUser && (
              <div className="mt-4 pt-4 border-t border-indigo-600">
                <Link
                  href="/app-routes/admin/dashboard"
                  className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white bg-indigo-800"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Admin Panel
                </Link>
              </div>
            )}
          </nav>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <MobileSidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white shadow">
          <div className="flex flex-1 justify-between px-4">
            <div className="flex flex-1">
              {/* Page title display */}
              <div className="flex w-full md:ml-0 items-center">
                <PageTitle />
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Notification Badge */}
              <NotificationBadge />

              {/* Profile dropdown */}
              <UserMenu user={session.user} />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}