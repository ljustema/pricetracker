"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { NewTicketForm } from "./NewTicketForm";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface SupportDashboardProps {
  user: User;
}

interface Conversation {
  id: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  unread_count: number;
  latest_message?: {
    id: string;
    message_content: string;
    sender_type: string;
    created_at: string;
  };
}

export default function SupportDashboard({ user }: SupportDashboardProps) {
  const [activeTab, setActiveTab] = useState("conversations");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    unread: 0
  });

  const { unreadCount, markAsViewed, refreshNotifications } = useNotifications();

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/support/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);

        // Calculate stats
        const total = data.conversations.length;
        const open = data.conversations.filter((c: Conversation) => c.status === 'open').length;
        const resolved = data.conversations.filter((c: Conversation) => c.status === 'resolved').length;
        const unread = data.conversations.reduce((sum: number, c: Conversation) => sum + c.unread_count, 0);

        setStats({ total, open, resolved, unread });
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    // Mark notifications as viewed when user visits support page
    const markViewed = async () => {
      await markAsViewed();
    };
    markViewed();
  }, [markAsViewed]);

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setActiveTab("conversation");
  };

  const handleNewTicket = () => {
    setSelectedConversation(null);
    setActiveTab("new-ticket");
  };

  const handleTicketCreated = (conversation: Conversation) => {
    setConversations(prev => [conversation, ...prev]);
    setSelectedConversation(conversation.id);
    setActiveTab("conversation");
    refreshNotifications();
  };

  const handleMessageSent = () => {
    fetchConversations();
    refreshNotifications();
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
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-6 w-6 mr-2" />
            Support Center
          </h1>
          <p className="text-gray-600">
            Get help with your PriceTracker account and manage your support tickets.
          </p>
        </div>
        <Button onClick={handleNewTicket} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{stats.open}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unread Messages</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>
            View your support conversations and create new tickets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conversations">
                <MessageSquare className="h-4 w-4 mr-2" />
                My Tickets
                {stats.unread > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {stats.unread}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="new-ticket">
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </TabsTrigger>
              <TabsTrigger value="conversation" disabled={!selectedConversation}>
                View Conversation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversations" className="mt-6">
              <ConversationList
                conversations={conversations}
                loading={loading}
                onConversationSelect={handleConversationSelect}
                getStatusColor={getStatusColor}
                getPriorityColor={getPriorityColor}
              />
            </TabsContent>

            <TabsContent value="new-ticket" className="mt-6">
              <NewTicketForm
                user={user}
                onTicketCreated={handleTicketCreated}
              />
            </TabsContent>

            <TabsContent value="conversation" className="mt-6">
              {selectedConversation && (
                <ConversationView
                  conversationId={selectedConversation}
                  user={user}
                  onMessageSent={handleMessageSent}
                  onBack={() => setActiveTab("conversations")}
                  getStatusColor={getStatusColor}
                  getPriorityColor={getPriorityColor}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
