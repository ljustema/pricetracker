'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandsTable from '@/components/brands/BrandsTable';
import BrandForm from '@/components/brands/BrandForm';
import BrandStandardizationUI from '@/components/brands/BrandStandardizationUI';
import BrandReviewUI from '@/components/brands/BrandReviewUI';
import BrandDirectMergeModal from '@/components/brands/BrandDirectMergeModal';
import BrandStatistics from '@/components/brands/BrandStatistics';
import { Database } from '@/lib/supabase/database.types';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Removed unused imports
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
// Removed unused imports
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Brand = Database['public']['Tables']['brands']['Row'] & {
  product_count?: number;
  competitor_count?: number;
};
type BrandInsert = Database['public']['Tables']['brands']['Insert'];
type BrandUpdate = Database['public']['Tables']['brands']['Update'];


type Competitor = {
  id: string;
  name: string;
};

export default function BrandsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitorId = searchParams.get('competitor');

  const [brands, setBrands] = useState<Brand[]>([]);
  const [duplicates, setDuplicates] = useState<Brand[]>([]);
  const [needsReview, setNeedsReview] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competitorName, setCompetitorName] = useState<string>('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorDropdownOpen, setCompetitorDropdownOpen] = useState(false);
  const [competitorSearch, setCompetitorSearch] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCompetitorDropdownOpen(false);
        setCompetitorSearch(''); // Clear search when closing dropdown
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isMerging, setIsMerging] = useState(false); // State to indicate if a merge operation is in progress
  const [brandToMerge, setBrandToMerge] = useState<Brand | null>(null); // State to track which brand is being merged
  const [isDirectMergeModalOpen, setIsDirectMergeModalOpen] = useState(false); // State to control the direct merge modal
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]); // State to store filtered brands
  const [activeFilter, setActiveFilter] = useState<{min: number, max: number | null} | null>(null); // State to track active filter

  const fetchBrandData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // If competitorId is provided, fetch competitor name
      if (competitorId) {
        const competitorRes = await fetch(`/api/competitors/${competitorId}`);
        if (competitorRes.ok) {
          const competitor = await competitorRes.json();
          setCompetitorName(competitor.name);
        }
      }

      // Fetch all brands with analytics, duplicates, and those needing review in parallel
      const [analyticsRes, duplicatesRes, reviewRes] = await Promise.all([
        fetch('/api/brands/analytics'),
        fetch('/api/brands/duplicates'),
        fetch('/api/brands/review')
      ]);

      if (!analyticsRes.ok) throw new Error(`Failed to fetch brands with analytics: ${analyticsRes.statusText}`);
      if (!duplicatesRes.ok) throw new Error(`Failed to fetch duplicates: ${duplicatesRes.statusText}`);
      if (!reviewRes.ok) throw new Error(`Failed to fetch brands needing review: ${reviewRes.statusText}`);


      const brandsWithAnalytics: Brand[] = await analyticsRes.json();
      const duplicatesData: Brand[] = await duplicatesRes.json();
      const reviewData: Brand[] = await reviewRes.json();

      // If competitorId is provided, fetch brands for that competitor
      if (competitorId) {
        // Use the new API endpoint to get brands for this competitor
        const brandsForCompetitorRes = await fetch(`/api/brands/by-competitor?competitorId=${competitorId}`);

        if (brandsForCompetitorRes.ok) {
          const brandsForCompetitor = await brandsForCompetitorRes.json();

          // Merge the analytics data with the competitor-specific brands
          const brandsWithStats = brandsForCompetitor.map((brand: Brand) => {
            // Find the matching brand in brandsWithAnalytics to get the stats
            const brandWithAnalytics = brandsWithAnalytics.find(b => b.id === brand.id);
            return {
              ...brand,
              product_count: brandWithAnalytics?.product_count || 0,
              competitor_count: brandWithAnalytics?.competitor_count || 0
            };
          });

          setBrands(brandsWithStats);
        } else {
          console.error('Error fetching brands for competitor:', await brandsForCompetitorRes.text());
          setBrands(brandsWithAnalytics); // Fallback to all brands
        }
      } else {
        setBrands(brandsWithAnalytics);
      }

      setDuplicates(duplicatesData);
      setNeedsReview(reviewData);

    } catch (err: unknown) {
      console.error("Error fetching brand data:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [competitorId]); // Include competitorId in dependencies to refetch when it changes

  // Fetch competitors for the dropdown
  const fetchCompetitors = useCallback(async () => {
    try {
      const res = await fetch('/api/competitors');
      if (!res.ok) {
        throw new Error(`Failed to fetch competitors: ${res.statusText}`);
      }
      const data = await res.json();
      setCompetitors(data);
    } catch (err) {
      console.error('Error fetching competitors:', err);
    }
  }, []);

  useEffect(() => {
    fetchBrandData();
    fetchCompetitors();
  }, [fetchBrandData, fetchCompetitors]); // Fetch data on initial component mount

  // Update filtered brands when brands or active filter changes
  useEffect(() => {
    if (activeFilter) {
      const { min, max } = activeFilter;
      const filtered = brands.filter(brand => {
        const productCount = brand.product_count || 0;
        return productCount >= min && (max === null || productCount <= max);
      });
      setFilteredBrands(filtered);
    } else {
      setFilteredBrands(brands);
    }
  }, [brands, activeFilter]);

  // Handle filtering by product count
  const handleFilterByProductCount = (min: number, max: number | null) => {
    // If clicking the same filter, clear it
    if (activeFilter && activeFilter.min === min && activeFilter.max === max) {
      setActiveFilter(null);
    } else {
      setActiveFilter({ min, max });
    }
  };


  const handleAddBrandClick = () => {
    setEditingBrand(null); // Clear any previous editing data
    setIsFormOpen(true);
  };

  const handleEditBrandClick = async (brand: Brand) => {
    try {
      // Fetch brand with aliases using the new endpoint
      const res = await fetch(`/api/brands/with-aliases/${brand.id}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch brand details: ${res.statusText}`);
      }
      const brandWithAliases = await res.json();
      setEditingBrand(brandWithAliases);
    } catch (err) {
      console.error("Error fetching brand with aliases:", err);
      // Fall back to using the brand without aliases
      setEditingBrand(brand);
    }
    setIsFormOpen(true);
  };

  const handleDeleteBrand = async (brandId: string) => {
    if (confirm('Are you sure you want to delete this brand?')) {
      setIsLoading(true); // Indicate loading while deleting
      try {
        const res = await fetch(`/api/brands/${brandId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errorBody = await res.json();

          // If the error is about products still referencing the brand, show a more user-friendly message
          if (res.status === 409 && errorBody.details && errorBody.details.includes('still referenced by')) {
            throw new Error(
              `This brand cannot be deleted because it is still being used by products. ` +
              `Please update or delete these products first, or merge this brand with another brand.`
            );
          }

          throw new Error(errorBody.details || `Failed to delete brand: ${res.statusText}`);
        }

        // Refresh the router cache to ensure the UI updates
        router.refresh();

        // Refetch data to update the list
        await fetchBrandData();
      } catch (err: unknown) {
        console.error("Error deleting brand:", err);
        setError(err instanceof Error ? err.message : 'Failed to delete brand.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleToggleBrandActive = async (brandId: string, currentStatus: boolean) => {
     setIsLoading(true); // Indicate loading while updating
     try {
        const res = await fetch(`/api/brands/${brandId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_active: !currentStatus }),
        });
         if (!res.ok) {
           const errorBody = await res.json();
           throw new Error(errorBody.details || `Failed to toggle brand status: ${res.statusText}`);
        }
        // Refetch data to update the list
        await fetchBrandData();
     } catch (err: unknown) {
        console.error("Error toggling brand active status:", err);
        setError(err instanceof Error ? err.message : 'Failed to toggle brand status.');
     } finally {
        setIsLoading(false);
     }
  };


  const handleFormSubmit = async (formData: BrandInsert | BrandUpdate) => {
    setIsLoading(true); // Indicate loading while submitting form
    setError(null);
    const method = (formData as BrandUpdate).id ? 'PUT' : 'POST';
    const url = (formData as BrandUpdate).id ? `/api/brands/${(formData as BrandUpdate).id}` : '/api/brands';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
         const errorBody = await res.json();
         throw new Error(errorBody.details || `Failed to save brand: ${res.statusText}`);
      }

      // Refetch data to update the list
      await fetchBrandData();
      setIsFormOpen(false); // Close form on success
    } catch (err: unknown) {
      console.error("Error submitting brand form:", err);
      setError(err instanceof Error ? err.message : 'Failed to save brand.');
      throw err; // Re-throw to allow the form component to handle it
    } finally {
      setIsLoading(false);
    }
  };

  const handleMergeBrands = async (primaryBrandId: string, brandIdsToMerge: string[]) => {
      setIsMerging(true); // Indicate merging is in progress
      setError(null);
      try {
          const res = await fetch('/api/brands/merge', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ primaryBrandId, brandIdsToMerge }),
          });

          if (!res.ok) {
             const errorBody = await res.json();
             throw new Error(errorBody.details || `Failed to merge brands: ${res.statusText}`);
          }

          // Refetch data to update the lists (duplicates, needsReview, all brands)
          await fetchBrandData();

          // Close any open forms or modals
          setIsFormOpen(false);
          setIsDirectMergeModalOpen(false);

          // Clear any editing state
          setEditingBrand(null);
          setBrandToMerge(null);

          // Redirect to the brands list page
          router.push('/app-routes/brands');
      } catch (err: unknown) {
          console.error("Error merging brands:", err);
          setError(err instanceof Error ? err.message : 'Failed to merge brands.');
      } finally {
          setIsMerging(false);
      }
  };

   const handleConfirmBrand = async (brandId: string) => {
      setIsLoading(true); // Indicate loading while confirming
      setError(null);
      try {
          const res = await fetch(`/api/brands/${brandId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ needs_review: false }),
          });

          if (!res.ok) {
             const errorBody = await res.json();
             throw new Error(errorBody.details || `Failed to confirm brand: ${res.statusText}`);
          }

          // Refresh the router cache to ensure the UI updates
          router.refresh();

          // Refetch data to update the lists (needsReview, all brands)
          await fetchBrandData();
      } catch (err: unknown) {
          console.error("Error confirming brand:", err);
          setError(err instanceof Error ? err.message : 'Failed to confirm brand.');
      } finally {
          setIsLoading(false);
      }
   };

   const handleConfirmAllBrands = async (brandIds: string[]) => {
      setIsLoading(true); // Indicate loading while confirming
      setError(null);
      try {
          const res = await fetch('/api/brands/confirm-all', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ brandIds }),
          });

          if (!res.ok) {
             const errorBody = await res.json();
             throw new Error(errorBody.details || `Failed to confirm all brands: ${res.statusText}`);
          }

          // Refresh the router cache to ensure the UI updates
          router.refresh();

          // Refetch data to update the lists (needsReview, all brands)
          await fetchBrandData();
      } catch (err: unknown) {
          console.error("Error confirming all brands:", err);
          setError(err instanceof Error ? err.message : 'Failed to confirm all brands.');
      } finally {
          setIsLoading(false);
      }
   };

   const handleDismissDuplicates = async (groupKey: string, brandIds: string[]) => {
      setIsLoading(true); // Indicate loading while dismissing
      setError(null);
      try {
          const res = await fetch('/api/brands/dismiss-duplicates', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ groupKey, brandIds }),
          });

          if (!res.ok) {
             const errorBody = await res.json();
             const errorMessage = errorBody.details || errorBody.message || `Failed to dismiss duplicates: ${res.statusText}`;
             throw new Error(errorMessage);
          }

          // Refetch data to update the duplicates list
          await fetchBrandData();
      } catch (err: unknown) {
          console.error("Error dismissing duplicates:", err);
          setError(err instanceof Error ? err.message : 'Failed to dismiss duplicates.');
      } finally {
          setIsLoading(false);
      }
   };

   const handleInitiateMergeFromReview = (brand: Brand) => {
       // Set the brand to merge in state
       setBrandToMerge(brand);

       // Open the direct merge modal
       setIsDirectMergeModalOpen(true);
   };


  if (isLoading) {
    return <div>Loading brand management...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading brands: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {competitorId && competitorName ? `Brands for ${competitorName}` : 'Brands Management'}
        </h1>
        <div className="flex items-center space-x-2">
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              onClick={() => setCompetitorDropdownOpen(!competitorDropdownOpen)}
              className="w-[200px] justify-between"
            >
              {competitorId
                ? competitors.find((competitor) => competitor.id === competitorId)?.name || "Select competitor"
                : "Filter by competitor"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            {competitorDropdownOpen && (
              <div className="absolute z-10 mt-1 w-[200px] rounded-md bg-white shadow-lg">
                <div className="py-1">
                  <input
                    className="block w-full px-4 py-2 text-sm border-b"
                    placeholder="Search competitor..."
                    value={competitorSearch}
                    onChange={(e) => setCompetitorSearch(e.target.value)}
                  />
                  <div className="max-h-60 overflow-auto">
                    {(() => {
                      if (competitors.length === 0) {
                        return <div className="px-4 py-2 text-sm text-gray-500">No competitor found.</div>;
                      }

                      const filteredCompetitors = competitors.filter(competitor =>
                        competitor.name.toLowerCase().includes(competitorSearch.toLowerCase())
                      );

                      if (filteredCompetitors.length === 0) {
                        return <div className="px-4 py-2 text-sm text-gray-500">No results found</div>;
                      }

                      return filteredCompetitors.map((competitor) => (
                        <div
                          key={competitor.id}
                          className={`px-4 py-2 text-sm cursor-pointer flex items-center ${competitorId === competitor.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                          onClick={() => {
                            if (competitor.id === competitorId) {
                              // Clear filter if clicking the same competitor
                              router.push('/app-routes/brands');
                            } else {
                              router.push(`/app-routes/brands?competitor=${competitor.id}`);
                            }
                            setCompetitorDropdownOpen(false);
                            setCompetitorSearch(''); // Clear search
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              competitorId === competitor.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {competitor.name}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {competitorId && (
            <Button
              variant="outline"
              onClick={() => router.push('/app-routes/brands')}
              className="px-3 py-1 text-sm"
            >
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      <Button
        onClick={handleAddBrandClick}
        className="bg-indigo-600 hover:bg-indigo-700"
      >
        Add New Brand
      </Button>

      {/* Brand Statistics */}
      <BrandStatistics brands={brands} onFilterByProductCount={handleFilterByProductCount} />

      <section id="standardize-section">
        <h2 className="text-xl font-semibold mb-4">Standardize Brands</h2>
        <BrandStandardizationUI
          duplicateBrands={duplicates}
          onMerge={handleMergeBrands}
          onDismissDuplicates={handleDismissDuplicates}
          isLoading={isMerging} // Use isMerging state for this section
          brandToMerge={brandToMerge}
          onBrandToMergeProcessed={() => setBrandToMerge(null)} // Clear the brandToMerge after it's processed
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Review New Brands</h2>
        <BrandReviewUI
          brandsToReview={needsReview}
          onConfirm={handleConfirmBrand}
          onConfirmAll={handleConfirmAllBrands}
          onInitiateMerge={handleInitiateMergeFromReview}
          onSeeProducts={(brandId) => router.push(`/app-routes/products?brand=${brandId}`)}
          isLoading={isLoading} // Use general isLoading for review actions
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">
          {activeFilter || competitorId ? (
            <div className="flex items-center">
              <span>
                {activeFilter && competitorId
                  ? `Brands for ${competitorName} (${activeFilter.min}${activeFilter.max ? `-${activeFilter.max}` : '+'} products)`
                  : activeFilter
                    ? `Brands with ${activeFilter.min}${activeFilter.max ? `-${activeFilter.max}` : '+'} products`
                    : competitorId
                      ? `Brands for ${competitorName}`
                      : 'Filtered Brands'}
              </span>
              <button
                onClick={() => {
                  setActiveFilter(null);
                  if (competitorId) {
                    router.push('/app-routes/brands');
                  }
                }}
                className="ml-3 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            'All Brands'
          )}
        </h2>
        <BrandsTable
          brands={filteredBrands.length > 0 ? filteredBrands : brands}
          onEdit={handleEditBrandClick}
          onDelete={handleDeleteBrand}
          onToggleActive={handleToggleBrandActive}
          onSeeProducts={(brandId) => router.push(`/app-routes/products?brand=${brandId}`)}
          initialSortColumn="name"
          initialSortDirection="asc"
        />
      </section>

      <BrandForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingBrand}
        onInitiateMerge={handleInitiateMergeFromReview}
      />

      <BrandDirectMergeModal
        isOpen={isDirectMergeModalOpen}
        onClose={() => setIsDirectMergeModalOpen(false)}
        brandToMerge={brandToMerge}
        onMergeComplete={fetchBrandData}
      />

    </div>
  );
}