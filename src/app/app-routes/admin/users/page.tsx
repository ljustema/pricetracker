import { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { Suspense } from "react";
import { UserTable } from "@/components/admin/UserTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "User Management - Admin Panel",
  description: "Manage user accounts and permissions",
};

interface SearchParams {
  page?: string;
  limit?: string;
  search?: string;
  subscription?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Require admin access
  await requireAdmin();

  // Await searchParams
  const resolvedSearchParams = await searchParams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="h-6 w-6 mr-2" />
          User Management
        </h1>
        <p className="text-gray-600">
          View and manage user accounts, subscriptions, and permissions.
        </p>
      </div>

      {/* User Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Search, filter, and manage user accounts across your platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="p-8 text-center">Loading users...</div>}>
            <UserTable searchParams={resolvedSearchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
