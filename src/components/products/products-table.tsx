"use client";

import Link from "next/link";
import Image from "next/image";
import DeleteButton from "@/components/ui/delete-button";
import type { Product } from "@/lib/services/product-service"; // Import the shared type
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter"; // Import our new hook

// Removed unused CompetitorPrice interface

// # Reason: Removed local Product interface to avoid conflict with imported type.

interface ProductsTableProps {
  products: Product[];
  competitors: { id: string; name: string }[];
  onDelete?: (productId: string) => void;
}

export default function ProductsTable({ products, competitors, onDelete }: ProductsTableProps) {
  const { formatPrice } = useCurrencyFormatter();

  // Ensure products have competitor_prices and source_prices
  const productsWithPrices = products.map(product => ({
    ...product,
    competitor_prices: product.competitor_prices || {},
    source_prices: product.source_prices || {}
  }));

  // Handle delete callback
  const handleDelete = (productId: string) => {
    if (onDelete) {
      onDelete(productId);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Product
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Brand / SKU
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Our Price
            </th>
            {/* Competitor price columns */}
            {competitors.map((competitor) => ( // Removed slice to show all competitors
              <th
                key={competitor.id}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {competitor.name}
              </th>
            ))}
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {productsWithPrices.map((product) => (
            <tr key={product.id} className={!product.is_active ? "bg-gray-50" : ""}>
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex items-center">
                  {product.image_url ? (
                    <div className="h-10 w-10 flex-shrink-0">
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="h-auto w-full rounded-full object-cover"
                        style={{ aspectRatio: '1/1' }}
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
                  )}
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      <Link href={`/app-routes/products/${product.id}`} className="hover:text-indigo-600">
                        {product.name}
                      </Link>
                    </div>
                    {product.ean && (
                      <div className="text-xs text-gray-500">
                        EAN: {product.ean}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <div className="text-sm text-gray-900">{product.brand || "-"}</div>
                <div className="text-xs text-gray-500">{product.sku || "-"}</div>
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                {product.our_price ? (
                  <div className="text-sm font-medium text-gray-900">
                    {formatPrice(product.our_price)}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">-</div>
                )}
              </td>
              {/* Source price cells (competitors and integrations) */}
              {competitors.map((competitor) => {
                // First try to get price from source_prices
                let sourceData, price, sourceType;

                // Get competitor price for this product


                try {
                  // Ensure competitor ID is a string
                  const competitorIdStr = String(competitor.id);

                  // Try to get price from source_prices first
                  sourceData = product.source_prices?.[competitorIdStr];

                  // If source_prices has data for this competitor, use it
                  if (sourceData) {
                    price = sourceData.price;
                    sourceType = sourceData.source_type;

                  } else {
                    // Otherwise, fall back to competitor_prices
                    price = product.competitor_prices?.[competitorIdStr];
                    sourceType = "competitor";

                  }

                  // If we still don't have a price, try searching through all keys
                  if (price === undefined) {
                    // Try to find a matching key in source_prices
                    const sourcePricesKeys = Object.keys(product.source_prices || {});
                    for (const key of sourcePricesKeys) {
                      if (key.includes(competitor.id) || competitor.id.includes(key)) {
                        sourceData = product.source_prices?.[key];
                        if (sourceData) {
                          price = sourceData.price;
                          sourceType = sourceData.source_type;

                          break;
                        }
                      }
                    }

                    // If still no price, try to find a matching key in competitor_prices
                    if (price === undefined) {
                      const competitorPricesKeys = Object.keys(product.competitor_prices || {});
                      for (const key of competitorPricesKeys) {
                        if (key.includes(competitor.id) || competitor.id.includes(key)) {
                          price = product.competitor_prices?.[key];
                          sourceType = "competitor";

                          break;
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error("Error accessing source_prices:", error);
                  // Fall back to competitor_prices if there's an error
                  const competitorIdStr = String(competitor.id);
                  price = product.competitor_prices?.[competitorIdStr];
                  sourceType = "competitor";
                }



                return (
                  <td key={competitor.id} className="whitespace-nowrap px-6 py-4">
                    {price !== undefined ? (
                      <div className="flex items-center">
                        <div className={`text-sm font-medium ${
                          product.our_price && price < product.our_price
                            ? "text-red-600"
                            : product.our_price && price > product.our_price
                              ? "text-green-600"
                              : "text-gray-900"
                        }`}>
                          {formatPrice(price)}
                        </div>
                        {sourceType === "integration" && (
                          <span className="ml-1 rounded-full bg-blue-100 px-1 py-0.5 text-xs text-blue-800">
                            Int
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">-</div>
                    )}
                  </td>
                );
              })}
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <Link
                    href={`/app-routes/products/${product.id}/edit`}
                    className="rounded-md bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    aria-label="Edit"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </Link>
                  <DeleteButton
                    id={product.id}
                    name={product.name}
                    endpoint="/api/products"
                    onDelete={() => handleDelete(product.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}