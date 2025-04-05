"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ScraperConfig, ScrapedProduct } from "@/lib/services/scraper-service";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ScraperRunProgress from "@/components/scrapers/scraper-run-progress";

export default function TestRunScraperPage() {
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
  
  const scraperId = params.scraperId as string;
  
  // Handle completion of the test run
  // Update callback to accept errorMessage
  const handleRunComplete = useCallback((success: boolean, productCount: number, errorMessage: string | null) => {
    setIsRunning(false);
    
    if (success) {
      setResults({
        success: true,
        message: `Test run completed successfully with ${productCount} products`,
        products: [] // We'll fetch the products from the database if needed
      });
    } else {
      // Use the specific error message from the backend
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
  
  const runScraperTest = async () => {
    setIsRunning(true);
    setError(null);
    setRunId(null);
    
    try {
      const { runId } = await ScraperClientService.startTestRun(scraperId);
      setRunId(runId);
    } catch (err) {
      console.error("Error starting test run:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setIsRunning(false);
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
          Run the test function of your Python scraper to collect a sample of data.
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
              onClick={runScraperTest}
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