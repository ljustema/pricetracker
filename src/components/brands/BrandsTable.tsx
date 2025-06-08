'use client';

import React from 'react';
import Link from 'next/link';
import { Database } from '@/lib/supabase/database.types';
// TODO: Import UI components (e.g., Table, Button, Switch) from your library (e.g., shadcn/ui)

type Brand = Database['public']['Tables']['brands']['Row'] & {
  product_count?: number;
  our_products_count?: number;
  competitor_count?: number;
  aliases?: string[];
  competitor_names?: string[];
};

// Define sort directions
type SortDirection = 'asc' | 'desc';

// Define sortable columns
type SortableColumn = 'name' | 'is_active' | 'needs_review' | 'product_count' | 'competitor_count' | 'aliases';

interface BrandsTableProps {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
  onDelete: (brandId: string) => void;
  onToggleActive: (brandId: string, currentStatus: boolean) => void;
  initialSortColumn?: SortableColumn; // Default column to sort by
  initialSortDirection?: SortDirection; // Default sort direction
  onSeeProducts?: (brandId: string) => void; // Optional callback for "See Products" button
}

const BrandsTable: React.FC<BrandsTableProps> = ({
  brands,
  onEdit,
  onDelete,
  onToggleActive,
  initialSortColumn = 'name',
  initialSortDirection = 'asc',
  onSeeProducts,
}) => {
  const [sortColumn, setSortColumn] = React.useState<SortableColumn>(initialSortColumn);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(initialSortDirection);
  if (!brands || brands.length === 0) {
    return <p>No brands found.</p>;
  }

  // Handle column header click for sorting
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      // If already sorting by this column, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If sorting by a new column, set it as the sort column with ascending direction
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort the brands based on current sort column and direction
  const sortedBrands = [...brands].sort((a, b) => {
    // Handle aliases column specially
    if (sortColumn === 'aliases') {
      const aAliases = a.aliases || [];
      const bAliases = b.aliases || [];
      // Sort by number of aliases
      if (sortDirection === 'asc') {
        return aAliases.length - bAliases.length;
      } else {
        return bAliases.length - aAliases.length;
      }
    }

    // Define a type for the possible values of Brand properties
    type BrandPropertyValue = string | boolean | number | string[] | null | undefined;

    let aValue: BrandPropertyValue = a[sortColumn as keyof Brand];
    let bValue: BrandPropertyValue = b[sortColumn as keyof Brand];

    // Handle special cases for nullable or undefined values
    if (aValue === null || aValue === undefined) aValue = sortDirection === 'asc' ? '' : Infinity;
    if (bValue === null || bValue === undefined) bValue = sortDirection === 'asc' ? '' : Infinity;

    // Handle arrays (like aliases)
    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      if (sortDirection === 'asc') {
        return aValue.length - bValue.length;
      } else {
        return bValue.length - aValue.length;
      }
    }

    // Compare based on type
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      // For numbers and booleans
      if (aValue === bValue) return 0;
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : 1;
      } else {
        return aValue > bValue ? -1 : 1;
      }
    }
  });

  // Helper to render sort indicator
  const renderSortIndicator = (column: SortableColumn) => {
    if (sortColumn !== column) return null;
    return (
      <span className="ml-1 text-indigo-600 font-bold">
        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
      </span>
    );
  };

  // Table with sticky header and fixed height
  return (
    <div className="overflow-x-auto border rounded-md shadow-md">
      <div style={{ height: '1000px' }} className="h-[1000px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort('name')}
              >
                Name{renderSortIndicator('name')}
              </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
              onClick={() => handleSort('is_active')}
            >
              Active{renderSortIndicator('is_active')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
              onClick={() => handleSort('needs_review')}
            >
              Needs Review{renderSortIndicator('needs_review')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
              onClick={() => handleSort('product_count')}
            >
              Product Count{renderSortIndicator('product_count')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
              onClick={() => handleSort('competitor_count')}
            >
              Competitor Count{renderSortIndicator('competitor_count')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
              onClick={() => handleSort('aliases')}
            >
              Aliases{renderSortIndicator('aliases')}
            </th>
            <th scope="col" className="relative px-6 py-3 bg-gray-50">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedBrands.map((brand) => (
            <tr key={brand.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <Link
                  href={`/app-routes/products?brand=${brand.id}`}
                  className="hover:text-indigo-600 hover:underline cursor-pointer"
                >
                  {brand.name}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {/* TODO: Replace with Switch component */}
                <button onClick={() => onToggleActive(brand.id, brand.is_active ?? false)}>
                   {brand.is_active ? 'Yes' : 'No'}
                </button>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {brand.needs_review ? 'Yes' : 'No'}
              </td>
               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {brand.product_count !== undefined ? brand.product_count : '-'}
              </td>
               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 relative group">
                <div className="cursor-help">
                  {brand.competitor_count !== undefined ? brand.competitor_count : '-'}
                  {brand.competitor_names && brand.competitor_names.length > 0 && (
                    <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded p-2 left-1/2 transform -translate-x-1/2 mt-1 w-max max-w-xs">
                      <div className="font-semibold mb-1">Competitors:</div>
                      <ul className="list-disc pl-4">
                        {brand.competitor_names.map((name: string, index: number) => (
                          <li key={index}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {brand.aliases && brand.aliases.length > 0 ? (
                  <div className="max-w-xs overflow-hidden">
                    <div className="truncate">{brand.aliases.join(', ')}</div>
                    {brand.aliases.length > 2 && (
                      <span className="text-xs text-gray-400">{brand.aliases.length} aliases</span>
                    )}
                  </div>
                ) : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                {/* TODO: Replace with Button components */}
                <button onClick={() => onEdit(brand)} className="text-indigo-600 hover:text-indigo-900">
                  Edit
                </button>
                {onSeeProducts && (
                  <button
                    onClick={() => onSeeProducts(brand.id)}
                    className="text-green-600 hover:text-green-900"
                  >
                    See Products
                  </button>
                )}
                <button onClick={() => onDelete(brand.id)} className="text-red-600 hover:text-red-900">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {/* TODO: Add Pagination controls */}
    </div>
  );
};

export default BrandsTable;