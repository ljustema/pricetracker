"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Send,
  User,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  EyeOff
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  adminRole: string;
}

interface SupportMessage {
  id: string;
  message_content: string;
  sender_type: string;
  sender_id: string;
  is_internal: boolean;
  read_by_recipient: boolean;
  created_at: string;
  user_profiles: {
    id: string;
    name: string;
    email: string;
  };
}

interface SupportConversation {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  user_id: string;
  admin_user_id?: string;
  user_profiles: {
    id: string;
    name: string;
    email: string;
    subscription_tier: string;
  };
  admin_profiles?: {
    id: string;
    name: string;
    email: string;
  };
  support_messages: SupportMessage[];
}

interface AdminConversationViewProps {
  conversationId: string;
  adminUser: AdminUser;
  onBack: () => void;
  onUpdate?: () => void;
}

export function AdminConversationView({
  conversationId,
  adminUser,
  onBack,
  onUpdate
}: AdminConversationViewProps) {
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");

  const fetchConversation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/support/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }
      const data = await response.json();
      setConversation(data.conversation);
      setNewStatus(data.conversation.status);
      setNewPriority(data.conversation.priority);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchConversation();
  }, [conversationId, fetchConversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      const response = await fetch(`/api/admin/support/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_content: newMessage,
          is_internal: isInternal
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setNewMessage("");
      setIsInternal(false);
      await fetchConversation();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateConversation = async () => {
    if (!conversation) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/support/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          priority: newPriority,
          admin_user_id: adminUser.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }

      await fetchConversation();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating conversation:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <XCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Conversation not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              {getStatusIcon(conversation.status)}
              <span className="ml-2">{conversation.subject}</span>
            </h1>
            <p className="text-gray-600">
              Conversation with {conversation.user_profiles.name || 'No name'} ({conversation.user_profiles.email})
            </p>
          </div>
        </div>
      </div>

      {/* Conversation Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Conversation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Status:</span>
              <Badge className={getStatusColor(conversation.status)}>
                {conversation.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Priority:</span>
              <Badge className={getPriorityColor(conversation.priority)}>
                {conversation.priority}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Category:</span>
              <span className="capitalize">{conversation.category.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Created:</span>
              <span className="text-sm">{formatDate(conversation.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Last Updated:</span>
              <span className="text-sm">{formatDate(conversation.updated_at)}</span>
            </div>
            {conversation.resolved_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Resolved:</span>
                <span className="text-sm">{formatDate(conversation.resolved_at)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Name:</span>
              <span>{conversation.user_profiles.name || 'No name'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Email:</span>
              <span>{conversation.user_profiles.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Subscription:</span>
              <Badge variant="outline">
                {conversation.user_profiles.subscription_tier || 'Free'}
              </Badge>
            </div>
            {conversation.admin_profiles && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Assigned Admin:</span>
                <span>{conversation.admin_profiles.name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Update Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Update Conversation</CardTitle>
          <CardDescription>
            Change the status, priority, or assignment of this conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Priority</label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleUpdateConversation}
                disabled={updating || (newStatus === conversation.status && newPriority === conversation.priority)}
                className="w-full"
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Conversation'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            Conversation history (internal notes are only visible to admins)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {conversation.support_messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg ${
                  message.sender_type === 'admin'
                    ? message.is_internal
                      ? 'bg-purple-50 border-l-4 border-purple-500'
                      : 'bg-blue-50 border-l-4 border-blue-500'
                    : 'bg-gray-50 border-l-4 border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">
                      {message.user_profiles.name || 'No name'} ({message.user_profiles.email})
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {message.sender_type}
                    </Badge>
                    {message.is_internal && (
                      <Badge variant="secondary" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Internal
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(message.created_at)}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {message.message_content}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reply Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send Reply</CardTitle>
          <CardDescription>
            Respond to the user or add an internal note
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Type your message here..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={4}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="internal"
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                />
                <label htmlFor="internal" className="text-sm font-medium">
                  Internal note (only visible to admins)
                </label>
                {isInternal && (
                  <EyeOff className="h-4 w-4 text-purple-600" />
                )}
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {isInternal ? 'Internal Note' : 'Reply'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
