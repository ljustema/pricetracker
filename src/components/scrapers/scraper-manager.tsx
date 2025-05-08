"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ScraperConfig } from "@/lib/services/scraper-service";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import dynamic from 'next/dynamic';
import ScraperList from "./scraper-list";

// Dynamically import components to reduce initial bundle size
const ScraperTypeSelector = dynamic(() => import('./scraper-type-selector'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});

const ScriptScraperForm = dynamic(() => import('./script-scraper-form'), {
  loading: () => <div>Loading...</div>,
  ssr: false
}); // Updated to new unified script scraper form, old python-scraper-form removed

const AiScraperValidation = dynamic(() => import('./ai-scraper-validation'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});

const ScraperLogViewer = dynamic(() => import('./scraper-log-viewer'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});

interface ScraperManagerProps {
  competitorId: string;
  initialScrapers?: ScraperConfig[];
}

type Step = 'list' | 'select-type' | 'create-ai' | 'create-python' | 'create-typescript' | 'validate-ai' | 'test' | 'view-logs'; // Added validate-ai step

export default function ScraperManager({
  competitorId,
  initialScrapers = [],
}: ScraperManagerProps) {
  const [step, setStep] = useState<Step>('list');
  const [scrapers, setScrapers] = useState<ScraperConfig[]>(initialScrapers);
  const [selectedScraperId, setSelectedScraperId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [competitorName, setCompetitorName] = useState<string>("");

  // Memoize the filtered scrapers to avoid unnecessary re-renders
  const filteredScrapers = useMemo(() => {
    return initialScrapers.length > 0
      ? initialScrapers
      : scrapers.filter(s => s.competitor_id === competitorId);
  }, [competitorId, initialScrapers, scrapers]);

  const loadScrapers = useCallback(async () => {
    if (initialScrapers.length > 0) {
      setScrapers(initialScrapers);
      return;
    }

    setIsLoading(true);
    try {
      const loadedScrapers = await ScraperClientService.getScrapersByUser('current');
      setScrapers(loadedScrapers.filter(s => s.competitor_id === competitorId));
    } catch (error) {
      console.error("Error loading scrapers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [competitorId, initialScrapers]);

  // Fetch competitor name
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

    if (competitorId) {
      fetchCompetitorName();
    }
  }, [competitorId]);

  // Only load scrapers once on initial render
  useEffect(() => {
    loadScrapers();
  }, [loadScrapers]);

  const handleAddScraper = () => {
    setStep('select-type');
  };

  const handleScraperTypeSelect = (type: 'ai' | 'python' | 'typescript') => {
    switch (type) {
      case 'ai':
        setStep('create-ai');
        break;
      case 'python':
        setStep('create-python');
        break;
      case 'typescript':
        setStep('create-typescript');
        break;
    }
  }; // Updated to support Python and TypeScript scraper types explicitly

  const handleCreateAIScraper = async (url: string) => {
    setIsLoading(true);
    try {
      const scraper = await ScraperClientService.createAIScraper(url, competitorId);
      setScrapers([...scrapers, scraper]);
      setSelectedScraperId(scraper.id);
      setStep('validate-ai'); // Go to validation step instead of test
    } catch (error) {
      console.error("Error creating AI scraper:", error);
      alert(error instanceof Error ? error.message : "Failed to create AI scraper");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScraperCreated = (scraperId: string) => {
    loadScrapers();
    setSelectedScraperId(scraperId);
    setStep('test');
  };

  const handleEditScraper = (scraperId: string) => {
    // For now, we'll just show the test panel for the selected scraper
    setSelectedScraperId(scraperId);
    setStep('test');
  };

  // This method is no longer needed as we're removing the test panel
  // and will handle test runs directly from the scraper list

  const handleViewLogs = (scraperId: string) => {
    setSelectedScraperId(scraperId);
    setStep('view-logs');
  };

  const _handleApprove = async () => {
    if (!selectedScraperId) return;

    setIsLoading(true);
    try {
      await ScraperClientService.approveScraper(selectedScraperId);
      await loadScrapers();
      setStep('list');
    } catch (error) {
      console.error("Error approving scraper:", error);
      alert(error instanceof Error ? error.message : "Failed to approve scraper");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStep('list');
    setSelectedScraperId(null);
  };

  const getSelectedScraper = () => {
    return scrapers.find(s => s.id === selectedScraperId);
  };

  // Handle validation confirmation
  const handleValidationConfirmed = () => {
    // After validation is confirmed, go to the list view
    setStep('list');
    // Refresh the scrapers list
    loadScrapers();
  };

  // Render the appropriate component based on the current step
  const renderStep = () => {
    switch (step) {
      case 'list':
        return (
          <ScraperList
            scrapers={filteredScrapers}
            _competitorId={competitorId}
            onAddScraper={handleAddScraper}
            onEditScraper={handleEditScraper}
            onViewLogs={handleViewLogs}
            onRefresh={loadScrapers}
          />
        );
      case 'select-type':
        return (
          <ScraperTypeSelector onSelect={handleScraperTypeSelect} />
        );
      case 'create-ai':
        // For AI scrapers, we'll just use the URL to generate the scraper
        // and then show the validation panel
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
                  value={`${competitorName ? `${competitorName} TypeScript Scraper X` : "Loading..."}`}
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
          return <div>No scraper selected</div>;
        }
        return (
          <AiScraperValidation
            scraperId={selectedScraperId}
            onValidationConfirmed={handleValidationConfirmed}
            onCancel={handleCancel}
          />
        );
      case 'create-python':
        return (
          <ScriptScraperForm
            competitorId={competitorId}
            scraperType="python"
            onSuccess={handleScraperCreated}
            onCancel={handleCancel}
          />
        );
      case 'create-typescript':
        return (
          <ScriptScraperForm
            competitorId={competitorId}
            scraperType="typescript"
            onSuccess={handleScraperCreated}
            onCancel={handleCancel}
          />
        );
      case 'test':
        // We're removing the test panel, so we'll just redirect to the list view
        // This case should no longer be reached, but we'll handle it gracefully
        return (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-700">
                The test panel has been removed. Test runs are now handled directly from the scraper list.
              </p>
              <button
                onClick={() => setStep('list')}
                className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Return to List
              </button>
            </div>
          </div>
        );
      case 'view-logs':
        const logScraper = getSelectedScraper();
        if (!logScraper) {
          return <div>No scraper selected</div>;
        }
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                Logs for {logScraper.name}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Back
              </button>
            </div>
            <ScraperLogViewer scraperRunId={logScraper.id!} />
          </div>
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading scrapers...</span>
        </div>
      ) : (
        renderStep()
      )}
    </div>
  );
}