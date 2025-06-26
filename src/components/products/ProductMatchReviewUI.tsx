'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Check, X, Eye, Package, DollarSign } from 'lucide-react';

interface ProductMatchReview {
  id: string;
  ean: string;
  existing_product_id: string;
  existing_product_name: string;
  existing_product_sku: string | null;
  existing_product_brand: string | null;
  existing_product_price: number | null;
  new_product_name: string;
  new_product_sku: string | null;
  new_product_brand: string | null;
  new_product_price: number | null;
  source_table: string;
  conflict_reason: string;
  price_difference_percent: number | null;
  status: string;
  created_at: string;
  existing_product?: {
    id: string;
    name: string;
    sku: string | null;
    brand: string | null;
    our_retail_price: number | null;
    our_wholesale_price: number | null;
    our_url: string | null;
  };
}

interface ProductMatchReviewUIProps {
  onReviewsUpdated?: () => void;
}

const ProductMatchReviewUI: React.FC<ProductMatchReviewUIProps> = ({
  onReviewsUpdated
}) => {
  const [reviews, setReviews] = useState<ProductMatchReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/product-match-reviews?status=pending&limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleAction = async (action: string, reviewId?: string, reviewIds?: string[]) => {
    try {
      setProcessing(reviewId || 'bulk');
      setError(null);

      const response = await fetch('/api/product-match-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reviewId,
          reviewIds
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Action failed');
      }

      // Refresh the reviews list
      await fetchReviews();
      setSelectedReviews(new Set());

      if (onReviewsUpdated) {
        onReviewsUpdated();
      }

      // Trigger a custom event to notify the header to refresh counts
      window.dispatchEvent(new CustomEvent('refreshProductCounts'));
    } catch (err) {
      console.error('Error performing action:', err);
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleSelectReview = (reviewId: string, checked: boolean) => {
    const newSelected = new Set(selectedReviews);
    if (checked) {
      newSelected.add(reviewId);
    } else {
      newSelected.delete(reviewId);
    }
    setSelectedReviews(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReviews(new Set(reviews.map(r => r.id)));
    } else {
      setSelectedReviews(new Set());
    }
  };

  const getConflictReasonBadge = (reason: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'outline'; label: string; icon: React.ReactNode }> = {
      'multiple_ean_in_batch': {
        variant: 'destructive',
        label: 'Multiple EANs in Batch',
        icon: <Package className="w-3 h-3" />
      },
      'large_price_difference': {
        variant: 'warning',
        label: 'Large Price Difference',
        icon: <DollarSign className="w-3 h-3" />
      },
      'name_mismatch': {
        variant: 'secondary',
        label: 'Name Mismatch',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      'manual_review': {
        variant: 'outline',
        label: 'Manual Review',
        icon: <Eye className="w-3 h-3" />
      }
    };

    const config = variants[reason] || variants['manual_review'];
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatPrice = (price: number | null, currency = 'SEK') => {
    if (price === null) return 'N/A';
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product match reviews...</p>
        </div>
      </div>
    );
  }

  const handleTestConflicts = async () => {
    try {
      setProcessing('test');
      const response = await fetch('/api/test-ean-conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType: 'multiple_ean' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create test conflicts');
      }

      // Refresh the reviews list
      await fetchReviews();

      // Trigger a custom event to notify the header to refresh counts
      window.dispatchEvent(new CustomEvent('refreshProductCounts'));
    } catch (err) {
      console.error('Error creating test conflicts:', err);
      setError(err instanceof Error ? err.message : 'Failed to create test conflicts');
    } finally {
      setProcessing(null);
    }
  };

  const handleCleanupTest = async () => {
    try {
      setProcessing('cleanup');
      const response = await fetch('/api/test-ean-conflicts', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup test data');
      }

      // Refresh the reviews list
      await fetchReviews();

      // Trigger a custom event to notify the header to refresh counts
      window.dispatchEvent(new CustomEvent('refreshProductCounts'));
    } catch (err) {
      console.error('Error cleaning up test data:', err);
      setError(err instanceof Error ? err.message : 'Failed to cleanup test data');
    } finally {
      setProcessing(null);
    }
  };

  if (reviews.length === 0) {
    return (
      <div className="text-center p-8">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Conflicts Found</h3>
        <p className="text-gray-600 mb-4">
          All product matches look good! No EAN conflicts require your review.
        </p>
        <div className="flex justify-center space-x-3">
          <Button
            variant="outline"
            onClick={handleTestConflicts}
            disabled={processing === 'test'}
          >
            {processing === 'test' ? 'Creating Test...' : 'Create Test Conflicts'}
          </Button>
          <Button
            variant="outline"
            onClick={handleCleanupTest}
            disabled={processing === 'cleanup'}
          >
            {processing === 'cleanup' ? 'Cleaning...' : 'Cleanup Test Data'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {reviews.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedReviews.size === reviews.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Select all ({reviews.length} reviews)
                </span>
              </label>
              {selectedReviews.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedReviews.size} selected
                </span>
              )}
            </div>
            {selectedReviews.size > 0 && (
              <Button
                onClick={() => handleAction('approve_all', undefined, Array.from(selectedReviews))}
                disabled={processing === 'bulk'}
                className="bg-green-600 hover:bg-green-700"
              >
                {processing === 'bulk' ? 'Processing...' : `Approve ${selectedReviews.size} Matches`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Review Cards */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="border-l-4 border-l-yellow-400">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedReviews.has(review.id)}
                    onChange={(e) => handleSelectReview(review.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <CardTitle className="text-lg">EAN Conflict: {review.ean}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      {getConflictReasonBadge(review.conflict_reason)}
                      {review.price_difference_percent && (
                        <Badge variant="outline">
                          {review.price_difference_percent.toFixed(1)}% price difference
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(review.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Existing Product */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <Package className="w-4 h-4 mr-2" />
                    Existing Product
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {review.existing_product_name}</div>
                    {review.existing_product_sku && (
                      <div><strong>SKU:</strong> {review.existing_product_sku}</div>
                    )}
                    {review.existing_product_brand && (
                      <div><strong>Brand:</strong> {review.existing_product_brand}</div>
                    )}
                    <div><strong>Price:</strong> {formatPrice(review.existing_product_price)}</div>
                  </div>
                </div>

                {/* New Product */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center">
                    <Package className="w-4 h-4 mr-2" />
                    New Product Data
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {review.new_product_name}</div>
                    {review.new_product_sku && (
                      <div><strong>SKU:</strong> {review.new_product_sku}</div>
                    )}
                    {review.new_product_brand && (
                      <div><strong>Brand:</strong> {review.new_product_brand}</div>
                    )}
                    <div><strong>Price:</strong> {formatPrice(review.new_product_price)}</div>
                    <div><strong>Source:</strong> {review.source_table.replace('temp_', '').replace('_scraped_data', '')}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleAction('decline_match', review.id)}
                  disabled={processing === review.id}
                  className="flex items-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  Create Separate Product
                </Button>
                <Button
                  onClick={() => handleAction('approve_match', review.id)}
                  disabled={processing === review.id}
                  className="bg-green-600 hover:bg-green-700 flex items-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {processing === review.id ? 'Processing...' : 'Approve Match'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProductMatchReviewUI;
