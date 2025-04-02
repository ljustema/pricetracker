"use client"; // Make it a client component

import { Suspense } from 'react';
import { ReadonlyURLSearchParams } from 'next/navigation'; // Use the correct type
import ProductsHeader from "@/components/products/products-header";
import ProductsContent from "./products-content"; // The child component that fetches products
import type { ComplexFiltersState } from './products-client-wrapper';
import type { Competitor } from "@/lib/services/competitor-service"; // Import Competitor type

// Remove server-side imports:
// import { Metadata } from "next";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth/options";
// import { redirect } from "next/navigation";
// import { headers } from 'next/headers';
// import { createSupabaseAdminClient } from '@/lib/supabase/server';

// Remove Metadata export
// export const metadata: Metadata = { ... };

// Define props for this client component
interface ProductsPageContentProps {
  searchParams: ReadonlyURLSearchParams; // Accept the object directly
  complexFilters: ComplexFiltersState;
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void; // Callback for filter changes
  // Assume these are fetched by a server parent and passed down
  initialCompetitors: Competitor[]; // Use the imported Competitor type
  initialBrands: string[];
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
  searchParams,
  complexFilters,
  onComplexFilterChange, // Receive the callback
  initialCompetitors,
  initialBrands,
  cookieHeader,
}: ProductsPageContentProps) {

  // Remove server-side logic:
  // const session = await getServerSession(authOptions);
  // if (!session?.user) { redirect("/login"); }
  // const supabase = createSupabaseAdminClient();
  // Fetch Competitors logic...
  // Fetch Brands logic...
  // Get Cookie Header logic...
  // Await Search Params logic...

  // Convert ReadonlyURLSearchParams to a plain object for ProductsContent
  // as its useEffect dependency array relies on object/stringified values.
  // Also include the complex filters in the object passed down.
  const currentCombinedParams: { [key: string]: string | string[] | undefined | boolean } = {};
  searchParams.forEach((value, key) => {
    // Handle potential multiple values if necessary, though current usage seems single value
    currentCombinedParams[key] = value;
  });

  // Add complex filters to the params object passed down
  // Ensure undefined is used if the filter is empty/false where appropriate for the API call
  currentCombinedParams['brand'] = complexFilters.brand || undefined;
  currentCombinedParams['competitor'] = complexFilters.competitor || undefined;
  currentCombinedParams['search'] = complexFilters.search || undefined;
  // API expects 'true' or undefined for isActive, derived from !showInactive
  currentCombinedParams['inactive'] = complexFilters.inactive; // Keep boolean for ProductsContent logic
  // API expects true or undefined for has_price
  currentCombinedParams['has_price'] = complexFilters.has_price; // Keep boolean for ProductsContent logic


  return (
    <div className="container mx-auto px-4 py-8">
      <ProductsHeader />

      {/*
        ProductsContent now receives a combined object representing the *current* state
        derived from both URL params (page, sort, view) and the managed state (complex filters).
        It also receives the initial static data.
        The onComplexFilterChange callback needs to be passed to ProductsFilter inside ProductsContent.
      */}
      <Suspense fallback={<LoadingFallback />}>
        <ProductsContent
          // Pass the combined params object instead of the raw searchParams
          currentParams={currentCombinedParams} // Renamed prop
          cookieHeader={cookieHeader}
          initialCompetitors={initialCompetitors}
          initialBrands={initialBrands}
          // Pass the filter change handler down
          onComplexFilterChange={onComplexFilterChange}
        />
      </Suspense>
    </div>
  );
}