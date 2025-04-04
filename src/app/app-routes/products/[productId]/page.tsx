import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import crypto from 'crypto';
import DeleteButton from "@/components/ui/delete-button";
import { PriceChange as ServicePriceChange } from "@/lib/services/product-service";

// Define types for the data we'll receive from Supabase
interface Competitor {
  name: string;
  website?: string;
}

// Rename to _ScrapedProduct to indicate it's intentionally unused
interface _ScrapedProduct {
  id: string;
  user_id: string;
  scraper_id: string;
  competitor_id: string;
  product_id: string;
  name: string;
  price: number;
  currency: string;
  url?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  scraped_at: string;
  competitors: Competitor;
}

// Use the same interface as the service to ensure compatibility
type PriceChange = ServicePriceChange;

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

export const metadata: Metadata = {
  title: "Product Details | PriceTracker",
  description: "View product details and competitor prices",
};

interface ProductPageProps {
  params: {
    productId: string;
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  // Get the current user from the session
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/auth-routes/login");
  }
  
  // Get the product details from Supabase using the admin client to bypass RLS
  const supabase = createSupabaseAdminClient();
  
  // Convert the NextAuth user ID to a UUID (same as in API route)
  const userId = ensureUUID(session.user.id);
  
  // Params are directly available in server components, no await needed
  const { productId } = params;
  
  // Check if productId is a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(productId)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Invalid product ID format. Please use a valid product ID.
        </div>
      </div>
    );
  }
  
  // Fetch the product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", userId)
    .single();
  
  if (productError) {
    console.error("Error fetching product:", productError);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          Error: {productError.message}
        </div>
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Product not found or you don&apos;t have permission to view it.
        </div>
      </div>
    );
  }
  
  // Import the product service
  const { getLatestCompetitorPrices, getProductPriceHistory } = await import('@/lib/services/product-service');
  
  // Fetch latest competitor prices for this product
  let competitorPrices: PriceChange[] = [];
  try {
    competitorPrices = await getLatestCompetitorPrices(userId, productId);
  } catch (error) {
    console.error("Error fetching competitor prices:", error);
  }
  
  // Fetch price history for this product
  let priceHistory: PriceChange[] = [];
  try {
    priceHistory = await getProductPriceHistory(userId, productId, undefined, 20);
  } catch (error) {
    console.error("Error fetching price history:", error);
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-1 text-gray-600">
            {product.brand && `${product.brand} • `}
            {product.category && `${product.category} • `}
            {product.sku && `SKU: ${product.sku}`}
          </p>
        </div>
        <div className="flex space-x-2">
          <Link
            href={`/app-routes/products/${product.id}/edit`} // Corrected path
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Edit Product
          </Link>
          <DeleteButton
            id={product.id}
            name={product.name}
            endpoint="/api/products"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Product Details */}
        <div className="md:col-span-1">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Product Details</h2>
            
            {product.image_url && (
              <div className="mb-4 overflow-hidden rounded-md">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  width={500}
                  height={300}
                  className="h-auto w-full object-contain"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}
            
            <div className="space-y-3">
              {product.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Description</h3>
                  <p className="text-gray-900">{product.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Our Price</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.our_price ? `$${product.our_price.toFixed(2)}` : "Not set"}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Cost Price</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.cost_price ? `$${product.cost_price.toFixed(2)}` : "Not set"}
                  </p>
                </div>
                
                {product.ean && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">EAN/UPC</h3>
                    <p className="text-gray-900">{product.ean}</p>
                  </div>
                )}
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      product.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {product.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Competitor Prices */}
        <div className="md:col-span-2">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Competitor Prices</h2>
              <p className="text-sm text-gray-500">
                Prices are automatically tracked when competitors update their prices
              </p>
            </div>
            
            {competitorPrices && competitorPrices.length > 0 ? (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                      >
                        Competitor
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Price
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Difference
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {competitorPrices.map((priceChange: PriceChange) => {
                      const competitor = priceChange.competitors;
                      const priceDiff = product.our_price
                        ? ((priceChange.new_price - product.our_price) / product.our_price) * 100
                        : 0;
                      
                      return (
                        <tr key={priceChange.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div className="font-medium text-gray-900">
                              {competitor?.name || "Unknown"}
                            </div>
                            {/* Website link removed as it's not available in the current data structure */}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <div className="font-medium text-gray-900">
                              ${priceChange.new_price.toFixed(2)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {product.our_price ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  priceDiff > 0
                                    ? "bg-red-100 text-red-800"
                                    : priceDiff < 0
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {priceDiff > 0 ? "+" : ""}
                                {priceDiff.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-500">N/A</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {new Date(priceChange.changed_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                <p className="text-gray-500">
                  No competitor prices found for this product.
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Prices will be automatically tracked when competitors are scraped.
                </p>
              </div>
            )}
          </div>
          
          {/* Price History */}
          {priceHistory && priceHistory.length > 0 && (
            <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">Price History</h2>
              
              {/* Price History Chart */}
              <div className="mb-6 h-64 w-full">
                <div className="relative h-full w-full">
                  {/* Chart visualization */}
                  <div className="absolute inset-0 flex items-end">
                    {/* Create a simple bar chart visualization */}
                    {priceHistory.slice(0, 10).reverse().map((change: PriceChange, _index: number) => {
                      // Calculate height percentage based on price
                      const maxPrice = Math.max(...priceHistory.map(p => p.new_price));
                      const minPrice = Math.min(...priceHistory.map(p => p.new_price));
                      const range = maxPrice - minPrice;
                      const heightPercent = range > 0
                        ? ((change.new_price - minPrice) / range) * 80 + 20 // 20% minimum height
                        : 50; // Default height if all prices are the same
                      
                      return (
                        <div
                          key={change.id}
                          className="mx-1 flex flex-1 flex-col items-center"
                        >
                          <div
                            className={`w-full ${
                              change.price_change_percentage > 0
                                ? "bg-red-400"
                                : change.price_change_percentage < 0
                                  ? "bg-green-400"
                                  : "bg-gray-400"
                            }`}
                            style={{ height: `${heightPercent}%` }}
                            title={`${change.competitors?.name}: $${change.new_price.toFixed(2)}`}
                          ></div>
                          <div className="mt-1 text-xs text-gray-500">
                            {new Date(change.changed_at).toLocaleDateString().split('/').slice(0, 2).join('/')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <h3 className="mb-2 text-lg font-medium">Recent Price Changes</h3>
              <div className="space-y-4">
                {priceHistory.slice(0, 5).map((change: PriceChange) => {
                  const competitor = change.competitors;
                  const changePercent = change.price_change_percentage;
                  
                  return (
                    <div
                      key={change.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                    >
                      <div>
                        <div className="font-medium">{competitor?.name || "Unknown"}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(change.changed_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">${change.old_price.toFixed(2)}</span>
                          <svg
                            className="h-4 w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          <span className="font-medium">${change.new_price.toFixed(2)}</span>
                        </div>
                        
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            changePercent > 0
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {changePercent > 0 ? "+" : ""}
                          {changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}