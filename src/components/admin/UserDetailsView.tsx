'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminUser } from '@/lib/admin/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Calendar, 
  Crown, 
  Shield, 
  UserX, 
  UserCheck,
  Package,
  Users,
  Bot,
  Zap,
  Activity,
  MessageSquare
} from 'lucide-react';
import { SubscriptionEditor } from './SubscriptionEditor';
import { UserStatusEditor } from './UserStatusEditor';

interface UserData {
  user: {
    id: string;
    name: string;
    email: string;
    subscription_tier: string;
    admin_role: string | null;
    is_suspended: boolean;
    created_at: string;
    updated_at: string;
  };
  statistics: {
    products: number;
    competitors: number;
    scrapers: number;
    integrations: number;
  };
  recentActivity: Array<{
    id: string;
    old_price: number;
    new_price: number;
    changed_at: string;
    products: {
      name: string;
    };
  }>;
  communications: Array<{
    id: string;
    subject: string;
    communication_type: string;
    sent_at: string;
    status: string;
  }>;
}

interface UserDetailsViewProps {
  userData: UserData;
  adminUser: AdminUser;
  userId: string;
}

export function UserDetailsView({ userData, adminUser, userId }: UserDetailsViewProps) {
  const { user, statistics, recentActivity, communications } = userData;
  const [isUpdating, setIsUpdating] = useState(false);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format price
  const formatPrice = (price: number, currencyCode: string = 'SEK') => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currencyCode
    }).format(price);
  };

  // Get subscription badge
  const getSubscriptionBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-yellow-500"><Crown className="h-3 w-3 mr-1" />Premium</Badge>;
      case 'enterprise':
        return <Badge className="bg-purple-500"><Shield className="h-3 w-3 mr-1" />Enterprise</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  // Get admin role badge
  const getAdminBadge = (role: string | null) => {
    if (!role) return null;
    
    return (
      <Badge variant="destructive">
        {role === 'super_admin' ? 'Super Admin' : 'Support Admin'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" asChild>
            <Link href="/app-routes/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <User className="h-6 w-6 mr-2" />
              {user.name || 'No name'}
              {getAdminBadge(user.admin_role)}
            </h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {user.is_suspended ? (
            <Badge variant="destructive" className="flex items-center">
              <UserX className="h-3 w-3 mr-1" />
              Suspended
            </Badge>
          ) : (
            <Badge className="bg-green-500 flex items-center">
              <UserCheck className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
          {getSubscriptionBadge(user.subscription_tier)}
        </div>
      </div>

      {/* User Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Products</p>
                <p className="text-2xl font-bold">{statistics.products}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Competitors</p>
                <p className="text-2xl font-bold">{statistics.competitors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bot className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scrapers</p>
                <p className="text-2xl font-bold">{statistics.scrapers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Integrations</p>
                <p className="text-2xl font-bold">{statistics.integrations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile Info</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          {adminUser.adminRole === 'super_admin' && (
            <TabsTrigger value="admin">Admin Actions</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>User account details and metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">User ID</label>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">{user.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-sm">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p className="text-sm">{user.name || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Subscription Tier</label>
                  <div className="mt-1">{getSubscriptionBadge(user.subscription_tier)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Account Created</label>
                  <p className="text-sm">{formatDate(user.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-sm">{formatDate(user.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest price changes and user actions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price Change</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">
                          {activity.products.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">{formatPrice(activity.old_price)}</span>
                            <span>→</span>
                            <span className="font-medium">{formatPrice(activity.new_price)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(activity.changed_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-gray-500 text-center py-8">No recent activity found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Communication History
              </CardTitle>
              <CardDescription>Messages sent to this user by admins</CardDescription>
            </CardHeader>
            <CardContent>
              {communications.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communications.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell className="font-medium">{comm.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{comm.communication_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={comm.status === 'sent' ? 'default' : 'destructive'}>
                            {comm.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(comm.sent_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-gray-500 text-center py-8">No communications found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {adminUser.adminRole === 'super_admin' && (
          <TabsContent value="admin">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SubscriptionEditor user={user} onUpdate={() => window.location.reload()} />
              <UserStatusEditor user={user} onUpdate={() => window.location.reload()} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
