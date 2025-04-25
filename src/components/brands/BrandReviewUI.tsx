'use client';

import React, { useState } from 'react';
import { Database } from '@/lib/supabase/database.types';
// TODO: Import UI components (e.g., Card, Button) from your library

type Brand = Database['public']['Tables']['brands']['Row'];

interface BrandReviewUIProps {
  brandsToReview: Brand[];
  onConfirm: (brandId: string) => Promise<void>; // Function to set needs_review = false
  onConfirmAll?: (brandIds: string[]) => Promise<void>; // Function to confirm multiple brands at once
  onInitiateMerge: (brandToMerge: Brand) => void; // Function to open merge UI/modal with this brand pre-selected
  onSeeProducts?: (brandId: string) => void; // Function to navigate to products page filtered by brand
  isLoading: boolean; // To disable actions while processing
}

const BrandReviewUI: React.FC<BrandReviewUIProps> = ({
  brandsToReview,
  onConfirm,
  onConfirmAll,
  onInitiateMerge,
  onSeeProducts,
  isLoading,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null); // Track which brand is being processed

  const handleConfirmClick = async (brandId: string) => {
    setError(null);
    setProcessingId(brandId);
    try {
      await onConfirm(brandId);
      // Parent component should refetch data to update the list
    } catch (err: unknown) {
      console.error("Error confirming brand:", err);
      setError(err instanceof Error ? err.message : 'Failed to confirm brand.');
    } finally {
      setProcessingId(null);
    }
  };

   const handleMergeClick = (brand: Brand) => {
    // Simply call the callback provided by the parent page
    // The parent page will handle opening the merge UI/modal
    onInitiateMerge(brand);
  };


  if (!brandsToReview || brandsToReview.length === 0) {
    return <p>No brands currently need review.</p>;
  }

  const handleConfirmAllClick = async () => {
    if (!onConfirmAll) {
      setError('Mass confirmation is not available.');
      return;
    }

    if (!window.confirm(`Are you sure you want to confirm all ${brandsToReview.length} brands as correct?`)) {
      return;
    }

    setError(null);
    setProcessingId('all');

    try {
      // Get all brand IDs
      const brandIds = brandsToReview.map(brand => brand.id);

      // Call the parent's callback for all brands
      await onConfirmAll(brandIds);
    } catch (err: unknown) {
      console.error("Error confirming all brands:", err);
      setError(err instanceof Error ? err.message : 'Failed to confirm all brands.');
    } finally {
      setProcessingId(null);
    }
  };

  // TODO: Replace with actual Card, Button components
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded mb-4">{error}</p>}

      {brandsToReview.length > 1 && onConfirmAll && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleConfirmAllClick}
            disabled={isLoading || processingId === 'all'}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {processingId === 'all' ? 'Confirming All...' : `Confirm All ${brandsToReview.length} Brands`}
          </button>
        </div>
      )}
      {brandsToReview.map((brand) => (
        <div key={brand.id} className="border p-4 rounded-md shadow-sm flex justify-between items-center">
          <div>
            <p className="font-medium">{brand.name}</p>
            <p className="text-xs text-gray-500">ID: {brand.id}</p>
             {!brand.is_active && <p className="text-xs text-red-500">(Currently Inactive)</p>}
          </div>
          <div className="space-x-2">
            <button
              onClick={() => handleConfirmClick(brand.id)}
              disabled={isLoading || processingId === brand.id}
              className="px-3 py-1 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {processingId === brand.id ? 'Confirming...' : 'Confirm as Correct'}
            </button>
            {onSeeProducts && (
              <button
                onClick={() => onSeeProducts(brand.id)}
                disabled={isLoading || processingId === brand.id}
                className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 border border-transparent rounded-md hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                See Products
              </button>
            )}
             <button
              onClick={() => handleMergeClick(brand)}
              disabled={isLoading || processingId === brand.id} // Disable while any action is processing
              className="px-3 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Merge with Existing...
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BrandReviewUI;