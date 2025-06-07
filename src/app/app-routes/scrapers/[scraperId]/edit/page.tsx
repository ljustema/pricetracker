"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ScraperConfig, ScrapedProduct } from "@/lib/services/scraper-service";
import ScriptScraperForm from "@/components/scrapers/script-scraper-form";
import TestResultsModal from "@/components/scrapers/test-results-modal";
import { useSession } from "next-auth/react";

export default function EditScraperPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraper, setScraper] = useState<ScraperConfig | null>(null);
  const [testResults, _setTestResults] = useState<ScrapedProduct[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const scraperId = params.scraperId as string;

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

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to edit a scraper.
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

  const _handleSubmit = async (data: Partial<ScraperConfig>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call the API route to update the scraper
      const response = await fetch(`/api/scrapers/${scraperId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update scraper');
      }

      // Redirect to the scrapers page
      router.push("/app-routes/scrapers");
    } catch (err) {
      console.error("Error updating scraper:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleScriptScraperSuccess = (_scraperId: string) => {
    router.push("/app-routes/scrapers");
  };

  // Render the appropriate form based on the scraper type
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {scraper.scraper_type === 'python' || scraper.scraper_type === 'typescript'
            ? `Update ${scraper.scraper_type === 'python' ? 'Python' : 'TypeScript'} Scraper`
            : 'Edit Scraper'}
        </h1>
        <p className="mt-2 text-gray-600">
          Update your scraper configuration to improve data collection.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div>
          <p className="mb-4 text-sm text-gray-500">
            To edit this {scraper.scraper_type === 'python' ? 'Python' : 'TypeScript'} scraper, please use the validation process to ensure your script works correctly.
          </p>
          <ScriptScraperForm
            competitorId={scraper.competitor_id}
            scraperType={scraper.scraper_type}
            onSuccess={handleScriptScraperSuccess}
            onCancel={handleCancel}
            initialScript={scraper.scraper_type === 'python' ? scraper.python_script : scraper.typescript_script}
            isUpdate={true}
            scraperId={scraperId}
          />
        </div>
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