"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, ArrowLeft, User, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  sender_type: string;
  message_content: string;
  is_internal: boolean;
  read_by_recipient: boolean;
  created_at: string;
  user_profiles?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Conversation {
  id: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  created_at: string;
  updated_at: string;
  support_messages: Message[];
}

interface ConversationViewProps {
  conversationId: string;
  user: User;
  onMessageSent: () => void;
  onBack: () => void;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
}

export function ConversationView({
  conversationId,
  user,
  onMessageSent,
  onBack,
  getStatusColor,
  getPriorityColor
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { refreshNotifications } = useNotifications();

  const fetchConversation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/support/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setConversation(data.conversation);
        // Refresh notification count since messages may have been marked as read
        refreshNotifications();
      } else {
        setError("Failed to load conversation");
      }
    } catch (err) {
      console.error('Error fetching conversation:', err);
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.support_messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/support/conversations/${conversationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setNewMessage("");
      toast.success("Message sent successfully!");
      fetchConversation(); // Refresh conversation
      onMessageSent();

    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCategory = (category: string) => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading conversation...</span>
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!conversation) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Conversation not found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tickets
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{conversation.subject}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(conversation.status)}>
                {conversation.status.replace('_', ' ')}
              </Badge>
              <Badge className={getPriorityColor(conversation.priority)}>
                {conversation.priority}
              </Badge>
              <Badge variant="outline">
                {formatCategory(conversation.category)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Created {formatDate(conversation.created_at)}
        </div>
      </div>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {conversation.support_messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    message.sender_type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      {message.sender_type === 'user'
                        ? 'You'
                        : message.user_profiles?.name || 'Support Team'
                      }
                    </span>
                    <div className="flex items-center gap-1 text-xs opacity-75">
                      <Clock className="h-3 w-3" />
                      {formatDate(message.created_at)}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    {message.message_content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* Reply Form */}
      {conversation.status !== 'closed' && (
        <Card>
          <CardHeader>
            <CardTitle>Send Reply</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSendMessage} className="space-y-4">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your reply here..."
                rows={4}
                maxLength={2000}
                disabled={isSending}
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {newMessage.length}/2000 characters
                </p>
                <Button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  className="min-w-[100px]"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {conversation.status === 'closed' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This conversation has been closed. If you need further assistance, please create a new support ticket.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
