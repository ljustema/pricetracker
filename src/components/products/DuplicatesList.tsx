"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MergeModal } from './MergeModal';
import { BulkMergeProgress } from './BulkMergeProgress';
import { X, Merge, Eye } from 'lucide-react';

interface PriceInfo {
  price: number;
  currency_code: string;
  source: string;
  platform?: string;
  website?: string;
  updated_at: string;
  url?: string;
}

interface Product {
  product_id: string;
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
  our_retail_price?: number | null; // Renamed from our_price
  our_wholesale_price?: number | null; // Renamed from wholesale_price
  currency_code?: string | null;
  url?: string | null;
  image_url?: string | null;
  category?: string | null;
  description?: string | null;
  prices?: {
    our_prices: PriceInfo[];
    competitor_prices: PriceInfo[];
  };
}

interface DuplicateGroup {
  group_id: string;
  match_reason: string;
  products: Product[];
}

export function DuplicatesList() {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, {
    primaryId?: string;
    duplicateIds?: Record<string, boolean>;
  }>>({});
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<DuplicateGroup | null>(null);
  const [dismissingGroups, setDismissingGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [bulkMerging, setBulkMerging] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({
    totalGroups: 0,
    processedGroups: 0,
    successCount: 0,
    errorCount: 0,
    currentGroup: ''
  });
  const [automaticMerging, setAutomaticMerging] = useState(false);

  // Extract fetchDuplicates function so it can be reused
  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      // Use enhanced API (now working without price data)
      const response = await fetch('/api/products/duplicates/enhanced');
      if (!response.ok) {
        throw new Error('Failed to fetch duplicates');
      }
      const data = await response.json();
      setDuplicateGroups(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch duplicates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const handleSelectPrimary = (groupId: string, productId: string) => {
    setSelectedProducts({
      ...selectedProducts,
      [groupId]: {
        ...selectedProducts[groupId],
        primaryId: productId
      }
    });
  };

  const handleSelectDuplicate = (groupId: string, productId: string) => {
    setSelectedProducts({
      ...selectedProducts,
      [groupId]: {
        ...selectedProducts[groupId],
        duplicateIds: {
          ...(selectedProducts[groupId]?.duplicateIds || {}),
          [productId]: !selectedProducts[groupId]?.duplicateIds?.[productId]
        }
      }
    });
  };

  const handleMergeClick = (group: DuplicateGroup) => {
    setCurrentGroup(group);
    setShowMergeModal(true);
  };

  const handleDismissGroup = async (group: DuplicateGroup) => {
    const groupId = group.group_id;
    setDismissingGroups(prev => new Set(prev).add(groupId));
    setError(null);

    try {
      const productIds = group.products.map(p => p.product_id);
      const response = await fetch('/api/products/duplicates/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupKey: groupId,
          productIds: productIds
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        const errorMessage = errorBody.details || errorBody.message || `Failed to dismiss duplicates: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Remove the dismissed group from the list
      setDuplicateGroups(prev => prev.filter(g => g.group_id !== groupId));

      // Clear any selections for this group
      setSelectedProducts(prev => {
        const updated = { ...prev };
        delete updated[groupId];
        return updated;
      });

    } catch (err: unknown) {
      console.error('Error dismissing duplicates:', err);
      setError(err instanceof Error ? err.message : 'Failed to dismiss duplicates');
    } finally {
      setDismissingGroups(prev => {
        const updated = new Set(prev);
        updated.delete(groupId);
        return updated;
      });
    }
  };

  const handleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      const updated = new Set(prev);
      if (updated.has(groupId)) {
        updated.delete(groupId);
      } else {
        updated.add(groupId);
      }
      return updated;
    });
  };

  const handleSelectAllGroups = () => {
    if (selectedGroups.size === duplicateGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(duplicateGroups.map(g => g.group_id)));
    }
  };

  const handleAutomaticMerge = async () => {
    setAutomaticMerging(true);
    setError(null);

    try {
      const response = await fetch('/api/products/duplicates/merge-automatic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform automatic merge');
      }

      const result = await response.json();

      // Show success message
      if (result.mergedCount > 0) {
        // Refresh the list
        await fetchDuplicates();

        // Clear selections
        setSelectedGroups(new Set());
        setSelectedProducts({});
      }

      // Show result message
      if (result.errorCount > 0) {
        setError(`Automatic merge completed: ${result.mergedCount} successful merges, ${result.errorCount} errors. Check console for details.`);
      } else if (result.mergedCount === 0) {
        setError('No products were eligible for automatic merging. Automatic merge works for groups of 2-10 products with same brand and SKU.');
      }

    } catch (err: unknown) {
      console.error('Error during automatic merge:', err);
      setError(err instanceof Error ? err.message : 'Failed to perform automatic merge');
    } finally {
      setAutomaticMerging(false);
    }
  };

  const handleBulkMerge = async () => {
    if (selectedGroups.size === 0) return;

    setBulkMerging(true);
    setError(null);

    try {
      const selectedGroupsData = duplicateGroups.filter(g => selectedGroups.has(g.group_id));

      // For bulk merge, we need to ensure each group has a primary and duplicates selected
      const validGroups = selectedGroupsData.filter(group => {
        const groupSelections = selectedProducts[group.group_id];
        return groupSelections?.primaryId &&
               Object.values(groupSelections.duplicateIds || {}).some(Boolean);
      });

      if (validGroups.length === 0) {
        setError('Please select primary and duplicate products for each group before bulk merging.');
        return;
      }

      // Initialize progress
      setBulkProgress({
        totalGroups: validGroups.length,
        processedGroups: 0,
        successCount: 0,
        errorCount: 0,
        currentGroup: ''
      });

      let successCount = 0;
      let errorCount = 0;

      // Process each group sequentially to avoid overwhelming the server
      for (let i = 0; i < validGroups.length; i++) {
        const group = validGroups[i];

        // Update progress
        setBulkProgress(prev => ({
          ...prev,
          currentGroup: group.match_reason,
          processedGroups: i
        }));

        try {
          const groupSelections = selectedProducts[group.group_id];
          const primaryProduct = group.products.find(p => p.product_id === groupSelections.primaryId);
          const duplicateProducts = group.products.filter(p =>
            groupSelections.duplicateIds && groupSelections.duplicateIds[p.product_id]
          );

          // Merge each duplicate into the primary
          for (const duplicate of duplicateProducts) {
            const response = await fetch('/api/products/merge', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                primaryId: primaryProduct?.product_id,
                duplicateId: duplicate.product_id,
                fieldSelections: {} // Use default field selections for bulk merge
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error(`Error merging ${duplicate.name}:`, errorData);
              errorCount++;
            } else {
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Error processing group ${group.group_id}:`, err);
          errorCount++;
        }

        // Update progress after each group
        setBulkProgress(prev => ({
          ...prev,
          processedGroups: i + 1,
          successCount,
          errorCount
        }));
      }

      // Show results
      if (successCount > 0) {
        // Refresh the list
        await fetchDuplicates();

        // Clear selections
        setSelectedGroups(new Set());
        setSelectedProducts({});
      }

      if (errorCount > 0) {
        setError(`Bulk merge completed with ${successCount} successes and ${errorCount} errors. Check console for details.`);
      }

    } catch (err: unknown) {
      console.error('Error during bulk merge:', err);
      setError(err instanceof Error ? err.message : 'Failed to perform bulk merge');
    } finally {
      setBulkMerging(false);
      // Clear progress after a delay
      setTimeout(() => {
        setBulkProgress({
          totalGroups: 0,
          processedGroups: 0,
          successCount: 0,
          errorCount: 0,
          currentGroup: ''
        });
      }, 3000);
    }
  };

  const openProductInNewWindow = (product: Product) => {
    // Validate product ID before creating URL
    if (!product.id) {
      console.error('Product ID is missing:', product);
      return;
    }
    const productUrl = `/app-routes/products/${product.id}`;
    window.open(productUrl, '_blank', 'noopener,noreferrer');
  };

  const formatPrice = (price: number | null | undefined, currencyCode: string | null | undefined = 'SEK') => {
    // Check if price is valid
    if (price === null || price === undefined || isNaN(price)) {
      return 'N/A';
    }

    // Ensure currency code is valid and not null/undefined
    const validCurrencyCode = currencyCode && currencyCode.length === 3 ? currencyCode : 'SEK';

    try {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: validCurrencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(price);
    } catch (_error) {
      // Fallback if currency code is invalid
      console.warn(`Invalid currency code: ${currencyCode}, falling back to SEK`);
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(price);
    }
  };

  const getLatestPrice = (prices: PriceInfo[]) => {
    if (!prices || prices.length === 0) return null;
    return prices.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  };

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Potential Duplicate Products</h1>
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div>
            <p className="text-gray-700 font-medium">Analyzing products for duplicates...</p>
            <p className="text-gray-500 text-sm mt-1">
              This may take a moment for large product catalogs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Potential Duplicate Products</h1>
        <div className="bg-red-50 p-4 rounded-md text-red-800">
          <p className="font-semibold">Error loading duplicates:</p>
          <p>{error}</p>
          <p className="mt-2 text-sm">
            Please try refreshing the page. If the error persists, contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Potential Duplicate Products</h1>

        {duplicateGroups.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {selectedGroups.size} of {duplicateGroups.length} groups selected
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllGroups}
              disabled={bulkMerging || automaticMerging}
            >
              {selectedGroups.size === duplicateGroups.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              onClick={handleAutomaticMerge}
              disabled={bulkMerging || automaticMerging}
              className="bg-green-600 hover:bg-green-700"
            >
              {automaticMerging ? (
                "Auto Merging..."
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-1" />
                  Merge All Automatic
                </>
              )}
            </Button>
            <Button
              onClick={handleBulkMerge}
              disabled={selectedGroups.size === 0 || bulkMerging || automaticMerging}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {bulkMerging ? (
                "Merging..."
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-1" />
                  Bulk Merge ({selectedGroups.size})
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <BulkMergeProgress
        isVisible={bulkMerging}
        totalGroups={bulkProgress.totalGroups}
        processedGroups={bulkProgress.processedGroups}
        successCount={bulkProgress.successCount}
        errorCount={bulkProgress.errorCount}
        currentGroup={bulkProgress.currentGroup}
      />

      {duplicateGroups.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-500">No potential duplicates found.</p>
        </div>
      ) : (
        duplicateGroups.map((group) => (
          <Card key={group.group_id} className={`p-4 ${selectedGroups.has(group.group_id) ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="mb-4 flex justify-between items-start">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`group-${group.group_id}`}
                  checked={selectedGroups.has(group.group_id)}
                  onCheckedChange={() => handleGroupSelection(group.group_id)}
                  disabled={bulkMerging || automaticMerging}
                />
                <div>
                  <h2 className="text-lg font-semibold">{group.match_reason}</h2>
                  <p className="text-sm text-gray-500">
                    {group.products.length} potential duplicates found
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDismissGroup(group)}
                disabled={dismissingGroups.has(group.group_id) || bulkMerging || automaticMerging}
                className="text-red-600 hover:text-red-700"
              >
                {dismissingGroups.has(group.group_id) ? (
                  "Dismissing..."
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Dismiss
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              {group.products.map((product) => {
                const latestOurPrice = getLatestPrice(product.prices?.our_prices || []);

                return (
                  <div key={product.product_id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      {/* Selection checkboxes */}
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`primary-${group.group_id}-${product.product_id}`}
                            checked={selectedProducts[group.group_id]?.primaryId === product.product_id}
                            onCheckedChange={() => handleSelectPrimary(group.group_id, product.product_id)}
                          />
                          <label htmlFor={`primary-${group.group_id}-${product.product_id}`} className="text-sm">Primary</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`duplicate-${group.group_id}-${product.product_id}`}
                            checked={!!selectedProducts[group.group_id]?.duplicateIds?.[product.product_id]}
                            onCheckedChange={() => handleSelectDuplicate(group.group_id, product.product_id)}
                            disabled={selectedProducts[group.group_id]?.primaryId === product.product_id}
                          />
                          <label htmlFor={`duplicate-${group.group_id}-${product.product_id}`} className="text-sm">Duplicate</label>
                        </div>
                      </div>

                      {/* Product image */}
                      {product.image_url && (
                        <div className="flex-shrink-0">
                          <Image
                            src={`/api/proxy-image?url=${encodeURIComponent(product.image_url)}`}
                            alt={product.name}
                            width={80}
                            height={80}
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Product info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-lg">{product.name}</h4>
                            <div className="text-sm text-gray-600 mt-1">
                              {product.brand && <span className="mr-4">Brand: <strong>{product.brand}</strong></span>}
                              {product.sku && <span className="mr-4">SKU: <strong>{product.sku}</strong></span>}
                              {product.ean && <span>EAN: <strong>{product.ean}</strong></span>}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openProductInNewWindow(product)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>

                        {/* Price information */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Our prices */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Our Price</h5>
                            {latestOurPrice ? (
                              <div className="text-sm bg-green-50 p-2 rounded">
                                <span className="font-medium">Latest ({latestOurPrice.source}): </span>
                                {formatPrice(latestOurPrice.price, latestOurPrice.currency_code)}
                                <div className="text-xs text-gray-500 mt-1">
                                  Updated: {new Date(latestOurPrice.updated_at).toLocaleDateString()}
                                </div>
                              </div>
                            ) : product.our_retail_price ? (
                              <div className="text-sm bg-blue-50 p-2 rounded">
                                <span className="font-medium">Base Price: </span>
                                {formatPrice(product.our_retail_price, product.currency_code || 'SEK')}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 italic">No price data</div>
                            )}
                          </div>

                          {/* Competitor prices */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Competitor Prices</h5>
                            {product.prices?.competitor_prices && product.prices.competitor_prices.length > 0 ? (
                              <div className="space-y-1">
                                {product.prices.competitor_prices
                                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                                  .map((competitorPrice, index) => (
                                    <div key={index} className="text-sm bg-orange-50 p-2 rounded">
                                      <span className="font-medium">{competitorPrice.source}: </span>
                                      {formatPrice(competitorPrice.price, competitorPrice.currency_code)}
                                      <div className="text-xs text-gray-500 mt-1">
                                        Updated: {new Date(competitorPrice.updated_at).toLocaleDateString()}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 italic">No competitor data</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <Button
                onClick={() => handleMergeClick(group)}
                disabled={
                  bulkMerging ||
                  automaticMerging ||
                  !selectedProducts[group.group_id]?.primaryId ||
                  !Object.values(selectedProducts[group.group_id]?.duplicateIds || {}).some(Boolean)
                }
              >
                Merge Selected Products
              </Button>
            </div>
          </Card>
        ))
      )}

      {showMergeModal && currentGroup && (
        <MergeModal
          open={showMergeModal}
          onOpenChange={setShowMergeModal}
          group={currentGroup}
          selectedProducts={selectedProducts[currentGroup.group_id]}
          onSuccess={async () => {
            // Refresh the list after successful merge without page reload
            await fetchDuplicates();
            setShowMergeModal(false);
            setCurrentGroup(null);
          }}
        />
      )}
    </div>
  );
}
