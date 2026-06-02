"use client";

import { ScrapedProduct } from "@/lib/services/scraper-service";
import Image from "next/image";

interface TestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ScrapedProduct[];
}

export default function TestResultsModal({
  isOpen,
  onClose,
  products,
}: TestResultsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[80vh] overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Test Results: {products.length} Products Found
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {products.length === 0 ? (
          <p className="text-gray-500">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Image
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Brand
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    SKU
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {products.map((product, index) => (
                  <tr key={index}>
                    <td className="whitespace-nowrap px-6 py-4">
                      {product.image_url ? (
                        <Image
                          src={`/api/proxy-image?url=${encodeURIComponent(product.image_url)}`}
                          alt={product.name}
                          width={64}
                          height={64}
                          className="h-16 w-16 object-contain"
                          unoptimized // Skip optimization for external images
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            console.error(`Failed to load image: ${product.image_url}`);
                            // Replace with a div that looks like the fallback
                            const imgElement = e.currentTarget;
                            const parent = imgElement.parentElement;
                            if (parent) {
                              // Create a fallback div
                              const fallbackDiv = document.createElement('div');
                              fallbackDiv.className = "h-16 w-16 bg-gray-100 flex items-center justify-center text-gray-400";
                              fallbackDiv.textContent = "No Image";
                              // Replace the image with the fallback
                              parent.replaceChild(fallbackDiv, imgElement);
                            }
                          }}
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-100 flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {product.name}
                        </a>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {product.competitor_price} {product.currency_code}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {product.brand || "N/A"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {product.sku || "N/A"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}