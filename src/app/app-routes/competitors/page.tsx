import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import crypto from 'crypto';
import DeleteButton from "@/components/ui/delete-button";
import { cache } from "react";

// Helper function to ensure user ID is a valid UUID (same as in API route)
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID v5 from the ID
  // Using the DNS namespace as a base
  return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

// Define type for competitor statistics
interface CompetitorStat {
  competitor_id: string;
  product_count: number;
  brand_count: number;
}

// Cache the competitors fetch to improve performance
const getCompetitors = cache(async (userId: string) => {
  const supabase = createSupabaseAdminClient();

  // First get the competitors
  const { data: competitors, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching competitors:", error);
    return [];
  }

  if (!competitors || competitors.length === 0) {
    return [];
  }

  // Get statistics for all competitors in a single efficient query
  const { data: competitorStats, error: statsError } = await supabase
    .rpc('get_competitor_statistics', { p_user_id: userId });

  if (statsError) {
    console.error("Error fetching competitor statistics:", statsError);
    // Continue with empty stats if there's an error
  }

  // Create a map of competitor_id to stats for quick lookup
  const statsMap = new Map<string, { product_count: number, brand_count: number }>();
  if (competitorStats) {
    competitorStats.forEach((stat: CompetitorStat) => {
      statsMap.set(stat.competitor_id, {
        product_count: stat.product_count || 0,
        brand_count: stat.brand_count || 0
      });
    });
  }

  // Combine competitors with their stats
  const competitorsWithCounts = competitors.map(competitor => {
    const stats = statsMap.get(competitor.id) || { product_count: 0, brand_count: 0 };
    return {
      ...competitor,
      product_count: stats.product_count,
      brand_count: stats.brand_count
    };
  });

  return competitorsWithCounts || [];
});

export const metadata: Metadata = {
  title: "Competitors | PriceTracker",
  description: "Manage your competitors and their product scrapers",
};

export default async function CompetitorsPage() {
  // Get the current user from the session
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/auth-routes/login");
  }

  // Convert the NextAuth user ID to a UUID (same as in API route)
  const userId = ensureUUID(session.user.id);

  // Fetch competitors using the cached function
  const competitors = await getCompetitors(userId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Competitors</h1>
        <Link
          href="/app-routes/competitors/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Add Competitor
        </Link>
      </div>

      {competitors && competitors.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => (
            <div
              key={competitor.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{competitor.name}</h2>
                <div className="flex space-x-2">
                  <Link
                    href={`/app-routes/competitors/${competitor.id}/edit`}
                    className="rounded-md bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    aria-label="Edit"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </Link>
                  <DeleteButton
                    id={competitor.id}
                    name={competitor.name}
                    endpoint="/api/competitors"
                  />
                </div>
              </div>

              <p className="mb-2 text-gray-600">
                <span className="font-medium">Website:</span>{" "}
                <a
                  href={competitor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {competitor.website}
                </a>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/app-routes/products?competitor=${competitor.id}`}
                  className="rounded-md bg-blue-50 p-2 hover:bg-blue-100 transition-colors"
                >
                  <p className="text-xs font-medium text-gray-500">Total Products</p>
                  <p className="text-lg font-semibold text-blue-700">{competitor.product_count}</p>
                </Link>
                <Link
                  href={`/app-routes/brands?competitor=${competitor.id}`}
                  className="rounded-md bg-purple-50 p-2 hover:bg-purple-100 transition-colors"
                >
                  <p className="text-xs font-medium text-gray-500">Total Brands</p>
                  <p className="text-lg font-semibold text-purple-700">{competitor.brand_count}</p>
                </Link>
              </div>

              <div className="mt-5 flex justify-between">
                <Link
                  href={`/app-routes/scrapers?competitorId=${competitor.id}`}
                  className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200"
                >
                  View Scrapers
                </Link>

                <Link
                  href={`/app-routes/competitors/${competitor.id}/scrapers/new`}
                  className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Add Scraper
                </Link>
              </div>
            </div>
          ))}
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
            No competitors
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first competitor.
          </p>
          <div className="mt-6">
            <Link
              href="/app-routes/competitors/new"
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
              Add Competitor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}