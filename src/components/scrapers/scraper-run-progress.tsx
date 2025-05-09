"use client";

import dynamic from "next/dynamic";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

const ScraperLogViewer = dynamic(() => import("./scraper-log-viewer"), {
  loading: () => <div>Loading...</div>,
});

import { useState, useEffect, useCallback } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { CheckIcon, XIcon, LoaderIcon, ClockIcon, StopCircle } from "lucide-react";
import { Button } from "../ui/button";

interface ScraperRunProgressProps {
  scraperId: string;
  runId: string;
  onComplete?: (success: boolean, productCount: number, errorMessage: string | null) => void;
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
    currentPhase?: number;
    elapsedTime: number;
    errorMessage: string | null;
    errorDetails: string | null;
    progressMessages: string[];
    isComplete: boolean;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number>(5000); // 5 seconds - reduced frequency to lower database load
  const [consecutiveErrors, setConsecutiveErrors] = useState<number>(0);
  const [stoppedPollingOnError, setStoppedPollingOnError] = useState<boolean>(false); // Track if polling stopped due to errors
  const [isStopping, setIsStopping] = useState<boolean>(false); // Track if we're in the process of stopping

  // Format elapsed time as mm:ss
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Track simulated progress for when there's no actual progress information
  const [simulatedProgress, setSimulatedProgress] = useState<number>(0);

  // Update simulated progress every 2 seconds
  useEffect(() => {
    if (progress && !progress.isComplete && progress.status === 'running' &&
        progress.currentBatch === 0 && progress.productCount === 0) {
      const interval = setInterval(() => {
        setSimulatedProgress(prev => {
          // Increase by 1-3% each time, but never go above 95%
          const increment = Math.random() * 2 + 1; // 1-3%
          return Math.min(95, prev + increment);
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [progress]);

  // Determine the current phase of the scraper
  const determinePhase = useCallback((statusData = progress) => {
    if (!statusData) return { phase: 'initializing', phaseText: 'Initializing...' };

    if (statusData.isComplete) {
      return {
        phase: statusData.status,
        phaseText: statusData.status === 'failed' ? 'Failed' : 'Completed'
      };
    }

    // Check if we're in the URL collection phase or product processing phase
    if (statusData.status === 'running') {
      // If we have explicit phase information from the API, use it
      if (statusData.currentPhase) {
        if (statusData.currentPhase === 1) {
          return { phase: 'collecting-urls', phaseText: 'Phase 1: Collecting URLs...' };
        } else if (statusData.currentPhase === 2) {
          return { phase: 'processing-products', phaseText: `Phase 2: Processing products...` };
        }
      }

      // Fallback to the old logic if no explicit phase information
      // If we have products but no or few URLs processed, we're likely in URL collection phase
      if (statusData.currentBatch === 0 || (statusData.currentBatch < 3 && statusData.productCount === 0)) {
        return { phase: 'collecting-urls', phaseText: 'Collecting URLs...' };
      }

      // If we have URLs processed and products, we're in the processing phase
      if (statusData.currentBatch > 0 || statusData.productCount > 0) {
        return { phase: 'processing-products', phaseText: 'Processing products...' };
      }

      // Default running state
      return { phase: 'running', phaseText: 'Running...' };
    }

    // Default to the status as the phase
    return { phase: statusData.status, phaseText: statusData.status };
  }, [progress]);

  // Calculate progress percentage
  const calculateProgress = useCallback(() => {
    if (!progress) return 0;

    // If the run is complete, return 100%
    if (progress.isComplete) {
      return progress.status === 'failed' ? 0 : 100;
    }

    const { phase } = determinePhase();

    // Different progress calculation based on the phase
    if (phase === 'collecting-urls') {
      // During URL collection, use a slow-moving progress bar (max 30%)
      if (progress.currentBatch > 0) {
        // If we have some batches, use that for a rough estimate
        return Math.min(30, Math.round((progress.currentBatch / 10) * 30));
      }
      // Otherwise use simulated progress capped at 30%
      return Math.min(30, simulatedProgress / 3);
    }

    // For product processing phase
    if (phase === 'processing-products') {
      // Start at 30% (URL collection complete)
      const baseProgress = 30;

      // If we have actual progress information, use it for the remaining 70%
      if (progress.totalBatches && progress.currentBatch > 0) {
        // For significant product counts, always use product count as the primary metric
        if (progress.productCount > 20) {
          // Use product count as a better indicator of progress
          // Estimate total based on the largest total we've seen or a reasonable default
          const estimatedTotal = maxBatchValues.total && maxBatchValues.total > 3
            ? maxBatchValues.total
            : Math.max(1000, progress.productCount * 2);

          const processingProgress = Math.round((progress.productCount / estimatedTotal) * 70);
          return Math.min(100, baseProgress + processingProgress);
        }

        // Use batch information for cases with few products
        const processingProgress = Math.round((progress.currentBatch / progress.totalBatches) * 70);
        return Math.min(100, baseProgress + processingProgress);
      }

      // If we have batch information but no total, estimate
      if (progress.currentBatch > 0) {
        // Assume at least 5 batches, but scale up if we've seen more
        const estimatedTotal = Math.max(5, progress.currentBatch * 1.5);
        const processingProgress = Math.round((progress.currentBatch / estimatedTotal) * 70);
        return Math.min(95, baseProgress + processingProgress);
      }

      // If we have product count but no batch information
      if (progress.productCount > 0) {
        // Estimate progress based on product count
        // Assume at least 100 products for a full run
        const processingProgress = Math.round((progress.productCount / 100) * 70);
        return Math.min(95, baseProgress + processingProgress);
      }

      // Default to 30% if we're in processing phase but don't have metrics yet
      return baseProgress;
    }

    // If we have no actual progress information, use simulated progress
    if (progress.status === 'running') {
      return simulatedProgress;
    }

    return 0;
  }, [progress, simulatedProgress, determinePhase]);

  // Store the previous phase and batch info to prevent UI flickering
  const [prevPhase, setPrevPhase] = useState<string>('');
  const [maxBatchValues, setMaxBatchValues] = useState<{current: number, total: number | null}>({current: 0, total: null});

  // Poll for status updates
  const fetchStatus = useCallback(async () => {
    try {
      const status = await ScraperClientService.getScraperRunStatus(scraperId, runId);

      // Determine the current phase before updating state
      const currentPhase = status ? determinePhase(status).phase : '';

      // Create a stabilized status to prevent flickering
      const stabilizedStatus = { ...status };

      // Stabilize batch values - use a consistent approach to prevent flickering

      // First, determine if we should use the product count as our primary metric
      const useProductCount = status.productCount > 20;

      // Store the largest total we've seen for consistency
      if (status.totalBatches && status.totalBatches > 3) {
        if (!maxBatchValues.total || status.totalBatches > maxBatchValues.total) {
          setMaxBatchValues(prev => ({ ...prev, total: status.totalBatches }));
        }
      }

      // Now apply the appropriate stabilization strategy
      if (useProductCount) {
        // For significant product counts, use product count as the primary metric

        // If we have a stored max value, use it
        if (maxBatchValues.total && maxBatchValues.total > 3) {
          stabilizedStatus.totalBatches = maxBatchValues.total;
          stabilizedStatus.currentBatch = status.productCount;
        }
        // If we have a large totalBatches value in the current status, use it
        else if (status.totalBatches && status.totalBatches > 3) {
          // Keep the current totalBatches
          stabilizedStatus.currentBatch = status.productCount;
        }
        // If we have a small totalBatches or none, estimate based on product count
        else {
          stabilizedStatus.totalBatches = Math.max(1000, status.productCount * 2);
          stabilizedStatus.currentBatch = status.productCount;
        }
      } else {
        // For small product counts, use the batch information if available
        if (maxBatchValues.total && maxBatchValues.total > 3) {
          stabilizedStatus.totalBatches = maxBatchValues.total;
        }
      }

      // Track the highest current batch we've seen
      if (status.currentBatch > maxBatchValues.current) {
        setMaxBatchValues(prev => ({ ...prev, current: status.currentBatch }));
      }

      // Only update the phase if it's a meaningful change
      // This prevents flickering between phases
      if (prevPhase === 'processing-products' && currentPhase === 'collecting-urls' && status.currentBatch > 0) {
        // Don't go backwards from processing to collecting
        setPrevPhase('processing-products');
        setProgress(stabilizedStatus);
      } else {
        // Normal update
        setProgress(stabilizedStatus);
        setPrevPhase(currentPhase);
      }

      // Reset consecutive errors counter on success
      setConsecutiveErrors(0);

      // If the run is complete, call the onComplete callback
      if (status.isComplete) {
        if (onComplete) {
          // Consider both 'success' and 'completed' as successful statuses
          const isSuccess = status.status === 'success' || status.status === 'completed';
          console.log(`[ScraperRunProgress] Run is complete with status: ${status.status}, isSuccess: ${isSuccess}, productCount: ${status.productCount}`);
          onComplete(isSuccess, status.productCount, status.errorMessage);
        }
      }
    } catch (err) {
      console.error("Error fetching run status:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to get run status";

      // Check if this is a temporary connection issue
      const isConnectionIssue = errorMessage.includes('still running in the background') ||
                               errorMessage.includes('Connection timed out') ||
                               errorMessage.includes('SyntaxError') ||
                               errorMessage.includes('Unexpected end of JSON');

      // Don't set error immediately - only after multiple consecutive failures
      // This prevents brief network hiccups from showing errors to the user

      // For connection issues, increment the counter more slowly
      if (isConnectionIssue) {
        // Only increment every other error for connection issues
        setConsecutiveErrors(prev => prev + 0.5);
        console.log('Temporary connection issue detected, continuing to poll');
      } else {
        // For other errors, increment normally
        setConsecutiveErrors(prev => prev + 1);
      }

      // Only show error to user after 3 consecutive failures
      if (consecutiveErrors >= 3) {
        setError(`${errorMessage} - The scraper is still running in the background. You can refresh the page to reconnect.`);
      }

      // If we've had too many consecutive errors, slow down polling but don't stop completely
      const MAX_ERRORS = 12; // Increase tolerance for long-running jobs
      if (consecutiveErrors >= MAX_ERRORS) {
        console.error(`Reached ${MAX_ERRORS} consecutive errors, slowing down polling.`);
        // Slow down polling to once every 15 seconds instead of stopping completely
        setPollingInterval(15000);

        // Don't mark as stopped - we want to keep trying
        // Don't call onComplete - the job might still be running

        // Update the error message to be more informative
        setError(`Connection issues detected. The scraper is still running in the background. You can refresh the page to reconnect or check the database for results later.`);
        return;
      }

      // Increase polling interval on error to avoid hammering the server
      // For connection issues, increase more slowly
      if (isConnectionIssue) {
        setPollingInterval(prev => Math.min(prev * 1.2, 8000));
      } else {
        setPollingInterval(prev => Math.min(prev * 1.5, 10000));
      }
    }
  }, [scraperId, runId, onComplete, consecutiveErrors, error]);

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

    // Clean up on unmount or when polling stops
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchStatus, pollingInterval, progress?.isComplete]);

  // Stop polling only when the run is complete
  useEffect(() => {
    if (progress?.isComplete) {
      setPollingInterval(0); // Ensure interval is 0
      console.log(`Polling stopped. Reason: Run complete`);
    }
  }, [progress?.isComplete]);

  // Add a manual retry button functionality
  const handleManualRetry = useCallback(() => {
    console.log("Manual retry requested by user");
    setError(null); // Clear any existing error
    setConsecutiveErrors(0); // Reset error counter
    setPollingInterval(3000); // Reset polling interval

    // Immediately try to fetch status
    fetchStatus();
  }, [fetchStatus]);

  // Add stop scraper functionality
  const handleStopScraper = useCallback(async () => {
    if (!progress || progress.isComplete || isStopping) return;

    try {
      setIsStopping(true);
      console.log(`Stopping scraper run ${runId}`);

      const result = await ScraperClientService.stopScraperRun(scraperId, runId);
      console.log(`Stop request result:`, result);

      // Update the progress status locally to show stopping state
      // This gives immediate feedback while we wait for the next status poll
      setProgress(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'stopping',
        };
      });

      // Fetch status immediately to get the updated state
      fetchStatus();
    } catch (error) {
      console.error("Error stopping scraper:", error);
      setError("Failed to stop scraper. Please try again.");
    } finally {
      setIsStopping(false);
    }
  }, [scraperId, runId, progress, isStopping, fetchStatus]);

  if (error) {
    return (
      <div className="p-4 rounded-md bg-red-50">
        <div className="flex">
          <div className="flex-shrink-0">
            <XIcon className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3 flex-grow">
            <h3 className="text-sm font-medium text-red-800">Connection Issue</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={handleManualRetry}
                className="inline-flex items-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Retry Connection
              </button>
              <span className="ml-3 text-xs text-gray-500">
                The scraper is still running in the background even if this page shows an error.
              </span>
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
            progress.status === 'success' || progress.status === 'completed' ? (
              <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <XIcon className="h-5 w-5 text-red-500 mr-2" />
            )
          ) : (
            <LoaderIcon className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
          )}
          <div>
            <span className="font-medium block">
              {progress.isComplete
                ? progress.status === 'success' || progress.status === 'completed'
                  ? 'Scrape completed successfully'
                  : 'Scrape failed'
                : 'Scraping in progress...'}
            </span>
            {!progress.isComplete && (
              <span className="text-sm text-gray-600 block">
                {determinePhase().phaseText}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <ClockIcon className="h-4 w-4 mr-1" />
          <span>{formatTime(progress.elapsedTime)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          {!progress.isComplete && determinePhase().phase === 'collecting-urls' ? (
            <span>URL Collection</span>
          ) : (
            <span>{progressPercent}%</span>
          )}
        </div>
        {/* Different UI based on phase */}
        {!progress.isComplete && determinePhase().phase === 'collecting-urls' ? (
          <div className="flex items-center justify-center py-2 bg-gray-50 rounded-md border border-gray-200">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3"></div>
            <span className="text-sm text-gray-600">Collecting URLs...</span>
          </div>
        ) : (
          <div className="w-full bg-gray-200 rounded-full h-2.5 relative">
            {/* Main progress bar */}
            <div
              className={`h-2.5 rounded-full ${
                progress.isComplete
                  ? progress.status === 'success' || progress.status === 'completed'
                    ? 'bg-green-500'
                    : 'bg-red-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        )}

        {/* Phase labels - only show when in processing phase or complete */}
        {(progress.isComplete || determinePhase().phase === 'processing-products') && (
          <div className="flex justify-end text-xs text-gray-500 mt-1">
            <div>Product Processing</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Products found:</span>
          <span className="ml-2 font-medium">{progress.productCount}</span>
        </div>
        {/* Only show URLs processed during product processing phase */}
        {determinePhase().phase !== 'collecting-urls' && (
          <div>
            <span className="text-gray-500">URLs processed:</span>
            <span className="ml-2 font-medium">
              {/* Always use the most stable batch values */}
              {(() => {
                // Case 1: We have a stored max value - use it
                if (maxBatchValues.total && maxBatchValues.total > 3) {
                  return (
                    <>
                      {progress.productCount} of {maxBatchValues.total}
                    </>
                  );
                }
                // Case 2: We have a large totalBatches value - use it
                else if (progress.totalBatches && progress.totalBatches > 3) {
                  return (
                    <>
                      {progress.currentBatch} of {progress.totalBatches}
                    </>
                  );
                }
                // Case 3: We have a small totalBatches but many products - use product count
                else if (progress.totalBatches && progress.totalBatches <= 3 && progress.productCount > 20) {
                  // Estimate total as 2x current product count
                  const estimatedTotal = Math.max(1000, progress.productCount * 2);
                  return (
                    <>
                      {progress.productCount} of ~{estimatedTotal}
                    </>
                  );
                }
                // Case 4: Default case - use whatever we have
                else {
                  return (
                    <>
                      {progress.currentBatch}
                      {progress.totalBatches ? ` of ${progress.totalBatches}` : ''}
                    </>
                  );
                }
              })()} {/* IIFE to execute the logic */}
            </span>
          </div>
        )}
        <div>
          <span className="text-gray-500">Elapsed time:</span>
          <span className="ml-2 font-medium">{formatTime(progress.elapsedTime)}</span>
        </div>
        <div>
          <span className="text-gray-500">Status:</span>
          <span className="ml-2 font-medium capitalize">{progress.status}</span>
        </div>

        {/* Add a progress rate indicator */}
        {progress.productCount > 0 && progress.elapsedTime > 0 && (
          <div className="col-span-2">
            <span className="text-gray-500">Rate:</span>
            <span className="ml-2 font-medium">
              {(progress.productCount / (progress.elapsedTime / 1000)).toFixed(2)} products/second
            </span>
          </div>
        )}
      </div>

      {/* Phase information - more prominent */}
      {progress && progress.status === 'running' && determinePhase().phase === 'collecting-urls' && (
        <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md border border-blue-200 shadow-sm">
          <h4 className="font-semibold text-sm mb-1">URL Collection Phase</h4>
          <p className="text-sm">The scraper is gathering all product URLs from the website. This phase may take a few minutes depending on the site size.</p>
        </div>
      )}

      {progress && progress.status === 'running' && determinePhase().phase === 'processing-products' && (
        <div className="mt-4 p-3 bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200 shadow-sm">
          <h4 className="font-semibold text-sm mb-1">Product Processing Phase</h4>
          <p className="text-sm">The scraper is now processing product pages. Progress is based on the number of URLs processed.</p>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p>Note: The scraper continues running in the background even if this page shows connection issues or is closed. Scraper jobs will automatically timeout after 2 hours if not completed.</p>
      </div>

      {progress.progressMessages.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent activity:</h4>
          <div className="bg-gray-50 p-3 rounded-md text-xs font-mono overflow-y-auto max-h-48 border border-gray-200">
            {progress.progressMessages.map((message, index) => {
              // Highlight URLs in the message
              const isUrl = message.includes('http://') || message.includes('https://');
              const isProcessing = message.includes('Bearbetar') || message.includes('Processing');
              const isSuccess = message.includes('Framgångsrikt') || message.includes('Successfully');

              let className = "mb-1 py-1 px-2 rounded";
              if (isUrl) className += " text-blue-600";
              if (isProcessing) className += " bg-blue-50";
              if (isSuccess) className += " bg-green-50 text-green-700";

              return (
                <div key={index} className={className}>
                  {message}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {progress.errorMessage && (
        <div className="p-3 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <XIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3 w-full">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-1 text-sm text-red-700">
                <p>{progress.errorMessage}</p>
              </div>

              {/* Show error details if available */}
              {progress.errorDetails && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-red-800">Error Details</h4>
                  <div className="mt-1 bg-red-100 p-3 rounded-md text-xs font-mono overflow-y-auto max-h-48 border border-red-200">
                    {/* Try to parse the error details as JSON for better display */}
                    {(() => {
                      try {
                        // Check if it's a JSON string
                        if (progress.errorDetails.trim().startsWith('{')) {
                          const errorObj = JSON.parse(progress.errorDetails);
                          return (
                            <div>
                              {errorObj.exitCode !== undefined && (
                                <div className="mb-2">Exit Code: {errorObj.exitCode}</div>
                              )}

                              {errorObj.scriptErrors && errorObj.scriptErrors.length > 0 && (
                                <div className="mb-2">
                                  <div className="font-semibold">Script Errors:</div>
                                  <ul className="list-disc pl-4">
                                    {errorObj.scriptErrors.map((err: string, i: number) => (
                                      <li key={i} className="mb-1">{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {errorObj.stderr && errorObj.stderr.length > 0 && (
                                <div className="mb-2">
                                  <div className="font-semibold">Stderr Output:</div>
                                  <div className="whitespace-pre-wrap">
                                    {errorObj.stderr.slice(0, 10).map((line: string, i: number) => (
                                      <div key={i} className="mb-1">{line}</div>
                                    ))}
                                    {errorObj.stderr.length > 10 && (
                                      <div className="text-red-600">...and {errorObj.stderr.length - 10} more lines</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {errorObj.command && (
                                <div className="mb-2">
                                  <div className="font-semibold">Command:</div>
                                  <div className="whitespace-pre-wrap">{errorObj.command}</div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // If not JSON, display as plain text
                        return <pre className="whitespace-pre-wrap">{progress.errorDetails}</pre>;
                      } catch (e) {
                        // If JSON parsing fails, display as plain text
                        return <pre className="whitespace-pre-wrap">{progress.errorDetails}</pre>;
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex space-x-3 mt-4">
        {/* Stop button - only show when scraper is running */}
        {progress && !progress.isComplete && progress.status === 'running' && (
          <Button
            variant="destructive"
            onClick={handleStopScraper}
            disabled={isStopping}
            className="flex items-center"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            {isStopping ? 'Stopping...' : 'Stop Scraper'}
          </Button>
        )}

        {/* Show stopping state */}
        {progress && !progress.isComplete && progress.status === 'stopping' && (
          <Button
            variant="outline"
            disabled={true}
            className="flex items-center"
          >
            <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
            Stopping...
          </Button>
        )}

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              View Logs
            </button>
          </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Scraper Logs</DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-[70vh] overflow-y-auto">
            <ScraperLogViewer scraperRunId={runId} />
          </div>
        </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}