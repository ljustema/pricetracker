"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ScraperConfig, ScrapedProduct } from "@/lib/services/scraper-service";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ScraperRunProgress from "@/components/scrapers/scraper-run-progress";

interface ScraperRunStatus {
  isComplete: boolean;
  status: string;
  errorMessage?: string;
  // Add more fields if needed from API
}

export default function RunTestScraperPage() {
  const params = useParams();
  const _router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scraper, setScraper] = useState<ScraperConfig | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<{
    success: boolean;
    message: string;
    products: ScrapedProduct[];
  } | null>(null);
  const [_status, setStatus] = useState<ScraperRunStatus | null>(null); // Status is used via setStatus but not directly

  const scraperId = params.scraperId as string;

  // Helper to log client errors to the server log file
  async function logClientError(message: string, context: string, errorDetails?: unknown) {
    try {
      console.log("[RunTestPage] logClientError called", { message, context, errorDetails });
      await fetch("/api/log-client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context, errorDetails }),
      });
    } catch (e) {
      // Fallback: log to console if server logging fails
      console.error("[RunTestPage] Failed to send client error log to server", e);
    }
  }

  // Handle completion of the test run
  // Update callback to accept errorMessage
  const handleRunComplete = useCallback((success: boolean, productCount: number, errorMessage: string | null) => {
    setIsRunning(false);

    if (success) {
      console.log(`[RunTestPage] handleRunComplete called with success=true, productCount=${productCount}`);
      setResults({
        success: true,
        message: `Test run completed successfully with ${productCount} products`,
        products: [] // We'll fetch the products from the database if needed
      });
    } else {
      // Use the specific error message from the backend
      console.log(`[RunTestPage] handleRunComplete called with success=false, errorMessage=${errorMessage}`);
      setError(`Test run failed: ${errorMessage || 'Unknown error'}`);
    }
  }, []);

  // Fetch the scraper data
  useEffect(() => {
    const fetchScraper = async () => {
      try {
        const response = await fetch(`/api/scrapers/${scraperId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch scraper');
        }

        setScraper(data);
      } catch (err) {
        console.error("Error fetching scraper:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user) {
      fetchScraper();
    }
  }, [scraperId, session]);

  const handleTestRun = async () => {
    try {
      setIsRunning(true);
      setError(null);
      setRunId(null);
      setStatus(null);

      // Detailed log before starting test run
      console.log(`[RunTestPage] [DEBUG] About to start test run for scraperId: ${scraperId}`);
      let runId;
      try {
        const startResponse = await ScraperClientService.startTestRun(scraperId);
        runId = startResponse.runId;
        console.log(`[RunTestPage] [DEBUG] startTestRun response:`, JSON.stringify(startResponse, null, 2));
      } catch (startError) {
        if (startError instanceof Error) {
          console.error(`[RunTestPage] [ERROR] startTestRun failed for scraperId: ${scraperId}`, startError.message, startError.stack);
        } else {
          console.error(`[RunTestPage] [ERROR] startTestRun failed for scraperId: ${scraperId}`, startError);
        }
        setError(startError instanceof Error ? startError.message : 'Failed to start test run');
        setIsRunning(false);
        return;
      }

      console.log(`[RunTestPage] Test run started with runId: ${runId}`);
      setRunId(runId);

      // Start polling for status
      const statusInterval = setInterval(async () => {
        try {
          console.log(`[RunTestPage] [DEBUG] Polling status for runId: ${runId}, scraperId: ${scraperId}`);
          const status = await ScraperClientService.getScraperRunStatus(scraperId, runId);
          console.log(`[RunTestPage] [DEBUG] Received status:`, JSON.stringify(status, null, 2));

          setStatus(status);

          // Check if the run is complete
          if (status.isComplete) {
            clearInterval(statusInterval);
            console.log(`[RunTestPage] Run is complete with status: ${status.status}`);

            // Special handling for different error types
            if (status.errorMessage === 'fetch failed') {
              console.log(`[RunTestPage] Run failed with 'fetch failed' error - this may be retried automatically`);

              // Log to server but with a special note about retry
              logClientError(
                'fetch failed (may retry automatically)',
                `RunTestPage: runId=${runId}, scraperId=${scraperId}`,
                status
              );

              // Set a more user-friendly error message
              setError('Network error occurred while fetching data. The system will automatically retry. Please check back in a few moments.');
            } else if (status.errorMessage && status.errorMessage.includes('Worker did not pick up the job')) {
              // Handle the case where the worker didn't pick up the job
              logClientError(
                status.errorMessage,
                `RunTestPage: runId=${runId}, scraperId=${scraperId}`,
                status
              );

              setError('The worker did not pick up the job. This could be because the worker is not running or is busy with other tasks. Please check that the appropriate worker is running and try again.');
            } else if (status.errorMessage && (status.errorMessage.includes('Waiting for worker') || status.errorMessage.includes('Waiting for TypeScript worker'))) {
              // Handle the case where we're waiting for the worker to pick up the job
              logClientError(
                status.errorMessage,
                `RunTestPage: runId=${runId}, scraperId=${scraperId}`,
                status
              );

              setError('Waiting for the worker to pick up the job. The worker may be busy or starting up. Please try again in a few moments.');
            } else if (status.errorMessage && status.errorMessage.includes('Network error')) {
              // Handle the common "Network error" case
              logClientError(
                status.errorMessage,
                `RunTestPage: runId=${runId}, scraperId=${scraperId}`,
                status
              );

              setError('The worker couldn\'t connect to the target website. This is often a temporary issue. Please try again in a few moments. If the problem persists, check your internet connection and the target website.');
            } else {
              // Log other errors normally
              if (status.status === 'failed' && status.errorMessage) {
                logClientError(
                  status.errorMessage || 'Unknown error',
                  `RunTestPage: runId=${runId}, scraperId=${scraperId}`,
                  status
                );
              }

              // Call the completion handler
              // Consider both 'success' and 'completed' as successful statuses
              const isSuccess = status.status === 'success' || status.status === 'completed';
              console.log(`[RunTestPage] Calling handleRunComplete with isSuccess=${isSuccess}, status=${status.status}`);
              handleRunComplete(
                isSuccess,
                status.productCount || 0,
                status.errorMessage || null
              );
            }
          }
        } catch (statusError) {
          console.error(`[RunTestPage] Error polling status:`, statusError);
          // Don't clear the interval on polling errors, just try again
        }
      }, 2000); // Poll every 2 seconds

      // Clean up interval on component unmount
      return () => clearInterval(statusInterval);
    } catch (error) {
      console.error(`[RunTestPage] Error starting test run:`, error);
      setIsRunning(false);
      setError(error instanceof Error ? error.message : 'Failed to start test run');
    }
  };

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to run a scraper test.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !scraper) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          {error || "Scraper not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Run Scraper Test</h1>
        <p className="mt-2 text-gray-600">
          Run a test of your scraper to collect a sample of data.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
            {error.includes('Network error') && (
              <button
                onClick={() => {
                  setError(null);
                  setIsRunning(false);
                  setResults(null);
                  handleTestRun();
                }}
                className="ml-4 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">{scraper.name}</h2>
          <p className="text-gray-600">
            <span className="font-medium">URL:</span>{" "}
            <a
              href={scraper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {scraper.url}
            </a>
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Schedule:</span>{" "}
            {scraper.schedule.frequency.charAt(0).toUpperCase() +
              scraper.schedule.frequency.slice(1)}{" "}
            at {scraper.schedule.time}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Status:</span>{" "}
            <span
              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                scraper.status === "success"
                  ? "bg-green-100 text-green-800"
                  : scraper.status === "running"
                  ? "bg-blue-100 text-blue-800"
                  : scraper.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {scraper.status || "idle"}
            </span>
          </p>
          {scraper.last_run && (
            <p className="text-gray-600">
              <span className="font-medium">Last Run:</span>{" "}
              {new Date(scraper.last_run).toLocaleString()}
            </p>
          )}
        </div>

        <div className="mt-6 flex space-x-4">
          {!runId && (
            <button
              onClick={handleTestRun}
              disabled={isRunning}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Starting Test Run...
                </>
              ) : (
                "Run Test"
              )}
            </button>
          )}

          <Link
            href="/app-routes/scrapers"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Back to Scrapers
          </Link>
        </div>

        {/* Show progress when a run is in progress */}
        {runId && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Test Run Progress</h3>
            <ScraperRunProgress
              scraperId={scraperId}
              runId={runId}
              onComplete={handleRunComplete}
            />
          </div>
        )}
      </div>

      {results && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Test Results</h2>

          <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">
            <p className="font-medium">{results.message}</p>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Note: The test results have been stored in the database and will be used for product matching and price change detection.
          </p>
        </div>
      )}
    </div>
  );
}
