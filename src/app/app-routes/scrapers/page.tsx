"use client"; // Make this a client component to use state and effects

import { useState, useEffect } from "react"; // Import hooks
// import { Metadata } from "next"; // Removed as it's unused now
import { useSession } from "next-auth/react"; // Use client-side session hook
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
// import { ScraperService } from "@/lib/services/scraper-service"; // No longer needed directly
import { ScraperConfig } from "@/lib/services/scraper-types"; // Import type directly

// Define type for scraper run
interface ScraperRun {
  id: string;
  scraper_id: string;
  status: string;
  started_at?: string;
}
import { Button } from "@/components/ui/button"; // Import Button component
import DeleteButton from "@/components/ui/delete-button";
import ScraperRunHistoryModal from "@/components/scrapers/scraper-run-history-modal"; // Import the modal
import ActivateButton from "./activate-button"; // Import ActivateButton component
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Helper function to format execution time in hours, minutes, seconds
function formatExecutionTime(milliseconds?: number): string {
  if (!milliseconds) return "N/A";

  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
}

export default function ScrapersPage() {
  const { data: session, status } = useSession(); // Use client hook
  // Combined scraper and competitor data state
  const [scraperData, setScraperData] = useState<(ScraperConfig & { competitor: { name: string; website: string } | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedScraperId, setSelectedScraperId] = useState<string | null>(null);
  const [activeRuns, setActiveRuns] = useState<{[key: string]: string}>({});

  // Get the router to check for refresh parameter
  const router = useRouter();

  // Function to check for active runs
  const checkActiveRuns = async () => {
    try {
      const response = await fetch('/api/scrapers/active-runs');
      if (!response.ok) {
        console.error('Failed to fetch active runs');
        return;
      }
      const data = await response.json();

      // Create a map of scraper IDs to run IDs
      const activeRunsMap: {[key: string]: string} = {};
      if (data && data.runs) {
        data.runs.forEach((run: ScraperRun) => {
          activeRunsMap[run.scraper_id] = run.id;
        });
      }

      setActiveRuns(activeRunsMap);
    } catch (error) {
      console.error('Error checking active runs:', error);
    }
  };

  // Function to fetch scraper data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch combined scraper and competitor data from the new API route
      const response = await fetch('/api/scrapers/list');
      if (!response.ok) {
        throw new Error(`Failed to fetch scrapers: ${response.statusText}`);
      }
      const data = await response.json();
      // Sort the scrapers by name
      const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setScraperData(sortedData);

      // Check for active runs
      await checkActiveRuns();

    } catch (error) {
      console.error("Error fetching scraper data:", error);
      // Handle error state if needed (e.g., show error message)
    } finally {
      setIsLoading(false);
    }
  };

  // Check for refresh parameter in URL
  useEffect(() => {
    // Get the current URL search params
    const searchParams = new URLSearchParams(window.location.search);
    const refreshParam = searchParams.get('refresh');

    // If refresh parameter exists, fetch data and then remove the parameter
    if (refreshParam) {
      fetchData();

      // Remove the refresh parameter from the URL without triggering a navigation
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [router]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchData();

      // Set up polling for active runs every 30 seconds
      const interval = setInterval(checkActiveRuns, 30000);
      return () => clearInterval(interval);
    } else if (status === "unauthenticated") {
      redirect("/auth-routes/login");
    }
  }, [session, status]);

  // Handle loading state
  if (status === "loading" || isLoading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading scrapers...</div>;
  }

  // Handle unauthenticated state (redundant due to redirect but good practice)
  if (!session?.user) {
     // Redirect logic is handled by useEffect, this is a fallback.
     // Consider returning null or a specific message if redirect hasn't happened yet.
     return null;
  }

  const openHistoryModal = (scraperId: string) => {
    setSelectedScraperId(scraperId);
    setIsHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedScraperId(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Web Scrapers</h1>
        <Link
          href="/app-routes/competitors"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Manage Competitors
        </Link>
      </div>

      {scraperData.length > 0 ? ( // Use scraperData
        <div className="rounded-lg border border-gray-200 bg-white shadow">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Competitor
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  URL
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Schedule
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Last Run
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Time
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  P/s
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Active
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {scraperData.map((scraper) => (
                <tr key={scraper.id}>
                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {scraper.name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="text-sm text-gray-900">
                        {scraper.competitor?.name ?? "Unknown"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="text-sm text-gray-900">
                        <a
                          href={scraper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {scraper.url ? new URL(scraper.url).hostname : 'N/A'}
                        </a>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <div className="text-sm text-gray-900">
                        {scraper.schedule.frequency.charAt(0).toUpperCase() +
                          scraper.schedule.frequency.slice(1).substring(0, 3)}{" "}
                        {scraper.schedule.time}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      {activeRuns[scraper.id] ? (
                        <Link
                          href={`/app-routes/scrapers/${scraper.id}/run?runId=${activeRuns[scraper.id]}`}
                          className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-blue-100 text-blue-800 hover:bg-blue-200"
                        >
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                          running
                        </Link>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            scraper.status === "success"
                              ? "bg-green-100 text-green-800"
                              : scraper.status === "running"
                              ? "bg-blue-100 text-blue-800"
                              : scraper.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {scraper.status || "idle"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {scraper.last_run
                        ? new Date(scraper.last_run).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {formatExecutionTime(scraper.execution_time)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-center text-sm text-gray-500">
                      {typeof scraper.last_products_per_second === 'number'
                        ? scraper.last_products_per_second.toFixed(1)
                        : 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <span className="flex items-center">
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${scraper.is_active ? 'bg-green-100' : 'bg-red-100'} border ${scraper.is_active ? 'border-green-800' : 'border-red-800'}`}
                          title={scraper.is_active ? 'Active' : 'Inactive'}
                        ></span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-center text-sm font-medium">
                      {scraper.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openHistoryModal(scraper.id!)}
                              className="cursor-pointer"
                            >
                              View History
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/app-routes/scrapers/${scraper.id}/edit`}>
                                Edit Scraper
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/app-routes/scrapers/${scraper.id}/run${activeRuns[scraper.id] ? `?runId=${activeRuns[scraper.id]}` : ''}`}
                                className="text-green-700 flex items-center justify-between w-full"
                              >
                                Run Scraper
                                {activeRuns[scraper.id] && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    Running
                                  </span>
                                )}
                              </Link>
                            </DropdownMenuItem>
                            {(scraper.scraper_type === 'python' || scraper.scraper_type === 'typescript') && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/app-routes/scrapers/${scraper.id}/run-test`}
                                  className="text-blue-700"
                                >
                                  Run Test
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <ActivateButton
                                scraperId={scraper.id}
                                isActive={scraper.is_active}
                                onActivated={() => {
                                  // Refresh the list after activation
                                  const fetchData = async () => {
                                    setIsLoading(true);
                                    try {
                                      const response = await fetch('/api/scrapers/list');
                                      if (!response.ok) {
                                        throw new Error(`Failed to fetch scrapers: ${response.statusText}`);
                                      }
                                      const data = await response.json();
                                      const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name));
                                      setScraperData(sortedData);
                                    } catch (error) {
                                      console.error("Error fetching scraper data:", error);
                                    } finally {
                                      setIsLoading(false);
                                    }
                                  };
                                  fetchData();
                                }}
                              />
                            </DropdownMenuItem>
                            <div className="px-2 py-1.5">
                              <DeleteButton
                                id={scraper.id}
                                name={scraper.name}
                                endpoint="/api/scrapers"
                              />
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No scrapers
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a scraper to a competitor.
          </p>
          <div className="mt-6">
            <Link
              href="/app-routes/competitors"
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Manage Competitors
            </Link>
          </div>
        </div>
      )}

      {/* Render the Modal */}
      <ScraperRunHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={closeHistoryModal}
        scraperId={selectedScraperId}
      />
    </div>
  );
}