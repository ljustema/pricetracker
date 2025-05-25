'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, Eye, UserX, Crown, Shield } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  admin_role: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

interface UserTableProps {
  searchParams: {
    page?: string;
    limit?: string;
    search?: string;
    subscription?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

export function UserTable({ searchParams }: UserTableProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.search || '');
  const [subscriptionFilter, setSubscriptionFilter] = useState(searchParams.subscription || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.status || 'all');

  // Fetch users data
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (searchParams.page) params.set('page', searchParams.page);
      if (searchParams.limit) params.set('limit', searchParams.limit);
      if (searchParams.search) params.set('search', searchParams.search);
      if (searchParams.subscription && searchParams.subscription !== 'all') params.set('subscription', searchParams.subscription);
      if (searchParams.status && searchParams.status !== 'all') params.set('status', searchParams.status);
      if (searchParams.sortBy) params.set('sortBy', searchParams.sortBy);
      if (searchParams.sortOrder) params.set('sortOrder', searchParams.sortOrder);

      const response = await fetch(`/api/admin/users?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchParams]);

  // Update URL with new search params
  const updateSearchParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(urlSearchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filtering
    if (newParams.search !== undefined || newParams.subscription !== undefined || newParams.status !== undefined) {
      params.set('page', '1');
    }

    router.push(`/app-routes/admin/users?${params.toString()}`);
  };

  // Handle search
  const handleSearch = () => {
    updateSearchParams({ search: searchQuery });
  };

  // Handle filter changes
  const handleSubscriptionFilter = (value: string) => {
    setSubscriptionFilter(value);
    updateSearchParams({ subscription: value === 'all' ? '' : value });
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    updateSearchParams({ status: value === 'all' ? '' : value });
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: newPage.toString() });
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get subscription badge variant
  const getSubscriptionBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge variant="default" className="bg-yellow-500"><Crown className="h-3 w-3 mr-1" />Premium</Badge>;
      case 'enterprise':
        return <Badge variant="default" className="bg-purple-500"><Shield className="h-3 w-3 mr-1" />Enterprise</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  // Get admin role badge
  const getAdminBadge = (role: string | null) => {
    if (!role) return null;

    return (
      <Badge variant="destructive" className="ml-2">
        {role === 'super_admin' ? 'Super Admin' : 'Support Admin'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Select value={subscriptionFilter} onValueChange={handleSubscriptionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Subscription" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center">
                        {user.name || 'No name'}
                        {getAdminBadge(user.admin_role)}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getSubscriptionBadge(user.subscription_tier)}
                  </TableCell>
                  <TableCell>
                    {user.is_suspended ? (
                      <Badge variant="destructive" className="flex items-center w-fit">
                        <UserX className="h-3 w-3 mr-1" />
                        Suspended
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app-routes/admin/users/${user.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} users
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
