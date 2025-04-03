"use client";

import Link from "next/link";
import Image from "next/image";
import DeleteButton from "@/components/ui/delete-button";

// Removed unused CompetitorPrice interface

interface Product {
  id: string;
  name: string;
  sku?: string;
  ean?: string;
  brand?: string;
  category?: string;
  description?: string;
  image_url?: string;
  our_price?: number;
  cost_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  competitor_prices?: { [key: string]: number }; // Updated to match service type { competitor_id: price }
}

interface ProductsTableProps {
  products: Product[];
  competitors: { id: string; name: string }[];
  onDelete?: (productId: string) => void;
}

export default function ProductsTable({ products, competitors, onDelete }: ProductsTableProps) {
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
          {products.map((product) => (
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
                    ${product.our_price.toFixed(2)}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">-</div>
                )}
              </td>
              {/* Competitor price cells */}
              {competitors.map((competitor) => { // Removed slice to show all competitors
                // Access price directly from the object using competitor.id as the key
                const price = product.competitor_prices?.[competitor.id];
                
                return (
                  <td key={competitor.id} className="whitespace-nowrap px-6 py-4">
                    {price !== undefined ? ( // Check if price exists (is not undefined)
                      <div className={`text-sm font-medium ${
                        product.our_price && price < product.our_price
                          ? "text-red-600"
                          : product.our_price && price > product.our_price
                            ? "text-green-600"
                            : "text-gray-900"
                      }`}>
                        ${price.toFixed(2)}
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