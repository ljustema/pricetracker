"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";

export default function InsightsHeader() {
  const [isRefreshingStatistics, setIsRefreshingStatistics] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Function to check refresh status
  const checkRefreshStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/insights/refresh-statistics-status');
      if (response.ok) {
        const data = await response.json();
        return data.status?.is_refreshing || false;
      }
    } catch (error) {
      console.error('[FRONTEND] Error checking refresh status:', error);
    }
    return false;
  };

  // Function to refresh brand statistics
  const handleRefreshStatistics = async () => {
    setIsRefreshingStatistics(true);
    setRefreshMessage(null);

    try {
      console.log('[FRONTEND] Starting statistics refresh');
      const response = await fetch('/api/insights/refresh-statistics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      // Handle 202 Accepted - refresh started in background
      if (response.status === 202) {
        console.log('[FRONTEND] Refresh started in background (202 Accepted)');
        setRefreshMessage({
          type: 'success',
          text: `⏳ Refresh started in background. This may take several minutes. Checking status...`
        });

        // Poll for refresh completion
        let isStillRefreshing = true;
        let pollCount = 0;
        const maxPolls = 120; // 2 minutes of polling (1 second intervals)

        const pollInterval = setInterval(async () => {
          pollCount++;
          isStillRefreshing = await checkRefreshStatus();

          if (!isStillRefreshing || pollCount >= maxPolls) {
            clearInterval(pollInterval);

            if (isStillRefreshing && pollCount >= maxPolls) {
              console.log('[FRONTEND] Refresh still in progress after 2 minutes, reloading anyway');
            } else {
              console.log('[FRONTEND] Refresh completed, reloading page');
            }

            setRefreshMessage({
              type: 'success',
              text: `✅ Refresh completed! Reloading page...`
            });

            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }, 1000);

        return;
      }

      if (!response.ok) {
        throw new Error(data.details || 'Failed to refresh statistics');
      }

      setRefreshMessage({
        type: 'success',
        text: `✅ Statistics updated successfully`
      });

      // Clear message after 3 seconds
      setTimeout(() => setRefreshMessage(null), 3000);

      // Reload the page to show updated statistics
      window.location.reload();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FRONTEND] Error refreshing statistics:', error);
      setRefreshMessage({
        type: 'error',
        text: `❌ Failed to refresh statistics: ${errorMessage}`
      });
    } finally {
      setIsRefreshingStatistics(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Insights</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleRefreshStatistics}
            disabled={isRefreshingStatistics}
            className="flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            title="Refresh brand statistics from the latest data"
          >
            <RefreshCwIcon className={`h-4 w-4 mr-2 ${isRefreshingStatistics ? 'animate-spin' : ''}`} />
            {isRefreshingStatistics ? "Updating..." : "Update Insights"}
          </button>
        </div>
      </div>

      {/* Refresh message notification */}
      {refreshMessage && (
        <div className={`mt-4 p-3 rounded-md text-sm font-medium ${
          refreshMessage.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {refreshMessage.text}
        </div>
      )}
    </div>
  );
}

