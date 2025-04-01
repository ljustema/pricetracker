"use client"; // Make this a client component to use state and effects

import { useState, useEffect } from "react"; // Import hooks
// import { Metadata } from "next"; // Removed as it's unused now
import { useSession } from "next-auth/react"; // Use client-side session hook
import { redirect } from "next/navigation";
import Link from "next/link";
// import { ScraperService } from "@/lib/services/scraper-service"; // No longer needed directly
import { ScraperConfig } from "@/lib/services/scraper-types"; // Import type directly
import { Button } from "@/components/ui/button"; // Import Button component
import DeleteButton from "@/components/ui/delete-button";
import ScraperRunHistoryModal from "@/components/scrapers/scraper-run-history-modal"; // Import the modal

// Metadata needs to be handled differently for client components if needed,
// or moved to a parent server component/layout. For now, we remove it here.
// export const metadata: Metadata = {
//   title: "Scrapers | PriceTracker",
//   description: "Manage your web scrapers for competitor price tracking",
// };

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

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // Fetch combined scraper and competitor data from the new API route
          const response = await fetch('/api/scrapers/list');
          if (!response.ok) {
            throw new Error(`Failed to fetch scrapers: ${response.statusText}`);
          }
          const data = await response.json();
          setScraperData(data);

        } catch (error) {
          console.error("Error fetching scraper data:", error);
          // Handle error state if needed (e.g., show error message)
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else if (status === "unauthenticated") {
      redirect("/login");
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
  
  // Competitor fetching logic moved to useEffect
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Web Scrapers</h1>
        <Link
          href="/competitors"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Manage Competitors
        </Link>
      </div>
      
      {scraperData.length > 0 ? ( // Use scraperData
        <div className="rounded-lg border border-gray-200 bg-white shadow">
          {/* Add a wrapper div for horizontal scrolling */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Competitor
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  URL
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Schedule
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Last Run
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Execution Time
                </th>
                {/* Split header onto two lines */}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  <div>Products</div>
                  <div>/ sec</div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">{scraperData.map((scraper) => (
                  <tr key={scraper.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {scraper.name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {/* Access nested competitor name */}
                        {scraper.competitor?.name ?? "Unknown"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <a
                          href={scraper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {new URL(scraper.url).hostname}
                        </a>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {scraper.schedule.frequency.charAt(0).toUpperCase() + 
                          scraper.schedule.frequency.slice(1)}{" "}
                        at {scraper.schedule.time}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
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
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {scraper.last_run
                        ? new Date(scraper.last_run).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatExecutionTime(scraper.execution_time)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {/* Display Products/sec, formatted to 2 decimal places */}
                      {typeof scraper.last_products_per_second === 'number'
                        ? scraper.last_products_per_second.toFixed(2)
                        : 'N/A'}
                    </td>
                    {/* Actions Column - Cleaned up with Shadcn Buttons */}
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {scraper.id && ( // Ensure scraper.id exists before rendering actions
                          <>
                            <Button
                              variant="outline"
                              className="px-1.5 py-0.5 text-xs h-auto" // Smaller padding, text, auto height
                              onClick={() => openHistoryModal(scraper.id!)}
                            >
                              History
                            </Button>
                            <Button variant="outline" className="px-1.5 py-0.5 text-xs h-auto" asChild>
                              <Link href={`/scrapers/${scraper.id}/edit`}>Edit</Link>
                            </Button>
                            {/* Consider making Run/Test Run buttons that trigger API calls */}
                            <Button variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 px-1.5 py-0.5 text-xs h-auto" asChild>
                               <Link href={`/scrapers/${scraper.id}/run`}>Run</Link>
                            </Button>
                            {(scraper.scraper_type === 'python' || scraper.scraper_type === 'ai') && (
                               <Button variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-50 leading-tight text-center px-1.5 py-0.5 text-xs h-auto" asChild>
                                <Link href={`/scrapers/${scraper.id}/test-run`}><div>Run</div><div>Test</div></Link>
                               </Button>
                            )}
                            {/* DeleteButton likely already uses Shadcn Button internally */}
                            <DeleteButton
                              id={scraper.id}
                              name={scraper.name}
                              endpoint="/api/scrapers"
                              // onDeleted={() => setScraperData(prev => prev.filter(s => s.id !== scraper.id))} // Example refresh
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
              ))} {/* Correct closing for map */}
            </tbody>
            </table>
          </div> {/* Close the scrolling wrapper div */}
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
              href="/competitors"
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
      {/* Removed extra closing tag */}

      {/* Render the Modal */}
      <ScraperRunHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={closeHistoryModal}
        scraperId={selectedScraperId}
      />
    </div>
  );
}