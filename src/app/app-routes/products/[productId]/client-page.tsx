"use client";

import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import Image from "next/image";
import Link from "next/link";
import DeleteButton from "@/components/ui/delete-button";
import { PriceChange } from "@/lib/services/product-service";
import PriceHistoryChart from "@/components/products/PriceHistoryChart";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  sku: string | null;
  image_url: string | null;
  description: string | null;
  our_price: number | null;
  wholesale_price: number | null;
  is_active: boolean | null;
  ean: string | null;
  url: string | null;
}

interface ClientProductPageProps {
  product: Product;
  competitorPrices: PriceChange[];
  priceHistory: PriceChange[];
}

export default function ClientProductPage({ product, competitorPrices, priceHistory }: ClientProductPageProps) {
  const { formatPrice } = useCurrencyFormatter();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link
          href="/app-routes/products"
          className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Products
        </Link>
      </div>

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
            href={`/app-routes/products/${product.id}/edit`}
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
                  src={`/api/proxy-image?url=${encodeURIComponent(product.image_url)}`}
                  alt={product.name}
                  width={500}
                  height={300}
                  className="h-auto w-full object-contain"
                  style={{ maxHeight: '300px' }}
                  unoptimized // Skip Next.js image optimization for external images
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error(`Failed to load image: ${product.image_url}`);
                    // Fallback to a placeholder image
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22500%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23ccc%22%3E%3Cpath%20d%3D%22M0%200h24v24H0V0z%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M19%205v14H5V5h14m0-2H5c-1.1%200-2%20.9-2%202v14c0%201.1.9%202%202%202h14c1.1%200%202-.9%202-2V5c0-1.1-.9-2-2-2zm-4.86%208.86l-3%203.87L9%2013.14%206%2017h12l-3.86-5.14z%22%2F%3E%3C%2Fsvg%3E';
                  }}
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
                    {product.our_price ? formatPrice(product.our_price) : "Not set"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Wholesale Price</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.wholesale_price ? formatPrice(product.wholesale_price) : "Not set"}
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

                {product.url && (
                  <div className="col-span-2 mt-2">
                    <h3 className="text-sm font-medium text-gray-500">Product URL</h3>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-900 hover:underline text-sm"
                    >
                      {product.url}
                    </a>
                  </div>
                )}
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
                      const productUrl = priceChange.url;

                      const priceDiff = product.our_price
                        ? ((priceChange.new_price - product.our_price) / product.our_price) * 100
                        : 0;

                      return (
                        <tr key={priceChange.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div className="font-medium text-gray-900">
                              {productUrl ? (
                                <a
                                  href={productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                >
                                  {sourceName}
                                </a>
                              ) : (
                                <span>{sourceName}</span>
                              )}
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
                              {formatPrice(priceChange.new_price)}
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

          {/* Price History Chart */}
          {priceHistory && priceHistory.length > 0 && (
            <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-medium">Price History</h3>
              <PriceHistoryChart priceHistory={priceHistory} ourPrice={product.our_price} />

              <h3 className="mt-6 mb-2 text-lg font-medium">Recent Price Changes</h3>
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
                          <span className="text-gray-500">{formatPrice(change.old_price)}</span>
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
                          <span className="font-medium">{formatPrice(change.new_price)}</span>
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
