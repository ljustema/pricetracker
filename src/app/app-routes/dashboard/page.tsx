import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import Image from "next/image";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import crypto from 'crypto';

// Helper function to ensure user ID is a valid UUID
// This converts non-UUID IDs (like Google's numeric IDs) to a deterministic UUID
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

export const metadata: Metadata = {
  title: "Dashboard | PriceTracker",
  description: "Your price tracking dashboard",
};

export default async function DashboardPage() {
  // Get the current user from the session
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/auth-routes/login");
  }

  // Get data from Supabase for the dashboard
  // Use the admin client to bypass RLS policies
  const supabase = createSupabaseAdminClient();

  // Ensure we have a valid UUID for the user ID
  const userId = ensureUUID(session.user.id);

  console.log("Using user ID for queries:", userId);

  // Get competitor count - using the correct field name from the SQL schema
  const { count: competitorCount, error: competitorError } = await supabase
    .from("competitors")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get product count - using the correct field name from the SQL schema
  const { count: productCount, error: productError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get recent price changes (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: priceChangesCount, error: priceChangesError } = await supabase
    .from("price_changes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("changed_at", sevenDaysAgo.toISOString());

  // Define types for the nested data
  type PriceChange = {
    id: string;
    product_id: string;
    old_price: number;
    new_price: number;
    changed_at: string;
    price_change_percentage: number;
    products: {
      name: string;
      sku: string;
      image_url?: string;
    };
    competitors?: {
      name: string;
    };
    integration_id?: string;
    source_type?: 'competitor' | 'integration';
  };

  // Get top price drops
  const { data: topPriceDrops, error: topPriceDropsError } = await supabase
    .from("price_changes")
    .select(`
      id,
      product_id,
      old_price,
      new_price,
      changed_at,
      price_change_percentage,
      products (
        name,
        sku,
        image_url
      ),
      competitors (
        name
      ),
      integrations (
        name
      )
    `)
    .eq("user_id", userId)
    .lt("price_change_percentage", 0) // Only price drops
    .order("price_change_percentage", { ascending: true }) // Biggest drops first
    .limit(5) as { data: PriceChange[] | null; error: Error | null };

  // Handle any errors
  if (competitorError || productError || priceChangesError || topPriceDropsError) {
    console.error("Dashboard data fetch errors:", {
      competitorError,
      productError,
      priceChangesError,
      topPriceDropsError,
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Dashboard</h1>

      {/* Stats overview */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-medium text-gray-900">Competitors</h2>
              <p className="text-3xl font-semibold text-indigo-600">{competitorCount || 0}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/app-routes/competitors"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all competitors →
            </Link>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-medium text-gray-900">Products</h2>
              <p className="text-3xl font-semibold text-indigo-600">{productCount || 0}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/app-routes/products"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all products →
            </Link>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-medium text-gray-900">Price Changes</h2>
              <p className="text-3xl font-semibold text-indigo-600">{priceChangesCount || 0}</p>
              <p className="text-sm text-gray-500">Last 7 days</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/app-routes/insights/price-changes"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View insights →
            </Link>
          </div>
        </div>
      </div>

      {/* Top price drops */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Top Price Drops</h2>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {topPriceDrops && topPriceDrops.length > 0 ? (
            <div className="divide-y">
              {topPriceDrops.map((priceChange) => (
                <div key={priceChange.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {priceChange.products.image_url ? (
                        <Image
                          src={priceChange.products.image_url}
                          alt={priceChange.products.name}
                          width={48}
                          height={48}
                          className="rounded-md"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100">
                          <svg
                            className="h-6 w-6 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <Link href={`/app-routes/products/${priceChange.product_id}`}>
                        <h3 className="text-lg font-medium text-gray-900 hover:text-indigo-600">
                          {priceChange.products.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-500">
                        {priceChange.competitors?.name || priceChange.integrations?.name || "Unknown"} • SKU: {priceChange.products.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium text-red-600">
                        {priceChange.price_change_percentage.toFixed(2)}%
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceChange.old_price)} →{' '}
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceChange.new_price)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No price drops detected in the last 7 days.</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="grid gap-6 md:grid-cols-4">
          <Link
            href="/app-routes/competitors/new"
            className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-medium text-gray-900">Add Competitor</h3>
            <p className="text-center text-sm text-gray-500">Track a new competitor</p>
          </Link>

          <Link
            href="/app-routes/products/import"
            className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-medium text-gray-900">Import Products</h3>
            <p className="text-center text-sm text-gray-500">Upload product data</p>
          </Link>

          <Link
            href="/app-routes/reports/generate"
            className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-medium text-gray-900">Generate Report</h3>
            <p className="text-center text-sm text-gray-500">Create price reports</p>
          </Link>

          <Link
            href="/app-routes/integrations"
            className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-medium text-gray-900">Add Integration</h3>
            <p className="text-center text-sm text-gray-500">Connect e-commerce platform</p>
          </Link>

          <Link
            href="/app-routes/settings"
            className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-medium text-gray-900">Settings</h3>
            <p className="text-center text-sm text-gray-500">Configure your account</p>
          </Link>
        </div>
      </div>
    </div>
  );
}