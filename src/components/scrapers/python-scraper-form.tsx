"use client";

import { useState, useEffect } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { UploadIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
// Removed unused import: import TestResultsModal from "./test-results-modal";
import { ScrapedProduct } from "@/lib/services/scraper-service";
import Image from "next/image";

interface PythonScraperFormProps {
  competitorId: string;
  onSuccess: (scraperId: string) => void;
  onCancel: () => void;
  initialScript?: string;
  isUpdate?: boolean;
  scraperId?: string;
}

export default function PythonScraperForm({
  competitorId,
  onSuccess,
  onCancel,
  initialScript,
  isUpdate = false,
  scraperId,
}: PythonScraperFormProps) {
  const [competitorName, setCompetitorName] = useState("");
  const [pythonScript, setPythonScript] = useState(initialScript || "");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scraperType, setScraperType] = useState<'python' | 'crawlee'>('python'); // Add state for type, default to python
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean; // Structure validation
    error?: string; // Structure validation error
    executionError?: string | null; // Error during script execution/parsing
    rawStdout?: string;
    rawStderr?: string;
    totalProductsFound?: number;
    metadata?: {
      name: string;
      description: string;
      version: string;
      author: string;
      target_url: string;
      required_libraries: string[];
    };
    products?: ScrapedProduct[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestApproved, setIsTestApproved] = useState<boolean | null>(null); // State for manual approval
  const [schedule, setSchedule] = useState<{
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
  }>({
    frequency: "daily",
    time: "02:00",
  });

  // Fetch competitor name when component mounts
  useEffect(() => {
    const fetchCompetitorName = async () => {
      try {
        const response = await fetch(`/api/competitors/${competitorId}`);
        if (response.ok) {
          const competitor = await response.json();
          setCompetitorName(competitor.name);
        } else {
          console.error("Failed to fetch competitor name");
        }
      } catch (error) {
        console.error("Error fetching competitor name:", error);
      }
    };

    fetchCompetitorName();
  }, [competitorId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    // Read the file content
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPythonScript(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!pythonScript.trim()) {
      alert("Please enter or upload Python script first");
      return;
    }

    setIsValidating(true);
    setValidationResult(null); // Clear previous results
    setIsTestApproved(null); // Reset approval status

    try {
      // Call validation without the URL
      // Call the renamed validation function and pass the type
      const result = await ScraperClientService.validateScraper(pythonScript, scraperType);
      // The result now includes executionError, rawStdout, rawStderr, totalProductsFound
      setValidationResult(result);

      // No need to set name from metadata anymore as it's auto-generated
      
      // Inline display replaces the modal logic
      // No need to explicitly open anything here, the component will re-render with results

    } catch (error) {
      // This catch block handles errors in the API call itself (e.g., network error)
      console.error("Error calling validation API:", error);
      setValidationResult({
        valid: false, // Mark as invalid structure validation on API error
        error: "API Error: " + (error instanceof Error ? error.message : "Unknown error occurred"),
        // Ensure output fields are initialized
        rawStdout: '',
        rawStderr: '',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validationResult?.valid) {
      alert("Please validate the script structure first (ignore execution errors if intended)");
      // Only require script validation, name is now optional, URL removed
      return;
    }

    if (isTestApproved !== true) {
      alert("Please approve the validation results before " + (isUpdate ? "updating" : "creating") + " the scraper");
      return;
    }

    // Get URL from metadata if available, otherwise use an empty string
    // The backend will handle synchronization between metadata and database URL
    const targetUrl = validationResult?.metadata?.target_url || "";
    
    // Check if script is present (name is optional now)
    if (!pythonScript) {
       alert("Python script cannot be empty.");
       return;
    }
    setIsSubmitting(true);

    try {
      if (isUpdate && scraperId) {
        // Update existing scraper using direct fetch
        console.log("Updating scraper with ID:", scraperId);
        console.log("Update payload:", {
          // Include scraper_type in update payload if needed by backend PUT route
          scraper_type: scraperType,
          [scraperType === 'python' ? 'python_script' : 'typescript_script']: pythonScript ? pythonScript.substring(0, 100) + "..." : "undefined", // Log correct script key
          url: targetUrl,
          schedule,
        });
        
        const response = await fetch(`/api/scrapers/${scraperId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Send type and correct script key
            scraper_type: scraperType,
            [scraperType === 'python' ? 'python_script' : 'typescript_script']: pythonScript,
            url: targetUrl,
            schedule,
          }),
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
          url: targetUrl,
          scraper_type: scraperType, // Pass the selected type
          scriptContent: pythonScript, // Pass the script content
          schedule,
        });
        onSuccess(scraper.id);
      }
    } catch (error) {
      console.error(`Error ${isUpdate ? "updating" : "creating"} Python scraper:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${isUpdate ? "update" : "create"} scraper`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-8xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">{isUpdate ? "Update Python Scraper" : "Create Python Scraper"}</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload or write a custom Python scraper for maximum flexibility
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
              value={competitorName ? `${competitorName} Python Scraper X` : "Loading..."}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm bg-gray-100 text-gray-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Name is auto-generated following the pattern: [Competitor Name] Python Scraper X
              <br />
              The X will be replaced with the next available number (1, 2, 3, etc.)
            </p>
          </div>

           {/* Scraper Type Selection */}
           <div>
             <label htmlFor="scraper-type" className="block text-sm font-medium text-gray-700">
               Scraper Type
             </label>
             <select
               id="scraper-type"
               value={scraperType}
               onChange={(e) => setScraperType(e.target.value as 'python' | 'crawlee')}
               className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
             >
               <option value="python">Python</option>
               <option value="crawlee">Crawlee (TypeScript)</option>
             </select>
             <p className="mt-1 text-xs text-gray-500">
                Select the type of scraper code you are providing.
             </p>
           </div>

          {/* Removed Target Website URL input */}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Script Content ({scraperType === 'python' ? 'Python' : 'TypeScript'})
            </label>
            <div className="mt-1 flex items-center space-x-2">
              <a
                href="/api/scrapers/python/template"
                download="pricetracker_scraper_template.py"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                Download {scraperType === 'python' ? 'Python' : 'TS'} Template
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
                disabled={isValidating || !pythonScript}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isValidating ? "Validating..." : "Validate Script"}
              </button>
            </div>
            {uploadedFile && (
              <p className="mt-2 text-sm text-gray-500">
                Uploaded: {uploadedFile.name}
              </p>
            )}
            {/* Updated Validation Result Display */}
            {validationResult && (
              <div className={`mt-2 p-2 rounded-md ${validationResult.valid && !validationResult.executionError ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center">
                  {validationResult.valid && !validationResult.executionError ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  )}
                  <div className="flex flex-col">
                     <p className={`text-sm ${validationResult.valid && !validationResult.executionError ? 'text-green-700' : 'text-red-700'}`}>
                        {/* Structure Validation Status */}
                        {!validationResult.valid 
                          ? `Structure validation failed: ${validationResult.error}`
                          : validationResult.executionError
                            ? `Script execution failed: ${validationResult.executionError}`
                            : validationResult.totalProductsFound !== undefined
                              ? `Script executed successfully. Found ${validationResult.totalProductsFound} total products (showing first ${validationResult.products?.length || 0}).`
                              : "Script executed successfully, but did not return product count."
                        }
                        {/* Add guidance to check terminal output if there was an error */}
                        {(validationResult.executionError || (validationResult.rawStderr && validationResult.rawStderr.length > 0)) && (
                          <span className="block text-xs text-gray-500 mt-1">Check terminal output below for details.</span>
                        )}
                      </p>
                      {/* Removed View Products button - results shown inline */}
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
              value={pythonScript}
              onChange={(e) => setPythonScript(e.target.value)}
              rows={18} // Increased rows for bigger code block
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm font-mono"
              placeholder={`# Paste your ${scraperType === 'python' ? 'Python' : 'TypeScript'} scraper code here`}
            />
          </div>
          
          {/* Terminal Output Section - Always display */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terminal Output
            </label>
            <div className="space-y-2">
              {/* Display Stdout */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600">Standard Output (stdout):</h4>
                <pre className="mt-1 p-2 bg-gray-100 text-gray-800 rounded-md text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap break-words">
                  {validationResult?.rawStdout || "No output yet. Click 'Validate Script' to see results."}
                </pre>
              </div>
              {/* Display Stderr only if there are errors */}
              {validationResult?.rawStderr && validationResult.rawStderr.trim().length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-600">Standard Error (stderr):</h4>
                  <pre className="mt-1 p-2 bg-red-50 text-red-800 rounded-md text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap break-words">
                    {validationResult.rawStderr}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Products Display Section - Show after validation */}
          {validationResult?.products && validationResult.products.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <label className="block text-sm font-medium text-gray-700">
                    Scraped Products ({validationResult.products.length} shown of {validationResult.totalProductsFound || 0} total)
                  </label>
                  {isTestApproved === true && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                      Approved
                    </span>
                  )}
                  {isTestApproved === false && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircleIcon className="h-3 w-3 mr-1" />
                      Declined
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsTestApproved(true)}
                    className="inline-flex items-center rounded-md border border-transparent bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    Approve Results
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTestApproved(false)}
                    className="inline-flex items-center rounded-md border border-transparent bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Decline Results
                  </button>
                </div>
              </div>
              
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
                    {validationResult.products.map((product, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className="h-12 w-12 flex items-center justify-center">
                            {product.image_url ? (
                              <a href={product.image_url} target="_blank" rel="noopener noreferrer">
                                <Image
                                  src={product.image_url}
                                  alt={product.name || 'Product image'}
                                  width={48}
                                  height={48}
                                  className="max-h-12 max-w-12 object-contain"
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
                          <div className={`${product.price !== undefined ? 'text-green-600 font-medium' : 'text-red-500'}`}>
                            {product.price !== undefined ? product.price : 'Missing'}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <div className={`${product.currency ? 'text-gray-900' : 'text-yellow-600 italic'}`}>
                            {product.currency || 'Not set'}
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
                          <div className={`${product.url ? 'text-blue-600 underline' : 'text-yellow-600 italic'}`}>
                            {product.url ? (
                              <a href={product.url} target="_blank" rel="noopener noreferrer" className="truncate block max-w-[100px]">
                                {product.url}
                              </a>
                            ) : 'Not set'}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
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

            <div>
              <label htmlFor="schedule.time" className="block text-sm font-medium text-gray-700">
                Time (24h format)
              </label>
              <input
                id="schedule.time"
                type="time"
                value={schedule.time}
                onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
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
            disabled={isSubmitting || validationResult === null || !validationResult.valid || isTestApproved !== true}
            className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? (isUpdate ? "Updating..." : "Creating...") : (isUpdate ? "Update Scraper" : "Create Scraper")}
          </button>
        </div>
      </form>
    </div>
  );
}
