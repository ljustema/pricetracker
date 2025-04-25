"use client"; // Make it a client component

import { Suspense } from 'react'; // Removed useMemo
import ProductsHeader from "@/components/products/products-header";
import ProductsContent from "./products-content"; // The child component that fetches products
import type { ComplexFiltersState } from './products-client-wrapper';
import type { Competitor } from "@/lib/services/competitor-service"; // Import Competitor type

// Define props for this client component
interface ProductsPageContentProps {
  complexFilters: ComplexFiltersState;
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void; // Callback for filter changes
  // Assume these are fetched by a server parent and passed down
  initialCompetitors: Competitor[]; // Use the imported Competitor type
  initialBrands: { id: string; name: string }[];
  cookieHeader: string | null; // Still needed for the API call in ProductsContent
}

// Define a simple loading component for Suspense fallback
function LoadingFallback() {
  return (
    <div className="flex justify-center items-center py-10">
      <p className="text-gray-500">Loading products...</p>
    </div>
  );
}

// Make the component synchronous (remove async)
export default function ProductsPageContent({
  complexFilters,
  onComplexFilterChange, // Receive the callback
  initialCompetitors,
  initialBrands,
  cookieHeader,
}: ProductsPageContentProps) {

  // # Reason: No longer using useSearchParams hook here.
  // URL state management is centralized in ProductsClientWrapper.

  return (
    <div className="container mx-auto px-4 py-8">
      <ProductsHeader />

      {/*
        ProductsContent now receives the complex filter state and other necessary props.
        It will use the useSearchParams hook internally for rendering-specific parameters.
      */}
      <Suspense fallback={<LoadingFallback />}>
        <ProductsContent
          complexFilters={complexFilters} // Pass complexFilters state down
          onComplexFilterChange={onComplexFilterChange} // Pass callback down
          initialCompetitors={initialCompetitors}
          initialBrands={initialBrands}
          cookieHeader={cookieHeader}
          // # Reason: No longer passing currentUrlSearchParams or initialSearchParams down.
          // ProductsContent will get URL params via the hook if needed for rendering.
        />
      </Suspense>
    </div>
  );
}