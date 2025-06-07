"use client";

import { useState, useEffect } from "react";
import { ScraperAISession } from "@/lib/services/scraper-session-service";
import { Button } from "@/components/ui/button";
import { XCircle, AlertCircle, ExternalLink, ArrowLeft, RefreshCw, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

interface AiDataValidationProps {
  session: ScraperAISession;
  onComplete: () => void;
  onBack: () => void;
}

export default function AiDataValidation({ session, onComplete, onBack }: AiDataValidationProps) {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("products");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [sessionData, setSessionData] = useState<ScraperAISession>(session);

  // Use the state variable instead of the prop directly
  const dataExtractionData = sessionData.dataExtractionData;
  const urlCollectionData = sessionData.urlCollectionData;
  const analysisData = sessionData.analysisData;

  // Check if we have product data to display
  const hasProductData = dataExtractionData && dataExtractionData.extractedProducts && dataExtractionData.extractedProducts.length > 0;

  // Update session data when the session prop changes
  useEffect(() => {
    console.log("Session prop changed:", session);
    setSessionData(session);
  }, [session]);

  // Debug logging
  useEffect(() => {
    console.log("Current session data:", sessionData);
    console.log("Has product data:", hasProductData);
    if (dataExtractionData && dataExtractionData.extractedProducts) {
      console.log("Number of products:", dataExtractionData.extractedProducts.length);
    }
  }, [sessionData, dataExtractionData, hasProductData]);

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Approving data validation for session:", session.id);

      const response = await fetch(`/api/scrapers/ai/sessions/${session.id}/approve-data-validation`, {
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
        throw new Error(errorData.error || "Failed to approve data validation");
      }

      const responseData = await response.json();
      console.log("Data validation approved successfully:", responseData);

      // Force a small delay to ensure the server has time to process the update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Call onComplete to move to the next phase
      console.log("Moving to next phase (assembly)");
      onComplete();
    } catch (err) {
      console.error("Error approving data validation:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);

      const response = await fetch(`/api/scrapers/ai/validate-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          sampleUrls: selectedUrls.length > 0 ? selectedUrls : undefined,
          userFeedback: feedback,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate data validation");
      }

      // Get the response data
      const responseData = await response.json();
      console.log("Data validation completed successfully:", responseData);

      // Force a small delay to ensure the server has time to process the update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch the updated session data
      const sessionResponse = await fetch(`/api/scrapers/ai/sessions/${session.id}?t=${Date.now()}`);
      if (!sessionResponse.ok) {
        throw new Error("Failed to fetch updated session data");
      }

      const updatedSession = await sessionResponse.json();

      // Update the local session data with the new data
      if (updatedSession) {
        // Update the session data state
        setSessionData(updatedSession);

        console.log("Updated session data:", updatedSession);

        // Force a re-render by setting a state variable
        setError(null);

        // No need to reload the page, the state update will trigger a re-render
      } else {
        console.error("No updated session data received");
      }
    } catch (err) {
      console.error("Error regenerating data:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setRegenerating(false);
    }
  };

  const handleUrlToggle = (url: string) => {
    if (selectedUrls.includes(url)) {
      setSelectedUrls(selectedUrls.filter((u) => u !== url));
    } else {
      setSelectedUrls([...selectedUrls, url]);
    }
  };

  // If we don't have any data yet, show a message
  if (!hasProductData) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-medium text-gray-900">Data Validation</h2>

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

        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No product data available</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>We need to extract sample products from the competitor website to validate the data extraction process.</p>
              </div>
            </div>
          </div>
        </div>

        {/* URL Selection */}
        {analysisData && analysisData.productPages && analysisData.productPages.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700">Select URLs for Testing (Optional)</h3>
            <p className="text-xs text-gray-500 mb-2">
              Select specific URLs to test data extraction on. If none are selected, random URLs will be used.
            </p>
            <div className="border border-gray-200 rounded-md overflow-hidden max-h-40 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {analysisData.productPages.slice(0, 20).map((url, index) => (
                  <li key={index} className="px-4 py-2 hover:bg-gray-50 flex items-center">
                    <input
                      type="checkbox"
                      id={`url-${index}`}
                      checked={selectedUrls.includes(url)}
                      onChange={() => handleUrlToggle(url)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`url-${index}`} className="ml-2 text-sm text-gray-700 truncate">
                      {url}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
              placeholder="Provide any additional information to help the AI extract better data"
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
            Back to Site Analysis
          </Button>

          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? "Extracting..." : "Extract Sample Products"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Data Validation</h2>

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

      {/* Data Validation Summary */}
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Data Validation Summary</h3>
            <p className="text-sm text-gray-500">
              {dataExtractionData.extractedProducts
                ? `Extracted data from ${dataExtractionData.extractedProducts.length} products`
                : "No products extracted yet"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                dataExtractionData.extractedProducts && dataExtractionData.extractedProducts.length > 0
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {dataExtractionData.extractedProducts && dataExtractionData.extractedProducts.length > 0
                ? "Data Extracted"
                : "No Data Found"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs for Products and Code */}
      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Extracted Products</TabsTrigger>
          <TabsTrigger value="code">Generated Code</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4 mt-4">
          {dataExtractionData.extractedProducts && dataExtractionData.extractedProducts.length > 0 ? (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              {/* Check if we have an extraction failure message */}
              {dataExtractionData.extractedProducts.length === 1 &&
               dataExtractionData.extractedProducts[0].name === "Extraction Failed - Please Review Code" ? (
                <div className="bg-yellow-50 p-4 border-b border-yellow-100">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Extraction Failed</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>The automatic extraction process failed. Please review the generated code and make any necessary adjustments.</p>
                        <p className="mt-1">You can still proceed with the current code, but you may need to modify it manually later.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU/Brand/EAN
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dataExtractionData.extractedProducts.map((product, index) => (
                      <tr key={index} className={`hover:bg-gray-50 ${product.name === "Extraction Failed - Please Review Code" ? "bg-yellow-50" : ""}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {product.image_url ? (
                              <div className="flex-shrink-0 h-10 w-10 relative">
                                <Image
                                  src={product.image_url}
                                  alt={product.name}
                                  fill
                                  className="object-contain"
                                  onError={(e) => {
                                    // Replace with placeholder on error
                                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 flex items-center justify-center rounded-md">
                                <ImageIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                {product.name}
                              </div>
                              {product.is_available ? (
                                <div className="text-xs text-green-600">In stock</div>
                              ) : (
                                <div className="text-xs text-red-600">Out of stock</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {product.competitor_price !== null
                              ? `${product.competitor_price} ${product.currency_code || ""}`
                              : "N/A"}
                          </div>
                          {product.raw_price && (
                            <div className="text-xs text-gray-500">{product.raw_price}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.sku && (
                            <div className="text-sm text-gray-500">
                              <span className="font-medium">SKU:</span> {product.sku}
                            </div>
                          )}
                          {product.brand && (
                            <div className="text-sm text-gray-500">
                              <span className="font-medium">Brand:</span> {product.brand}
                            </div>
                          )}
                          {product.ean && (
                            <div className="text-sm text-gray-500">
                              <span className="font-medium">EAN:</span> {product.ean}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.url ? (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-500 flex items-center"
                            >
                              <span className="truncate max-w-xs">View</span>
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-gray-400">No URL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No products extracted yet</p>
              <p className="mt-2 text-sm">Click "Extract Sample Products" to begin the validation process.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="mt-4">
          {dataExtractionData.generatedCode ? (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <pre className="p-4 text-xs font-mono overflow-x-auto bg-gray-50 max-h-96">
                {dataExtractionData.generatedCode}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No code generated yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* URL Selection */}
      {analysisData && analysisData.productPages && analysisData.productPages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700">Select URLs for Testing (Optional)</h3>
          <p className="text-xs text-gray-500 mb-2">
            Select specific URLs to test data extraction on. If none are selected, random URLs will be used.
          </p>
          <div className="border border-gray-200 rounded-md overflow-hidden max-h-40 overflow-y-auto">
            <ul className="divide-y divide-gray-200">
              {analysisData.productPages.slice(0, 20).map((url, index) => (
                <li key={index} className="px-4 py-2 hover:bg-gray-50 flex items-center">
                  <input
                    type="checkbox"
                    id={`url-${index}`}
                    checked={selectedUrls.includes(url)}
                    onChange={() => handleUrlToggle(url)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`url-${index}`} className="ml-2 text-sm text-gray-700 truncate">
                    {url}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
          Back to Site Analysis
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
            disabled={loading || !dataExtractionData.extractedProducts || dataExtractionData.extractedProducts.length === 0}
            className={`inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              dataExtractionData.extractedProducts &&
              dataExtractionData.extractedProducts.length === 1 &&
              dataExtractionData.extractedProducts[0].name === "Extraction Failed - Please Review Code"
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Approving..." : (
              dataExtractionData.extractedProducts &&
              dataExtractionData.extractedProducts.length === 1 &&
              dataExtractionData.extractedProducts[0].name === "Extraction Failed - Please Review Code"
                ? "Continue with Caution"
                : "Approve & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
