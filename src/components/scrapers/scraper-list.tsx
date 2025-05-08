"use client";

import { useState, useCallback } from "react";
import { ScraperConfig } from "@/lib/services/scraper-service";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { PlayIcon, CheckCircleIcon, XCircleIcon, PlusIcon, PencilIcon, ClockIcon } from "lucide-react";
import DeleteButton from "@/components/ui/delete-button";
import ScraperRunProgress from "./scraper-run-progress";

interface ScraperListProps {
  scrapers: ScraperConfig[];
  _competitorId: string; // Prefix with underscore to indicate it's intentionally unused
  onAddScraper: () => void;
  onEditScraper: (scraperId: string) => void;
  onViewLogs: (scraperId: string) => void;
  onRefresh: () => void;
}

export default function ScraperList({
  scrapers,
  _competitorId, // Prefix with underscore to indicate it's intentionally unused
  onAddScraper,
  onEditScraper,
  onViewLogs,
  onRefresh,
}: ScraperListProps) {
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [fullRunId, setFullRunId] = useState<string | null>(null);

  // Memoize the handleActivate function to prevent unnecessary re-renders
  const handleToggleActive = useCallback(async (scraper: ScraperConfig) => {
    if (!scraper.id) return;
    setActivatingId(scraper.id);
    try {
      await ScraperClientService.updateScraper(scraper.id, { is_active: !scraper.is_active });
      onRefresh();
    } catch (error) {
      console.error("Error toggling scraper active status:", error);
      alert(error instanceof Error ? error.message : "Failed to toggle scraper status");
    } finally {
      setActivatingId(null);
    }
  }, [onRefresh]);

  const handleApproveScraper = useCallback(async (scraperId: string) => {
    try {
      await ScraperClientService.approveScraper(scraperId);
      onRefresh();
    } catch (error) {
      console.error("Error approving scraper:", error);
      alert(error instanceof Error ? error.message : "Failed to approve scraper");
    }
  }, [onRefresh]);

  // Handle starting a test run
  const handleTestRun = useCallback(async (scraperId: string) => {
    setTestingId(scraperId);
    setTestRunId(null);

    try {
      const { runId } = await ScraperClientService.startTestRun(scraperId);
      setTestRunId(runId);
    } catch (error) {
      console.error("Error starting test run:", error);
      alert(error instanceof Error ? error.message : "Failed to start test run");
      setTestingId(null);
    }
  }, []);

  // Handle completion of a test run
  const handleRunComplete = useCallback((success: boolean) => {
    setTestingId(null);
    setTestRunId(null);

    if (success) {
      onRefresh();
    }
  }, [onRefresh]);

  // Handle starting a full run
  const handleRunScraper = useCallback(async (scraperId: string) => {
    setRunningId(scraperId);
    setFullRunId(null);

    try {
      const { runId } = await ScraperClientService.runScraper(scraperId);
      setFullRunId(runId);
    } catch (error) {
      console.error("Error starting full run:", error);
      alert(error instanceof Error ? error.message : "Failed to start full run");
      setRunningId(null);
    }
  }, []);

  // Handle completion of a full run
  const handleFullRunComplete = useCallback((success: boolean) => {
    setRunningId(null);
    setFullRunId(null);

    if (success) {
      onRefresh();
    }
  }, [onRefresh]);

  const getScraperTypeLabel = (type: string) => {
    switch (type) {
      case 'ai':
        return 'AI Generated';
      case 'python':
        return 'Python Script';
      case 'typescript':
        return 'TypeScript Script';
      default:
        return type;
    }
  };

  const getStatusBadge = (scraper: ScraperConfig) => {
    if (scraper.is_active) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Active
        </span>
      );
    }

    if (!scraper.is_approved) {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          Needs Approval
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
        Inactive
      </span>
    );
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">Scrapers</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Manage scrapers for this competitor
          </p>
        </div>
        <button
          type="button"
          onClick={onAddScraper}
          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Scraper
        </button>
      </div>

      {scrapers.length === 0 ? (
        <div className="px-4 py-5 sm:p-6 text-center">
          <p className="text-sm text-gray-500">No scrapers found for this competitor.</p>
          <button
            type="button"
            onClick={onAddScraper}
            className="mt-3 inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create your first scraper
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {scrapers.map((scraper) => { // Changed to curly braces for explicit return
            // Debug: Log scraper data before rendering the list item
            console.log(`Rendering item for ${scraper.name} (ID: ${scraper.id}): Type=${scraper.scraper_type}, Approved=${scraper.is_approved}`);
            return ( // Added explicit return
              <li key={scraper.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {scraper.is_active ? (
                      <CheckCircleIcon className="h-8 w-8 text-green-500" />
                    ) : !scraper.is_approved ? (
                      <XCircleIcon className="h-8 w-8 text-yellow-500" />
                    ) : (
                      <CheckCircleIcon className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{scraper.name}</div>
                    <div className="text-sm text-gray-500">
                      {getScraperTypeLabel(scraper.scraper_type)} • {scraper.url}
                    </div>
                    <div className="mt-1 flex items-center">
                      {getStatusBadge(scraper)}
                      <span className="ml-2 text-xs text-gray-500">
                        {scraper.schedule.frequency}, {scraper.schedule.time}
                      </span>
                      {scraper.last_run && (
                        <span className="ml-2 text-xs text-gray-500">
                          Last run: {new Date(scraper.last_run).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {/* Show test run button for approved scrapers */}
                  {(scraper.scraper_type === 'python' || scraper.scraper_type === 'typescript') && scraper.is_approved && testingId !== scraper.id && (
                    <button
                      type="button"
                      onClick={() => handleTestRun(scraper.id!)}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      <PlayIcon className="h-4 w-4 mr-1" />
                      Test Run
                    </button>
                  )}

                  {/* Approve Scraper button, only if not approved */}
                  {!scraper.is_approved && (
                    <button
                      type="button"
                      onClick={() => handleApproveScraper(scraper.id!)}
                      className="inline-flex items-center rounded-md border border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 shadow-sm hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Approve Scraper
                    </button>
                  )}

                  {/* Show progress when a test run is in progress */}
                  {testingId === scraper.id && testRunId && (
                    <div className="flex-1 min-w-0 max-w-md">
                      <div className="p-2 bg-gray-50 border border-gray-200 rounded-md">
                        <h4 className="text-xs font-medium text-gray-700 mb-1">Test Run Progress</h4>
                        <ScraperRunProgress
                          scraperId={scraper.id!}
                          runId={testRunId}
                          onComplete={handleRunComplete}
                        />
                      </div>
                    </div>
                  )}

                  {scraper.is_approved && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(scraper)}
                        disabled={activatingId === scraper.id}
                        className={`inline-flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                          scraper.is_active
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        }`}
                      >
                        {activatingId === scraper.id
                          ? (scraper.is_active ? "Deactivating..." : "Activating...")
                          : (scraper.is_active ? "Deactivate" : "Activate")}
                      </button>

                      {/* Run Now button for full scraper runs */}
                      {runningId !== scraper.id && (
                        <button
                          type="button"
                          onClick={() => handleRunScraper(scraper.id!)}
                          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Run Now
                        </button>
                      )}

                      {/* Show progress when a full run is in progress */}
                      {runningId === scraper.id && fullRunId && (
                        <div className="flex-1 min-w-0 max-w-md">
                          <div className="p-2 bg-gray-50 border border-gray-200 rounded-md">
                            <h4 className="text-xs font-medium text-gray-700 mb-1">Full Run Progress</h4>
                            <ScraperRunProgress
                              scraperId={scraper.id!}
                              runId={fullRunId}
                              onComplete={handleFullRunComplete}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onViewLogs(scraper.id!)}
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Logs
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => onEditScraper(scraper.id!)}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>

                  <DeleteButton
                    id={scraper.id!}
                    name={scraper.name}
                    endpoint="/api/scrapers"
                    onDelete={onRefresh}
                  />
                </div>
              </div>
            </li>
          );})}
        </ul>
      )}
    </div>
  );
}