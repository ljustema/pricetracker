"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ScraperConfig, ScrapedProduct } from "@/lib/services/scraper-service";
import ScraperTypeSelector from "@/components/scrapers/scraper-type-selector";
import ScraperForm from "@/components/scrapers/scraper-form";
import ScriptScraperForm from "@/components/scrapers/script-scraper-form";
import TestResultsModal from "@/components/scrapers/test-results-modal";
import { useSession } from "next-auth/react";

type Step = 'select-type' | 'create-ai' | 'create-script'; // Simplified Step type

export default function NewScraperPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('select-type');
  const [selectedScriptType, setSelectedScriptType] = useState<'python' | 'typescript' | null>(null); // Added state for selected type
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ScrapedProduct[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  
  const competitorId = params.competitorId as string;
  
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
      setStep('create-ai');
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
  
  const handleGenerateWithAI = async (url: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the API route to generate a scraper with AI
      const generateResponse = await fetch('/api/scrapers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          competitorId,
        }),
      });
      
      const config = await generateResponse.json();
      
      if (!generateResponse.ok) {
        throw new Error(config.error || 'Failed to generate scraper with AI');
      }
      
      // Call the API route to create a new scraper
      const createResponse = await fetch('/api/scrapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      const createData = await createResponse.json();
      
      if (!createResponse.ok) {
        throw new Error(createData.error || 'Failed to create scraper');
      }
      
      // Redirect to the scrapers page
      router.push(`/app-routes/competitors/${competitorId}/scrapers`);
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
  
  // Render the appropriate component based on the current step
  const renderStep = () => {
    switch (step) {
      case 'select-type':
        return <ScraperTypeSelector onSelect={handleScraperTypeSelect} />;
      case 'create-ai':
        return (
          <ScraperForm
            competitorId={competitorId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onTest={handleTest}
            onGenerateWithAI={handleGenerateWithAI}
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