"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface NotificationData {
  count: number;
  lastCheck: string;
}

export function useNotifications() {
  const { data: session, status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  const checkAdminStatus = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) {
      setIsAdmin(false);
      return;
    }

    try {
      // Use a lightweight admin check - just try to access admin auth validation
      const response = await fetch('/api/admin/auth/check', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // If the admin auth check responds with 200, user is an admin
      // If it responds with 403, user is not an admin
      // Any other error means we should default to non-admin
      setIsAdmin(response.status === 200);
    } catch (error) {
      setIsAdmin(false);
    }
  }, [session, status]);

  const checkForNewMessages = useCallback(async () => {
    // Only check if user is authenticated
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use admin API if user is admin, otherwise use regular user API
      const apiEndpoint = isAdmin ? '/api/admin/support/unread-count' : '/api/support/unread-count';

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data: NotificationData = await response.json();
      const previousCount = unreadCount;

      setUnreadCount(data.count);
      setLastCheck(new Date(data.lastCheck));

      // Show toast notification if count increased (new messages)
      if (data.count > previousCount && previousCount > 0) {
        const newMessages = data.count - previousCount;
        const messageType = isAdmin ? 'support message' : 'message';
        const redirectUrl = isAdmin ? '/app-routes/admin/communication' : '/app-routes/support';

        toast.info(
          `You have ${newMessages} new ${messageType}${newMessages > 1 ? 's' : ''}`,
          {
            action: {
              label: 'View',
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.location.href = redirectUrl;
                }
              },
            },
            duration: 5000,
          }
        );

        // Request browser notification permission and show notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New Support Message', {
            body: `You have ${newMessages} new ${messageType}${newMessages > 1 ? 's' : ''}.`,
            icon: '/favicon.ico',
            tag: 'support-notification',
          });
        }
      }
    } catch (err) {
      console.error('Error checking for new messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [session, status, unreadCount, isAdmin]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasNotificationPermission(granted);
      return granted;
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const granted = Notification.permission === 'granted';
      setHasNotificationPermission(granted);
      return granted;
    }
    return false;
  }, []);

  // Manual refresh function
  const refreshNotifications = useCallback(() => {
    checkForNewMessages();
  }, [checkForNewMessages]);

  // Reset unread count (call when user visits support page)
  const markAsViewed = useCallback(async () => {
    // Only mark as viewed if user is authenticated and there are unread messages
    if (status !== 'authenticated' || !session?.user || unreadCount === 0) {
      return;
    }

    try {
      // Use admin API if user is admin, otherwise use regular user API
      const apiEndpoint = isAdmin ? '/api/admin/support/mark-all-read' : '/api/support/mark-all-read';

      // Call API to mark all messages as read in database
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Only update local state if API call was successful
        setUnreadCount(0);
      } else {
        console.error('Failed to mark messages as read:', await response.text());
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [session, status, unreadCount, isAdmin]);

  // Check admin status when session changes
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  useEffect(() => {
    // Only set up polling if user is authenticated
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    // Check immediately
    checkForNewMessages();

    // Set up polling every 30 seconds
    const interval = setInterval(checkForNewMessages, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [checkForNewMessages, session, status]);

  // Check for new messages when the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && status === 'authenticated') {
        checkForNewMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkForNewMessages, status]);

  // Check notification permission on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  return {
    unreadCount,
    lastCheck,
    isLoading,
    error,
    refreshNotifications,
    markAsViewed,
    requestNotificationPermission,
    hasNotificationPermission,
  };
}
