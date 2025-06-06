"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import type { ComplexFiltersState } from './products-client-wrapper';
import MultiSelectDropdown from '@/components/ui/multi-select-dropdown';

// Move debounce function outside the component so it doesn't get recreated on every render
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
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
}

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


  // Use useMemo to memoize the debounced function itself
  const debouncedSearchHandler = useMemo(
    () => debounce((value: string) => {
        // # Reason: Update the complex filter state in the parent.
        onComplexFilterChange({ search: value });
        // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
        // which reacts to changes in complexFilters.
      }, 300), // Use a shorter delay for better responsiveness
    [onComplexFilterChange] // Depend on the stable callback prop
  );

  // Local state for search input - ensure it's always a string
  const [searchValue, setSearchValue] = useState(currentFilters.search || "");

  // Update local search state when currentFilters.search changes
  useEffect(() => {
    // Make sure we're always dealing with strings to avoid controlled/uncontrolled input warnings
    const currentSearch = currentFilters.search || "";
    // Only update if the value is different to avoid infinite loops
    // Don't include searchValue in the dependency array to prevent circular updates
    if (currentSearch !== searchValue) {
      setSearchValue(currentSearch);
    }
  }, [currentFilters.search]); // Removed searchValue from dependencies

  // Handler for immediate search input change (updates UI instantly)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Just update the local state, don't trigger search
    setSearchValue(e.target.value);
  };

  // Handler for search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trigger search on form submission
    debouncedSearchHandler(searchValue);
  };

  // Handler for clearing the search
  const handleClearSearch = () => {
    setSearchValue("");
    debouncedSearchHandler("");
  };

  // # Reason: No longer managing URL updates directly in this component.
  // The useEffect for URL updates and the refs (isFirstRender, prevUrlRef) are removed.


  return (
    <div className="mb-6 space-y-4">
      {/* Search input with form */}
      <form onSubmit={handleSearchSubmit} className="relative mb-2">
        <div className="flex items-center">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search products..."
              className={`w-full rounded-l-md border py-2 pl-10 pr-8 focus:outline-none focus:ring-indigo-500 text-sm ${
                currentFilters.search ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
              }`}
              value={searchValue}
              onChange={handleSearchInputChange}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className={`h-5 w-5 ${currentFilters.search ? 'text-indigo-500' : 'text-gray-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-r-md border border-l-0 border-gray-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Search
          </button>
        </div>
        {currentFilters.search && (
          <div className="mt-2 flex items-center text-sm text-indigo-600">
            <span className="mr-2">Showing results for:</span>
            <span className="font-medium">{currentFilters.search}</span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="ml-2 text-indigo-500 hover:text-indigo-700 underline"
            >
              Clear
            </button>
          </div>
        )}
      </form>

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
          <MultiSelectDropdown
            options={competitors}
            selectedValues={currentFilters.competitor}
            onChange={(selectedValues) => {
              // # Reason: Update the complex filter state in the parent.
              onComplexFilterChange({ competitor: selectedValues });
              // # Reason: The URL update will be handled by the useEffect in ProductsClientWrapper,
              // which reacts to changes in complexFilters.
            }}
            placeholder="All Competitors"
            label="Competitors"
            id="competitor"
          />
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

        <div>
          <label htmlFor="filter" className="block text-sm font-medium text-gray-700">
            Filter
          </label>
          <select
            id="filter"
            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            value={
              currentFilters.inactive ? "inactive" :
              currentFilters.has_price ? "our_products" :
              currentFilters.price_lower_than_competitors ? "price_lower" :
              currentFilters.price_higher_than_competitors ? "price_higher" :
              "all"
            }
            onChange={(e) => {
              const value = e.target.value;
              // Reset all filters first
              const resetFilters = {
                inactive: false,
                has_price: false,
                price_lower_than_competitors: false,
                price_higher_than_competitors: false
              };

              // Set the selected filter
              switch (value) {
                case "inactive":
                  onComplexFilterChange({ ...resetFilters, inactive: true });
                  break;
                case "our_products":
                  onComplexFilterChange({ ...resetFilters, has_price: true });
                  break;
                case "price_lower":
                  onComplexFilterChange({ ...resetFilters, price_lower_than_competitors: true });
                  break;
                case "price_higher":
                  onComplexFilterChange({ ...resetFilters, price_higher_than_competitors: true });
                  break;
                default:
                  onComplexFilterChange(resetFilters);
                  break;
              }
            }}
          >
            <option value="all">All Products</option>
            <option value="inactive">Inactive Products</option>
            <option value="our_products">Our Products</option>
            <option value="price_lower">Price lower than competitor</option>
            <option value="price_higher">Price higher than competitor</option>
          </select>
        </div>
      </div>
    </div>
  );
}