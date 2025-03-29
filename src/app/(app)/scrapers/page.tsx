import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScraperService } from "@/lib/services/scraper-service";
import DeleteButton from "@/components/ui/delete-button";

export const metadata: Metadata = {
  title: "Scrapers | PriceTracker",
  description: "Manage your web scrapers for competitor price tracking",
};

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

export default async function ScrapersPage() {
  // Get the current user from the session
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login");
  }
  // Get all scrapers for the user
  const scrapers = await ScraperService.getScrapersByUser(session.user.id);
  
  // Get competitor information for each scraper
  const competitorIds = [...new Set(scrapers.map(scraper => scraper.competitor_id))];
  
  let competitors: Record<string, { id: string; name: string; website: string }> = {};
  
  if (competitorIds.length > 0) {
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createSupabaseAdminClient();
    
    const { data: competitorsData, error: competitorsError } = await supabaseAdmin
      .from("competitors")
      .select("id, name, website")
      .in("id", competitorIds);
    
    if (competitorsError) {
      console.error("Error fetching competitors:", competitorsError);
    } else if (competitorsData) {
      competitors = competitorsData.reduce((acc, competitor) => {
        acc[competitor.id] = competitor;
        return acc;
      }, {} as Record<string, { id: string; name: string; website: string }>);
    }
  }
  
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
      
      {scrapers && scrapers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
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
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {scrapers.map((scraper) => {
                const competitor = competitors[scraper.competitor_id];
                
                return (
                  <tr key={scraper.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {scraper.name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {competitor ? competitor.name : "Unknown"}
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
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/scrapers/${scraper.id}/edit`}
                          className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/scrapers/${scraper.id}/run`}
                          className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          Run
                        </Link>
                        {(scraper.scraper_type === 'python' || scraper.scraper_type === 'ai') && (
                          <Link
                            href={`/scrapers/${scraper.id}/test-run`}
                            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Run Test
                          </Link>
                        )}
                        <DeleteButton
                          id={scraper.id}
                          name={scraper.name}
                          endpoint="/api/scrapers"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </div>
  );
}