"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MessageSquare, Calendar, User } from "lucide-react";

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

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  onConversationSelect: (conversationId: string) => void;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
}

export function ConversationList({
  conversations,
  loading,
  onConversationSelect,
  getStatusColor,
  getPriorityColor
}: ConversationListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'scraper_request':
        return '🔧';
      case 'technical':
        return '⚙️';
      case 'billing':
        return '💳';
      case 'feature_request':
        return '💡';
      default:
        return '💬';
    }
  };

  const formatCategory = (category: string) => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your conversations...</span>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets yet</h3>
        <p className="text-gray-500 mb-4">
          Create your first support ticket to get help with your PriceTracker account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Your Support Tickets ({conversations.length})</h3>
      </div>

      <div className="space-y-3">
        {conversations.map((conversation) => (
          <Card 
            key={conversation.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onConversationSelect(conversation.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header with title and badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getCategoryIcon(conversation.category)}</span>
                    <h4 className="font-semibold text-gray-900 truncate flex-1">
                      {conversation.subject}
                    </h4>
                    {conversation.unread_count > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conversation.unread_count} new
                      </Badge>
                    )}
                  </div>

                  {/* Status and priority badges */}
                  <div className="flex items-center gap-2 mb-3">
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

                  {/* Latest message preview */}
                  {conversation.latest_message && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {conversation.latest_message.sender_type === 'admin' ? 'Support Team' : 'You'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(conversation.latest_message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {conversation.latest_message.message_content}
                      </p>
                    </div>
                  )}

                  {/* Footer with metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created {formatDate(conversation.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span>Last updated {formatDate(conversation.updated_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <div className="ml-4 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConversationSelect(conversation.id);
                    }}
                  >
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
