"use client";

import { useState, useEffect, useCallback } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { CheckIcon, XIcon, LoaderIcon, ClockIcon } from "lucide-react";

interface ScraperRunProgressProps {
  scraperId: string;
  runId: string;
  onComplete?: (success: boolean, productCount: number) => void;
}

export default function ScraperRunProgress({
  scraperId,
  runId,
  onComplete,
}: ScraperRunProgressProps) {
  const [progress, setProgress] = useState<{
    status: string;
    productCount: number;
    currentBatch: number;
    totalBatches: number | null;
    elapsedTime: number;
    errorMessage: string | null;
    progressMessages: string[];
    isComplete: boolean;
  } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number>(3000); // 3 seconds
  const [consecutiveErrors, setConsecutiveErrors] = useState<number>(0);
  
  // Format elapsed time as mm:ss
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate progress percentage
  const calculateProgress = useCallback(() => {
    if (!progress) return 0;
    
    if (progress.totalBatches) {
      return Math.min(100, Math.round((progress.currentBatch / progress.totalBatches) * 100));
    }
    
    // If we don't know total batches, use a more conservative estimate
    // based on the current batch number
    if (progress.currentBatch > 0) {
      // Assume at least 5 batches, but scale up if we've seen more
      const estimatedTotal = Math.max(5, progress.currentBatch * 1.5);
      return Math.min(90, Math.round((progress.currentBatch / estimatedTotal) * 100));
    }
    
    return 0;
  }, [progress]);
  
  // Poll for status updates
  const fetchStatus = useCallback(async () => {
    try {
      const status = await ScraperClientService.getScraperRunStatus(scraperId, runId);
      setProgress(status);
      
      // Reset consecutive errors counter on success
      setConsecutiveErrors(0);
      
      // If the run is complete, call the onComplete callback
      if (status.isComplete) {
        if (onComplete) {
          onComplete(status.status === 'success', status.productCount);
        }
      }
    } catch (err) {
      console.error("Error fetching run status:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to get run status";
      setError(errorMessage);
      
      // Increment consecutive errors counter
      const newErrorCount = consecutiveErrors + 1;
      setConsecutiveErrors(newErrorCount);
      
      // If we've had too many consecutive errors, stop polling
      if (newErrorCount >= 5) {
        console.error("Too many consecutive errors, stopping polling");
        setPollingInterval(0);
        
        // If we have an onComplete callback, call it with failure
        if (onComplete) {
          onComplete(false, 0);
        }
        return;
      }
      
      // Increase polling interval on error to avoid hammering the server
      setPollingInterval(prev => Math.min(prev * 1.5, 10000));
    }
  }, [scraperId, runId, onComplete, consecutiveErrors]);
  
  // Set up polling
  useEffect(() => {
    // Don't set up polling if polling interval is 0 or if the run is already complete
    if (pollingInterval === 0 || progress?.isComplete) {
      return;
    }
    
    // Fetch status immediately
    fetchStatus();
    
    // Set up polling interval
    const intervalId = setInterval(fetchStatus, pollingInterval);
    
    // Clean up on unmount or when run is complete
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchStatus, pollingInterval, progress?.isComplete]);
  
  // Stop polling when the run is complete
  useEffect(() => {
    if (progress?.isComplete) {
      // Directly clear any existing intervals by setting polling interval to 0
      setPollingInterval(0);
      console.log("Run complete, stopping polling");
    }
  }, [progress?.isComplete]);
  
  if (error) {
    return (
      <div className="p-4 rounded-md bg-red-50">
        <div className="flex">
          <div className="flex-shrink-0">
            <XIcon className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!progress) {
    return (
      <div className="flex items-center justify-center p-6">
        <LoaderIcon className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-sm text-gray-500">Connecting to scraper...</span>
      </div>
    );
  }
  
  const progressPercent = calculateProgress();
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {progress.isComplete ? (
            progress.status === 'success' ? (
              <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XIcon className="h-5 w-5 text-red-500 mr-2" />
            )
          ) : (
            <LoaderIcon className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
          )}
          <span className="font-medium">
            {progress.isComplete
              ? progress.status === 'success'
                ? 'Scrape completed successfully'
                : 'Scrape failed'
              : 'Scraping in progress...'}
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <ClockIcon className="h-4 w-4 mr-1" />
          <span>{formatTime(progress.elapsedTime)}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${
              progress.isComplete 
                ? progress.status === 'success' 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Products found:</span>
          <span className="ml-2 font-medium">{progress.productCount}</span>
        </div>
        <div>
          <span className="text-gray-500">Batches processed:</span>
          <span className="ml-2 font-medium">
            {progress.currentBatch}
            {progress.totalBatches ? `/${progress.totalBatches}` : ''}
          </span>
        </div>
      </div>
      
      {progress.progressMessages.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent progress messages:</h4>
          <div className="bg-gray-50 p-3 rounded-md text-xs font-mono overflow-y-auto max-h-32">
            {progress.progressMessages.map((message, index) => (
              <div key={index} className="mb-1">
                {message}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {progress.errorMessage && (
        <div className="p-3 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <XIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-1 text-sm text-red-700">
                <p>{progress.errorMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}