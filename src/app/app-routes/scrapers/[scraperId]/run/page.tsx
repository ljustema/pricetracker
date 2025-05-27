"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ScraperConfig } from "@/lib/services/scraper-service";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ScraperRunProgress from "@/components/scrapers/scraper-run-progress";

export default function RunScraperPage() {
  const params = useParams();
  const _router = useRouter(); // Kept for potential future navigation needs
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scraper, setScraper] = useState<ScraperConfig | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<{
    success: boolean;
    message: string;
    productCount: number;
  } | null>(null);

  // Check for runId in URL parameters when the component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const runIdFromUrl = searchParams.get('runId');

      if (runIdFromUrl && !runId) {
        console.log('Recovered runId from URL:', runIdFromUrl);
        setRunId(runIdFromUrl);
        setIsRunning(true);
      }
    }
  }, [runId]);

  const scraperId = params.scraperId as string;

  // Handle completion of the run
  // Update callback to accept errorMessage
  const handleRunComplete = useCallback((success: boolean, productCount: number, errorMessage: string | null) => {
    setIsRunning(false);

    if (success) {
      setResults({
        success: true,
        message: `Scraper run completed successfully`,
        productCount
      });
    } else {
      // Use the specific error message from the backend
      setError(`Scraper run failed: ${errorMessage || 'Unknown error'}`);
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

  const runScraper = async () => {
    setIsRunning(true);
    setError(null);
    setRunId(null);

    try {
      // Add a timeout to the fetch request
      const controller = new AbortController();
      const TIMEOUT_MS = 30000; // Increase to 30 seconds to give worker more time to start
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const { runId } = await ScraperClientService.runScraper(scraperId, controller.signal);
        clearTimeout(timeoutId);
        setRunId(runId);

        // Update URL with runId parameter for recovery if page is refreshed
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('runId', runId);
          window.history.replaceState({}, '', url.toString());
        }

        // Show a message that the scraper is running even if we can't connect to status API
        setResults({
          success: true,
          message: `Scraper run initiated. It will continue running in the background even if this page shows connection issues.`,
          productCount: 0
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (err) {
      console.error("Error starting scraper run:", err);

      // Check if it's an abort error (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          "Connection timed out when starting the scraper. This is often due to the worker not being ready yet. " +
          "Try again in a few seconds. If the problem persists, check that the worker is running properly."
        );
      } else if (err instanceof Error && err.message.includes('Network error')) {
        // Handle the common "Network error" case
        setError(
          "The worker couldn't connect to the target website. This is often a temporary issue. " +
          "Please try again in a few moments. If the problem persists, check your internet connection and the target website."
        );
      } else if (err instanceof Error && err.message.includes('Worker did not pick up the job')) {
        // Handle the case where the worker didn't pick up the job
        setError(
          "The worker did not pick up the job. This could be because the worker is not running " +
          "or is busy with other tasks. Please check that the worker is running and try again."
        );
      } else if (err instanceof Error && err.message.includes('Waiting for worker')) {
        // Handle the case where we're waiting for the worker to pick up the job
        setError(
          "Waiting for the worker to pick up the job. The worker may be busy or starting up. " +
          "Please try again in a few moments."
        );
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      }

      setIsRunning(false);
    }
  };

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to run a scraper.
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
        <h1 className="text-3xl font-bold">Run Scraper</h1>
        <p className="mt-2 text-gray-600">
          Run the scraper to collect price data from competitor websites.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
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
                runId
                  ? "bg-blue-100 text-blue-800" // Always show running when we have an active runId
                  : scraper.status === "success"
                    ? "bg-green-100 text-green-800"
                    : scraper.status === "running"
                      ? "bg-blue-100 text-blue-800"
                      : scraper.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
              }`}
            >
              {runId ? "running" : (scraper.status || "idle")}
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
              onClick={runScraper}
              disabled={isRunning}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Starting Run...
                </>
              ) : (
                "Run Scraper Now"
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">Full Run Progress</h3>
            <ScraperRunProgress
              scraperId={scraperId}
              runId={runId}
              onComplete={handleRunComplete}
            />
          </div>
        )}
      </div>

      {/* Only show results when the scraper is complete */}
      {results && !runId && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Scraper Results</h2>

          <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">
            <p className="font-medium">{results.message}</p>
            <p>Found {results.productCount} products</p>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Note: The scraper is running in the background. Even if you see connection issues or close this page, the scraper will continue running. You can check the database or logs for results.
          </p>
        </div>
      )}
    </div>
  );
}