"use client";

import { useState, useEffect, useMemo } from "react"; // Removed unused useCallback
import { useRouter } from "next/navigation"; // Removed useSearchParams
import type { ComplexFiltersState } from './products-client-wrapper'; // Import filter state type

interface ProductsFilterProps {
  brands: string[];
  competitors: { id: string; name: string }[];
  // Receive current filter state from parent
  currentFilters: ComplexFiltersState & { sort: string }; // Include sort string
  // Callback to notify parent of complex filter changes
  onComplexFilterChange: (newFilters: Partial<ComplexFiltersState>) => void;
  // Receive simple params that *should* go in the URL
  simpleSearchParams: { page?: string; view?: string };
}

export default function ProductsFilter({
  brands,
  competitors,
  currentFilters, // Use prop for current state
  onComplexFilterChange, // Use callback for changes
  simpleSearchParams // Use prop for simple URL params
}: ProductsFilterProps) {
  const router = useRouter();

  // Local state ONLY for sort dropdown, as it directly controls URL params
  const [sortBy, setSortBy] = useState<string>(currentFilters.sort);

  // Update local sortBy state if the prop changes (e.g., initial load or external navigation)
  useEffect(() => {
    setSortBy(currentFilters.sort);
  }, [currentFilters.sort]);

  // Debounced search handler (optional but good practice)
  // Make debounce generic to correctly type the passed function and its arguments
  // Revert constraint to any[] for flexibility, but keep Parameters<T> for the returned function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    // The returned function signature uses Parameters<T> to match the input function `func`
    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args); // Call the original function with the correct arguments
      }, delay);
    };
  };

  // Use useMemo to memoize the debounced function itself
  const debouncedSearchHandler = useMemo(
    () => debounce((value: string) => {
        onComplexFilterChange({ search: value });
      }, 300),
    [onComplexFilterChange] // Depend on the stable callback prop
  );

  // Handler for immediate search input change (updates UI instantly)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Call the memoized debounced function
    debouncedSearchHandler(e.target.value);
  };

  // Update URL ONLY when simple params (sort, page, view) change
  useEffect(() => {
    const params = new URLSearchParams();

    // 1. Add sort parameters derived from local state `sortBy`
    if (sortBy) {
      const [sortField, sortDirection] = sortBy.split('-');
      if (sortField && sortDirection) {
        params.set("sort", sortField);
        params.set("sortOrder", sortDirection);
      } else if (sortField) { // Fallback if somehow only field exists
         params.set("sort", sortField);
         params.set("sortOrder", "desc"); // Default order
      }
    }

    // 2. Add simple parameters from props
    if (simpleSearchParams.page && simpleSearchParams.page !== '1') { // Only add page if not 1
      params.set("page", simpleSearchParams.page);
    }
    if (simpleSearchParams.view && simpleSearchParams.view !== 'cards') { // Only add view if not default 'cards'
       params.set("view", simpleSearchParams.view);
    }

    // 3. Construct URL and push
    const queryString = params.toString();
    // IMPORTANT: Keep existing complex filters in the URL if they were there initially?
    // Or remove them entirely? For this fix, we remove them to prevent 414.
    // If deep linking with complex filters is needed, another strategy is required.
    const url = `/products${queryString ? `?${queryString}` : ""}`;

    // Use replace instead of push to avoid polluting browser history excessively on filter changes?
    // Push is fine if history is desired.
    router.push(url);

    // Depend only on sortBy (local state) and simpleSearchParams (props)
  }, [sortBy, simpleSearchParams.page, simpleSearchParams.view, router]);

  return (
    <div className="mb-6 space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search products..."
          className="w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
          // Use defaultValue for uncontrolled input with debounce, or value={localSearchState} if using local state
          defaultValue={currentFilters.search}
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
            onChange={(e) => onComplexFilterChange({ brand: e.target.value })} // Call callback
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
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
            onChange={(e) => onComplexFilterChange({ competitor: e.target.value })} // Call callback
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
            onChange={(e) => setSortBy(e.target.value)} // Update local state (triggers useEffect for URL)
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
              onChange={(e) => onComplexFilterChange({ inactive: e.target.checked })} // Call callback
            />
            <span className="ml-2 text-sm text-gray-700">Show Inactive Products</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={currentFilters.has_price} // Controlled by prop
              onChange={(e) => onComplexFilterChange({ has_price: e.target.checked })} // Call callback
            />
            <span className="ml-2 text-sm text-gray-700">Only show products with our price</span>
          </label>
        </div>
      </div>
    </div>
  );
}