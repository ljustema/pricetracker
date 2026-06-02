'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, TrendingUp, TrendingDown, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface BrandProductItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  current_stock: number;
  current_price: number | null;
  competitor_name: string | null;
  in_stock_flag: boolean;
  last_updated: string;
}

interface BrandProductsData {
  data: BrandProductItem[];
  summary: {
    totalProducts: number;
    inStockProducts: number;
    outOfStockProducts: number;
    totalStockValue: number;
  };
  brand: string;
  stockStatus: string;
}

interface BrandStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: string;
  competitorId?: string;
}

const BrandStockModal: React.FC<BrandStockModalProps> = ({
  isOpen,
  onClose,
  brand,
  competitorId
}) => {
  const [data, setData] = useState<BrandProductsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Format functions
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('da-DK').format(value);
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0,00 kr';
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchBrandProducts = useCallback(async (stockStatus: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        brand,
        stock_status: stockStatus,
        ...(competitorId && { competitor_id: competitorId })
      });

      const response = await fetch(`/api/insights/stock-analysis/brand-products?${params}`);
      const result = await response.json();

      if (response.ok) {
        setData(result);
      } else {
        console.error('Error fetching brand products:', result.error);
      }
    } catch (error) {
      console.error('Error fetching brand products:', error);
    } finally {
      setLoading(false);
    }
  }, [brand, competitorId]);

  // Fetch data when modal opens or tab changes
  useEffect(() => {
    if (isOpen && brand) {
      fetchBrandProducts(activeTab);
    }
  }, [isOpen, brand, activeTab, competitorId, fetchBrandProducts]);

  const getFilteredProducts = () => {
    if (!data?.data) return [];
    
    switch (activeTab) {
      case 'in_stock':
        return data.data.filter(product => product.in_stock_flag);
      case 'out_of_stock':
        return data.data.filter(product => !product.in_stock_flag);
      default:
        return data.data;
    }
  };

  const ProductRow: React.FC<{ product: BrandProductItem }> = ({ product }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-8 py-4">
        <div className="flex items-center space-x-4">
          <Package className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Link
              href={`/app-routes/products/${product.product_id}`}
              target="_blank"
              className="flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              <span className="truncate">{product.product_name}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </Link>
            <div className="text-xs text-gray-500 mt-1">
              <span className="font-medium">SKU:</span> {product.sku}
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-medium">Brand:</span> {product.brand}
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-4">
        <Badge variant={product.in_stock_flag ? "default" : "destructive"} className="text-sm">
          {product.current_stock > 0 ? (
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-4 w-4" />
              <span>{formatNumber(product.current_stock)} units</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <TrendingDown className="h-4 w-4" />
              <span>Out of Stock</span>
            </div>
          )}
        </Badge>
      </td>
      <td className="px-8 py-4 text-sm font-medium text-gray-900">
        {product.current_price ? formatCurrency(product.current_price) : 'N/A'}
      </td>
      <td className="px-8 py-4 text-sm text-gray-500">
        {product.competitor_name || 'N/A'}
      </td>
      <td className="px-8 py-4 text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3" />
          <span className="whitespace-nowrap">{product.last_updated ? formatDate(product.last_updated) : 'N/A'}</span>
        </div>
      </td>
    </tr>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="brand-stock-modal-wide max-h-[95vh] overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Stock Details for Brand: {brand}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-600">Total Products</div>
                <div className="text-lg font-bold text-blue-900">{formatNumber(data.summary.totalProducts)}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-green-600">In Stock</div>
                <div className="text-lg font-bold text-green-900">{formatNumber(data.summary.inStockProducts)}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-red-600">Out of Stock</div>
                <div className="text-lg font-bold text-red-900">{formatNumber(data.summary.outOfStockProducts)}</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-purple-600">Stock Value</div>
                <div className="text-lg font-bold text-purple-900">{formatCurrency(data.summary.totalStockValue)}</div>
              </div>
            </div>

            {/* Tabs for filtering */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Products ({data.summary.totalProducts})</TabsTrigger>
                <TabsTrigger value="in_stock">In Stock ({data.summary.inStockProducts})</TabsTrigger>
                <TabsTrigger value="out_of_stock">Out of Stock ({data.summary.outOfStockProducts})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[65vh] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '45%' }}>
                            Product Details
                          </th>
                          <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                            Stock Level
                          </th>
                          <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                            Current Price
                          </th>
                          <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                            Competitor
                          </th>
                          <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                            Last Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredProducts().map((product) => (
                          <ProductRow key={product.product_id} product={product} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {getFilteredProducts().length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No products found for the selected filter.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No data available.
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandStockModal;
