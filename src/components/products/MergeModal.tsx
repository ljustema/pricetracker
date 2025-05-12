"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface Product {
  product_id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
  category?: string | null;
  description?: string | null;
  image_url?: string | null;
  our_price?: number | null;
  wholesale_price?: number | null;
}

interface DuplicateGroup {
  group_id: number;
  match_reason: string;
  products: Product[];
}

interface SelectedProducts {
  primaryId?: string;
  duplicateIds?: Record<string, boolean>;
}

interface MergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DuplicateGroup;
  selectedProducts: SelectedProducts;
  onSuccess: () => void;
}

export function MergeModal({
  open,
  onOpenChange,
  group,
  selectedProducts,
  onSuccess
}: MergeModalProps) {
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const primaryProduct = group.products.find(p => p.product_id === selectedProducts.primaryId);
  const duplicateProducts = group.products.filter(p =>
    selectedProducts.duplicateIds && selectedProducts.duplicateIds[p.product_id]
  );

  if (!primaryProduct) {
    return null;
  }

  // Prepare field comparison data
  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'ean', label: 'EAN' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'image_url', label: 'Image URL' },
    { key: 'our_price', label: 'Our Price' },
    { key: 'wholesale_price', label: 'Wholesale Price' },
  ];

  const handleFieldSelection = (field: string, value: string) => {
    setFieldSelections({
      ...fieldSelections,
      [field]: value
    });
  };

  const handleMerge = async () => {
    try {
      setMerging(true);
      setError(null);

      // For each duplicate, merge it into the primary
      for (const duplicate of duplicateProducts) {
        try {
          const response = await fetch('/api/products/merge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              primaryId: primaryProduct.product_id,
              duplicateId: duplicate.product_id,
              fieldSelections // Pass field selections to the API
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error("Merge API error:", data);
            throw new Error(data.details || data.error || 'Failed to merge products');
          }

          console.log("Merge successful:", data);
        } catch (mergeError: any) {
          console.error("Error merging product:", mergeError);
          throw mergeError;
        }
      }

      toast({
        title: "Products merged successfully",
        description: `${duplicateProducts.length} product(s) merged into ${primaryProduct.name}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Error merging products",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Merge Products</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4">
            <h3 className="font-medium">Primary Product (will be kept)</h3>
            <div className="p-2 border rounded mt-1">
              <div><strong>{primaryProduct.name}</strong></div>
              <div className="text-sm">
                {primaryProduct.brand && <span className="mr-2">Brand: {primaryProduct.brand}</span>}
                {primaryProduct.sku && <span className="mr-2">SKU: {primaryProduct.sku}</span>}
                {primaryProduct.ean && <span>EAN: {primaryProduct.ean}</span>}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-medium">Duplicate Products (will be merged and deleted)</h3>
            <div className="space-y-2 mt-1">
              {duplicateProducts.map(product => (
                <div key={product.product_id} className="p-2 border rounded">
                  <div><strong>{product.name}</strong></div>
                  <div className="text-sm">
                    {product.brand && <span className="mr-2">Brand: {product.brand}</span>}
                    {product.sku && <span className="mr-2">SKU: {product.sku}</span>}
                    {product.ean && <span>EAN: {product.ean}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-medium">Field Selection</h3>
            <p className="text-sm text-gray-500 mb-2">
              Choose which values to keep for each field when there are conflicts
            </p>

            <div className="space-y-4">
              {fields.map(field => {
                const values = new Set([
                  primaryProduct[field.key as keyof Product],
                  ...duplicateProducts.map(p => p[field.key as keyof Product])
                ].filter(Boolean));

                // Skip if there's only one unique value or no values
                if (values.size <= 1) return null;

                return (
                  <div key={field.key} className="border p-3 rounded">
                    <h4 className="font-medium mb-2">{field.label}</h4>
                    <RadioGroup
                      value={fieldSelections[field.key] || primaryProduct.product_id}
                      onValueChange={(value) => handleFieldSelection(field.key, value)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <RadioGroupItem id={`${field.key}-primary`} value={primaryProduct.product_id} />
                          <Label htmlFor={`${field.key}-primary`} className="ml-2">
                            {primaryProduct[field.key as keyof Product] || '(empty)'} (Primary)
                          </Label>
                        </div>

                        {duplicateProducts.map(product => (
                          <div key={product.product_id} className="flex items-center">
                            <RadioGroupItem
                              id={`${field.key}-${product.product_id}`}
                              value={product.product_id}
                              disabled={!product[field.key as keyof Product]}
                            />
                            <Label htmlFor={`${field.key}-${product.product_id}`} className="ml-2">
                              {product[field.key as keyof Product] || '(empty)'}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="text-red-500 mb-4">
              Error: {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={merging}>
            {merging ? 'Merging...' : 'Merge Products'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
