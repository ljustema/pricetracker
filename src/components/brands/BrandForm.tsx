'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@/lib/supabase/database.types';
// TODO: Import UI components (e.g., Dialog, Input, Button, Checkbox, Label) from your library

type Brand = Database['public']['Tables']['brands']['Row'];
type BrandInsert = Database['public']['Tables']['brands']['Insert'];
type BrandUpdate = Database['public']['Tables']['brands']['Update'];

// Extended brand type with aliases
type BrandWithAliases = Brand & { aliases?: string[] };

interface BrandFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: BrandInsert | BrandUpdate) => Promise<void>; // Make async for API call
  initialData?: BrandWithAliases | null; // Pass existing brand data with aliases for editing
  onInitiateMerge?: (brand: Brand) => void; // Optional callback to initiate merge
}

const BrandForm: React.FC<BrandFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  onInitiateMerge,
}) => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [needsReview, setNeedsReview] = useState(false); // Usually false when manually editing/adding
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);

  const isEditing = !!initialData;

  useEffect(() => {
    // Populate form when initialData changes (for editing)
    if (initialData) {
      setName(initialData.name ?? '');
      setIsActive(initialData.is_active ?? true);
      setNeedsReview(initialData.needs_review ?? false);
      setAliases(initialData.aliases || []);
    } else {
      // Reset form for adding
      setName('');
      setIsActive(true);
      setNeedsReview(false);
      setAliases([]);
    }
    setError(null); // Clear errors when form opens or data changes
  }, [initialData, isOpen]); // Rerun effect when isOpen changes too

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData: BrandUpdate | BrandInsert = {
      name: name.trim(),
      is_active: isActive,
      needs_review: needsReview,
      // For Insert, user_id is handled by the service/API
      // For Update, id is passed separately to the API endpoint
    };

    // Add id only if editing
    if (isEditing && initialData?.id) {
        (formData as BrandUpdate).id = initialData.id;
    } else {
        // Ensure id is not present for insert type if needed, though API should handle it
        delete (formData as BrandUpdate).id;
    }


    try {
      await onSubmit(formData);
      onClose(); // Close form on successful submission
    } catch (err: unknown) {
      console.error("Error submitting brand form:", err);
      setError(err instanceof Error ? err.message : 'Failed to save brand.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  // TODO: Replace with actual Dialog/Modal and Form components
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Brand' : 'Add New Brand'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="brandName" className="block text-sm font-medium text-gray-700">
              Brand Name
            </label>
            {/* TODO: Replace with Input component */}
            <input
              type="text"
              id="brandName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          {/* Display aliases if editing and there are aliases */}
          {isEditing && aliases.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alternative Names (Aliases)
              </label>
              <div className="bg-gray-50 p-3 rounded-md">
                <ul className="list-disc pl-5 space-y-1">
                  {aliases.map((alias, index) => (
                    <li key={index} className="text-sm text-gray-600">{alias}</li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2 italic">
                  These are alternative names from merged brands. Products with these names will be associated with this brand.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center">
             {/* TODO: Replace with Checkbox/Switch component */}
            <input
              type="checkbox"
              id="brandIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="brandIsActive" className="ml-2 block text-sm text-gray-900">
              Is Active
            </label>
          </div>

           {/* Optionally allow setting needs_review, though usually handled automatically */}
           {/* <div className="flex items-center">
             <input
              type="checkbox"
              id="brandNeedsReview"
              checked={needsReview}
              onChange={(e) => setNeedsReview(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="brandNeedsReview" className="ml-2 block text-sm text-gray-900">
              Needs Review
            </label>
          </div> */}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-between pt-4">
            {/* Merge button - only show when editing and onInitiateMerge is provided */}
            <div>
              {isEditing && initialData && onInitiateMerge && (
                <button
                  type="button"
                  onClick={() => {
                    onInitiateMerge(initialData);
                    // Close the form
                    onClose();
                    // Navigate back to brands page after initiating merge
                    setTimeout(() => {
                      router.push('/app-routes/brands');
                    }, 100);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Merge with Another Brand
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              {/* TODO: Replace with Button components */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Brand' : 'Add Brand')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BrandForm;