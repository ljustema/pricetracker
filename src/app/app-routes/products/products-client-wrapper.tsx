"use client";

import { useState, useCallback, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Competitor } from "@/lib/services/competitor-service";
import ProductsPageContent from "./products-page-content";

// Define the structure for complex filters
export interface ComplexFiltersState {
  brand: string;
  competitor: string[];  // Changed to array to support multiple competitors
  search: string;
  inactive: boolean;
  has_price: boolean;
  // # Reason: Add sort properties to ComplexFiltersState to manage sort state centrally.
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  // New price comparison filters
  price_lower_than_competitors: boolean;
  price_higher_than_competitors: boolean;
  // Add itemsPerPage to manage pagination size
  itemsPerPage: number;
}

// Define props for this client wrapper
interface ProductsClientWrapperProps {
  // Data fetched from the server parent
  initialCompetitors: Competitor[];
  initialBrands: { id: string; name: string }[];
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

export default function ProductsClientWrapper({
  initialCompetitors,
  initialBrands,
  cookieHeader,
  searchParams: initialSearchParams // Receive plain object from server parent
}: ProductsClientWrapperProps) {

  // # Reason: Initialize state for complex filters using the initial search params directly.
  // This state will be the source of truth for complex filters.
  const [complexFilters, setComplexFilters] = useState<ComplexFiltersState>({
    brand: typeof initialSearchParams.brand === 'string' ? initialSearchParams.brand : "",
    competitor: (() => {
      // Parse competitor parameter - can be comma-separated string or array
      if (typeof initialSearchParams.competitor === 'string') {
        return initialSearchParams.competitor ? initialSearchParams.competitor.split(',').filter(Boolean) : [];
      } else if (Array.isArray(initialSearchParams.competitor)) {
        return initialSearchParams.competitor.filter(Boolean);
      }
      return [];
    })(),
    search: typeof initialSearchParams.search === 'string' ? initialSearchParams.search : "",
    inactive: initialSearchParams.inactive === "true",
    has_price: initialSearchParams.has_price === "true",
    // # Reason: Initialize sort properties from initialSearchParams.
    sortBy: typeof initialSearchParams.sort === 'string' ? initialSearchParams.sort : 'created_at',
    sortOrder: typeof initialSearchParams.sortOrder === 'string' && (initialSearchParams.sortOrder === 'asc' || initialSearchParams.sortOrder === 'desc') ? initialSearchParams.sortOrder : 'desc',
    // Initialize new price comparison filters
    price_lower_than_competitors: initialSearchParams.price_lower_than_competitors === "true",
    price_higher_than_competitors: initialSearchParams.price_higher_than_competitors === "true",
    // Initialize itemsPerPage from URL params, default to 16, validate allowed values
    itemsPerPage: (() => {
      if (typeof initialSearchParams.itemsPerPage === 'string') {
        const parsed = parseInt(initialSearchParams.itemsPerPage, 10);
        return [16, 32, 64].includes(parsed) ? parsed : 16;
      }
      return 16;
    })(),
  });

  const router = useRouter();
  const searchParams = useSearchParams(); // Get current URL params

  // # Reason: Ref to track the first render to avoid overriding initial deep links.
  const isFirstRender = useRef(true);

  // # Reason: Effect to synchronize complexFilters state with the URL.
  // This effect runs whenever complexFilters or searchParams change.
  useEffect(() => {
    // Skip URL update on first render to avoid overriding initial deep links.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // # Reason: Build the new URLSearchParams based on the current URL and complexFilters state.
    const params = new URLSearchParams(searchParams.toString());

    // # Reason: Update/delete complex filter parameters in the URL based on the state.
    if (complexFilters.brand) {
      params.set("brand", complexFilters.brand);
    } else {
      params.delete("brand");
    }
    if (complexFilters.competitor && complexFilters.competitor.length > 0) {
      params.set("competitor", complexFilters.competitor.join(','));
    } else {
      params.delete("competitor");
    }
    if (complexFilters.search) {
      params.set("search", complexFilters.search);
    } else {
      params.delete("search");
    }
    if (complexFilters.inactive) {
      params.set("inactive", "true");
    } else {
      params.delete("inactive");
    }
    if (complexFilters.has_price) {
      params.set("has_price", "true");
    } else {
      params.delete("has_price");
    }
    // Add price comparison filters to URL
    if (complexFilters.price_lower_than_competitors) {
      params.set("price_lower_than_competitors", "true");
    } else {
      params.delete("price_lower_than_competitors");
    }
    if (complexFilters.price_higher_than_competitors) {
      params.set("price_higher_than_competitors", "true");
    } else {
      params.delete("price_higher_than_competitors");
    }
    // # Reason: Add sort parameters to the URL based on the state.
    if (complexFilters.sortBy) {
        params.set("sort", complexFilters.sortBy);
    } else {
        params.delete("sort");
    }
    if (complexFilters.sortOrder) {
        params.set("sortOrder", complexFilters.sortOrder);
    } else {
        params.delete("sortOrder");
    }
    // Add itemsPerPage to URL (only if different from default)
    if (complexFilters.itemsPerPage && complexFilters.itemsPerPage !== 16) {
        params.set("itemsPerPage", complexFilters.itemsPerPage.toString());
    } else {
        params.delete("itemsPerPage");
    }


    // # Reason: Construct the new URL and push it using the router.
    const queryString = params.toString();
    const newUrl = `/app-routes/products${queryString ? `?${queryString}` : ""}`;

    // # Reason: Only push if the URL has actually changed to avoid unnecessary navigation.
    if (newUrl !== window.location.pathname + window.location.search) {
       router.push(newUrl, { scroll: false });
    }

  }, [complexFilters, router]); // Only depend on complexFilters and router, not searchParams to avoid circular updates

  // Callback function for ProductsFilter to update complex filters
  const handleComplexFilterChange = useCallback((newFilters: Partial<ComplexFiltersState>) => {
    setComplexFilters(prevFilters => ({ ...prevFilters, ...newFilters }));
    // We no longer push complex filters to URL here
  }, []);

  return (
    // Suspense boundary for the content rendering which now uses the hook
    <Suspense fallback={<LoadingFallback />}>
      {/* ProductsPageContent will now use the useSearchParams hook itself */}
      <ProductsPageContent
        complexFilters={complexFilters} // Pass complexFilters state down
        onComplexFilterChange={handleComplexFilterChange} // Pass callback down
        initialCompetitors={initialCompetitors}
        initialBrands={initialBrands}
        cookieHeader={cookieHeader}
        // # Reason: No longer passing initialSearchParams or searchParams hook result down.
        // URL state management is centralized in ProductsClientWrapper.
      />
    </Suspense>
  );
}