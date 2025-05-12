"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MergeModal } from './MergeModal';

interface Product {
  product_id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
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

  useEffect(() => {
    async function fetchDuplicates() {
      try {
        setLoading(true);
        const response = await fetch('/api/products/duplicates');
        if (!response.ok) {
          throw new Error('Failed to fetch duplicates');
        }
        const data = await response.json();
        setDuplicateGroups(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

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

  if (loading) return <div className="flex justify-center items-center py-10">Loading potential duplicates...</div>;
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
      <h1 className="text-2xl font-bold">Potential Duplicate Products</h1>

      {duplicateGroups.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-500">No potential duplicates found.</p>
        </div>
      ) : (
        duplicateGroups.map((group) => (
          <Card key={group.group_id} className="p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{group.match_reason}</h2>
              <p className="text-sm text-gray-500">
                {group.products.length} potential duplicates found
              </p>
            </div>

            <div className="space-y-4">
              {group.products.map((product) => (
                <div key={product.product_id} className="flex items-center gap-4 p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`primary-${group.group_id}-${product.product_id}`}
                      checked={selectedProducts[group.group_id]?.primaryId === product.product_id}
                      onCheckedChange={() => handleSelectPrimary(group.group_id, product.product_id)}
                    />
                    <label htmlFor={`primary-${group.group_id}-${product.product_id}`}>Primary</label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`duplicate-${group.group_id}-${product.product_id}`}
                      checked={!!selectedProducts[group.group_id]?.duplicateIds?.[product.product_id]}
                      onCheckedChange={() => handleSelectDuplicate(group.group_id, product.product_id)}
                      disabled={selectedProducts[group.group_id]?.primaryId === product.product_id}
                    />
                    <label htmlFor={`duplicate-${group.group_id}-${product.product_id}`}>Duplicate</label>
                  </div>

                  <div className="ml-4">
                    <div><strong>{product.name}</strong></div>
                    <div className="text-sm">
                      {product.brand && <span className="mr-2">Brand: {product.brand}</span>}
                      {product.sku && <span className="mr-2">SKU: {product.sku}</span>}
                      {product.ean && <span>EAN: {product.ean}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button
                onClick={() => handleMergeClick(group)}
                disabled={
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
          onSuccess={() => {
            // Refresh the list after successful merge
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
