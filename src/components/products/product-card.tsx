"use client";

import Link from "next/link";
import Image from "next/image";
import DeleteButton from "@/components/ui/delete-button";
import type { Product } from "@/lib/services/product-service"; // Import the shared type
import type { Competitor } from "@/lib/services/competitor-service"; // Import Competitor type

// Removed local CompetitorPrice and Product interfaces

interface ProductCardProps {
  product: Product;
  competitors: Competitor[]; // Add competitors prop
  onDelete?: () => void;
}

export default function ProductCard({ product, competitors, onDelete }: ProductCardProps) {
  // No need for router or isDeleting state as they're not used

  // The DeleteButton component already handles refreshing the router
  // This is just a pass-through for the parent component's onDelete callback
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{product.name}</h2>
        <div className="flex space-x-2">
          <Link
            href={`/app-routes/products/${product.id}/edit`}
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
            id={product.id}
            name={product.name}
            endpoint="/api/products"
            onDelete={handleDelete}
          />
        </div>
      </div>
      
      {product.image_url && (
        <div className="mb-4 w-full overflow-hidden rounded-md">
          <Image
            src={product.image_url}
            alt={product.name}
            width={400}
            height={300}
            className="w-full h-auto object-contain"
            style={{ maxHeight: '200px' }}
          />
        </div>
      )}
      
      <div className="mb-2 flex flex-wrap gap-2">
        {product.sku && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            SKU: {product.sku}
          </span>
        )}
        {product.brand && (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            Brand: {product.brand}
          </span>
        )}
        {product.category && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            {product.category}
          </span>
        )}
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
      
      {product.description && (
        <p className="mb-4 text-sm text-gray-600 line-clamp-2">
          {product.description}
        </p>
      )}
      
      <div className="mt-4">
        <div className="flex justify-between">
          <div>
            {product.our_price ? (
              <span className="font-medium text-gray-900">
                Our Price: ${product.our_price.toFixed(2)}
              </span>
            ) : (
              <span className="text-gray-500">No price set</span>
            )}
          </div>
          
          <Link
            href={`/app-routes/products/${product.id}`}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            View Details
          </Link>
        </div>
        
        {/* Display competitor prices using the new object structure */}
        {product.competitor_prices && Object.keys(product.competitor_prices).length > 0 && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="text-xs font-medium text-gray-500">Competitor Prices:</p>
            <ul className="mt-1 space-y-1">
              {competitors.slice(0, 3).map((competitor) => { // Iterate through passed competitors
                const price = product.competitor_prices?.[competitor.id]; // Lookup price by ID
                if (price === undefined) return null; // Skip if no price for this competitor

                return (
                  <li key={competitor.id} className="text-xs flex justify-between">
                    <span className="font-medium">{competitor.name}:</span>
                    <span className={`${
                      product.our_price && price < product.our_price
                        ? "text-red-600 font-medium"
                        : product.our_price && price > product.our_price
                          ? "text-green-600 font-medium"
                          : "text-gray-600"
                    }`}>
                      ${price.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* Adjust 'more competitors' logic if needed, based on available prices vs total competitors */}
            {Object.keys(product.competitor_prices).length > 3 && (
               <p className="mt-1 text-xs text-gray-500">
                 +{Object.keys(product.competitor_prices).length - 3} more competitors with prices
               </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}