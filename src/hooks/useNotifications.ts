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

  const checkForNewMessages = useCallback(async () => {
    // Only check if user is authenticated
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/support/unread-count', {
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
        toast.info(
          `You have ${newMessages} new message${newMessages > 1 ? 's' : ''}`,
          {
            action: {
              label: 'View',
              onClick: () => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/app-routes/support';
                }
              },
            },
            duration: 5000,
          }
        );

        // Request browser notification permission and show notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New Support Message', {
            body: `You have ${newMessages} new message${newMessages > 1 ? 's' : ''} in your support conversations.`,
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
  }, [session, status, unreadCount]);

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
  const markAsViewed = useCallback(() => {
    setUnreadCount(0);
  }, []);

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
