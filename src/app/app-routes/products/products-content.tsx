"use client"; // This component fetches data client-side

import type { ComplexFiltersState } from './products-client-wrapper'; // Import filter state type

import { useState, useEffect } from 'react';
import type { Competitor } from "@/lib/services/competitor-service"; // Import Competitor type
import type { Product, StockChange } from "@/lib/services/product-service"; // Import the shared type
import ProductCard from "@/components/products/product-card";
import ProductsTable from "@/components/products/products-table";
import ProductsFilter from "@/app/app-routes/products/products-filter";
import ViewToggle from "@/app/app-routes/products/view-toggle";
import Pagination from "@/components/ui/pagination";
import PaginationSizeSelector from "@/components/ui/pagination-size-selector";
import { useSearchParams } from 'next/navigation'; // Import useSearchParams

// Define the props for the component
interface ProductsContentProps {
  // # Reason: Receive the complex filter state from the parent.
  complexFilters: ComplexFiltersState;
  cookieHeader: string | null;
  initialCompetitors: Competitor[]; // Use the imported Competitor type
  initialBrands: { id: string; name: string }[];
  // Callback to update complex filters in the parent wrapper
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void;
}

// Make component synchronous (remove async)
export default function ProductsContent({
  complexFilters, // Receive the state
  cookieHeader,
  initialCompetitors,
  initialBrands,
  onComplexFilterChange, // Receive callback
}: ProductsContentProps) {

  // Use state for dynamic data
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<Map<string, StockChange[]>>(new Map());

  // Use initial props for static data passed from server
  const competitors = initialCompetitors;
  const brands = initialBrands;
  // Get itemsPerPage from complexFilters state instead of hardcoded value
  const itemsPerPage = complexFilters.itemsPerPage || 16;
  // --- End: Define constants and derived variables ---



  // # Reason: Use the useSearchParams hook here to get the *current* client-side URL params for rendering-specific logic.
  // Data fetching parameters are derived from complexFilters state.
  const currentUrlSearchParams = useSearchParams();

  // --- Start: Product Fetching Logic (Moved to useEffect) ---
  // # Reason: Extract parameters for data fetching from the complexFilters state and URL params.
  const pageParam = currentUrlSearchParams.get('page') || '1'; // Get page from URL for fetching
  const sortParam = currentUrlSearchParams.get('sort') || 'created_at'; // Get sort from URL for fetching
  const sortOrderParam = currentUrlSearchParams.get('sortOrder') || 'desc'; // Get sortOrder from URL for fetching
  const refreshParam = currentUrlSearchParams.get('refresh'); // Get refresh parameter for cache busting
  const brandFilter = complexFilters.brand || undefined;
  const categoryFilter = undefined; // Keep if used by API, derive from complexFilters if needed
  const searchQuery = complexFilters.search || undefined;
  const showInactive = complexFilters.inactive;
  const sourceFilter = complexFilters.competitor && complexFilters.competitor.length > 0 ? complexFilters.competitor : undefined; // Using competitor filter for both competitors and integrations
  const hasPriceFilter = complexFilters.has_price;
  const priceLowerThanCompetitors = complexFilters.price_lower_than_competitors;
  const priceHigherThanCompetitors = complexFilters.price_higher_than_competitors;

  useEffect(() => {
    // Function to fetch products based on current searchParams
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use the extracted dependency variables
        const page = parseInt(pageParam, 10);
        // itemsPerPage is defined outside useEffect
        const sortBy = sortParam;
        const sortOrder = sortOrderParam;
        const brand = brandFilter;
        const category = categoryFilter; // Keep if used by API
        const search = searchQuery;
        const isActive = !showInactive; // API expects isActive, derive from showInactive
        const sourceId = sourceFilter; // Use sourceId instead of competitor
        const has_price = hasPriceFilter;

        // Fetch Paginated Products from API Route using POST
        const apiUrl = '/api/products'; // Base URL for the POST request

        // Prepare the payload for the POST request body
        const payload = {
          page: page.toString(),
          pageSize: itemsPerPage.toString(),
          sortBy: sortBy,
          sortOrder: sortOrder,
          brand: brand,
          category: category, // Keep sending category
          search: search,
          isActive: isActive, // Send boolean based on filter state
          sourceId: sourceId, // Use sourceId parameter
          has_price: has_price, // Send boolean based on filter state
          price_lower_than_competitors: priceLowerThanCompetitors, // Add new price comparison filter
          price_higher_than_competitors: priceHigherThanCompetitors, // Add new price comparison filter
        };

        // Use the cookieHeader passed down from the parent Server Component
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
        const sessionTokenCookieName = 'PriceTracker.session-token'; // Use the correct name
        const sessionTokenValue = getCookieValue(cookieHeader, sessionTokenCookieName);
        const fetchHeaders: HeadersInit = {
            'Content-Type': 'application/json',
        };
        // Only include Cookie header if the token exists
        if (sessionTokenValue) {
          fetchHeaders['Cookie'] = `${sessionTokenCookieName}=${sessionTokenValue}`;
        } else {
           console.warn("Session token cookie not found. API request might fail if auth is required.");
           // Optionally handle missing auth token case here (e.g., redirect, show error)
        }


        // Add a cache-busting parameter to the URL if refreshParam is present
        const cacheBuster = refreshParam ? `?t=${refreshParam}` : '';

        const response = await fetch(`${apiUrl}${cacheBuster}`, { // Use base URL with cache buster
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

        // IMPORTANT: Transform competitor_prices from API response if needed
        // Assuming API returns the object format { competitor_id: price }
        // If ProductCard/ProductsTable expect a different format, transform here.
        // For now, assume the API returns the format expected by the service Product type.
        setProducts(apiProducts || []);
        setTotalProductCount(apiTotalCount || 0);

        // Fetch stock data for the loaded products
        if (apiProducts && apiProducts.length > 0) {
          try {
            const productIds = apiProducts.map((p: Product) => p.id);

            const stockResponse = await fetch('/api/products/stock/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...fetchHeaders
              },
              body: JSON.stringify({ productIds }),
              cache: 'no-store',
            });

            if (stockResponse.ok) {
              const stockChanges = await stockResponse.json();

              // Group stock changes by product_id
              const stockByProduct = new Map<string, StockChange[]>();
              stockChanges.forEach((stockChange: StockChange) => {
                if (!stockByProduct.has(stockChange.product_id)) {
                  stockByProduct.set(stockChange.product_id, []);
                }
                stockByProduct.get(stockChange.product_id)!.push(stockChange);
              });

              setStockData(stockByProduct);
            } else {
              console.error("Failed to fetch stock data:", stockResponse.status);
            }
          } catch (stockError) {
            console.error("Error fetching stock data:", stockError);
            // Don't fail the whole component if stock data fails
          }
        }

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
      refreshParam, // Add refresh parameter to trigger refetch when it changes
      brandFilter,
      categoryFilter,
      searchQuery,
      showInactive,
      sourceFilter,
      hasPriceFilter,
      priceLowerThanCompetitors, // Add new price comparison filter
      priceHigherThanCompetitors, // Add new price comparison filter
      itemsPerPage, // Add itemsPerPage to trigger refetch when pagination size changes
      cookieHeader // Keep cookieHeader dependency
    ]);

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
              Showing <span className="font-medium">{(parseInt(pageParam, 10) - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(parseInt(pageParam, 10) * itemsPerPage, totalProducts)}
              </span>{" "}
              of <span className="font-medium">{totalProducts}</span> results
            </p>
            <div className="flex items-center space-x-4">
              <PaginationSizeSelector
                currentSize={itemsPerPage}
                onSizeChange={(newSize) => onComplexFilterChange({ itemsPerPage: newSize })}
              />
              {/* Pass view from currentParams */}
              {/* # Reason: Pass the view parameter derived from the hook result. */}
              <ViewToggle defaultView={(currentUrlSearchParams.get('view') as "table" | "cards") || "cards"} />
            </div>
          </div>

          {/* Pass filter state and callback down to ProductsFilter */}
          <ProductsFilter
            brands={brands}
            competitors={competitors as Competitor[]} // Assert type here if needed, already typed in props
            currentFilters={complexFilters} // Pass complexFilters state down
            onComplexFilterChange={onComplexFilterChange} // Pass callback down
          />
        </div>
      )}
      {/* --- End: Filter and sort controls --- */}

      {/* --- Start: Product Display --- */}
      {!isLoading && products && products.length > 0 ? ( // Check loading state
        <>
          {/* Show either table or card view based on the view parameter */}
          {/* # Reason: Derive view directly from the hook result for rendering. */}
          {((currentUrlSearchParams.get('view') as "table" | "cards") || "cards") === 'table' ? (
            <ProductsTable
              products={products} // No need for assertion if state type is correct
              competitors={competitors} // Use prop directly
              stockData={stockData} // Pass stock data
              onDelete={(productId) => console.log("Delete product:", productId)}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {products.map((product: Product) => (
                <ProductCard key={product.id} product={product} competitors={competitors as Competitor[]} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            totalItems={totalProducts}
            itemsPerPage={itemsPerPage}
            currentPage={parseInt(pageParam, 10)}
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
}