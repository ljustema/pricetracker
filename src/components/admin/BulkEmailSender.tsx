"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Users, Filter, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  adminRole: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  is_suspended: boolean;
}

interface BulkEmailSenderProps {
  adminUser: AdminUser;
}

interface UserFilters {
  subscriptionTiers: string[];
  includeSuspended: boolean;
}

export function BulkEmailSender({ adminUser }: BulkEmailSenderProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [filters, setFilters] = useState<UserFilters>({
    subscriptionTiers: ["free", "basic", "premium"],
    includeSuspended: false,
  });

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users?limit=1000"); // Get all users for bulk operations
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Apply filters
  useEffect(() => {
    const filtered = users.filter(user => {
      // Filter by subscription tier
      if (!filters.subscriptionTiers.includes(user.subscription_tier)) {
        return false;
      }

      // Filter by suspension status
      if (!filters.includeSuspended && user.is_suspended) {
        return false;
      }

      return true;
    });

    setFilteredUsers(filtered);
    // Clear selected users that are no longer in filtered results
    setSelectedUsers(prev => {
      const newSelected = new Set<string>();
      prev.forEach(userId => {
        if (filtered.some(user => user.id === userId)) {
          newSelected.add(userId);
        }
      });
      return newSelected;
    });
  }, [users, filters]);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  };

  // Select all filtered users
  const selectAllUsers = () => {
    setSelectedUsers(new Set(filteredUsers.map(user => user.id)));
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedUsers(new Set());
  };

  // Toggle subscription tier filter
  const toggleSubscriptionTier = (tier: string) => {
    setFilters(prev => ({
      ...prev,
      subscriptionTiers: prev.subscriptionTiers.includes(tier)
        ? prev.subscriptionTiers.filter(t => t !== tier)
        : [...prev.subscriptionTiers, tier]
    }));
  };

  // Send bulk emails
  const sendBulkEmails = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (!subject.trim() || !content.trim()) {
      toast.error("Please fill in subject and content");
      return;
    }

    setIsSending(true);
    setSendingProgress(0);

    try {
      const selectedUserIds = Array.from(selectedUsers);
      const response = await fetch("/api/admin/communication/send-bulk-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds: selectedUserIds,
          subject,
          content,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Bulk email sent to ${result.successCount} users`);
        if (result.failureCount > 0) {
          toast.warning(`${result.failureCount} emails failed to send`);
        }

        // Reset form
        setSubject("");
        setContent("");
        setSelectedUsers(new Set());
      } else {
        const error = await response.json();
        toast.error(error.details || error.error || "Failed to send bulk emails");
      }
    } catch (error) {
      console.error("Error sending bulk emails:", error);
      toast.error("Failed to send bulk emails");
    } finally {
      setIsSending(false);
      setSendingProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            User Filters
          </CardTitle>
          <CardDescription>
            Filter users by subscription tier and status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Subscription Tiers</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["free", "basic", "premium"].map((tier) => (
                <div key={tier} className="flex items-center space-x-2">
                  <Checkbox
                    id={tier}
                    checked={filters.subscriptionTiers.includes(tier)}
                    onCheckedChange={() => toggleSubscriptionTier(tier)}
                  />
                  <Label htmlFor={tier} className="capitalize">{tier}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeSuspended"
              checked={filters.includeSuspended}
              onCheckedChange={(checked) =>
                setFilters(prev => ({ ...prev, includeSuspended: !!checked }))
              }
            />
            <Label htmlFor="includeSuspended">Include suspended users</Label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-gray-600">
              {filteredUsers.length} users match your filters
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={selectAllUsers}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearAllSelections}>
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Select Recipients
            </div>
            <Badge variant="secondary">
              {selectedUsers.size} selected
            </Badge>
          </CardTitle>
          <CardDescription>
            Choose which users to send the email to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No users match your filters.
              </div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="capitalize">
                        {user.subscription_tier}
                      </Badge>
                      {user.is_suspended && (
                        <Badge variant="destructive">Suspended</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Composition */}
      <Card>
        <CardHeader>
          <CardTitle>Compose Bulk Email</CardTitle>
          <CardDescription>
            Write your email content. Use {`{{name}}`} and {`{{email}}`} for personalization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bulk-subject">Subject *</Label>
            <Input
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>

          <div>
            <Label htmlFor="bulk-content">Message Content *</Label>
            <Textarea
              id="bulk-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message..."
              rows={8}
            />
          </div>

          {selectedUsers.size > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This email will be sent to <strong>{selectedUsers.size}</strong> users.
                Please review your message carefully before sending.
              </AlertDescription>
            </Alert>
          )}

          {isSending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Sending emails...</span>
                <span>{Math.round(sendingProgress)}%</span>
              </div>
              <Progress value={sendingProgress} />
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-gray-600">
              From: {adminUser.name} ({adminUser.email})
            </div>
            <Button
              onClick={sendBulkEmails}
              disabled={selectedUsers.size === 0 || !subject.trim() || !content.trim() || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {selectedUsers.size} Users
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
