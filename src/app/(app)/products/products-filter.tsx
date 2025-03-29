"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ProductsFilterProps {
  brands: string[];
  competitors: { id: string; name: string }[];
}

export default function ProductsFilter({ brands, competitors }: ProductsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedBrand, setSelectedBrand] = useState<string>(
    searchParams.get("brand") || ""
  );
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>(
    searchParams.get("competitor") || ""
  );
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sort") || "name"
  );
  const [showInactive, setShowInactive] = useState<boolean>(
    searchParams.get("inactive") === "true"
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("search") || ""
  );
  const [onlyWithPrice, setOnlyWithPrice] = useState<boolean>(
    searchParams.get("has_price") === "true"
  );

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (selectedBrand) {
      params.set("brand", selectedBrand);
    }
    
    if (selectedCompetitor) {
      params.set("competitor", selectedCompetitor);
    }
    
    if (sortBy && sortBy !== "name") {
      params.set("sort", sortBy);
    }
    
    if (showInactive) {
      params.set("inactive", "true");
    }
    
    if (searchQuery) {
      params.set("search", searchQuery);
    }
    
    if (onlyWithPrice) {
      params.set("has_price", "true");
    }
    
    const queryString = params.toString();
    const url = queryString ? `?${queryString}` : "";
    
    router.push(`/products${url}`);
  }, [selectedBrand, selectedCompetitor, sortBy, showInactive, searchQuery, onlyWithPrice, router]);

  return (
    <div className="mb-6 space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search products..."
          className="w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
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
            value={selectedCompetitor}
            onChange={(e) => setSelectedCompetitor(e.target.value)}
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
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
        
        <div className="flex flex-col space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span className="ml-2 text-sm text-gray-700">Show Inactive Products</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={onlyWithPrice}
              onChange={(e) => setOnlyWithPrice(e.target.checked)}
            />
            <span className="ml-2 text-sm text-gray-700">Only Products with Price</span>
          </label>
        </div>
      </div>
    </div>
  );
}