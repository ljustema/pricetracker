"use client";

import { useState } from "react";
import { ScraperAISession, ScraperAIAnalysisData } from "@/lib/services/scraper-session-service";
import { Button } from "@/components/ui/button";
import { XCircle, AlertCircle, ExternalLink } from "lucide-react";

// Extended interface to include productSelectors which is present in the API but not in the type definition
interface ExtendedAnalysisData extends ScraperAIAnalysisData {
  productPages?: string[]; // Updated field name (was productListingPages)
  productSelectors?: {
    listItem?: string;
    name?: string;
    price?: string;
    link?: string;
    brand?: string;
    sku?: string;
    ean13?: string;
    imageUrl?: string; // URL for the product image
    [key: string]: string | undefined;
  };
}

interface AiSiteAnalysisProps {
  session: ScraperAISession;
  onComplete: () => void;
}

export default function AiSiteAnalysis({ session, onComplete }: AiSiteAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  // Cast to ExtendedAnalysisData to handle the productSelectors property
  const analysisData = session.analysisData as ExtendedAnalysisData;

  // Debug log to see what's in the session data
  console.log("Session analysis data:", {
    productPages: analysisData.productPages,
    productListingPages: analysisData.productListingPages,
    fullData: analysisData
  });

  if (!analysisData) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">No analysis data available</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Please restart the wizard to analyze the site.</p>
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

      // Debug the session ID
      console.log("Session ID:", session.id);
      console.log("Full session object:", session);

      // Make sure we have a valid session ID
      if (!session.id || typeof session.id !== 'string') {
        throw new Error("Invalid session ID. Please try refreshing the page.");
      }

      const response = await fetch(`/api/scrapers/ai/sessions/${session.id}/approve-analysis`, {
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
        throw new Error(errorData.error || "Failed to approve analysis");
      }

      onComplete();
    } catch (err) {
      console.error("Error approving analysis:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Site Analysis Results</h2>

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

      {/* Site URL */}
      <div>
        <h3 className="text-sm font-medium text-gray-700">Site URL</h3>
        <div className="mt-1 flex items-center">
          <a
            href={session.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center"
          >
            {session.url}
            <ExternalLink className="ml-1 h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Proposed Strategy */}
      <div>
        <h3 className="text-sm font-medium text-gray-700">Proposed Strategy</h3>
        <div className="mt-1 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-900">{analysisData.proposedStrategy}</p>
          {analysisData.strategyDescription && (
            <p className="mt-2 text-sm text-gray-500">{analysisData.strategyDescription}</p>
          )}
        </div>
      </div>

      {/* Sitemaps */}
      {analysisData.sitemapUrls && analysisData.sitemapUrls.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700">Sitemaps</h3>
          <ul className="mt-1 space-y-1">
            {analysisData.sitemapUrls.slice(0, 20).map((url, index) => (
              <li key={index} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-500 flex items-center"
                >
                  {url}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </li>
            ))}
            {analysisData.sitemapUrls.length > 20 && (
              <li className="text-sm text-gray-500">
                ...and {analysisData.sitemapUrls.length - 20} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Brand Pages */}
      <div>
        <h3 className="text-sm font-medium text-gray-700">Brand Pages</h3>
        {analysisData.brandPages && analysisData.brandPages.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {analysisData.brandPages.slice(0, 20).map((url, index) => (
              <li key={index} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-500 flex items-center"
                >
                  {url}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </li>
            ))}
            {analysisData.brandPages.length > 20 && (
              <li className="text-sm text-gray-500">
                ...and {analysisData.brandPages.length - 20} more
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 mt-1">No brand pages found</p>
        )}
      </div>

      {/* Category Pages */}
      {analysisData.categoryPages && analysisData.categoryPages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700">Category Pages</h3>
          <ul className="mt-1 space-y-1">
            {analysisData.categoryPages.slice(0, 20).map((url, index) => (
              <li key={index} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-500 flex items-center"
                >
                  {url}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </li>
            ))}
            {analysisData.categoryPages.length > 20 && (
              <li className="text-sm text-gray-500">
                ...and {analysisData.categoryPages.length - 20} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Product Pages */}
      <div>
        <h3 className="text-sm font-medium text-gray-700">Product Pages</h3>
        {/* Check both productPages and productListingPages for backward compatibility */}
        {((analysisData.productPages && analysisData.productPages.length > 0) ||
          (analysisData.productListingPages && analysisData.productListingPages.length > 0)) ? (
          <ul className="mt-1 space-y-1">
            {/* Use productPages if available, otherwise fall back to productListingPages */}
            {(analysisData.productPages || analysisData.productListingPages || []).slice(0, 20).map((url, index) => (
              <li key={index} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-500 flex items-center"
                >
                  {url}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </li>
            ))}
            {/* Show count of remaining pages */}
            {(analysisData.productPages?.length || analysisData.productListingPages?.length || 0) > 20 && (
              <li className="text-sm text-gray-500">
                ...and {(analysisData.productPages?.length || analysisData.productListingPages?.length || 0) - 20} more
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 mt-1">No product pages found</p>
        )}
      </div>

      {/* API Endpoints */}
      {analysisData.apiEndpoints && analysisData.apiEndpoints.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700">API Endpoints</h3>
          <div className="mt-1 space-y-3">
            {analysisData.apiEndpoints.map((endpoint, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <span className="px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800">
                    {endpoint.method}
                  </span>
                  <span className="ml-2 text-sm font-mono">{endpoint.url}</span>
                </div>
                {endpoint.description && (
                  <p className="mt-1 text-sm text-gray-500">{endpoint.description}</p>
                )}
                {endpoint.parameters && Object.keys(endpoint.parameters).length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-xs font-medium text-gray-700">Parameters</h4>
                    <ul className="mt-1 text-xs text-gray-600">
                      {Object.entries(endpoint.parameters).map(([key, value]) => (
                        <li key={key}>
                          <span className="font-mono">{key}</span>: {value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Selectors */}
      <div>
        <h3 className="text-sm font-medium text-gray-700">Product Selectors</h3>
        {analysisData.productSelectors && typeof analysisData.productSelectors === 'object' &&
         Object.values(analysisData.productSelectors).some(value => value) ? (
          <div className="mt-1 p-4 bg-gray-50 rounded-md">
            <div className="space-y-2">
              {/* Name selector */}
              <div className="flex items-start">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">Name:</span>
                </div>
                <div className="flex-grow">
                  <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                    {analysisData.productSelectors.name || "Not detected"}
                  </code>
                </div>
              </div>

              {/* Price selector */}
              <div className="flex items-start">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">Price:</span>
                </div>
                <div className="flex-grow">
                  <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                    {analysisData.productSelectors.price || "Not detected"}
                  </code>
                </div>
              </div>

              {/* Brand selector */}
              <div className="flex items-start">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">Brand:</span>
                </div>
                <div className="flex-grow">
                  <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                    {analysisData.productSelectors.brand || "Not detected"}
                  </code>
                </div>
              </div>

              {/* SKU selector */}
              <div className="flex items-start">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">SKU:</span>
                </div>
                <div className="flex-grow">
                  <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                    {analysisData.productSelectors.sku || "Not detected"}
                  </code>
                </div>
              </div>

              {/* Image URL */}
              <div className="flex items-start">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">Image URL:</span>
                </div>
                <div className="flex-grow">
                  <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700 break-all">
                    {analysisData.productSelectors.imageUrl || "Not detected"}
                  </code>
                </div>
              </div>

              {/* EAN13 selector */}
              <div className="flex items-start">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">EAN13:</span>
                </div>
                <div className="flex-grow">
                  <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                    {analysisData.productSelectors.ean13 || "Not detected"}
                  </code>
                </div>
              </div>

              {/* List item selector (if present) */}
              {analysisData.productSelectors.listItem && (
                <div className="flex items-start">
                  <div className="w-20 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700">List item:</span>
                  </div>
                  <div className="flex-grow">
                    <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                      {analysisData.productSelectors.listItem}
                    </code>
                  </div>
                </div>
              )}

              {/* Link selector (if present) */}
              {analysisData.productSelectors.link && (
                <div className="flex items-start">
                  <div className="w-20 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700">Link:</span>
                  </div>
                  <div className="flex-grow">
                    <code className="px-2 py-1 text-sm font-mono bg-gray-100 rounded text-blue-700">
                      {analysisData.productSelectors.link}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-1">No product selectors found</p>
        )}
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
      <div className="flex justify-end space-x-3">
        <Button
          onClick={handleApprove}
          disabled={loading}
          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {loading ? "Approving..." : "Approve & Continue"}
        </Button>
      </div>
    </div>
  );
}
