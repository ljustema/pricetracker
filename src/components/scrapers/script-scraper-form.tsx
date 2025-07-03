"use client";

import { useState, useEffect } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { UploadIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
// Removed unused import: import TestResultsModal from "./test-results-modal";
import { ValidationProduct } from "@/lib/services/scraper-types";
import Image from "next/image";

interface ScriptScraperFormProps { // Renamed interface
  competitorId?: string; // Made optional for supplier scrapers
  supplierId?: string; // Added for supplier scrapers
  scraperType: 'python' | 'typescript'; // Added scraperType prop
  onSuccess: (scraperId: string) => void;
  onCancel: () => void;
  initialScript?: string;
  isUpdate?: boolean;
  scraperId?: string;
}

export default function ScriptScraperForm({ // Renamed component
  competitorId,
  supplierId,
  scraperType, // Added scraperType prop
  onSuccess,
  onCancel,
  initialScript,
  isUpdate = false,
  scraperId,
}: ScriptScraperFormProps) { // Use renamed interface
  const [targetName, setTargetName] = useState(""); // Renamed from competitorName to targetName
  const [scriptContent, setScriptContent] = useState(initialScript || ""); // Renamed state variable and setter
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // Add state for template type selection with Crawlee as default
  const [templateType, setTemplateType] = useState<'standard' | 'crawlee'>('crawlee');
  const [isValidating, setIsValidating] = useState(false);
  // Updated validation result state to match new API response
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    logs?: { ts: string; lvl: string; phase: string; msg: string; data?: Record<string, unknown> }[]; // Use actual log object type
    sampleProducts?: ValidationProduct[]; // Array of sample products
    error?: string; // General error message for API failure or validation issues
    metadata?: { target_url?: string }; // Add metadata to validationResult
  } | null>(null);
  // Removed rawStdout/rawStderr state, using structured logs only
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Removed isTestApproved state, using isValidationApproved for pre-save check
  const [isValidationApproved, setIsValidationApproved] = useState(false); // New: explicit validation approval
  const [schedule, setSchedule] = useState<{
    frequency: 'daily' | 'weekly' | 'monthly';
    // Removed time property
  }>({
    frequency: "daily",
  });
  const [filterByActiveBrands, setFilterByActiveBrands] = useState(false);
  const [scrapeOnlyOwnProducts, setScrapeOnlyOwnProducts] = useState(false);
  const [url, setUrl] = useState(initialScript ? "" : ""); // Will be set after validation or from initial data if editing

  // Fetch competitor name when component mounts
  useEffect(() => {
    const fetchTargetName = async () => {
      try {
        let targetType: string;
        let apiEndpoint: string;

        if (competitorId) {
          targetType = "competitor";
          apiEndpoint = `/api/competitors/${competitorId}`;
        } else if (supplierId) {
          targetType = "supplier";
          apiEndpoint = `/api/suppliers/${supplierId}`;
        } else {
          console.warn("No competitor ID or supplier ID provided");
          return;
        }

        const response = await fetch(apiEndpoint);
        if (response.ok) {
          const target = await response.json();
          if (target && target.name) {
            setTargetName(target.name);
          } else {
            console.error(`${targetType} data missing name property`, target);
            // Set a fallback name to prevent UI issues
            setTargetName(`Unknown ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`);
          }
        } else {
          const errorText = await response.text().catch(() => "No response body");
          console.error(`Failed to fetch ${targetType} name: HTTP ${response.status}`, errorText);
          // Set a fallback name to prevent UI issues
          setTargetName(`Unknown ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`);
        }
      } catch (error) {
        const targetType = competitorId ? "competitor" : "supplier";
        console.error(`Error fetching ${targetType} name:`, error);
        // Set a fallback name to prevent UI issues
        setTargetName(`Unknown ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`);
      }
    };

    fetchTargetName();
  }, [competitorId, supplierId]);

  // When editing, pre-fill url from initialData (if available)
  useEffect(() => {
    if (isUpdate && scraperId) {
      // Fetch the current scraper data to get the URL
      fetch(`/api/scrapers/${scraperId}`)
        .then(res => res.json())
        .then(data => {
          if (data.url) setUrl(data.url);
        });
    }
  }, [isUpdate, scraperId]);

  // When validation finishes, update the URL field from metadata if present
  useEffect(() => {
    if (validationResult?.metadata?.target_url) {
      setUrl(validationResult.metadata.target_url);
    }
  }, [validationResult?.metadata?.target_url]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    // Read the file content
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScriptContent(event.target.result as string); // Use renamed setter
      }
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!scriptContent.trim()) { // Use renamed state variable
      alert(`Please enter or upload ${scraperType === 'python' ? 'Python' : 'TypeScript'} script first`); // Dynamic alert
      return;
    }

    setIsValidating(true);
    setValidationResult(null); // Clear previous results
    // Removed setIsTestApproved reset
    setIsValidationApproved(false); // Reset validation approval
    // Removed rawStdout/rawStderr reset

    try {
      // Call the API endpoint directly using fetch
      // IMPORTANT: When modifying validation request body, also update:
      // - pricetracker/src/components/scrapers/ai-scraper-validation.tsx (validation calls)
      // - pricetracker/src/app/app-routes/scrapers/[scraperId]/edit/page.tsx (props passed to this component)
      const response = await fetch('/api/scrapers/validate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scraper_type: scraperType,  // Ändrat från 'type'
          scriptContent: scriptContent, // Use renamed state variable
          // Pass supplier/competitor ID for context
          ...(competitorId && { competitorId }),
          ...(supplierId && { supplierId }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validation API request failed');
      }

      const result = await response.json();
      // Assuming result has { success: boolean, logs?: string[], sampleProducts?: ScrapedProduct[], error?: string }
      // Also assuming the API might still return raw stdout/stderr for debugging, let's capture them if present
      // Map API response fields (valid, products) to frontend state fields (success, sampleProducts)
      setValidationResult({
        success: result.valid, // Map 'valid' from API to 'success' in state
        logs: result.logs,
        sampleProducts: result.products, // Map 'products' from API to 'sampleProducts' in state
        error: result.error,
        metadata: result.metadata, // Add metadata to validationResult
      });
      // Removed setting rawStdout/rawStderr

      // Inline display replaces the modal logic
      // No need to explicitly open anything here, the component will re-render with results

      // If metadata.target_url is present, update url state
      if (result.metadata?.target_url) {
        setUrl(result.metadata.target_url);
      }

    } catch (error) {
      // This catch block handles errors in the API call itself (e.g., network error)
      console.error("Error calling validation API:", error);
      setValidationResult({
        success: false, // Mark as failed on API error
        error: "API Call Failed: " + (error instanceof Error ? error.message : "Unknown error occurred"),
      });
      // Removed setting rawStdout/rawStderr on error
    } finally {
      setIsValidating(false); // Ensure loading state is reset
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Update check to use the 'success' field and ensure products were potentially found if successful
    if (!validationResult?.success) {
      alert("Validation failed or script produced errors. Please review the logs and results before proceeding.");
      return;
    }
    // Keep the approval check
    // Updated approval check: Rely on isValidationApproved state set by the "Approve Validation" button
    if (!isValidationApproved) {
      alert("Please approve the validation before " + (isUpdate ? "updating" : "creating") + " the scraper");
      return;
    }

    const urlToSave = validationResult?.metadata?.target_url || url;

    // Check if script is present (name is optional now)
    if (!scriptContent) { // Use renamed state variable
      alert(`${scraperType === 'python' ? 'Python' : 'TypeScript'} script cannot be empty.`); // Dynamic alert
      return;
    }
    setIsSubmitting(true);

    try {
      if (isUpdate && scraperId) {
        // Only send the url if the script is unchanged
        type UpdatePayload = {
          scraper_type: 'python' | 'typescript';
          url: string;
          schedule: { frequency: 'daily' | 'weekly' | 'monthly' };
          filter_by_active_brands: boolean;
          scrape_only_own_products: boolean;
          python_script?: string;
          typescript_script?: string;
        };
        const updatePayload: UpdatePayload = {
          scraper_type: scraperType,
          url: urlToSave,
          schedule: { frequency: schedule.frequency },
          filter_by_active_brands: filterByActiveBrands,
          scrape_only_own_products: scrapeOnlyOwnProducts,
        };
        // If the script has changed, include it
        if (scriptContent !== initialScript) {
          if (scraperType === 'python') {
            updatePayload.python_script = scriptContent;
          } else {
            updatePayload.typescript_script = scriptContent;
          }
        }
        const response = await fetch(`/api/scrapers/${scraperId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update scraper');
        }
        const scraper = await response.json();
        onSuccess(scraper.id);
      } else {
        // Create new scraper using the updated service method
        const scraper = await ScraperClientService.createScriptScraper({
          competitor_id: competitorId,
          supplier_id: supplierId,
          url: urlToSave,
          scraper_type: scraperType,
          scriptContent: scriptContent,
          schedule: { frequency: schedule.frequency },
          filter_by_active_brands: filterByActiveBrands,
          scrape_only_own_products: scrapeOnlyOwnProducts,
        });
        onSuccess(scraper.id);
      }
    } catch (error) {
      console.error(`Error ${isUpdate ? "updating" : "creating"} ${scraperType} scraper:`, error); // Dynamic error log
      alert(error instanceof Error ? error.message : `Failed to ${isUpdate ? "update" : "create"} scraper`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-8xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">{isUpdate ? `Update ${scraperType === 'python' ? 'Python' : 'TypeScript'} Scraper` : `Create ${scraperType === 'python' ? 'Python' : 'TypeScript'} Scraper`}</h2> {/* Dynamic Title */}
        <p className="mt-1 text-sm text-gray-500">
          {/* Dynamic Description */}
          {scraperType === 'python'
            ? "Upload or write a custom Python scraper for maximum flexibility. Best for complex websites."
            : "Upload or write your own TypeScript scraper. Best for sites suited to browser automation or Crawlee."
          }
        </p>
      </div>

      {/* Removed Test Results Modal */}
      {/* <TestResultsModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        products={validationResult?.products || []}
      /> */}

      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Scraper Name
            </label>
            <input
              id="name"
              type="text"
              value={targetName ? `${targetName} ${scraperType === 'python' ? 'Python' : 'TypeScript'} Scraper X` : "Loading..."}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm bg-gray-100 text-gray-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Name is auto-generated following the pattern: [{supplierId ? 'Supplier' : 'Competitor'} Name] {scraperType === 'python' ? 'Python' : 'TypeScript'} Scraper X {/* Dynamic Name Pattern */}
              <br />
              The X will be replaced with the next available number (1, 2, 3, etc.)
            </p>
          </div>

          {url && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Scraper Target URL (from Metadata)</label>
              <input type="text" value={url} readOnly className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-100" />
            </div>
          )}

          {/* Removed Target Website URL input */}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Script Content ({scraperType === 'python' ? 'Python' : 'TypeScript'})
            </label>

            {/* Template selection for TypeScript only */}
            {scraperType === 'typescript' && (
              <div className="mt-2 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Type
                </label>
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <input
                      id="crawlee-template"
                      type="radio"
                      name="template-type"
                      value="crawlee"
                      checked={templateType === 'crawlee'}
                      onChange={() => setTemplateType('crawlee')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="crawlee-template" className="ml-2 block text-sm text-gray-900">
                      Crawlee (Recommended)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="standard-template"
                      type="radio"
                      name="template-type"
                      value="standard"
                      checked={templateType === 'standard'}
                      onChange={() => setTemplateType('standard')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="standard-template" className="ml-2 block text-sm text-gray-900">
                      Standard TypeScript
                    </label>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {templateType === 'crawlee'
                    ? "Crawlee is a powerful web scraping library that makes it easier to build reliable scrapers with built-in features for handling rate limiting, proxies, and more."
                    : "Standard TypeScript allows for custom implementation using native fetch or other HTTP libraries. Best for simple sites or when you need complete control over the scraping logic."}
                </p>
              </div>
            )}

            <div className="mt-1 flex items-center space-x-2">
              <a
                href={
                  scraperType === 'python'
                    ? "/api/scrapers/python/template"
                    : templateType === 'crawlee'
                      ? "/api/scrapers/crawlee/template"
                      : "/api/scrapers/typescript/template"
                }
                download={
                  scraperType === 'python'
                    ? "pricetracker_scraper_template.py"
                    : templateType === 'crawlee'
                      ? "pricetracker_crawlee_template.ts"
                      : "pricetracker_scraper_template.ts"
                }
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Download {
                  scraperType === 'python'
                    ? 'Python'
                    : templateType === 'crawlee'
                      ? 'Crawlee'
                      : 'TS'
                } Template
              </a>
              <label
                htmlFor="file-upload"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Upload {scraperType === 'python' ? '.py' : '.ts'} Script
                <input
                  id="file-upload"
                  type="file"
                  accept={scraperType === 'python' ? '.py' : '.ts'} // Accept correct file type
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || !scriptContent} // Use renamed state variable
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isValidating ? "Validating..." : "Validate Script"}
              </button>
              {/* Approve Validation button removed from here, moved below */}
            </div>
            {uploadedFile && (
              <p className="mt-2 text-sm text-gray-500">
                Uploaded: {uploadedFile.name}
              </p>
            )}
            {/* Updated Validation Result Display */}
            {/* Updated Validation Result Display */}
            {validationResult && (
              <div className={`mt-2 p-3 rounded-md ${validationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start">
                  {validationResult.success ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                     <p className={`text-sm font-medium ${validationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {validationResult.success
                          ? `Validation Successful. Found ${validationResult.sampleProducts?.length || 0} sample products.`
                          : `Validation Failed: ${validationResult.error || 'Unknown error'}`
                        }
                      </p>
                      {/* Display guidance */}
                      <p className="text-xs text-gray-600 mt-1">
                        {validationResult.success
                          ? "Review the logs and sample products below. Approve the results to enable saving."
                          : "Check the logs and terminal output below for details."
                        }
                      </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="python-code" className="block text-sm font-medium text-gray-700">
              {scraperType === 'python' ? 'Python Code' : 'TypeScript Code'}
            </label>
            <textarea
              id="python-code"
              value={scriptContent} // Use renamed state variable
              onChange={(e) => setScriptContent(e.target.value)} // Use renamed setter
              rows={18} // Increased rows for bigger code block
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm font-mono"
              placeholder={`# Paste your ${scraperType === 'python' ? 'Python' : 'TypeScript'} scraper code here`}
            />
          </div>

          {/* Removed Terminal Output Section - Use Validation Logs instead */}

        <> {/* Fragment start to wrap logs + products */}
        {/* Logs Display Section - Added */}
        {validationResult?.logs && validationResult.logs.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Validation Logs
            </label>
            <pre className="mt-1 p-2 bg-blue-50 text-blue-900 rounded-md text-xs overflow-auto max-h-60 font-mono whitespace-pre-wrap break-words">
              {validationResult.logs.map((log, _index) =>
                `[${log.ts}] [${log.lvl}] [${log.phase}] ${log.msg}${log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : ''}`
              ).join('\n')}
            </pre>
          </div>
        )} {/* <-- Correctly close the conditional rendering */}
        ) {/* <-- Moved closing parenthesis inside the curly braces */}

          {/* Approve Validation Section - Show for successful validations */}
          {validationResult?.success && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <label className="block text-sm font-medium text-gray-700">
                    {validationResult.sampleProducts && validationResult.sampleProducts.length > 0
                      ? `Sample Products (${validationResult.sampleProducts.length} found)`
                      : "Validation Results"
                    }
                  </label>
                  {/* Approve Validation button - show for all successful validations */}
                  <button
                    type="button"
                    disabled={isValidationApproved} // Only disable if already approved
                    onClick={() => setIsValidationApproved(true)}
                    className="ml-4 inline-flex items-center rounded-md border border-transparent bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidationApproved ? <><CheckCircleIcon className="h-4 w-4 mr-1.5" />Approved</> : "Approve Validation"}
                  </button>
                </div>
                {/* Removed button container div */}
              </div>

          {/* Show message for static validation (no products) */}
          {(!validationResult.sampleProducts || validationResult.sampleProducts.length === 0) && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                Static validation completed successfully. Use "Test Run" after creating the scraper to validate execution and see sample products.
              </p>
            </div>
          )}

          {/* Products Display Section - Show only when products exist */}
          {validationResult?.sampleProducts && validationResult.sampleProducts.length > 0 && (
            <div className="mt-2">

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EAN</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validationResult.sampleProducts.map((product, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className="h-12 w-12 flex items-center justify-center">
                            {product.image_url ? (
                              <a href={product.image_url} target="_blank" rel="noopener noreferrer">
                                <Image
                                  src={`/api/proxy-image?url=${encodeURIComponent(product.image_url)}`}
                                  alt={product.name || 'Product image'}
                                  width={48}
                                  height={48}
                                  className="max-h-12 max-w-12 object-contain"
                                  unoptimized // Skip Next.js image optimization for external images
                                  onError={(e) => {
                                    // Replace broken image with placeholder
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2248%22%20height%3D%2248%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23ccc%22%3E%3Cpath%20d%3D%22M0%200h24v24H0V0z%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M19%205v14H5V5h14m0-2H5c-1.1%200-2%20.9-2%202v14c0%201.1.9%202%202%202h14c1.1%200%202-.9%202-2V5c0-1.1-.9-2-2-2zm-4.86%208.86l-3%203.87L9%2013.14%206%2017h12l-3.86-5.14z%22%2F%3E%3C%2Fsvg%3E';
                                  }}
                                />
                              </a>
                            ) : (
                              <div className="h-12 w-12 bg-gray-100 flex items-center justify-center text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`text-gray-900 ${product.name ? '' : 'text-red-500'}`}>
                            {product.name || 'Missing'}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${
                            supplierId
                              ? (product.supplier_price !== undefined ? 'text-green-600 font-medium' : 'text-red-500')
                              : (product.competitor_price !== undefined ? 'text-green-600 font-medium' : 'text-red-500')
                          }`}>
                            {supplierId
                              ? (product.supplier_price !== undefined ? product.supplier_price : 'Missing')
                              : (product.competitor_price !== undefined ? product.competitor_price : 'Missing')
                            }
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${product.currency_code ? 'text-gray-900' : (!product.ean ? 'text-red-500' : 'text-yellow-600 italic')}`}>
                            {product.currency_code || 'Not set'}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${product.brand ? 'text-gray-900' : (!product.ean ? 'text-red-500' : 'text-yellow-600 italic')}`}>
                            {product.brand || (product.ean ? 'Not set' : 'Missing*')}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${product.sku ? 'text-gray-900' : (!product.ean ? 'text-red-500' : 'text-yellow-600 italic')}`}>
                            {product.sku || (product.ean ? 'Not set' : 'Missing*')}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${product.ean ? 'text-gray-900' : (product.brand && product.sku ? 'text-yellow-600 italic' : 'text-red-500')}`}>
                            {product.ean || (product.brand && product.sku ? 'Not set' : 'Missing*')}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${
                            supplierId
                              ? ((product as unknown as Record<string, unknown>).supplier_url as string ? 'text-blue-600 underline' : 'text-yellow-600 italic')
                              : ((product as unknown as Record<string, unknown>).competitor_url as string ? 'text-blue-600 underline' : 'text-yellow-600 italic')
                          }`}>
                            {supplierId ? (
                              (product as unknown as Record<string, unknown>).supplier_url as string ? (
                                <a href={(product as unknown as Record<string, unknown>).supplier_url as string} target="_blank" rel="noopener noreferrer" className="truncate block max-w-[100px]">
                                  {(product as unknown as Record<string, unknown>).supplier_url as string}
                                </a>
                              ) : 'Not set'
                            ) : (
                              (product as unknown as Record<string, unknown>).competitor_url as string ? (
                                <a href={(product as unknown as Record<string, unknown>).competitor_url as string} target="_blank" rel="noopener noreferrer" className="truncate block max-w-[100px]">
                                  {(product as unknown as Record<string, unknown>).competitor_url as string}
                                </a>
                              ) : 'Not set'
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                * Products require either an EAN or both Brand and SKU for matching.
              </p>
            </div>
          )}
            </div>
          )}
        </> {/* Fragment end */}

          {/* Filtering Options */}
          <div className="space-y-2 pt-4 border-t border-gray-200">
             <h4 className="text-sm font-medium text-gray-700">Filtering Options</h4>
             <div className="flex items-center">
               <input
                 id="filter-active-brands"
                 type="checkbox"
                 checked={filterByActiveBrands}
                 onChange={(e) => setFilterByActiveBrands(e.target.checked)}
                 className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
               />
               <label htmlFor="filter-active-brands" className="ml-2 block text-sm text-gray-900">
                 Only scrape active brands
               </label>
             </div>
             <div className="flex items-center">
               <input
                 id="filter-own-products"
                 type="checkbox"
                 checked={scrapeOnlyOwnProducts}
                 onChange={(e) => setScrapeOnlyOwnProducts(e.target.checked)}
                 className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
               />
               <label htmlFor="filter-own-products" className="ml-2 block text-sm text-gray-900">
                 Only scrape products matching my catalog
               </label>
             </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="w-64"> {/* Set a specific width for the dropdown */}
              <label htmlFor="schedule.frequency" className="block text-sm font-medium text-gray-700">
                Frequency
              </label>
              <select
                id="schedule.frequency"
                value={schedule.frequency}
                onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                // Disable if submitting, or if validation hasn't run, or if structure validation failed, or if test hasn't been approved
                // Updated disabled logic: Disable if submitting, validation hasn't run, validation failed,
                // OR if validation succeeded but requires approval (has products) and isn't approved.
                disabled={
                  isSubmitting ||
                  validationResult === null || // Disable if validation hasn't run
                  !validationResult.success || // Disable if validation failed
                  !isValidationApproved       // Disable if validation succeeded but wasn't approved
                }
                className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? (isUpdate ? "Updating..." : "Creating...") : (isUpdate ? "Update Scraper" : "Create Scraper")}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
