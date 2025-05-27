"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, User, Search } from "lucide-react";
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
}

interface EmailComposerProps {
  adminUser: AdminUser;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome Message",
    subject: "Welcome to PriceTracker!",
    content: `Hello {{name}},

Welcome to PriceTracker! We're excited to have you on board.

Your account is now active and you can start tracking competitor prices right away.

If you have any questions, feel free to reach out to our support team.

Best regards,
The PriceTracker Team`
  },
  {
    id: "account_issue",
    name: "Account Issue",
    subject: "Important: Account Update Required",
    content: `Hello {{name}},

We've noticed an issue with your account that requires your attention.

Please log in to your account and review the details in your dashboard.

If you need assistance, please contact our support team.

Best regards,
The PriceTracker Team`
  },
  {
    id: "feature_announcement",
    name: "Feature Announcement",
    subject: "New Feature: Enhanced Price Tracking",
    content: `Hello {{name}},

We're excited to announce a new feature that will help you track prices even more effectively.

[Feature details here]

This feature is now available in your dashboard.

Best regards,
The PriceTracker Team`
  }
];

export function EmailComposer({ adminUser }: EmailComposerProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Search for users
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const users = await response.json();
        setSearchResults(users.slice(0, 10)); // Limit to 10 results
      }
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Failed to search users");
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearch) {
        searchUsers(userSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch]);

  // Apply email template
  const applyTemplate = (templateId: string) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setContent(template.content);
    }
  };

  // Replace template variables
  const processContent = (text: string, user: User) => {
    return text
      .replace(/\{\{name\}\}/g, user.name || "User")
      .replace(/\{\{email\}\}/g, user.email);
  };

  // Send email
  const sendEmail = async () => {
    if (!selectedUser || !subject.trim() || !content.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSending(true);
    try {
      const processedContent = processContent(content, selectedUser);

      const response = await fetch("/api/admin/communication/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: selectedUser.id,
          subject,
          content: processedContent,
        }),
      });

      if (response.ok) {
        toast.success("Email sent successfully!");
        // Reset form
        setSelectedUser(null);
        setUserSearch("");
        setSubject("");
        setContent("");
        setSelectedTemplate("");
      } else {
        const error = await response.json();
        toast.error(error.details || error.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Select Recipient
          </CardTitle>
          <CardDescription>
            Search and select a user to send an email to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onClick={() => {
                    setSelectedUser(user);
                    setUserSearch(user.name || user.email);
                    setSearchResults([]);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <Badge variant="outline">{user.subscription_tier}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected User */}
          {selectedUser && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                <strong>Selected:</strong> {selectedUser.name} ({selectedUser.email})
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    setSelectedUser(null);
                    setUserSearch("");
                  }}
                >
                  Change
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Email Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Email Template (Optional)</CardTitle>
          <CardDescription>
            Choose a pre-made template or compose your own email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTemplate} onValueChange={(value) => {
            setSelectedTemplate(value);
            if (value) {
              applyTemplate(value);
            }
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Email Composition */}
      <Card>
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
          <CardDescription>
            Write your email content. Use {`{{name}}`} and {`{{email}}`} for personalization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>

          <div>
            <Label htmlFor="content">Message Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message..."
              rows={10}
            />
          </div>

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-gray-600">
              From: {adminUser.name} ({adminUser.email})
            </div>
            <Button
              onClick={sendEmail}
              disabled={!selectedUser || !subject.trim() || !content.trim() || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
