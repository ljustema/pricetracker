"use client"; // This component fetches data client-side

import type { ComplexFiltersState } from './products-client-wrapper'; // Import filter state type
// Removed import { headers } from 'next/headers'; as it's passed via props now

import { useState, useEffect } from 'react'; // Import hooks
// Removed unused Session import
import type { Product } from "@/lib/services/product-service";
import ProductCard from "@/components/products/product-card";
import ProductsTable from "@/components/products/products-table";
import ProductsFilter from "@/app/(app)/products/products-filter";
import ViewToggle from "@/app/(app)/products/view-toggle";
import Pagination from "@/components/ui/pagination";

// Define the props for the component
interface ProductsContentProps {
  // Renamed prop: Combined object of URL params and complex filter state
  currentParams: { [key: string]: string | string[] | undefined | boolean };
  cookieHeader: string | null;
  initialCompetitors: { id: string; name: string }[];
  initialBrands: string[];
  // Callback to update complex filters in the parent wrapper
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void;
}

// Make component synchronous (remove async)
export default function ProductsContent({
  currentParams, // Use renamed prop
  cookieHeader,
  initialCompetitors,
  initialBrands,
  onComplexFilterChange // Receive callback
}: ProductsContentProps) {

  // Use state for dynamic data
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);

  // Use initial props for static data passed from server
  const competitors = initialCompetitors;
  const brands = initialBrands;
  // Use currentParams directly in useEffect dependency and inside the hook
  const itemsPerPage = 12; // Re-declare for use in rendering logic
  // --- End: Define constants and derived variables ---

  // --- Start: Product Fetching Logic (Moved to useEffect) ---
  // Extract dependencies for useEffect
  const pageParam = currentParams?.page as string || '1';
  const sortParam = currentParams?.sort as string || 'created_at';
  const sortOrderParam = currentParams?.sortOrder as string || 'desc';
  const brandParam = currentParams?.brand as string | undefined;
  const categoryParam = currentParams?.category as string | undefined; // Keep if used by API
  const searchParam = currentParams?.search as string | undefined;
  const inactiveParam = currentParams?.inactive === true;
  const competitorParam = currentParams?.competitor as string | undefined;
  const hasPriceParam = currentParams?.has_price === true;
  useEffect(() => {
    // Function to fetch products based on current searchParams
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use the extracted dependency variables
        const page = parseInt(pageParam, 10);
        const itemsPerPage = 12; // Keep consistent page size
        const sortBy = sortParam;
        const sortOrder = sortOrderParam;
        const brandFilter = brandParam;
        const categoryFilter = categoryParam; // Keep if used by API
        const searchQuery = searchParam;
        const showInactive = inactiveParam;
        const competitorFilter = competitorParam;
        const hasPriceFilter = hasPriceParam;

        // Fetch Paginated Products from API Route using POST
        const apiUrl = '/api/products'; // Base URL for the POST request

        // Prepare the payload for the POST request body
        const payload = {
          page: page.toString(),
          pageSize: itemsPerPage.toString(),
          sortBy: sortBy,
          sortOrder: sortOrder,
          brand: brandFilter,
          category: categoryFilter,
          search: searchQuery,
          // Send isActive based on showInactive flag. API expects 'true' or undefined.
          isActive: !showInactive ? 'true' : undefined,
          competitor: competitorFilter,
          // Send has_price as boolean if true, otherwise undefined
          has_price: hasPriceFilter ? true : undefined,
        };
        // Use the cookieHeader passed down from the parent Server Component
        // const requestHeaders = await headers(); // Removed
        // const cookieHeader = requestHeaders.get('cookie'); // Removed

        // Function to parse cookie string and get a specific cookie
        const getCookieValue = (cookieString: string | null, cookieName: string): string | null => {
          if (!cookieString) return null;
          const cookies = cookieString.split('; ');
          for (const cookie of cookies) {
            const [name, value] = cookie.split('=');
            if (name === cookieName) {
              return value;
            }
          }
          return null;
        };

        // Extract only the session token cookie (adjust name if needed)
        // Use the correct custom cookie name found in logs
        const sessionTokenCookieName = 'PriceTracker.session-token';
        const sessionTokenValue = getCookieValue(cookieHeader, sessionTokenCookieName);
        // Explicitly construct HeadersInit, adding Content-Type
        const fetchHeaders: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (sessionTokenValue) {
          fetchHeaders['Cookie'] = `${sessionTokenCookieName}=${sessionTokenValue}`;
        }

        const response = await fetch(apiUrl, { // Use base URL
          method: 'POST', // Specify POST method
          headers: fetchHeaders,
          body: JSON.stringify(payload), // Send payload in the body
          cache: 'no-store',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API Error (${response.status}): ${errorData.error || response.statusText}`);
        }

        const { data: apiProducts, totalCount: apiTotalCount } = await response.json();
        setProducts(apiProducts || []);
        setTotalProductCount(apiTotalCount || 0);

      } catch (err) {
        console.error("Error fetching products content:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred loading product data.");
        setProducts([]); // Clear products on error
        setTotalProductCount(0);
      } finally {
        setIsLoading(false); // Stop loading regardless of outcome
      }
    };

    fetchProducts();

    // Dependency array: Use the extracted primitive values
  }, [
      pageParam,
      sortParam,
      sortOrderParam,
      brandParam,
      categoryParam,
      searchParam,
      inactiveParam,
      competitorParam,
      hasPriceParam,
      cookieHeader
    ]);
  // --- End: Data Fetching Logic ---

  // --- Start: Rendering Logic (Moved from ProductsPage) ---
  const totalProducts = totalProductCount; // Use state variable

  // --- Start: Loading State ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <p className="text-gray-500">Loading products...</p>
        {/* You could replace this with a spinner component */}
      </div>
    );
  }
  // --- End: Loading State ---

  // --- Start: Error State ---
  if (error) {
    return (
      <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
        <p className="font-medium">Error Loading Products</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter and sort controls - Show even if totalProducts is 0 initially, but hide if error */}
      {!error && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{(parseInt(currentParams?.page as string || '1', 10) - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(parseInt(currentParams?.page as string || '1', 10) * itemsPerPage, totalProducts)}
              </span>{" "}
              of <span className="font-medium">{totalProducts}</span> results
            </p>
            {/* Pass view from currentParams */}
            <ViewToggle defaultView={(currentParams?.view as "table" | "cards") || "cards"} />
          </div>

          {/* Pass filter state and callback down to ProductsFilter */}
          <ProductsFilter
            brands={brands}
            competitors={competitors}
            currentFilters={{ // Pass current complex filter values
              brand: currentParams?.brand as string || "",
              competitor: currentParams?.competitor as string || "",
              search: currentParams?.search as string || "",
              inactive: currentParams?.inactive === true,
              has_price: currentParams?.has_price === true,
              // Pass sort info as well if needed for initial state
              sort: `${currentParams?.sort || 'created_at'}-${currentParams?.sortOrder || 'desc'}`,
            }}
            onComplexFilterChange={onComplexFilterChange} // Pass callback
            // Pass simple URL params if ProductsFilter needs them to manage router.push
            simpleSearchParams={{
                page: currentParams?.page as string || '1',
                view: currentParams?.view as string || 'cards',
                // Sort is handled differently now, but pass if needed
            }}
          />
        </div>
      )}
      {/* --- End: Filter and sort controls --- */}

      {/* --- Start: Product Display --- */}
      {!isLoading && products && products.length > 0 ? ( // Check loading state
        <>
          {/* Show either table or card view based on the view parameter */}
          {/* Derive view directly from currentParams for rendering */}
          {((currentParams?.view as "table" | "cards") || "cards") === 'table' ? (
            <ProductsTable
              products={products as Product[]}
              competitors={competitors} // Use prop directly
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            totalItems={totalProducts}
            itemsPerPage={itemsPerPage}
            currentPage={parseInt(currentParams?.page as string || '1', 10)}
          />
        </>
      ) : ( // Show "No products" only if not loading and no error occurred
        !isLoading && !error && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No products found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or add new products.
            </p>
          </div>
        )
      )}
      {/* --- End: Product Display --- */}
    </>
  );
  // --- End: Rendering Logic ---
}