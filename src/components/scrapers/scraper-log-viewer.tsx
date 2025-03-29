"use client";

import { useState, useEffect } from "react";
// import { createClient } from "@/lib/supabase/client";
import { CalendarIcon, ClockIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from "lucide-react";

interface ScraperLogViewerProps {
  scraperId: string;
}

interface ScraperLog {
  id: string;
  scraper_id: string;
  run_at: string;
  status: 'success' | 'failed' | 'running';
  message: string;
  products_found: number;
  products_matched: number;
  products_created: number;
  duration_ms: number;
  error_message?: string;
}

export default function ScraperLogViewer({ scraperId }: ScraperLogViewerProps) {
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      
      try {
        // Commented out until needed
        // const supabase = createClient();
        
        // In a real implementation, we would fetch logs from a scraper_logs table
        // For now, we'll generate mock logs
        
        // Mock logs
        const mockLogs: ScraperLog[] = [
          {
            id: '1',
            scraper_id: scraperId,
            run_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            status: 'success',
            message: 'Scraper run completed successfully',
            products_found: 15,
            products_matched: 12,
            products_created: 3,
            duration_ms: 3245,
          },
          {
            id: '2',
            scraper_id: scraperId,
            run_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            status: 'failed',
            message: 'Scraper run failed',
            products_found: 0,
            products_matched: 0,
            products_created: 0,
            duration_ms: 1532,
            error_message: 'Network error: Failed to fetch page',
          },
          {
            id: '3',
            scraper_id: scraperId,
            run_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            status: 'success',
            message: 'Scraper run completed successfully',
            products_found: 14,
            products_matched: 14,
            products_created: 0,
            duration_ms: 2987,
          },
        ];
        
        setLogs(mockLogs);
      } catch (error) {
        console.error("Error fetching scraper logs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLogs();
  }, [scraperId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (status: 'success' | 'failed' | 'running') => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'running':
        return <AlertCircleIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Scraper Execution Logs</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          View the execution history of this scraper
        </p>
      </div>
      
      {isLoading ? (
        <div className="px-4 py-5 sm:p-6 text-center">
          <p className="text-sm text-gray-500">Loading logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="px-4 py-5 sm:p-6 text-center">
          <p className="text-sm text-gray-500">No logs found for this scraper.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {logs.map((log) => (
            <li key={log.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {getStatusIcon(log.status)}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{log.message}</div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                      <span>{formatDate(log.run_at)}</span>
                      <ClockIcon className="flex-shrink-0 mx-1.5 h-4 w-4 text-gray-400" />
                      <span>{formatTime(log.run_at)}</span>
                      <span className="mx-1.5">•</span>
                      <span>Duration: {formatDuration(log.duration_ms)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-sm text-gray-900">
                    {log.products_found} products found
                  </div>
                  <div className="text-sm text-gray-500">
                    {log.products_matched} matched, {log.products_created} created
                  </div>
                </div>
              </div>
              
              {log.error_message && (
                <div className="mt-2 ml-9">
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    Error: {log.error_message}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}