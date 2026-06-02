"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ScraperConfig, ScrapedProduct } from "@/lib/services/scraper-service";
import ScraperTypeSelector from "@/components/scrapers/scraper-type-selector";
import ScriptScraperForm from "@/components/scrapers/script-scraper-form";
import TestResultsModal from "@/components/scrapers/test-results-modal";

import AiScraperWizard from "@/components/scrapers/ai-scraper-wizard";
import ProfessionalScraperForm from "@/components/scrapers/professional-scraper-form";

export const dynamic = 'force-dynamic';

type Step = 'select-target' | 'select-type' | 'create-ai' | 'create-script' | 'validate-ai' | 'ai-wizard' | 'professional-service';
type TargetType = 'competitor' | 'supplier';

interface Competitor {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function NewScraperPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [step, setStep] = useState<Step>('select-target');
  const [targetType, setTargetType] = useState<TargetType | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedScriptType, setSelectedScriptType] = useState<'python' | 'typescript' | null>(null);
  const [_selectedScraperId, _setSelectedScraperId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ScrapedProduct[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Check for pre-selected target from URL params
  useEffect(() => {
    const competitorId = searchParams.get('competitorId');
    const supplierId = searchParams.get('supplierId');
    
    if (competitorId) {
      setTargetType('competitor');
      setSelectedTargetId(competitorId);
      setStep('select-type');
    } else if (supplierId) {
      setTargetType('supplier');
      setSelectedTargetId(supplierId);
      setStep('select-type');
    }
  }, [searchParams]);

  // Fetch competitors and suppliers
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch competitors
        const competitorsResponse = await fetch('/api/competitors');
        if (competitorsResponse.ok) {
          const competitorsData = await competitorsResponse.json();
          setCompetitors(competitorsData);
        }

        // Fetch suppliers
        const suppliersResponse = await fetch('/api/suppliers');
        if (suppliersResponse.ok) {
          const suppliersData = await suppliersResponse.json();
          setSuppliers(suppliersData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to create a scraper.
        </div>
      </div>
    );
  }

  const handleTargetSelect = (type: TargetType, targetId: string) => {
    setTargetType(type);
    setSelectedTargetId(targetId);
    setStep('select-type');
  };

  const handleScraperTypeSelect = (type: 'ai' | 'python' | 'typescript' | 'professional') => {
    if (type === 'ai') {
      setStep('ai-wizard');
      setSelectedScriptType(null);
    } else if (type === 'professional') {
      setStep('professional-service');
      setSelectedScriptType(null);
    } else {
      setSelectedScriptType(type as 'python' | 'typescript');
      setStep('create-script');
    }
  };

  const _handleSubmit = async (data: Partial<ScraperConfig>) => {
    setIsLoading(true);
    setError(null);

    try {
      const scraperData = {
        ...data,
        ...(targetType === 'competitor' 
          ? { competitor_id: selectedTargetId }
          : { supplier_id: selectedTargetId }
        ),
      };

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

      router.push(`/app-routes/scrapers`);
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

  const _handleTest = async (data: Partial<ScraperConfig>) => {
    setIsLoading(true);
    setError(null);

    try {
      const testConfig = {
        ...data,
        ...(targetType === 'competitor' 
          ? { competitor_id: selectedTargetId }
          : { supplier_id: selectedTargetId }
        ),
      };

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

      setTestResults(result.products);
      setIsTestModalOpen(true);
    } catch (err) {
      console.error("Error testing scraper:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const renderTargetSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Select Target Type</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Competitor Scraper</h3>
              <p className="mt-1 text-sm text-gray-500">
                Scrape competitor websites for price comparison and market analysis
              </p>
            </div>
            <div className="mt-4">
              <label htmlFor="competitor" className="block text-sm font-medium text-gray-700">
                Select Competitor
              </label>
              <select
                id="competitor"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                onChange={(e) => e.target.value && handleTargetSelect('competitor', e.target.value)}
              >
                <option value="">Choose a competitor...</option>
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Supplier Scraper</h3>
              <p className="mt-1 text-sm text-gray-500">
                Scrape supplier websites for procurement and sourcing data
              </p>
            </div>
            <div className="mt-4">
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
                Select Supplier
              </label>
              <select
                id="supplier"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                onChange={(e) => e.target.value && handleTargetSelect('supplier', e.target.value)}
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'select-target':
        return renderTargetSelection();

      case 'select-type':
        return <ScraperTypeSelector onSelect={handleScraperTypeSelect} />;

      case 'ai-wizard':
        return (
          <AiScraperWizard
            competitorId={targetType === 'competitor' ? selectedTargetId || '' : ''}
            onComplete={() => router.push(`/app-routes/scrapers`)}
            onCancel={handleCancel}
          />
        );

      case 'create-script':
        if (!selectedScriptType) {
          setStep('select-type');
          return <div>Error: No script type selected.</div>;
        }
        return (
          <ScriptScraperForm
            competitorId={targetType === 'competitor' ? selectedTargetId || '' : undefined}
            supplierId={targetType === 'supplier' ? selectedTargetId || '' : undefined}
            scraperType={selectedScriptType}
            onSuccess={() => router.push(`/app-routes/scrapers`)}
            onCancel={handleCancel}
          />
        );

      case 'professional-service':
        return (
          <ProfessionalScraperForm
            competitorId={targetType === 'competitor' ? selectedTargetId || '' : ''}
            onCancel={handleCancel}
          />
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  const getTargetName = () => {
    if (targetType === 'competitor') {
      const competitor = competitors.find(c => c.id === selectedTargetId);
      return competitor?.name || 'Unknown Competitor';
    } else if (targetType === 'supplier') {
      const supplier = suppliers.find(s => s.id === selectedTargetId);
      return supplier?.name || 'Unknown Supplier';
    }
    return '';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Scraper</h1>
        <p className="mt-2 text-gray-600">
          Configure a web scraper to automatically collect data from websites.
        </p>
        {targetType && selectedTargetId && (
          <p className="mt-1 text-sm text-indigo-600">
            Target: {getTargetName()} ({targetType})
          </p>
        )}
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

      <TestResultsModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        products={testResults}
      />
    </div>
  );
}
