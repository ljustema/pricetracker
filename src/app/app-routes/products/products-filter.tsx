"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import type { ComplexFiltersState } from './products-client-wrapper';

interface ProductsFilterProps {
  brands: { id: string; name: string }[];
  competitors: { id: string; name: string }[];
  // Receive current complex filter state from parent
  currentFilters: ComplexFiltersState;
  // Callback to notify parent of complex filter changes
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void;
  // # Reason: Accept the useSearchParams hook result from the parent for reading URL parameters.
  searchParams: ReadonlyURLSearchParams;
}

export default function ProductsFilter({
  brands,
  competitors,
  currentFilters, // Use prop for current state
  onComplexFilterChange, // Use callback for changes
  searchParams, // Receive searchParams from parent
}: ProductsFilterProps) {
  // No need for router as URL updates are handled by the parent

  // Local state ONLY for sort dropdown, as it directly controls URL params
  // # Reason: Initialize local sort state from the URL searchParams.
  const initialSort = searchParams.get('sort') || 'created_at';
  const initialSortOrder = searchParams.get('sortOrder') || 'desc';
  const [sortBy, setSortBy] = useState<string>(`${initialSort}-${initialSortOrder}`);

  // Update local sortBy state if the URL parameters change externally
  useEffect(() => {
    const currentSort = searchParams.get('sort') || 'created_at';
    const currentSortOrder = searchParams.get('sortOrder') || 'desc';
    const currentSortValue = `${currentSort}-${currentSortOrder}`;
    if (currentSortValue !== sortBy) {
      setSortBy(currentSortValue);

      // Make sure the parent's complexFilters state is also updated
      // This ensures consistency between local state and parent state
      if (currentFilters.sortBy !== currentSort || currentFilters.sortOrder !== currentSortOrder) {
        onComplexFilterChange({
          sortBy: currentSort,
          sortOrder: currentSortOrder as 'asc' | 'desc'
        });
      }
    }
  }, [searchParams, sortBy, currentFilters.sortBy, currentFilters.sortOrder, onComplexFilterChange]);


  // Debounced search handler (optional but good practice)
  // Make debounce generic to correctly type the passed function and its arguments
  // Revert constraint to any[] for flexibility, but keep Parameters<T> for the returned function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    // The returned function signature uses Parameters<T> to match the input function `func`
    const debouncedFunction = (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args); // Call the original function with the correct arguments
      }, delay);
    };

    // Add a cancel method to the debounced function
    debouncedFunction.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return debouncedFunction;
  };

  // Use useMemo to memoize the debounced function itself
  const debouncedSearchHandler = useMemo(
    () => debounce((value: string) => {
        // # Reason: Update the complex filter state in the parent.
        onComplexFilterChange({ search: value });
        // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
        // which reacts to changes in complexFilters.
      }, 300),
    [onComplexFilterChange] // Depend on the stable callback prop
  );

  // Local state for search input - ensure it's always a string
  const [searchValue, setSearchValue] = useState(currentFilters.search || "");

  // Update local search state when currentFilters.search changes
  useEffect(() => {
    // Make sure we're always dealing with strings to avoid controlled/uncontrolled input warnings
    const currentSearch = currentFilters.search || "";
    if (currentSearch !== searchValue) {
      setSearchValue(currentSearch);
    }
  }, [currentFilters.search, searchValue]);

  // Handler for immediate search input change (updates UI instantly)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    // Call the memoized debounced function
    debouncedSearchHandler(newValue);
  };

  // # Reason: No longer managing URL updates directly in this component.
  // The useEffect for URL updates and the refs (isFirstRender, prevUrlRef) are removed.


  return (
    <div className="mb-6 space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search products..."
          className="w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
          // Use controlled input with value from local state
          value={searchValue}
          onChange={handleSearchInputChange} // Use debounced handler
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
            Brand
          </label>
          <select
            id="brand"
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={currentFilters.brand} // Controlled by prop
            onChange={(e) => {
              const newBrandValue = e.target.value;
              // # Reason: Update the complex filter state in the parent.
              onComplexFilterChange({ brand: newBrandValue });
              // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
              // which reacts to changes in complexFilters.
            }}
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="competitor" className="block text-sm font-medium text-gray-700">
            Competitor
          </label>
          <select
            id="competitor"
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={currentFilters.competitor} // Controlled by prop
            onChange={(e) => {
              const newCompetitorValue = e.target.value;
              // # Reason: Update the complex filter state in the parent.
              onComplexFilterChange({ competitor: newCompetitorValue });
              // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
              // which reacts to changes in complexFilters.
            }}
          >
            <option value="">All Competitors</option>
            {competitors.map((competitor) => (
              <option key={competitor.id} value={competitor.id}>
                {competitor.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sort" className="block text-sm font-medium text-gray-700">
            Sort By
          </label>
          <select
            id="sort"
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={sortBy} // Controlled by local state
            onChange={(e) => {
              const newSortValue = e.target.value;
              // Update the local sort state
              setSortBy(newSortValue);

              // Split the value into sortBy and sortOrder parts
              const [field, order] = newSortValue.split('-');

              // Update both sortBy and sortOrder in the parent's complexFilters state
              onComplexFilterChange({
                sortBy: field,
                sortOrder: order as 'asc' | 'desc'
              });
              // The URL update will be handled by the useEffect in ProductsClientWrapper
            }}
          >
            {/* Use combined values like field-order */}
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            {/* Add other sort options as needed */}
          </select>
        </div>

        <div className="flex flex-col space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={currentFilters.inactive} // Controlled by prop
              onChange={(e) => {
                const newInactiveValue = e.target.checked;
                // # Reason: Update the complex filter state in the parent.
                onComplexFilterChange({ inactive: newInactiveValue });
                // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
                // which reacts to changes in complexFilters.
              }}
            />
            <span className="ml-2 text-sm text-gray-700">Show Inactive Products</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={currentFilters.has_price} // Controlled by prop
              onChange={(e) => {
                const newHasPriceValue = e.target.checked;
                // # Reason: Update the complex filter state in the parent.
                onComplexFilterChange({ has_price: newHasPriceValue });
                // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
                // which reacts to changes in complexFilters.
              }}
            />
            <span className="ml-2 text-sm text-gray-700">Only show products with our price</span>
          </label>
        </div>
      </div>
    </div>
  );
}