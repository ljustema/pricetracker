'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/supabase/database.types';

type Brand = Database['public']['Tables']['brands']['Row'];

interface BrandDirectMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandToMerge: Brand | null;
  onMergeComplete: () => void;
}

const BrandDirectMergeModal: React.FC<BrandDirectMergeModalProps> = ({
  isOpen,
  onClose,
  brandToMerge,
  onMergeComplete,
}) => {
  const router = useRouter();
  const [availableBrands, setAvailableBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available brands to merge into
  useEffect(() => {
    if (isOpen && brandToMerge) {
      const fetchBrands = async () => {
        try {
          // Only fetch active brands
          const res = await fetch('/api/brands?isActive=true');
          if (!res.ok) {
            throw new Error('Failed to fetch brands');
          }
          const brands: Brand[] = await res.json();

          // Filter out the current brand and sort alphabetically
          const filteredBrands = brands
            .filter(brand => brand.id !== brandToMerge.id)
            .sort((a, b) => a.name.localeCompare(b.name));

          setAvailableBrands(filteredBrands);
        } catch (err) {
          setError('Failed to load brands. Please try again.');
          console.error('Error fetching brands:', err);
        }
      };

      fetchBrands();
    }
  }, [isOpen, brandToMerge]);

  const handleMerge = async () => {
    if (!selectedBrandId || !brandToMerge) {
      setError('Please select a brand to merge into.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/brands/direct-merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brandToMergeId: brandToMerge.id,
          targetBrandId: selectedBrandId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || 'Failed to merge brands');
      }

      // Force Next.js to revalidate the page data
      router.refresh();

      // Success - call the callback to refresh data in the parent component
      onMergeComplete();
      onClose();

      // Wait a moment to ensure the server has processed the merge
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate back to the brands page with cache busting parameter
      router.push(`/app-routes/brands?refresh=${Date.now()}`);
    } catch (err) {
      console.error('Error merging brands:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Merge Brand</h2>

        {brandToMerge && (
          <div className="mb-4">
            <p className="font-medium">Merge &quot;{brandToMerge.name}&quot; into:</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            disabled={isLoading}
          >
            <option value="">Select a brand...</option>
            {availableBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            disabled={isLoading || !selectedBrandId}
          >
            {isLoading ? 'Merging...' : 'Merge Brands'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandDirectMergeModal;
