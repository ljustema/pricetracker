"use client";

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Package, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface BrandProductItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  total_sold: number;
  total_revenue: number;
  avg_daily_sales: number;
  avg_daily_revenue: number;
  current_price: number;
  image_url: string | null;
  competitor_url: string | null;
  last_sale_date: string;
}

interface BrandProductsData {
  data: BrandProductItem[];
  summary: {
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    avgDailySales: number;
    avgDailyRevenue: number;
  };
  brand: string;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
}

interface BrandProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandName: string;
  filters: {
    competitorId: string;
    startDate: string;
    endDate: string;
  };
}

export default function BrandProductsModal({
  isOpen,
  onClose,
  brandName,
  filters
}: BrandProductsModalProps) {
  const [data, setData] = useState<BrandProductsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrandProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        start_date: filters.startDate,
        end_date: filters.endDate
      });

      const response = await fetch(`/api/insights/stock-analysis/brands/${encodeURIComponent(brandName)}/products?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to fetch brand products: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching brand products:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [brandName, filters]);

  useEffect(() => {
    if (isOpen && brandName) {
      fetchBrandProducts();
    }
  }, [isOpen, brandName, filters, fetchBrandProducts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl !max-w-[50vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold">
            {brandName} - Product Details
          </DialogTitle>
          {data && (
            <div className="text-sm text-gray-600">
              Period: {formatDate(data.period.startDate)} - {formatDate(data.period.endDate)} ({data.period.days} days)
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading products...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-red-600">
                <p>Error: {error}</p>
                <Button variant="outline" onClick={fetchBrandProducts} className="mt-2">
                  Retry
                </Button>
              </div>
            </div>
          ) : data ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 flex-shrink-0">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Package className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-600">Products</p>
                      <p className="text-lg font-bold">{data.summary.totalProducts}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-600">Total Sales</p>
                      <p className="text-lg font-bold">{data.summary.totalSales}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-600">Revenue</p>
                      <p className="text-lg font-bold">{formatCurrency(data.summary.totalRevenue)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-purple-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-600">Daily Avg</p>
                      <p className="text-lg font-bold">{data.summary.avgDailySales.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-3">
                  {data.data.map((product) => (
                    <div key={product.product_id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start space-x-4">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.product_name}
                              width={80}
                              height={80}
                              className="rounded-lg object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                <Link
                                  href={`/app-routes/products/${product.product_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-blue-600 hover:underline cursor-pointer"
                                >
                                  {product.product_name}
                                </Link>
                              </h4>
                              <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                              <div className="flex items-center space-x-4 mt-2">
                                <Badge variant="secondary">
                                  Sold: {product.total_sold}
                                </Badge>
                                <Badge variant="outline">
                                  {formatCurrency(product.current_price)}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  Revenue: {formatCurrency(product.total_revenue)}
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="text-xs text-gray-500">
                                  Daily avg: {product.avg_daily_sales.toFixed(1)} units
                                </span>
                                <span className="text-xs text-gray-500">
                                  Last sale: {formatDate(product.last_sale_date)}
                                </span>
                              </div>
                            </div>
                            
                            {/* External Link */}
                            {product.competitor_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(product.competitor_url!, '_blank')}
                                className="flex-shrink-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
