"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Product {
  product_id: string;
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
  our_price?: number | null;
  wholesale_price?: number | null;
  currency_code?: string | null;
  url?: string | null;
  image_url?: string | null;
  category?: string | null;
  description?: string | null;
}

// Type for field values that can be selected
type FieldValue = string | number | null;

interface FieldComparisonProps {
  products: Product[];
  onFieldSelect?: (field: string, productId: string, value: FieldValue) => void;
  selectedFields?: Record<string, string>;
}

interface FieldInfo {
  key: keyof Product;
  label: string;
  type: 'text' | 'number' | 'url';
}

const fields: FieldInfo[] = [
  { key: 'name', label: 'Product Name', type: 'text' },
  { key: 'sku', label: 'SKU', type: 'text' },
  { key: 'ean', label: 'EAN', type: 'text' },
  { key: 'brand', label: 'Brand', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'our_price', label: 'Our Price', type: 'number' },
  { key: 'wholesale_price', label: 'Wholesale Price', type: 'number' },
  { key: 'currency_code', label: 'Currency', type: 'text' },
  { key: 'url', label: 'Product URL', type: 'url' },
  { key: 'image_url', label: 'Image URL', type: 'url' },
];

export function ProductFieldComparison({ products, onFieldSelect, selectedFields = {} }: FieldComparisonProps) {
  const getFieldValue = (product: Product, field: keyof Product) => {
    const value = product[field];
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return value;
  };

  const getDataQualityScore = (product: Product) => {
    const totalFields = fields.length;
    const filledFields = fields.filter(field => getFieldValue(product, field.key) !== null).length;
    return Math.round((filledFields / totalFields) * 100);
  };

  const getFieldConflicts = (field: keyof Product) => {
    const values = products.map(p => getFieldValue(p, field));
    const uniqueValues = [...new Set(values.filter(v => v !== null))];
    return uniqueValues.length > 1;
  };

  const getBestValue = (field: keyof Product) => {
    const values = products
      .map(p => ({ product: p, value: getFieldValue(p, field) }))
      .filter(item => item.value !== null);

    if (values.length === 0) return null;
    if (values.length === 1) return values[0];

    // For text fields, prefer longer, more descriptive values
    if (field === 'name' || field === 'description') {
      return values.reduce((best, current) =>
        String(current.value).length > String(best.value).length ? current : best
      );
    }

    // For numeric fields, prefer non-zero values
    if (field === 'our_price' || field === 'wholesale_price') {
      const nonZero = values.filter(v => Number(v.value) > 0);
      return nonZero.length > 0 ? nonZero[0] : values[0];
    }

    // For other fields, prefer the first non-empty value
    return values[0];
  };

  const formatValue = (value: FieldValue, type: 'text' | 'number' | 'url') => {
    if (value === null || value === undefined) return '(empty)';

    if (type === 'number' && typeof value === 'number') {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }

    if (type === 'url' && typeof value === 'string') {
      return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }

    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Data Quality Overview */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Data Quality Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const score = getDataQualityScore(product);
            return (
              <div key={product.product_id} className="text-center">
                <div className="font-medium text-sm mb-1">{product.name}</div>
                <div className={`text-2xl font-bold ${
                  score >= 80 ? 'text-green-600' :
                  score >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {score}%
                </div>
                <div className="text-xs text-gray-500">Data Completeness</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Field-by-field comparison */}
      <div className="space-y-4">
        {fields.map((field) => {
          const hasConflict = getFieldConflicts(field.key);
          const bestValue = getBestValue(field.key);

          return (
            <Card key={field.key} className={`p-4 ${hasConflict ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{field.label}</h4>
                  {hasConflict ? (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Conflict
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Consistent
                    </Badge>
                  )}
                </div>

                {bestValue && (
                  <Badge variant="outline" className="text-xs">
                    <Info className="h-3 w-3 mr-1" />
                    Suggested: {formatValue(bestValue.value, field.type)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((product) => {
                  const value = getFieldValue(product, field.key);
                  const isBest = bestValue?.product.product_id === product.product_id;
                  const isSelected = selectedFields[field.key] === product.product_id;

                  return (
                    <div
                      key={product.product_id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        isSelected ? 'border-blue-500 bg-blue-50' :
                        isBest ? 'border-green-500 bg-green-50' :
                        value === null ? 'border-gray-200 bg-gray-50' :
                        'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => onFieldSelect?.(field.key, product.product_id, value)}
                    >
                      <div className="text-sm font-medium mb-1">{product.name}</div>
                      <div className={`text-sm ${value === null ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                        {formatValue(value, field.type)}
                      </div>
                      {isBest && !isSelected && (
                        <div className="text-xs text-green-600 mt-1">✓ Recommended</div>
                      )}
                      {isSelected && (
                        <div className="text-xs text-blue-600 mt-1">✓ Selected</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
