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

  // Get productId from params (no need to await in server components)
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
  const { getLatestCompetitorPrices: getLatestPrices, getProductPriceHistory } = await import('@/lib/services/product-service');

  // Fetch latest prices for this product from all sources
  let competitorPrices: PriceChange[] = [];
  try {
    competitorPrices = await getLatestPrices(userId, productId);
  } catch (error) {
    console.error("Error fetching latest prices:", error);
  }

  // Fetch price history for this product
  let priceHistory: PriceChange[] = [];
  try {
    priceHistory = await getProductPriceHistory(userId, productId, undefined, 20);
  } catch (error) {
    console.error("Error fetching price history:", error);
    // Continue with empty price history
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
                    {product.wholesale_price ? `$${product.wholesale_price.toFixed(2)}` : "Not set"}
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
                      // Use source information if available, fall back to competitors
                      const sourceName = priceChange.source_name || priceChange.competitors?.name || "Unknown";
                      const sourceWebsite = priceChange.source?.website || priceChange.competitors?.website;
                      const sourceType = priceChange.source_type || "competitor";

                      const priceDiff = product.our_price
                        ? ((priceChange.new_price - product.our_price) / product.our_price) * 100
                        : 0;

                      return (
                        <tr key={priceChange.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div className="font-medium text-gray-900">
                              {sourceName}
                              {sourceType === "integration" && (
                                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                                  Integration
                                </span>
                              )}
                            </div>
                            {sourceWebsite && (
                              <div className="text-xs text-gray-500">
                                <a href={sourceWebsite} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                                  {sourceWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                </a>
                              </div>
                            )}
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
              {priceHistory.length > 1 ? (
                <>
                  {/* Chart legend */}
                  <div className="mb-2 flex items-center justify-end space-x-4 text-xs">
                    <div className="flex items-center">
                      <div className="h-px w-3 border-t-2 border-cyan-500 mr-1"></div>
                      <span>Lowest Competitor Price</span>
                    </div>
                    <div className="flex items-center">
                      <div className="h-px w-3 border-t-2 border-red-500 border-dashed mr-1"></div>
                      <span>Our Price (Above)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="h-px w-3 border-t-2 border-green-500 border-dashed mr-1"></div>
                      <span>Our Price (Below/Equal)</span>
                    </div>
                  </div>

                  <div className="mb-8 h-72 w-full">
                    <div className="relative h-full w-full">
                      {/* Process and sort price history data */}
                      {(() => {
                        // Sort price history by date (oldest to newest)
                        const sortedHistory = [...priceHistory].sort((a, b) =>
                          new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
                        );

                        // Get unique dates and find lowest price for each date
                        const dateMap = new Map<string, { date: Date; price: number; source: string }>();
                        sortedHistory.forEach(change => {
                          // Ensure price is a valid number before processing
                          if (change && typeof change.new_price === 'number' && isFinite(change.new_price)) {
                            const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
                            const existing = dateMap.get(dateStr);
                            if (!existing || change.new_price < existing.price) {
                              dateMap.set(dateStr, {
                                date: new Date(change.changed_at),
                                price: change.new_price,
                                source: change.source_name || change.competitors?.name || "Unknown"
                              });
                            }
                          }
                        });

                        // Fill in missing dates with the previous lowest price
                        if (dateMap.size > 0) {
                          const dates = Array.from(dateMap.keys()).sort();
                          const startDate = new Date(dates[0]);
                          const endDate = new Date(dates[dates.length - 1]);
                          endDate.setDate(endDate.getDate() + 1); // Add one day

                          const currentDate = new Date(startDate);
                          let lastKnownData = dateMap.get(dates[0])!;

                          while (currentDate < endDate) {
                            const dateStr = currentDate.toISOString().split('T')[0];
                            if (!dateMap.has(dateStr)) {
                              dateMap.set(dateStr, {
                                date: new Date(currentDate),
                                price: lastKnownData.price,
                                source: lastKnownData.source
                              });
                            } else {
                              lastKnownData = dateMap.get(dateStr)!;
                            }
                            currentDate.setDate(currentDate.getDate() + 1);
                          }
                        }

                        // Convert to array for rendering and sort by date
                        const lowestPricesByDate = Array.from(dateMap.values())
                          .sort((a, b) => a.date.getTime() - b.date.getTime());

                        // Filter out invalid prices before calculating min/max
                        const validPrices = lowestPricesByDate
                          .map(item => item.price)
                          .filter(price => typeof price === 'number' && isFinite(price));

                        if (product.our_price && typeof product.our_price === 'number' && isFinite(product.our_price)) {
                          validPrices.push(product.our_price);
                        }

                        if (validPrices.length === 0) {
                           return <div className="text-center text-gray-500">No valid price data available for chart.</div>;
                        }

                        const maxPrice = Math.max(...validPrices);
                        const minPrice = Math.min(...validPrices);
                        const range = maxPrice - minPrice;
                        const buffer = range === 0 ? Math.max(maxPrice * 0.1, 1) : Math.max(range * 0.1, 1);
                        const topPrice = maxPrice + buffer;
                        const bottomPrice = Math.max(0, minPrice - buffer);
                        const adjustedRange = (topPrice - bottomPrice) > 0 ? (topPrice - bottomPrice) : 1;

                        // Function to calculate Y position
                        const getYPosition = (price: number) => {
                          if (typeof price !== 'number' || !isFinite(price)) return 50;
                          const clampedPrice = Math.max(bottomPrice, Math.min(topPrice, price));
                          const percentage = ((clampedPrice - bottomPrice) / adjustedRange) * 100;
                          return 100 - Math.max(0, Math.min(100, percentage));
                        };

                        // Create price labels for Y-axis
                        const priceLabels = Array.from({ length: 5 }).map((_, i) => {
                          const price = topPrice - (i * adjustedRange / 4);
                          return (
                            <div key={i} className="flex items-center">
                              <span className="mr-1">${isFinite(price) ? price.toFixed(2) : 'N/A'}</span>
                              <div className="h-px w-2 bg-gray-300"></div>
                            </div>
                          );
                        });

                        // Only show last 30 data points if we have more
                        const baseDisplayData = lowestPricesByDate.length > 30
                          ? lowestPricesByDate.slice(-30)
                          : lowestPricesByDate;

                        // Filter out points with invalid prices *before* calculating positions
                        const displayData = baseDisplayData.filter(item => item && typeof item.price === 'number' && isFinite(item.price));

                        // Calculate X positions based on the *filtered* data
                        const totalPoints = displayData.length;
                        const getXPosition = (index: number) => {
                          if (totalPoints <= 1) return 50;
                          if (index < 0 || index >= totalPoints) return 0;
                          return (index / (totalPoints - 1)) * 100;
                        };

                        // Generate points string for competitor line, ensuring validity
                        const competitorPointsString = displayData
                          .map((item, index) => {
                            const x = getXPosition(index);
                            const y = getYPosition(item.price);
                            if (isFinite(x) && isFinite(y)) {
                              return `${x}% ${y}%`;
                            }
                            return null;
                          })
                          .filter(point => point !== null)
                          .join(' ');

                        return (
                          <>
                            {/* Y-axis labels */}
                            <div className="absolute inset-y-0 left-0 flex flex-col justify-between text-xs text-gray-500 pr-2 py-4">
                              {priceLabels}
                            </div>

                            {/* Grid lines */}
                            <div className="absolute inset-0 ml-14 flex flex-col justify-between">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="w-full h-px bg-gray-200"></div>
                              ))}
                            </div>

                            {/* Chart area */}
                            <div className="absolute inset-0 ml-14 pt-4 pb-10">
                              {/* Add viewBox, explicit z-index, and debug styles */}
                              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                 {/* Draw competitor price line as individual line segments */}
                                 {displayData.length > 1 && displayData.map((item, index) => {
                                  // Skip the last point as we'll draw from current to next
                                  if (index < displayData.length - 1) {
                                    const x1 = getXPosition(index);
                                    const y1 = getYPosition(item.price);
                                    const x2 = getXPosition(index + 1);
                                    const y2 = getYPosition(displayData[index + 1].price);

                                    return (
                                      <line
                                        key={`line-${index}`}
                                        x1={`${x1}%`}
                                        y1={`${y1}%`}
                                        x2={`${x2}%`}
                                        y2={`${y2}%`}
                                        stroke="#06b6d4" // cyan-500
                                        strokeWidth="1.5"
                                        vectorEffect="non-scaling-stroke"
                                        style={{ zIndex: 10 }} // Higher z-index than our price line
                                        />
                                      );
                                    }
                                    return null;
                                  })}


                                {/* Our price line (dotted, colored segments) - Restored */}
                                {product.our_price && isFinite(product.our_price) && displayData.length > 1 && (
                                  displayData.slice(0, -1).map((item, index) => {
                                    const nextItem = displayData[index + 1];
                                    if (!nextItem || typeof nextItem.price !== 'number' || !isFinite(nextItem.price) || typeof item.price !== 'number' || !isFinite(item.price)) return null;

                                    const x1 = getXPosition(index);
                                    const x2 = getXPosition(index + 1);
                                    const y = getYPosition(product.our_price!);

                                    if (!isFinite(x1) || !isFinite(x2) || !isFinite(y)) return null;

                                    const isAbove = product.our_price! > item.price;
                                    const color = isAbove ? "#ef4444" : "#22c55e"; // red-500 or green-500

                                    return (
                                      <line
                                        key={`our-price-segment-${index}`}
                                        x1={`${x1}%`}
                                        y1={`${y}%`}
                                        x2={`${x2}%`}
                                        y2={`${y}%`}
                                        stroke={color}
                                        strokeWidth="2"
                                        strokeDasharray="4 4"
                                        vectorEffect="non-scaling-stroke"
                                        style={{ zIndex: 5 }} // Lower z-index than competitor line
                                      />
                                    );
                                  }).filter(Boolean)
                                )}
                                {/* Draw a single point if only one data point exists for 'Our Price' - Restored */}
                                {product.our_price && isFinite(product.our_price) && displayData.length === 1 && isFinite(getXPosition(0)) && isFinite(getYPosition(product.our_price)) && isFinite(displayData[0].price) && (
                                   <circle
                                     key={`our-price-point-single`}
                                     cx={`${getXPosition(0)}%`}
                                     cy={`${getYPosition(product.our_price!)}%`}
                                     r="2"
                                     fill={product.our_price! > displayData[0].price ? "#ef4444" : "#22c55e"}
                                     stroke={product.our_price! > displayData[0].price ? "#ef4444" : "#22c55e"}
                                     strokeWidth="1"
                                     strokeDasharray="2 2"
                                     vectorEffect="non-scaling-stroke"
                                     style={{ zIndex: 5 }} // Lower z-index than competitor line
                                   />
                                )}

                              </svg>

                              {/* X-axis labels */}
                              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500" style={{ top: '100%', marginTop: '6px' }}>
                                {displayData.map((item, index) => {
                                  const pointsToSkip = totalPoints > 20 ? Math.ceil(totalPoints / 6) : totalPoints > 10 ? 2 : 1;
                                  const showLabel = index === 0 || index === totalPoints - 1 || (totalPoints > 2 && index % pointsToSkip === 0);
                                  if (!showLabel) return null;
                                  const xPos = getXPosition(index);
                                  if (!isFinite(xPos)) return null;
                                  return (
                                    <span
                                      key={`date-label-${index}`}
                                      className="absolute whitespace-nowrap"
                                      style={{ left: `${xPos}%`, transform: 'translateX(-50%)' }}
                                    >
                                      {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  );
                                }).filter(Boolean)}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mb-6 rounded-lg border border-dashed border-gray-300 p-4 text-center">
                  <p className="text-gray-500">
                    Not enough price history data to display a chart.
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    More data points will be collected as prices change.
                  </p>
                </div>
              )}

              <h3 className="mb-2 text-lg font-medium">Recent Price Changes</h3>
              <div className="space-y-4">
                {priceHistory.slice(0, 5).map((change: PriceChange) => {
                  // Use source information if available, fall back to competitors
                  const sourceName = change.source_name || change.competitors?.name || "Unknown";
                  const sourceType = change.source_type || "competitor";
                  const changePercent = change.price_change_percentage;

                  return (
                    <div
                      key={change.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                    >
                      <div>
                        <div className="font-medium">
                          {sourceName}
                          {sourceType === "integration" && (
                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                              Integration
                            </span>
                          )}
                        </div>
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