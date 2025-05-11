'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/supabase/database.types';

// Simple SVG icons
const BrandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 016 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ProductIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const TopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

type Brand = Database['public']['Tables']['brands']['Row'] & {
  product_count?: number;
  competitor_count?: number;
  aliases?: string[];
};

// Define types for competitor stats
interface CompetitorStat {
  id: string;
  name: string;
  totalProducts: number;
}

interface BrandStatisticsServerProps {
  brands: Brand[];
  topCompetitors?: CompetitorStat[];
}

const BrandStatisticsServer: React.FC<BrandStatisticsServerProps> = ({ 
  brands,
  topCompetitors = []
}) => {
  const router = useRouter();

  // Calculate total number of brands
  const totalBrands = brands.length;

  // Calculate total number of products across all brands
  const totalProducts = brands.reduce((sum, brand) => sum + (brand.product_count || 0), 0);

  // Get top 5 brands by product count
  const topBrands = [...brands]
    .sort((a, b) => (b.product_count || 0) - (a.product_count || 0))
    .slice(0, 5);

  // Count brands by product count ranges
  const brandsOver1000 = brands.filter(brand => (brand.product_count || 0) >= 1000).length;
  const brands500to999 = brands.filter(brand => (brand.product_count || 0) >= 500 && (brand.product_count || 0) < 1000).length;
  const brands100to499 = brands.filter(brand => (brand.product_count || 0) >= 100 && (brand.product_count || 0) < 500).length;
  const brands10to99 = brands.filter(brand => (brand.product_count || 0) >= 10 && (brand.product_count || 0) < 100).length;
  const brands1to9 = brands.filter(brand => (brand.product_count || 0) >= 1 && (brand.product_count || 0) < 10).length;

  // Handle filter click
  const handleFilterClick = (min: number, max: number | null) => {
    // Navigate to brands page with filter
    const query = new URLSearchParams();
    query.set('minProducts', min.toString());
    if (max !== null) {
      query.set('maxProducts', max.toString());
    }
    router.push(`/app-routes/brands?${query.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Total Brands */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Total Brands</h3>
            <p className="text-3xl font-bold text-indigo-600">{totalBrands}</p>
          </div>
          <div className="bg-indigo-50 p-2 rounded-full">
            <BrandIcon />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Top 5 Brands:</h4>
          <ul className="space-y-1">
            {topBrands.map((brand, index) => (
              <li key={brand.id} className="flex justify-between items-center text-xs">
                <Link
                  href={`/app-routes/products?brand=${brand.id}`}
                  className="font-medium hover:text-indigo-600 hover:underline cursor-pointer"
                >
                  <span className="inline-block w-5 text-gray-500">{index + 1}.</span> {brand.name}
                </Link>
                <span className="text-gray-600 font-medium">{(brand.product_count || 0).toLocaleString()} products</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Total Products */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Total Products</h3>
            <p className="text-3xl font-bold text-indigo-600">{totalProducts.toLocaleString()}</p>
          </div>
          <div className="bg-indigo-50 p-2 rounded-full">
            <ProductIcon />
          </div>
        </div>

        {topCompetitors.length > 0 ? (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Top 5 Competitors:</h4>
            <ul className="space-y-1">
              {topCompetitors.map((competitor, index) => (
                <li key={competitor.id} className="flex justify-between items-center text-xs">
                  <Link
                    href={`/app-routes/products?competitor=${competitor.id}`}
                    className="font-medium hover:text-indigo-600 hover:underline cursor-pointer"
                  >
                    <span className="inline-block w-5 text-gray-500">{index + 1}.</span> {competitor.name}
                  </Link>
                  <span className="text-gray-600 font-medium">{competitor.totalProducts.toLocaleString()} products</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Brand Distribution */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Brand Distribution</h3>
          </div>
          <div className="bg-indigo-50 p-2 rounded-full">
            <TopIcon />
          </div>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <div
            onClick={() => handleFilterClick(1000, null)}
            className="flex justify-between cursor-pointer hover:bg-indigo-50 p-1 rounded transition-colors hover:bg-indigo-100"
          >
            <span>Brands with over 1000 products:</span>
            <span className="font-medium">{brandsOver1000}</span>
          </div>
          <div
            onClick={() => handleFilterClick(500, 999)}
            className="flex justify-between cursor-pointer hover:bg-indigo-50 p-1 rounded transition-colors hover:bg-indigo-100"
          >
            <span>Brands with 500-999 products:</span>
            <span className="font-medium">{brands500to999}</span>
          </div>
          <div
            onClick={() => handleFilterClick(100, 499)}
            className="flex justify-between cursor-pointer hover:bg-indigo-50 p-1 rounded transition-colors hover:bg-indigo-100"
          >
            <span>Brands with 100-499 products:</span>
            <span className="font-medium">{brands100to499}</span>
          </div>
          <div
            onClick={() => handleFilterClick(10, 99)}
            className="flex justify-between cursor-pointer hover:bg-indigo-50 p-1 rounded transition-colors hover:bg-indigo-100"
          >
            <span>Brands with 10-99 products:</span>
            <span className="font-medium">{brands10to99}</span>
          </div>
          <div
            onClick={() => handleFilterClick(1, 9)}
            className="flex justify-between cursor-pointer hover:bg-indigo-50 p-1 rounded transition-colors hover:bg-indigo-100"
          >
            <span>Brands with 1-9 products:</span>
            <span className="font-medium">{brands1to9}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandStatisticsServer;
