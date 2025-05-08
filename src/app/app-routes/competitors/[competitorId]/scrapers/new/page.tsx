"use client";

import { useParams, useRouter } from "next/navigation";

// Set this page to be dynamically rendered to avoid static path generation issues
export const dynamic = 'force-dynamic';
import { useState } from "react";
import { ScraperConfig, ScrapedProduct } from "@/lib/services/scraper-service";
import ScraperTypeSelector from "@/components/scrapers/scraper-type-selector";
import ScriptScraperForm from "@/components/scrapers/script-scraper-form";
import TestResultsModal from "@/components/scrapers/test-results-modal";
import AiScraperValidation from "@/components/scrapers/ai-scraper-validation";
import AiScraperWizard from "@/components/scrapers/ai-scraper-wizard";
import { useSession } from "next-auth/react";

type Step = 'select-type' | 'create-ai' | 'create-script' | 'validate-ai' | 'ai-wizard'; // Added ai-wizard step

export default function NewScraperPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('select-type');
  const [selectedScriptType, setSelectedScriptType] = useState<'python' | 'typescript' | null>(null); // Added state for selected type
  const [selectedScraperId, setSelectedScraperId] = useState<string | null>(null); // Added state for selected scraper ID
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ScrapedProduct[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Ensure competitorId is a string, not a promise or undefined
  const competitorId = params?.competitorId ?
    (typeof params.competitorId === 'string' ? params.competitorId : String(params.competitorId))
    : '';

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to create a scraper.
        </div>
      </div>
    );
  }

  const handleScraperTypeSelect = (type: 'ai' | 'python' | 'typescript') => {
    if (type === 'ai') {
      // Use the multi-phase AI wizard
      setStep('ai-wizard');
      setSelectedScriptType(null); // Reset script type if AI is chosen
    } else {
      setSelectedScriptType(type); // Store the selected script type
      setStep('create-script'); // Use the simplified step
    }
  };

  const handleSubmit = async (data: Partial<ScraperConfig>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Add the competitor ID to the data
      const scraperData = {
        ...data,
        competitor_id: competitorId,
      };

      // Call the API route to create a new scraper
      const response = await fetch('/api/scrapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scraperData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create scraper');
      }

      // Redirect to the scrapers page
      router.push(`/app-routes/competitors/${competitorId}/scrapers`);
    } catch (err) {
      console.error("Error creating scraper:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleTest = async (data: Partial<ScraperConfig>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create a temporary scraper config for testing
      const testConfig = {
        ...data,
        competitor_id: competitorId,
      };

      // Call the API route to test the scraper
      const response = await fetch('/api/scrapers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testConfig),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to test scraper');
      }

      // Store the test results and open the modal
      console.log("Test results:", result);
      setTestResults(result.products);
      setIsTestModalOpen(true);
    } catch (err) {
      console.error("Error testing scraper:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAIScraper = async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call our new API route to generate a scraper with AI
      const response = await fetch('/api/scrapers/generate-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          competitorId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate scraper with AI');
      }

      // Set the selected scraper ID and change the step to validate-ai
      setSelectedScraperId(data.id);
      setStep('validate-ai');
    } catch (err) {
      console.error("Error generating scraper with AI:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScriptScraperCreated = async (_scraperId: string) => { // Renamed handler
    router.push(`/app-routes/competitors/${competitorId}/scrapers`);
  };

  const handleValidationConfirmed = () => {
    // After validation is confirmed, redirect to the scrapers page
    router.push(`/app-routes/competitors/${competitorId}/scrapers`);
  };

  // Render the appropriate component based on the current step
  const renderStep = () => {
    switch (step) {
      case 'select-type':
        return <ScraperTypeSelector onSelect={handleScraperTypeSelect} />;

      case 'ai-wizard':
        // Use the new multi-phase AI wizard
        return (
          <AiScraperWizard
            competitorId={competitorId}
            onComplete={(scraperId) => {
              // Navigate to the scrapers list page after completion
              router.push(`/app-routes/competitors/${competitorId}/scrapers`);
            }}
            onCancel={handleCancel}
          />
        );

      case 'create-ai':
        // Legacy AI form - kept for backward compatibility
        return (
          <div className="w-full max-w-8xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900">Create AI-Generated Scraper</h2>
              <p className="mt-1 text-sm text-gray-500">
                Let our AI analyze the website and generate a TypeScript Crawlee scraper for you. Ideal for standard e-commerce sites.
              </p>
            </div>
            <div className="px-6 py-4 space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Scraper Name
                </label>
                <input
                  id="name"
                  type="text"
                  value="Auto-generated based on competitor name"
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm bg-gray-100 text-gray-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Name is auto-generated following the pattern: [Competitor Name] TypeScript Scraper X
                  <br />
                  The X will be replaced with the next available number (1, 2, 3, etc.)
                </p>
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                  Website URL
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    id="url"
                    type="url"
                    required
                    className="block w-full flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="https://example.com/products"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const urlInput = document.getElementById('url') as HTMLInputElement;
                      if (urlInput && urlInput.value) {
                        handleCreateAIScraper(urlInput.value);
                      } else {
                        alert('Please enter a URL');
                      }
                    }}
                    disabled={isLoading}
                    className="ml-3 inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Generate with AI
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );

      case 'validate-ai':
        // Show the validation component for AI-generated scrapers
        if (!selectedScraperId) {
          console.error("Attempted to render validation form without a selected scraper ID.");
          setStep('select-type'); // Go back to selection
          return <div>Error: No scraper selected for validation.</div>;
        }
        return (
          <AiScraperValidation
            scraperId={selectedScraperId}
            onValidationConfirmed={handleValidationConfirmed}
            onCancel={handleCancel}
          />
        );

      case 'create-script': // Use simplified step
        if (!selectedScriptType) {
          // Should not happen if logic is correct, but good practice to handle
          console.error("Attempted to render script form without a selected type.");
          setStep('select-type'); // Go back to selection
          return <div>Error: No script type selected.</div>;
        }
        return (
          <ScriptScraperForm
            competitorId={competitorId}
            scraperType={selectedScriptType} // Pass the selected type as a prop
            onSuccess={handleScriptScraperCreated} // Use renamed handler
            onCancel={handleCancel}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Scraper</h1>
        <p className="mt-2 text-gray-600">
          Configure a web scraper to automatically collect price data from competitor websites.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
            <span className="ml-2">Processing...</span>
          </div>
        ) : (
          renderStep()
        )}
      </div>

      {/* Test Results Modal */}
      <TestResultsModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        products={testResults}
      />
    </div>
  );
}