"use client";

import React, { useState, useEffect } from "react";
import { ScraperAISession, ScraperAIPhase } from "@/lib/services/scraper-session-service";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Import components dynamically to avoid TypeScript errors
import dynamic from "next/dynamic";

const AiSiteAnalysis = dynamic(() => import("./ai-site-analysis"), {
  loading: () => <div>Loading Site Analysis...</div>,
});

// New component for the combined URL collection and data extraction
const AiDataValidation = dynamic(() => import("./ai-data-validation"), {
  loading: () => <div>Loading Data Validation...</div>,
});

const AiScriptAssembly = dynamic(() => import("./ai-script-assembly"), {
  loading: () => <div>Loading Script Assembly...</div>,
});

// Legacy components - kept for backward compatibility
const AiUrlCollection = dynamic(() => import("./ai-url-collection"), {
  loading: () => <div>Loading URL Collection...</div>,
});

const AiDataExtraction = dynamic(() => import("./ai-data-extraction"), {
  loading: () => <div>Loading Data Extraction...</div>,
});

interface AiScraperWizardProps {
  sessionId?: string;
  competitorId: string;
  onComplete: (scraperId: string) => void;
  onCancel: () => void;
}

export default function AiScraperWizard({
  sessionId,
  competitorId,
  onComplete,
  onCancel,
}: AiScraperWizardProps) {
  const [session, setSession] = useState<ScraperAISession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<ScraperAIPhase>("analysis");
  const [url, setUrl] = useState<string>("");
  // We store the competitor website directly in the url state
  const [sitemapUrl, setSitemapUrl] = useState<string>("");
  const [categoryPageUrl, setCategoryPageUrl] = useState<string>("");
  const [productPageUrl, setProductPageUrl] = useState<string>("");
  const [fetchingCompetitor, setFetchingCompetitor] = useState<boolean>(false);

  // Fetch competitor data to get the website URL
  useEffect(() => {
    if (competitorId) {
      fetchCompetitorData(competitorId);
    }
  }, [competitorId]);

  // Fetch session data if sessionId is provided
  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  // Fetch competitor data to get the website URL
  const fetchCompetitorData = async (id: string) => {
    try {
      setFetchingCompetitor(true);
      const response = await fetch(`/api/competitors/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch competitor data");
      }

      const data = await response.json();
      if (data.website) {
        // Set the URL state directly to the competitor's website
        setUrl(data.website);
      }
      setFetchingCompetitor(false);
    } catch (err) {
      console.error("Error fetching competitor data:", err);
      setFetchingCompetitor(false);
    }
  };

  // Fetch session data from the API
  const fetchSession = async (id: string) => {
    try {
      setLoading(true);
      console.log(`Fetching session data for ID: ${id}`);

      // Add a unique timestamp to prevent caching
      const timestamp = new Date().getTime();

      const response = await fetch(`/api/scrapers/ai/sessions/${id}?t=${timestamp}`, {
        // Add cache-busting headers to ensure we get fresh data
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch session data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Received session data:", data);

      // Only update the phase if it's different to prevent unnecessary re-renders
      if (data.currentPhase !== currentPhase) {
        console.log(`Updating phase from ${currentPhase} to ${data.currentPhase}`);
        setCurrentPhase(data.currentPhase);
      }

      // Update other session data
      setSession(data);
      setUrl(data.url);

      return data; // Return the data for use in other functions
    } catch (err) {
      console.error("Error fetching session:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      throw err; // Re-throw to allow calling functions to handle the error
    } finally {
      setLoading(false);
    }
  };

  // Create a new session
  const createSession = async (websiteUrl: string) => {
    try {
      setLoading(true);

      // Prepare additional URLs if provided
      const additionalUrls: Record<string, string> = {};
      if (sitemapUrl) additionalUrls.sitemapUrl = sitemapUrl;
      if (categoryPageUrl) additionalUrls.categoryPageUrl = categoryPageUrl;
      if (productPageUrl) additionalUrls.productPageUrl = productPageUrl;

      const response = await fetch("/api/scrapers/ai/analyze-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: websiteUrl,
          competitorId,
          ...additionalUrls,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();

      // Debug the response data
      console.log("Session creation response:", data);

      // Make sure we have a valid session ID
      if (!data.sessionId) {
        console.error("Invalid session data:", data);
        throw new Error("Invalid session ID returned from the server");
      }

      // Convert to string if it's not already a string
      const sessionId = String(data.sessionId);

      // Create a session object with the returned session ID
      setSession({
        id: sessionId, // Use the converted string ID
        userId: "", // Will be filled when we fetch the session
        competitorId,
        url: websiteUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentPhase: "analysis",
        analysisData: data.analysisData,
      });

      // Fetch the full session data to ensure we have all the details
      await fetchSession(sessionId);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setLoading(false);
    }
  };

  // Handle URL submission
  const handleUrlSubmit = (websiteUrl: string) => {
    setUrl(websiteUrl);
    createSession(websiteUrl);
  };

  // Handle phase completion
  const handlePhaseComplete = async (_phase: ScraperAIPhase, nextPhase: ScraperAIPhase) => {
    console.log(`Phase ${_phase} completed, moving to ${nextPhase}`);

    // Reset the refresh counter when manually changing phases
    refreshCountRef.current = 0;

    // First update the phase locally to ensure immediate UI update
    setCurrentPhase(nextPhase);

    // Then refresh session data from the server
    if (session) {
      try {
        setLoading(true);
        console.log(`Fetching updated session data for ID: ${session.id} after phase transition`);

        // Force a small delay to ensure the server has processed the phase change
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update the previous phase ref to prevent unnecessary refreshes
        prevPhaseRef.current = nextPhase;

        const updatedSession = await fetchSession(session.id);
        console.log("Updated session data after phase transition:", updatedSession);

        // Double-check that the phase was updated correctly
        if (updatedSession.currentPhase !== nextPhase) {
          console.warn(`Phase mismatch: expected ${nextPhase}, got ${updatedSession.currentPhase}`);
          // Force the correct phase locally
          setCurrentPhase(nextPhase);
        }
      } catch (err) {
        console.error("Error refreshing session data:", err);
        setError("Failed to refresh session data. Please reload the page.");
        // Keep the phase updated locally even if the fetch fails
        setCurrentPhase(nextPhase);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle wizard completion
  const handleWizardComplete = (scraperId: string) => {
    onComplete(scraperId);
  };

  // Render the steps indicator
  const renderSteps = () => {
    const steps: { phase: ScraperAIPhase; label: string }[] = [
      { phase: "analysis", label: "Site Analysis" },
      { phase: "data-validation", label: "Data Validation" },
      { phase: "assembly", label: "Script Assembly" },
      { phase: "complete", label: "Complete" },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {/* Progress line - rendered separately to avoid overlapping issues */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" style={{ width: '100%', zIndex: 0 }} />

          {steps.map((step, index) => (
            <div key={step.phase} className="flex flex-col items-center z-10">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white ${
                  currentPhase === step.phase
                    ? "border-indigo-600 bg-indigo-100 text-indigo-600"
                    : steps.findIndex(s => s.phase === currentPhase) > index
                    ? "border-green-500 bg-green-100 text-green-500"
                    : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {steps.findIndex(s => s.phase === currentPhase) > index ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              <div className="mt-2 text-xs font-medium text-gray-500">{step.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Track previous phase to prevent unnecessary refreshes
  const prevPhaseRef = React.useRef<ScraperAIPhase | null>(null);
  const refreshCountRef = React.useRef(0);

  // Effect to refresh session data only when the phase actually changes
  useEffect(() => {
    // Skip if no session
    if (!session) return;

    // Skip if this is just a re-render with the same phase
    if (prevPhaseRef.current === currentPhase) return;

    // Limit the number of refreshes to prevent infinite loops
    if (refreshCountRef.current > 2) {
      console.log("Reached maximum refresh count, skipping further refreshes");
      return;
    }

    console.log(`Phase changed from ${prevPhaseRef.current} to ${currentPhase}, refreshing session data`);
    prevPhaseRef.current = currentPhase;
    refreshCountRef.current += 1;

    // Add a small delay to prevent rapid successive calls
    const timer = setTimeout(() => {
      fetchSession(session.id).catch(err => {
        console.error("Error refreshing session data:", err);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPhase, session?.id]);

  // Render the current phase component
  const renderPhaseComponent = () => {
    console.log("Rendering phase component for phase:", currentPhase, "with session:", session?.id);

    if (!session && currentPhase === "analysis") {
      // Initial URL input form
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Competitor Website Information</h2>
            <p className="text-sm text-gray-500 mt-1">
              We&apos;ll use the competitor&apos;s website URL to analyze the site structure and generate a scraper.
              You can optionally provide specific URLs to help the AI generate a better scraper.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="website-url" className="block text-sm font-medium text-gray-700">
                Website URL <span className="text-red-500">*</span>
              </Label>
              <div className="mt-1 flex items-center">
                <Input
                  id="website-url"
                  type="url"
                  value={url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={fetchingCompetitor}
                  required
                />
                {fetchingCompetitor && (
                  <Loader2 className="ml-2 h-5 w-5 animate-spin text-gray-400" />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                This URL is automatically populated from the competitor&apos;s website.
              </p>
            </div>

            <div>
              <Label htmlFor="sitemap-url" className="block text-sm font-medium text-gray-700">
                Sitemap URL (Optional)
              </Label>
              <Input
                id="sitemap-url"
                type="url"
                value={sitemapUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                If you know the sitemap URL, providing it can help the AI find product pages more efficiently.
              </p>
            </div>

            <div>
              <Label htmlFor="category-url" className="block text-sm font-medium text-gray-700">
                Category Page URL (Optional)
              </Label>
              <Input
                id="category-url"
                type="url"
                value={categoryPageUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategoryPageUrl(e.target.value)}
                placeholder="https://example.com/products"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                A URL to a category or product listing page can help the AI understand the site structure.
              </p>
            </div>

            <div>
              <Label htmlFor="product-url" className="block text-sm font-medium text-gray-700">
                Product Page URL (Optional)
              </Label>
              <Input
                id="product-url"
                type="url"
                value={productPageUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductPageUrl(e.target.value)}
                placeholder="https://example.com/products/example-product"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                A URL to a specific product page can help the AI identify product data more accurately.
              </p>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => handleUrlSubmit(url)}
                disabled={!url || loading}
                className="w-full justify-center"
              >
                {loading ? "Analyzing..." : "Analyze Site"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!session) {
      return <div>No session data available</div>;
    }

    // Check if the session has the required data for the current phase
    const hasAnalysisData = !!session.analysisData;
    const hasUrlCollectionData = !!session.urlCollectionData;
    const hasDataExtractionData = !!session.dataExtractionData;

    console.log("Session data availability:", {
      hasAnalysisData,
      hasUrlCollectionData,
      hasDataExtractionData,
      currentPhase
    });

    // Render the appropriate component based on the current phase
    // Force the correct component based on the current phase, regardless of session data
    switch (currentPhase) {
      case "analysis":
        return (
          <AiSiteAnalysis
            session={session}
            onComplete={() => handlePhaseComplete("analysis", "data-validation")}
          />
        );
      case "data-validation":
        // Ensure we have analysis data before showing data validation
        if (!hasAnalysisData) {
          console.warn("Missing analysis data for data validation phase, forcing analysis phase");
          setCurrentPhase("analysis");
          return (
            <AiSiteAnalysis
              session={session}
              onComplete={() => handlePhaseComplete("analysis", "data-validation")}
            />
          );
        }
        return (
          <AiDataValidation
            session={session}
            onComplete={() => handlePhaseComplete("data-validation", "assembly")}
            onBack={() => setCurrentPhase("analysis")}
          />
        );
      case "assembly":
      case "complete":
        // Ensure we have data extraction data before showing assembly
        if (!hasDataExtractionData) {
          console.warn("Missing data extraction data for assembly phase, forcing data validation phase");
          setCurrentPhase("data-validation");
          return (
            <AiDataValidation
              session={session}
              onComplete={() => handlePhaseComplete("data-validation", "assembly")}
              onBack={() => setCurrentPhase("analysis")}
            />
          );
        }
        return (
          <AiScriptAssembly
            session={session}
            onComplete={handleWizardComplete}
            onBack={() => setCurrentPhase("data-validation")}
          />
        );

      // Legacy phases - handle for backward compatibility
      case "url-collection" as const:
        console.warn("Legacy phase 'url-collection' detected, redirecting to 'data-validation'");
        setCurrentPhase("data-validation");
        return (
          <AiDataValidation
            session={session}
            onComplete={() => handlePhaseComplete("data-validation", "assembly")}
            onBack={() => setCurrentPhase("analysis")}
          />
        );
      case "data-extraction" as const:
        console.warn("Legacy phase 'data-extraction' detected, redirecting to 'data-validation'");
        setCurrentPhase("data-validation");
        return (
          <AiDataValidation
            session={session}
            onComplete={() => handlePhaseComplete("data-validation", "assembly")}
            onBack={() => setCurrentPhase("analysis")}
          />
        );
      default:
        console.error("Unknown phase:", currentPhase);
        return <div>Unknown phase: {currentPhase}. <Button onClick={() => setCurrentPhase("analysis")}>Reset to Analysis Phase</Button></div>;
    }
  };

  // Main render
  return (
    <div className="w-full max-w-8xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">AI Scraper Generation Wizard</h2>
        <p className="mt-1 text-sm text-gray-500">
          Create a TypeScript scraper in multiple steps with AI assistance
        </p>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Steps indicator */}
        {renderSteps()}

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current phase component */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          renderPhaseComponent()
        )}

        {/* Cancel button */}
        <div className="flex justify-end mt-6">
          <Button
            variant="outline"
            onClick={onCancel}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
