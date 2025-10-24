"use client"; // This component fetches data client-side

import type { ComplexFiltersState } from './products-client-wrapper'; // Import filter state type

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  initialSuppliers: { id: string; name: string }[];
  // Callback to update complex filters in the parent wrapper
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void;
}

// Make component synchronous (remove async)
export default function ProductsContent({
  complexFilters, // Receive the state
  cookieHeader,
  initialCompetitors,
  initialBrands,
  initialSuppliers,
  onComplexFilterChange, // Receive callback
}: ProductsContentProps) {

  // Use state for dynamic data
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);

  // Ref to track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);
  const lastFetchParamsRef = useRef<string>('');
  const [stockData, setStockData] = useState<Map<string, StockChange[]>>(new Map());

  // Use initial props for static data passed from server
  const competitors = initialCompetitors;
  const brands = initialBrands;
  const suppliers = initialSuppliers;
  // Get itemsPerPage from complexFilters state instead of hardcoded value
  const itemsPerPage = complexFilters.itemsPerPage || 16;
  // --- End: Define constants and derived variables ---



  // # Reason: Use the useSearchParams hook here to get the *current* client-side URL params for rendering-specific logic.
  // Data fetching parameters are derived from complexFilters state.
  const currentUrlSearchParams = useSearchParams();

  // --- Start: Product Fetching Logic (Moved to useEffect) ---
  // # Reason: Extract parameters for data fetching from the complexFilters state and URL params.
  // Memoize URL parameters to prevent unnecessary re-renders
  const urlParams = useMemo(() => ({
    page: currentUrlSearchParams.get('page') || '1',
    sort: currentUrlSearchParams.get('sort') || 'created_at',
    sortOrder: currentUrlSearchParams.get('sortOrder') || 'desc',
    refresh: currentUrlSearchParams.get('refresh')
  }), [currentUrlSearchParams]);

  // Note: We now use urlParams directly in fetchProducts instead of destructuring

  // Memoize filter parameters to prevent unnecessary re-renders
  const filterParams = useMemo(() => ({
    brand: complexFilters.brand || undefined,
    category: undefined, // Keep if used by API, derive from complexFilters if needed
    search: complexFilters.search || undefined,
    showInactive: complexFilters.inactive,
    source: complexFilters.competitor && complexFilters.competitor.length > 0 ? complexFilters.competitor : undefined, // Using competitor filter for both competitors and integrations
    supplier: complexFilters.supplier && complexFilters.supplier.length > 0 ? complexFilters.supplier : undefined, // New supplier filter
    hasPrice: complexFilters.has_price,
    notOurProducts: complexFilters.not_our_products,
    priceLowerThanCompetitors: complexFilters.price_lower_than_competitors,
    priceHigherThanCompetitors: complexFilters.price_higher_than_competitors,
    inStockOnly: complexFilters.in_stock_only,
    ourProductsWithCompetitorPrices: complexFilters.our_products_with_competitor_prices,
    ourProductsWithSupplierPrices: complexFilters.our_products_with_supplier_prices
  }), [complexFilters]);

  // Note: We now use filterParams directly in fetchProducts instead of destructuring

  // Function to fetch products based on current searchParams with retry logic
  const fetchProducts = useCallback(async (retryCount = 0) => {
    const _maxRetries = 3;
    const _fetchStartTime = Date.now();

    // Create a unique key for current parameters to prevent duplicate requests
    const currentParamsKey = JSON.stringify({ urlParams, filterParams, itemsPerPage });

    // If we're already fetching with the same parameters, skip
    if (isFetchingRef.current && lastFetchParamsRef.current === currentParamsKey && retryCount === 0) {
      return;
    }

    console.log('📊 [FRONTEND] Starting fetch with params:', { urlParams, filterParams, itemsPerPage });

    isFetchingRef.current = true;
    lastFetchParamsRef.current = currentParamsKey;
    setIsLoading(true);
    setError(null);
    try {
        // Use the extracted dependency variables from memoized objects
        const page = parseInt(urlParams.page, 10);
        const sortBy = urlParams.sort;
        const sortOrder = urlParams.sortOrder;
        const brand = filterParams.brand;
        const category = filterParams.category; // Keep if used by API
        const search = filterParams.search;
        const isActive = !filterParams.showInactive; // API expects isActive, derive from showInactive
        const sourceId = filterParams.source; // Use sourceId instead of competitor
        const supplierId = filterParams.supplier; // Use supplierId for supplier filter
        const has_price = filterParams.hasPrice;
        const not_our_products = filterParams.notOurProducts;



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
          supplierId: supplierId, // Add new supplier filter parameter
          has_price: has_price, // Send boolean based on filter state
          not_our_products: not_our_products, // Add new filter for products without our price
          price_lower_than_competitors: filterParams.priceLowerThanCompetitors, // Add new price comparison filter
          price_higher_than_competitors: filterParams.priceHigherThanCompetitors, // Add new price comparison filter
          in_stock_only: filterParams.inStockOnly, // Add new stock filter
          our_products_with_competitor_prices: filterParams.ourProductsWithCompetitorPrices, // Add new combined filter
          our_products_with_supplier_prices: filterParams.ourProductsWithSupplierPrices, // Add new combined filter
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
        const cacheBuster = urlParams.refresh ? `?t=${urlParams.refresh}` : '';

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

        // Parse error response if it's a fetch error
        let errorMessage = "An unknown error occurred loading product data.";
        let errorCode = null;
        let isRetryable = false;

        if (err instanceof Error) {
          try {
            // Try to parse the error message if it contains JSON
            if (err.message.includes('{')) {
              const jsonMatch = err.message.match(/\{.*\}/);
              if (jsonMatch) {
                const errorData = JSON.parse(jsonMatch[0]);
                errorMessage = errorData.error || errorData.message || err.message;
                errorCode = errorData.code;
                isRetryable = errorData.retryable || false;
              }
            } else {
              errorMessage = err.message;
            }
          } catch (_parseError) {
            errorMessage = err.message;
          }
        }

        // Check if this is a retryable error (timeout or connection issues)
        const isRetryableError = isRetryable ||
                                errorMessage.includes('timed out') ||
                                errorMessage.includes('504') ||
                                errorMessage.includes('503') ||
                                errorMessage.includes('connection') ||
                                errorMessage.includes('timeout');

        // Retry logic for timeout/connection errors
        if (isRetryableError && retryCount < _maxRetries) {
          console.log(`Retrying products fetch (attempt ${retryCount + 1}/${_maxRetries}) after error:`, errorMessage);
          setError(`Loading products... (attempt ${retryCount + 1}/${_maxRetries + 1})`);

          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, retryCount);
          setTimeout(() => {
            fetchProducts(retryCount + 1);
          }, delay);
          return; // Don't set final error state yet
        }

        // Final error state (no more retries or non-retryable error)
        if (isRetryableError) {
          setError("Database connection timeout. This usually happens after periods of inactivity. Please refresh the page to try again.");
        } else {
          // Show more user-friendly error message
          const userFriendlyMessage = errorCode ?
            `Error loading products (${errorCode}): ${errorMessage}` :
            `Error loading products: ${errorMessage}`;
          setError(userFriendlyMessage);
        }
        setProducts([]); // Clear products on error
        setTotalProductCount(0);
        setIsLoading(false); // Stop loading on final error
    } finally {
      // Ensure loading is stopped if not retrying
      if (retryCount === 0) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [
    urlParams,
    filterParams,
    itemsPerPage,
    cookieHeader
  ]);

  useEffect(() => {
    fetchProducts(0); // Start with retry count 0
  }, [fetchProducts]);

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
    const isRetrying = error.includes('attempt');
    return (
      <div className={`mb-6 rounded-lg p-4 ${isRetrying ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800'}`}>
        <p className="font-medium">{isRetrying ? 'Retrying...' : 'Error Loading Products'}</p>
        <p>{error}</p>
        {!isRetrying && error.includes('timeout') && (
          <div className="mt-3">
            <p className="text-sm mb-2">💡 <strong>Tip:</strong> This usually happens after the database has been idle.</p>
            <button
              onClick={() => fetchProducts(0)}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}
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
              Showing <span className="font-medium">{(parseInt(urlParams.page, 10) - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(parseInt(urlParams.page, 10) * itemsPerPage, totalProducts)}
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
            suppliers={suppliers}
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
                <ProductCard
                  key={product.id}
                  product={product}
                  competitors={competitors as Competitor[]}
                  stockData={stockData}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            totalItems={totalProducts}
            itemsPerPage={itemsPerPage}
            currentPage={parseInt(urlParams.page, 10)}
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