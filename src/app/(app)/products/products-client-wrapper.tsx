"use client";

import { useState, useCallback, useMemo, Suspense } from "react"; // Merged imports
import { useSearchParams } from "next/navigation"; // Removed unused ReadonlyURLSearchParams
// Removed Metadata import as it belongs in the server page.tsx
import ProductsPageContent from "./products-page-content";

// Removed Metadata export

// Define the structure for complex filters (can be kept here or moved)
export interface ComplexFiltersState {
  brand: string;
  competitor: string;
  search: string;
  inactive: boolean;
  has_price: boolean;
}

// Define props for this client wrapper
interface ProductsClientWrapperProps {
  // Data fetched from the server parent
  initialCompetitors: { id: string; name: string }[];
  initialBrands: string[];
  cookieHeader: string | null;
  // Accept the plain searchParams object from the server parent
  searchParams: { [key: string]: string | string[] | undefined };
}


// Define a simple loading component for Suspense fallback
function LoadingFallback() {
  return (
    <div className="flex justify-center items-center py-10">
      <p className="text-gray-500">Loading page structure...</p>
    </div>
  );
}

// Rename the component
export default function ProductsClientWrapper({
  initialCompetitors,
  initialBrands,
  cookieHeader,
  searchParams: initialSearchParams // Receive plain object from server parent
}: ProductsClientWrapperProps) {

  // Construct URLSearchParams from the initial plain object for reading initial state
  // This ensures we have the .get() method available
  const initialUrlSearchParams = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(initialSearchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else if (value !== undefined) {
          params.set(key, value);
        }
      });
    return params; // Return the constructed URLSearchParams object
  }, [initialSearchParams]); // Recompute only if the initial object changes

  // Initialize state for complex filters using the constructed URLSearchParams object
  const [complexFilters, setComplexFilters] = useState<ComplexFiltersState>({
    brand: initialUrlSearchParams.get("brand") || "",
    competitor: initialUrlSearchParams.get("competitor") || "",
    search: initialUrlSearchParams.get("search") || "",
    inactive: initialUrlSearchParams.get("inactive") === "true",
    has_price: initialUrlSearchParams.get("has_price") === "true",
  });

  // Callback function for ProductsFilter to update complex filters
  const handleComplexFilterChange = useCallback((newFilters: Partial<ComplexFiltersState>) => {
    setComplexFilters(prevFilters => ({ ...prevFilters, ...newFilters }));
    // We no longer push complex filters to URL here
  }, []);

  return (
    // Suspense boundary for the content rendering
    <Suspense fallback={<LoadingFallback />}>
       {/* We need to pass ReadonlyURLSearchParams down, use the hook for the *current* params */}
       {/* Or reconstruct it if needed based on simpleSearchParams state */}
       {/* Let's use the hook for simplicity for now */}
       <ProductsPageContent
         searchParams={useSearchParams()} // Pass the current ReadonlyURLSearchParams from the hook
         complexFilters={complexFilters} // Pass the managed state
         onComplexFilterChange={handleComplexFilterChange} // Pass the callback
         // Pass down the server-fetched data
         initialCompetitors={initialCompetitors}
         initialBrands={initialBrands}
         cookieHeader={cookieHeader}
       />
    </Suspense>
  );
}