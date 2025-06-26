'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/supabase/database.types';
// TODO: Import UI components (e.g., Card, Button, Checkbox, Select) from your library

type Brand = Database['public']['Tables']['brands']['Row'];

interface BrandStandardizationUIProps {
  duplicateBrands: Brand[]; // Array containing all brands identified as potential duplicates
  onMerge: (primaryBrandId: string, brandIdsToMerge: string[]) => Promise<void>;
  onDismissDuplicates?: (groupKey: string, brandIds: string[]) => Promise<void>; // Optional callback to dismiss duplicates
  onSeeProducts?: (brandId: string) => void; // Function to navigate to products page filtered by brand
  isLoading: boolean; // To disable actions while merging
  brandToMerge?: Brand | null; // Optional brand to pre-select for merging
  onBrandToMergeProcessed?: () => void; // Callback to clear the brandToMerge after it's processed
}

// Helper to group brands by normalized name
const groupBrandsByName = (brands: Brand[]): Record<string, Brand[]> => {
  // First, group by exact normalized name
  const groups: Record<string, Brand[]> = {};
  const processedBrands = new Set<string>();
  const normalize = (name: string | null | undefined) => {
    if (!name) return '';
    let normalized = name.trim().toLowerCase();
    normalized = normalized.replace(/^(by|from|made by)\s+/i, '');
    normalized = normalized.replace(/\s+(brand|official|store|shop)$/i, '');
    normalized = normalized.replace(/[\-_\.\&\+]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
  };

  // First pass: group by exact normalized name
  brands.forEach(brand => {
    const normalizedName = normalize(brand.name);
    if (!normalizedName) return;

    if (!groups[normalizedName]) {
      groups[normalizedName] = [];
    }
    groups[normalizedName].push(brand);

    if (groups[normalizedName].length > 1) {
      groups[normalizedName].forEach(b => processedBrands.add(b.id));
    }
  });

  // Second pass: find similar brands
  for (let i = 0; i < brands.length; i++) {
    const brand1 = brands[i];
    if (processedBrands.has(brand1.id)) continue;

    const normalized1 = normalize(brand1.name);
    if (!normalized1) continue;

    const similarBrands: Brand[] = [brand1];

    for (let j = i + 1; j < brands.length; j++) {
      const brand2 = brands[j];
      if (processedBrands.has(brand2.id)) continue;

      const normalized2 = normalize(brand2.name);
      if (!normalized2) continue;

      // Check for contained substrings (e.g., "Calixter" and "By Calixter")
      if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
        similarBrands.push(brand2);
        processedBrands.add(brand2.id);
      }
    }

    if (similarBrands.length > 1) {
      const key = `similar_${normalized1}`;
      groups[key] = similarBrands;
      processedBrands.add(brand1.id);
    }
  }

  // Filter out groups with only one brand
  return Object.fromEntries(Object.entries(groups).filter(([_, group]) => group.length > 1));
};

const BrandStandardizationUI: React.FC<BrandStandardizationUIProps> = ({
  duplicateBrands,
  onMerge,
  onDismissDuplicates,
  onSeeProducts,
  isLoading,
  brandToMerge,
  onBrandToMergeProcessed,
}) => {
  const router = useRouter();
  const [selectedBrands, setSelectedBrands] = useState<Record<string, string[]>>({}); // { groupKey: [brandId1, brandId2] }
  const [primaryBrand, setPrimaryBrand] = useState<Record<string, string>>({}); // { groupKey: primaryBrandId }
  const [error, setError] = useState<string | null>(null);

  const duplicateGroups = useMemo(() => groupBrandsByName(duplicateBrands), [duplicateBrands]);
  const groupKeys = Object.keys(duplicateGroups);

  // Handle brandToMerge prop
  useEffect(() => {
    if (brandToMerge && duplicateGroups) {
      // Find the group that contains this brand
      const normalizedName = (brandToMerge.name || '').trim().toLowerCase();

      // Check if this brand is in any of the duplicate groups
      if (duplicateGroups[normalizedName]) {
        // Select this brand and all other brands in the group
        const groupBrands = duplicateGroups[normalizedName];
        const brandIds = groupBrands.map(b => b.id);

        // Set this brand as selected
        setSelectedBrands(prev => ({
          ...prev,
          [normalizedName]: brandIds
        }));

        // Set this brand as the primary brand
        setPrimaryBrand(prev => ({
          ...prev,
          [normalizedName]: brandToMerge.id
        }));

        // Scroll to this group
        setTimeout(() => {
          const groupElement = document.getElementById(`group-${normalizedName}`);
          if (groupElement) {
            groupElement.scrollIntoView({ behavior: 'smooth' });
            groupElement.classList.add('bg-yellow-50'); // Highlight the group
            setTimeout(() => {
              groupElement.classList.remove('bg-yellow-50');
            }, 2000);
          }
        }, 100);

        // Call the callback to clear the brandToMerge
        if (onBrandToMergeProcessed) {
          onBrandToMergeProcessed();
        }
      }
    }
  }, [brandToMerge, duplicateGroups, onBrandToMergeProcessed]);

  const handleCheckboxChange = (groupKey: string, brandId: string) => {
    setSelectedBrands(prev => {
      const currentSelection = prev[groupKey] || [];
      const newSelection = currentSelection.includes(brandId)
        ? currentSelection.filter(id => id !== brandId)
        : [...currentSelection, brandId];

      // If the primary was deselected, reset primary for this group
      if (primaryBrand[groupKey] === brandId && !newSelection.includes(brandId)) {
        setPrimaryBrand(p => ({ ...p, [groupKey]: '' }));
      }

      return { ...prev, [groupKey]: newSelection };
    });
  };

  const handlePrimaryChange = (groupKey: string, brandId: string) => {
    // Only allow selecting a primary if it's also selected for merging (or is the only one selected)
    if (selectedBrands[groupKey]?.includes(brandId)) {
      setPrimaryBrand(prev => ({ ...prev, [groupKey]: brandId }));
    }
  };

  const handleMergeClick = async (groupKey: string) => {
    setError(null);
    const primaryId = primaryBrand[groupKey];
    const idsToMerge = (selectedBrands[groupKey] || []).filter(id => id !== primaryId);

    if (!primaryId) {
      setError(`Please select a primary brand for "${groupKey}" to merge into.`);
      return;
    }
    if (idsToMerge.length === 0) {
      setError(`Please select at least one other brand to merge into "${primaryId}".`);
      return;
    }

    try {
      // Immediately update the UI by removing this group from the display
      // This provides instant visual feedback even before the API call completes
      const groupElement = document.getElementById(`group-${groupKey}`);
      if (groupElement) {
        groupElement.style.opacity = '0.5';
        groupElement.style.pointerEvents = 'none';
      }

      // Call the merge function from the parent component
      await onMerge(primaryId, idsToMerge);

      // Clear selection for this group after successful merge
      setSelectedBrands(prev => ({ ...prev, [groupKey]: [] }));
      setPrimaryBrand(prev => ({ ...prev, [groupKey]: '' }));

      // Force Next.js to revalidate the page data
      router.refresh();

      // Navigate back to the brands page with cache busting parameter
      router.push(`/app-routes/brands?refresh=${Date.now()}`);
    } catch (err: unknown) {
      console.error("Error merging brands:", err);
      setError(err instanceof Error ? err.message : 'Failed to merge brands.');

      // Restore the UI if there was an error
      const groupElement = document.getElementById(`group-${groupKey}`);
      if (groupElement) {
        groupElement.style.opacity = '1';
        groupElement.style.pointerEvents = 'auto';
      }
    }
  };

  const handleDismissDuplicatesClick = async (groupKey: string) => {
    if (!onDismissDuplicates) {
      setError('Dismiss functionality is not available.');
      return;
    }

    setError(null);
    const brandIds = duplicateGroups[groupKey].map(brand => brand.id);

    if (brandIds.length === 0) {
      return;
    }

    if (!window.confirm(`Are you sure you want to keep these brands separate? They will no longer appear as potential duplicates.`)) {
      return;
    }

    try {
      // Immediately update the UI by fading out this group
      // This provides instant visual feedback even before the API call completes
      const groupElement = document.getElementById(`group-${groupKey}`);
      if (groupElement) {
        groupElement.style.opacity = '0.5';
        groupElement.style.pointerEvents = 'none';
      }

      // Call the dismiss function from the parent component
      await onDismissDuplicates(groupKey, brandIds);

      // Force Next.js to revalidate the page data
      router.refresh();

      // Wait a moment to ensure the server has processed the dismissal
      await new Promise(resolve => setTimeout(resolve, 100));

      // If the group element still exists, remove it completely
      if (groupElement && groupElement.parentNode) {
        groupElement.parentNode.removeChild(groupElement);
      }
    } catch (err: unknown) {
      console.error("Error dismissing duplicates:", err);
      setError(err instanceof Error ? err.message : 'Failed to dismiss duplicates.');

      // Restore the UI if there was an error
      const groupElement = document.getElementById(`group-${groupKey}`);
      if (groupElement) {
        groupElement.style.opacity = '1';
        groupElement.style.pointerEvents = 'auto';
      }
    }
  };

  if (groupKeys.length === 0) {
    return <p>No potential duplicate brands found needing standardization.</p>;
  }

  // TODO: Replace with actual Card, Button, Checkbox, Select/Radio components
  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded">{error}</p>}
      {groupKeys.map((groupKey) => (
        <div key={groupKey} id={`group-${groupKey}`} className="border p-4 rounded-md shadow-sm transition-colors duration-300">
          <h3 className="text-lg font-medium mb-1">Potential Duplicates</h3>
          <p className="text-sm text-gray-500 mb-3">
            {groupKey.startsWith('similar_')
              ? 'These brands appear to be similar and might be duplicates.'
              : 'These brands have identical normalized names.'}
          </p>
          <div className="space-y-2 mb-4">
            {duplicateGroups[groupKey].map((brand) => (
              <div key={brand.id} className="flex items-center space-x-4">
                <input
                  type="checkbox"
                  id={`select-${groupKey}-${brand.id}`}
                  checked={selectedBrands[groupKey]?.includes(brand.id) ?? false}
                  onChange={() => handleCheckboxChange(groupKey, brand.id)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                 <input
                  type="radio"
                  id={`primary-${groupKey}-${brand.id}`}
                  name={`primary-${groupKey}`}
                  value={brand.id}
                  checked={primaryBrand[groupKey] === brand.id}
                  onChange={() => handlePrimaryChange(groupKey, brand.id)}
                  disabled={!(selectedBrands[groupKey]?.includes(brand.id))} // Disable if not selected
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label htmlFor={`select-${groupKey}-${brand.id}`} className="flex-1">
                  {brand.name} <span className="text-xs text-gray-500">(ID: {brand.id})</span>
                  {!brand.is_active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                </label>
                {onSeeProducts && (
                  <button
                    onClick={() => onSeeProducts(brand.id)}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 border border-transparent rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    See Products
                  </button>
                )}
                 <label htmlFor={`primary-${groupKey}-${brand.id}`} className="text-sm text-gray-600">
                  Set as Primary
                </label>
              </div>
            ))}
          </div>
          <div className="flex space-x-2">
            {onDismissDuplicates && (
              <button
                onClick={() => handleDismissDuplicatesClick(groupKey)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Keep Separate
              </button>
            )}
            <button
              onClick={() => handleMergeClick(groupKey)}
              disabled={isLoading || !primaryBrand[groupKey] || (selectedBrands[groupKey]?.length ?? 0) < 2}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Merging...' : `Merge Selected into Primary`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BrandStandardizationUI;