import { createSupabaseServerClient } from "@/lib/supabase/server";
import ScraperManager from "@/components/scrapers/scraper-manager";
import { redirect } from "next/navigation";

// Updated interface to match Next.js 15 server component props
interface CompetitorScrapersPageProps {
  params: Promise<{
    competitorId: string;
  }>;
  // Optional: Add searchParams if needed
  // searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function CompetitorScrapersPage({
  params,
}: CompetitorScrapersPageProps) {
  // In App Router, params should be awaited
  const { competitorId } = await params;

  // Get the competitor details
  const supabase = await createSupabaseServerClient();
  const { data: competitor, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", competitorId)
    .single();

  if (error || !competitor) {
    // Redirect to competitors list if competitor not found
    redirect("/app-routes/competitors");
  }

  // Get the scrapers for this competitor
  const { data: scrapers } = await supabase
    .from("scrapers")
    .select("*")
    .eq("competitor_id", competitorId)
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Scrapers for {competitor.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage scrapers to collect price data from {competitor.name}
        </p>
      </div>

      <ScraperManager
        competitorId={competitorId}
        initialScrapers={scrapers || []}
      />
    </div>
  );
}