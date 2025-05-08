"use client";

import { useState } from "react";
import { ScraperAISession } from "@/lib/services/scraper-session-service";
import { Button } from "@/components/ui/button";
import { XCircle, AlertCircle, ExternalLink, ArrowLeft, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AiUrlCollectionProps {
  session: ScraperAISession;
  onComplete: () => void;
  onBack: () => void;
}

export default function AiUrlCollection({ session, onComplete, onBack }: AiUrlCollectionProps) {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [strategy, setStrategy] = useState("");
  const [activeTab, setActiveTab] = useState("urls");

  // Create state to manage URL collection data
  const [urlCollectionData, setUrlCollectionData] = useState(session.urlCollectionData);

  if (!urlCollectionData) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">No URL collection data available</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Please regenerate the URL collection code.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Approving URL collection for session:", session.id);

      const response = await fetch(`/api/scrapers/ai/sessions/${session.id}/approve-url-collection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userFeedback: feedback,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve URL collection");
      }

      const responseData = await response.json();
      console.log("URL collection approved successfully:", responseData);

      // Force a small delay to ensure the server has time to process the update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Call onComplete to move to the next phase
      console.log("Moving to next phase (data-extraction)");
      onComplete();
    } catch (err) {
      console.error("Error approving URL collection:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);

      console.log("Regenerating URL collection for session:", session.id);

      const response = await fetch(`/api/scrapers/ai/collect-urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          strategy,
          userFeedback: feedback,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate URL collection");
      }

      // Get the updated session data instead of reloading the page
      console.log("URL collection regenerated successfully, fetching updated session data");
      const sessionResponse = await fetch(`/api/scrapers/ai/sessions/${session.id}`);

      if (!sessionResponse.ok) {
        throw new Error("Failed to fetch updated session data");
      }

      const updatedSession = await sessionResponse.json();
      console.log("Updated session data:", updatedSession);

      // Update the local state with the new session data
      if (updatedSession.urlCollectionData) {
        setUrlCollectionData(updatedSession.urlCollectionData);
        console.log("URL collection data updated successfully");
      }
    } catch (err) {
      console.error("Error regenerating URL collection:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">URL Collection</h2>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL Collection Summary */}
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">URL Collection Summary</h3>
            <p className="text-sm text-gray-500">
              {urlCollectionData.totalUrlCount
                ? `Found ${urlCollectionData.totalUrlCount} product URLs`
                : "No URLs collected yet"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                urlCollectionData.totalUrlCount && urlCollectionData.totalUrlCount > 0
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {urlCollectionData.totalUrlCount && urlCollectionData.totalUrlCount > 0
                ? "URLs Collected"
                : "No URLs Found"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs for URLs and Code */}
      <Tabs defaultValue="urls" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="urls">Sample URLs</TabsTrigger>
          <TabsTrigger value="code">Generated Code</TabsTrigger>
        </TabsList>

        <TabsContent value="urls" className="space-y-4 mt-4">
          {urlCollectionData.sampleUrls && urlCollectionData.sampleUrls.length > 0 ? (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {urlCollectionData.sampleUrls.map((url, index) => (
                  <li key={index} className="px-4 py-2 hover:bg-gray-50">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center"
                    >
                      <span className="truncate">{url}</span>
                      <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No sample URLs available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="mt-4">
          {urlCollectionData.generatedCode ? (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <pre className="p-4 text-xs font-mono overflow-x-auto bg-gray-50 max-h-96">
                {urlCollectionData.generatedCode}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No code generated yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Strategy Input */}
      <div>
        <label htmlFor="strategy" className="block text-sm font-medium text-gray-700">
          Strategy (Optional)
        </label>
        <div className="mt-1">
          <input
            type="text"
            id="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="e.g., Use sitemap to find product URLs"
            className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Provide a specific strategy for URL collection if you want to override the AI&apos;s approach
        </p>
      </div>

      {/* Feedback */}
      <div>
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">
          Feedback (Optional)
        </label>
        <div className="mt-1">
          <textarea
            id="feedback"
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Provide any additional information or corrections to help the AI generate better code"
            className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Analysis
        </Button>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? "Regenerating..." : "Regenerate"}
          </Button>

          <Button
            onClick={handleApprove}
            disabled={loading || !urlCollectionData.sampleUrls || urlCollectionData.sampleUrls.length === 0}
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {loading ? "Approving..." : "Approve & Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
