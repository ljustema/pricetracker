"use client";

import Link from "next/link";
import Image from "next/image";
import DeleteButton from "@/components/ui/delete-button";
import type { Product } from "@/lib/services/product-service"; // Import the shared type
import type { Competitor } from "@/lib/services/competitor-service"; // Import Competitor type
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter"; // Import our new hook

// Removed local CompetitorPrice and Product interfaces

interface ProductCardProps {
  product: Product;
  competitors: Competitor[]; // Add competitors prop
  onDelete?: () => void;
}

export default function ProductCard({ product, competitors, onDelete }: ProductCardProps) {
  // No need for router or isDeleting state as they're not used
  const { formatPrice } = useCurrencyFormatter();

  // Check if product name is likely to span multiple lines (rough estimation)
  const isLongName = product.name.length > 50;

  // Ensure product has competitor_prices and source_prices
  const productWithPrices = {
    ...product,
    competitor_prices: product.competitor_prices || {},
    source_prices: product.source_prices || {}
  };

  // The DeleteButton component already handles refreshing the router
  // This is just a pass-through for the parent component's onDelete callback
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm relative flex flex-col min-h-96">
      {/* Edit and Delete icons in top-right corner */}
      <div className="absolute top-2 right-2 flex space-x-1">
        <Link
          href={`/app-routes/products/${productWithPrices.id}/edit`}
          className="rounded-md bg-gray-100 p-1 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label="Edit"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </Link>
        <DeleteButton
          id={productWithPrices.id}
          name={productWithPrices.name}
          endpoint="/api/products"
          onDelete={handleDelete}
          size="sm"
        />
      </div>

      {/* Product name with full width and up to 3 lines */}
      <div className="mb-4">
        <h2
          className="text-lg font-semibold leading-5 break-words"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden'
          }}
        >
          {productWithPrices.name}
        </h2>
      </div>

      {/* Flexible content area that grows */}
      <div className="flex-grow">
        {productWithPrices.image_url && (
          <div className="mb-4 w-full flex justify-center items-center rounded-md bg-white" style={{ height: isLongName ? '120px' : '160px' }}>
            <Image
              src={`/api/proxy-image?url=${encodeURIComponent(productWithPrices.image_url)}`}
              alt={productWithPrices.name}
              width={400}
              height={300}
              className="max-w-full max-h-full object-contain"
              unoptimized // Skip Next.js image optimization for external images
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                console.error(`Failed to load image via proxy: ${productWithPrices.image_url}`);
                // Try direct image URL as fallback
                const imgElement = e.currentTarget;
                if (imgElement.src.includes('/api/proxy-image')) {
                  console.log('Attempting direct image load as fallback');
                  imgElement.src = productWithPrices.image_url;
                } else {
                  console.error('Direct image load also failed, using placeholder');
                  // Fallback to a placeholder image
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23ccc%22%3E%3Cpath%20d%3D%22M0%200h24v24H0V0z%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M19%205v14H5V5h14m0-2H5c-1.1%200-2%20.9-2%202v14c0%201.1.9%202%202%202h14c1.1%200%202-.9%202-2V5c0-1.1-.9-2-2-2zm-4.86%208.86l-3%203.87L9%2013.14%206%2017h12l-3.86-5.14z%22%2F%3E%3C%2Fsvg%3E';
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Fixed position badges - always same distance from bottom */}
      <div className="mb-3 flex flex-wrap gap-2">
        {productWithPrices.sku && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 whitespace-nowrap">
            SKU: {productWithPrices.sku}
          </span>
        )}
        {productWithPrices.brand && (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 whitespace-nowrap">
            Brand: {productWithPrices.brand}
          </span>
        )}

        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
            productWithPrices.is_active
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {productWithPrices.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-auto">
        <div className="flex justify-between items-center mb-2">
          <div>
            {productWithPrices.our_retail_price ? (
              <span className="font-medium text-gray-900">
                Our Price: {formatPrice(productWithPrices.our_retail_price)}
              </span>
            ) : (
              <span className="text-gray-500">No price set</span>
            )}
          </div>

          <Link
            href={`/app-routes/products/${productWithPrices.id}`}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            View Details
          </Link>
        </div>

        {/* Display source prices (competitors and integrations) */}
        {(Object.keys(productWithPrices.competitor_prices).length > 0 || Object.keys(productWithPrices.source_prices).length > 0) && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="text-xs font-medium text-gray-500">Prices:</p>
            <ul className="mt-1 space-y-1">
              {/* First try to use source_prices if available */}
              {Object.keys(productWithPrices.source_prices).length > 0 &&
                Object.entries(productWithPrices.source_prices)
                  .filter(([_sourceId, sourceData]) => {
                    // Filter out all integration prices from product list cards
                    if (sourceData.source_type === 'integration') {
                      return false;
                    }
                    return true;
                  })
                  .sort((a, b) => a[1].price - b[1].price) // Sort by price (lowest to highest)
                  .slice(0, 3)
                  .map(([sourceId, sourceData]) => {
                try {
                  // Check if sourceData is valid
                  if (!sourceData || typeof sourceData !== 'object') {
                    console.error(`ProductCard - Invalid source data for source ID ${sourceId}:`, sourceData);
                    return null;
                  }

                  const price = sourceData.price;
                  const sourceName = sourceData.source_name || "Unknown";
                  const sourceType = sourceData.source_type || "competitor";

                  return (
                    <li key={sourceId} className="text-xs flex justify-between">
                      <span className="font-medium">
                        {sourceName}
                        {sourceType === "integration" && (
                          <span className="ml-1 rounded-full bg-blue-100 px-1 py-0.5 text-xs text-blue-800">
                            Int
                          </span>
                        )}
                      </span>
                      <span className={`${
                        productWithPrices.our_retail_price && price < productWithPrices.our_retail_price
                          ? "text-red-600 font-medium"
                          : productWithPrices.our_retail_price && price > productWithPrices.our_retail_price
                            ? "text-green-600 font-medium"
                            : "text-gray-600"
                      }`}>
                        {formatPrice(price)}
                      </span>
                    </li>
                  );
                } catch (error) {
                  console.error("Error rendering source price:", error);
                  return null;
                }
              }).filter(Boolean)}

              {/* Fall back to competitor_prices if source_prices is empty after filtering */}
              {(() => {
                const filteredSourcePrices = Object.entries(productWithPrices.source_prices)
                  .filter(([_sourceId, sourceData]) => {
                    // Filter out all integration prices from product list cards
                    if (sourceData.source_type === 'integration') {
                      return false;
                    }
                    return true;
                  });

                return filteredSourcePrices.length === 0 && Object.keys(productWithPrices.competitor_prices).length > 0;
              })() && (
                (() => {
                  // Create an array of competitors with their prices
                  const competitorsWithPrices = competitors
                    .map(competitor => {
                      // Ensure competitor ID is a string
                      const competitorIdStr = String(competitor.id);
                      let price = productWithPrices.competitor_prices[competitorIdStr];

                      // If we don't have a price, try searching through all keys
                      if (price === undefined) {
                        // Try to find a matching key in competitor_prices
                        const competitorPricesKeys = Object.keys(productWithPrices.competitor_prices || {});
                        for (const key of competitorPricesKeys) {
                          if (key.includes(competitor.id) || competitor.id.includes(key)) {
                            price = productWithPrices.competitor_prices[key];
                            break;
                          }
                        }
                      }

                      if (price === undefined) return null;

                      return { competitor, price };
                    })
                    .filter(Boolean) // Remove null entries
                    .sort((a, b) => a!.price - b!.price); // Sort by price (lowest to highest)

                  // Return the JSX for the top 3 competitors by price
                  return competitorsWithPrices.slice(0, 3).map((item) => {
                    if (!item) return null;
                    const { competitor, price } = item;
                    return (
                    <li key={competitor.id} className="text-xs flex justify-between">
                      <span className="font-medium">{competitor.name}:</span>
                      <span className={`${
                        productWithPrices.our_retail_price && price < productWithPrices.our_retail_price
                          ? "text-red-600 font-medium"
                          : productWithPrices.our_retail_price && price > productWithPrices.our_retail_price
                            ? "text-green-600 font-medium"
                            : "text-gray-600"
                      }`}>
                        {formatPrice(price)}
                      </span>
                    </li>
                    );
                  });
                })()
              )}

              {/* If neither filtered source_prices nor competitor_prices have any entries, show a message */}
              {(() => {
                const filteredSourcePrices = Object.entries(productWithPrices.source_prices)
                  .filter(([_sourceId, sourceData]) => {
                    // Filter out all integration prices from product list cards
                    if (sourceData.source_type === 'integration') {
                      return false;
                    }
                    return true;
                  });

                return filteredSourcePrices.length === 0 &&
                       Object.keys(productWithPrices.competitor_prices).length === 0;
              })() && (
                <li className="text-xs text-gray-500">No competitor prices available</li>
              )}
            </ul>
            {/* Show count of additional prices */}
            {(() => {
              const filteredSourcePrices = Object.entries(productWithPrices.source_prices)
                .filter(([_sourceId, sourceData]) => {
                  // Filter out all integration prices from product list cards
                  if (sourceData.source_type === 'integration') {
                    return false;
                  }
                  return true;
                });

              return filteredSourcePrices.length > 3 && (
                <p className="mt-1 text-xs text-gray-500">
                  +{filteredSourcePrices.length - 3} more sources with prices
                </p>
              );
            })()}
            {(() => {
              const filteredSourcePrices = Object.entries(productWithPrices.source_prices)
                .filter(([_sourceId, sourceData]) => {
                  // Filter out all integration prices from product list cards
                  if (sourceData.source_type === 'integration') {
                    return false;
                  }
                  return true;
                });

              return filteredSourcePrices.length === 0 &&
                     Object.keys(productWithPrices.competitor_prices).length > 3 && (
                <p className="mt-1 text-xs text-gray-500">
                  +{Object.keys(productWithPrices.competitor_prices).length - 3} more competitors with prices
                </p>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}