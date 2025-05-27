"use client";

import { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface NotificationBadgeProps {
  className?: string;
  showIcon?: boolean;
  showTooltip?: boolean;
}

export function NotificationBadge({
  className = '',
  showIcon = true,
  showTooltip = true
}: NotificationBadgeProps) {
  const { data: session, status } = useSession();
  const { unreadCount, isLoading, requestNotificationPermission, hasNotificationPermission } = useNotifications();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted before rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't show anything if user is not authenticated or not mounted
  if (!isMounted || status !== 'authenticated' || !session?.user) {
    return null;
  }

  // Get admin status directly from session
  const isAdmin = session.user.isAdmin || false;

  const handleClick = () => {
    const redirectUrl = isAdmin ? '/app-routes/admin/communication' : '/app-routes/support';
    router.push(redirectUrl);
  };

  const handleRequestPermission = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await requestNotificationPermission();
  };

  const badgeContent = (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="relative p-2 hover:bg-gray-100"
        disabled={isLoading}
      >
        {showIcon && (
          <>
            {unreadCount > 0 ? (
              <BellRing className="h-5 w-5 text-blue-600" />
            ) : (
              <Bell className="h-5 w-5 text-gray-600" />
            )}
          </>
        )}

        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold min-w-[20px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Browser notification permission prompt */}
      {!hasNotificationPermission && unreadCount > 0 && (
        <div className="absolute top-full right-0 mt-2 z-50">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
            <p className="text-sm text-gray-600 mb-2">
              Enable browser notifications to get alerts for new messages
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRequestPermission}
              className="w-full"
            >
              Enable Notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
              : 'No new messages'
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simplified version for use in navigation bars
export function SimpleNotificationBadge({ className = '' }: { className?: string }) {
  const { data: session, status } = useSession();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted before rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't show anything if user is not authenticated or not mounted
  if (!isMounted || status !== 'authenticated' || !session?.user) {
    return null;
  }

  if (unreadCount === 0) {
    return null;
  }

  // Get admin status directly from session
  const isAdmin = session.user.isAdmin || false;

  const handleClick = () => {
    const redirectUrl = isAdmin ? '/app-routes/admin/communication' : '/app-routes/support';
    router.push(redirectUrl);
  };

  return (
    <Badge
      variant="destructive"
      className={`cursor-pointer hover:bg-red-600 ${className}`}
      onClick={handleClick}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}

// Text-only version for use in menus
export function NotificationText({ className = '' }: { className?: string }) {
  const { data: session, status } = useSession();
  const { unreadCount } = useNotifications();

  // Don't show anything if user is not authenticated
  if (status !== 'authenticated' || !session?.user) {
    return null;
  }

  if (unreadCount === 0) {
    return (
      <span className={`text-gray-500 ${className}`}>
        No new messages
      </span>
    );
  }

  return (
    <span className={`text-blue-600 font-medium ${className}`}>
      {unreadCount} new message{unreadCount > 1 ? 's' : ''}
    </span>
  );
}
