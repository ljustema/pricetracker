'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils/format';
import { StockBadgeCompact } from '@/components/ui/stock-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Simple SVG icons
const ProductIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const CompetitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const BrandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Define types for KPIs and activity data
interface DashboardKPIs {
  productsCount: number;
  competitorsCount: number;
  brandsCount: number;
}

interface PriceChange {
  id: string;
  product_id: string;
  competitor_id: string | null;
  integration_id: string | null;
  old_competitor_price?: number;
  new_competitor_price?: number;
  old_our_retail_price?: number;
  new_our_retail_price?: number;
  price_change_percentage: number;
  changed_at: string;
  products: {
    name: string;
  };
  competitors?: {
    name: string;
  };
  integrations?: {
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string;
  our_price: number | null;
  created_at: string;
  brands: {
    name: string;
  };
}

interface StockChange {
  id: string;
  product_id: string;
  competitor_id: string;
  old_stock_quantity: number | null;
  new_stock_quantity: number | null;
  old_stock_status: string | null;
  new_stock_status: string | null;
  stock_change_quantity: number | null;
  changed_at: string;
  products: {
    name: string;
  };
  competitors: {
    name: string;
  };
}

interface SupplierPriceChange {
  id: string;
  product_id: string;
  supplier_id: string | null;
  integration_id: string | null;
  old_supplier_price: number | null;
  new_supplier_price: number | null;
  old_our_wholesale_price: number | null;
  new_our_wholesale_price: number | null;
  price_change_percentage: number | null;
  changed_at: string;
  products: {
    name: string;
  };
  suppliers: {
    name: string;
  } | null;
  integrations: {
    name: string;
  } | null;
}

interface DashboardActivity {
  latestCompetitorPriceChanges: PriceChange[];
  latestOurRetailPriceChanges: PriceChange[];
  latestProducts: Product[];
  latestStockChanges: StockChange[];
  latestSupplierPriceChanges: SupplierPriceChange[];
  latestOurWholesalePriceChanges: SupplierPriceChange[];
}

const DashboardTab: React.FC = () => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [activity, setActivity] = useState<DashboardActivity | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Modal states
  const [modalData, setModalData] = useState<{
    latestCompetitorPriceChanges: PriceChange[];
    latestOurRetailPriceChanges: PriceChange[];
    latestProducts: Product[];
    latestStockChanges: StockChange[];
    latestSupplierPriceChanges: SupplierPriceChange[];
    latestOurWholesalePriceChanges: SupplierPriceChange[];
  } | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);

  // Fetch extended data for modals
  const fetchModalData = async () => {
    if (modalData) return; // Already loaded

    try {
      setIsLoadingModal(true);
      const response = await fetch('/api/insights/dashboard/activity?limit=50');
      if (!response.ok) {
        throw new Error(`Failed to fetch extended activity data: ${response.statusText}`);
      }
      const data = await response.json();
      setModalData(data);
    } catch (err) {
      console.error('Error fetching extended activity data:', err);
      toast({
        title: 'Error',
        description: 'Failed to load extended activity data',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingModal(false);
    }
  };

  // Fetch KPIs
  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setIsLoadingKpis(true);
        const response = await fetch('/api/insights/dashboard/kpis');
        if (!response.ok) {
          throw new Error(`Failed to fetch KPIs: ${response.statusText}`);
        }
        const data = await response.json();
        setKpis(data);
      } catch (err) {
        console.error('Error fetching KPIs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch KPIs');
        toast({
          title: 'Error',
          description: 'Failed to load dashboard KPIs',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingKpis(false);
      }
    };

    fetchKpis();
  }, [toast]);

  // Fetch activity data
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setIsLoadingActivity(true);
        const response = await fetch('/api/insights/dashboard/activity');
        if (!response.ok) {
          throw new Error(`Failed to fetch activity data: ${response.statusText}`);
        }
        const data = await response.json();
        setActivity(data);
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch activity data');
        toast({
          title: 'Error',
          description: 'Failed to load dashboard activity',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingActivity(false);
      }
    };

    fetchActivity();
  }, [toast]);

  if (isLoadingKpis || isLoadingActivity) {
    return <div className="text-center py-8">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  if (!kpis || !activity) {
    return <div className="text-center py-8">No dashboard data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <div className="bg-indigo-50 p-2 rounded-full">
              <ProductIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.productsCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Active products in your catalog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitors</CardTitle>
            <div className="bg-indigo-50 p-2 rounded-full">
              <CompetitorIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.competitorsCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Competitors you're tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Brands</CardTitle>
            <div className="bg-indigo-50 p-2 rounded-full">
              <BrandIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.brandsCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Brands in your product catalog
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Competitor Price Changes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Competitor Price Changes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={fetchModalData}>
                    See more
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[50vw] !max-w-none max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Recent Competitor Price Changes (Latest 50)</DialogTitle>
                    <DialogDescription>
                      View the latest 50 competitor price changes from your tracked products.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-4">
                    {isLoadingModal ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : modalData?.latestCompetitorPriceChanges ? (
                      modalData.latestCompetitorPriceChanges.map((priceChange) => (
                        <div key={priceChange.id} className="border-b pb-3 last:border-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link
                                href={`/app-routes/products/${priceChange.product_id}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                target="_blank"
                              >
                                {priceChange.products.name}
                              </Link>
                              <p className="text-sm text-gray-500">
                                {priceChange.competitors?.name || 'Unknown competitor'}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${(priceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(priceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(priceChange.price_change_percentage || 0).toFixed(2)}%
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatCurrency(priceChange.old_competitor_price || 0)} → {formatCurrency(priceChange.new_competitor_price || 0)}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(priceChange.changed_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No recent competitor price changes</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(activity.latestCompetitorPriceChanges || []).length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recent competitor price changes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(activity.latestCompetitorPriceChanges || []).map((priceChange) => (
                  <div key={priceChange.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link 
                          href={`/app-routes/products/${priceChange.product_id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {priceChange.products.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {priceChange.competitors?.name || 'Unknown competitor'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${(priceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(priceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(priceChange.price_change_percentage || 0).toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(priceChange.old_competitor_price || 0)} → {formatCurrency(priceChange.new_competitor_price || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(priceChange.changed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Our Retail Price Changes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Our Retail Price Changes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={fetchModalData}>
                    See more
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[50vw] !max-w-none max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Recent Our Retail Price Changes (Latest 50)</DialogTitle>
                    <DialogDescription>
                      View the latest 50 retail price changes from your integrations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-4">
                    {isLoadingModal ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : modalData?.latestOurRetailPriceChanges ? (
                      modalData.latestOurRetailPriceChanges.map((priceChange) => (
                        <div key={priceChange.id} className="border-b pb-3 last:border-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link
                                href={`/app-routes/products/${priceChange.product_id}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                target="_blank"
                              >
                                {priceChange.products.name}
                              </Link>
                              <p className="text-sm text-gray-500">
                                {priceChange.integrations?.name || 'Unknown integration'}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${(priceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(priceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(priceChange.price_change_percentage || 0).toFixed(2)}%
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatCurrency(priceChange.old_our_retail_price || 0)} → {formatCurrency(priceChange.new_our_retail_price || 0)}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(priceChange.changed_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No recent retail price changes</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(activity.latestOurRetailPriceChanges || []).length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recent retail price changes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(activity.latestOurRetailPriceChanges || []).map((priceChange) => (
                  <div key={priceChange.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link
                          href={`/app-routes/products/${priceChange.product_id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {priceChange.products.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {priceChange.integrations?.name || 'Unknown integration'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${(priceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(priceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(priceChange.price_change_percentage || 0).toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(priceChange.old_our_retail_price || 0)} → {formatCurrency(priceChange.new_our_retail_price || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(priceChange.changed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second row for supplier price changes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Supplier Price Changes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Supplier Price Changes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={fetchModalData}>
                    See more
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[50vw] !max-w-none max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Recent Supplier Price Changes (Latest 50)</DialogTitle>
                    <DialogDescription>
                      View the latest 50 supplier price changes from your tracked suppliers.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-4">
                    {isLoadingModal ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : modalData?.latestSupplierPriceChanges ? (
                      modalData.latestSupplierPriceChanges.map((supplierPriceChange) => (
                        <div key={supplierPriceChange.id} className="border-b pb-3 last:border-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link
                                href={`/app-routes/products/${supplierPriceChange.product_id}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                target="_blank"
                              >
                                {supplierPriceChange.products.name}
                              </Link>
                              <p className="text-sm text-gray-500">
                                {supplierPriceChange.suppliers?.name || 'Unknown supplier'}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${(supplierPriceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(supplierPriceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(supplierPriceChange.price_change_percentage || 0).toFixed(2)}%
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatCurrency(supplierPriceChange.old_supplier_price || 0)} → {formatCurrency(supplierPriceChange.new_supplier_price || 0)}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(supplierPriceChange.changed_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No supplier price changes found</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(activity.latestSupplierPriceChanges || []).length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recent supplier price changes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(activity.latestSupplierPriceChanges || []).map((supplierPriceChange) => (
                  <div key={supplierPriceChange.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link
                          href={`/app-routes/products/${supplierPriceChange.product_id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {supplierPriceChange.products.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {supplierPriceChange.suppliers?.name || 'Unknown supplier'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${(supplierPriceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(supplierPriceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(supplierPriceChange.price_change_percentage || 0).toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(supplierPriceChange.old_supplier_price || 0)} → {formatCurrency(supplierPriceChange.new_supplier_price || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(supplierPriceChange.changed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Our Wholesale Price Changes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Our Wholesale Price Changes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={fetchModalData}>
                    See more
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[50vw] !max-w-none max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Recent Our Wholesale Price Changes (Latest 50)</DialogTitle>
                    <DialogDescription>
                      View the latest 50 wholesale price changes from your integrations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-4">
                    {isLoadingModal ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : modalData?.latestOurWholesalePriceChanges ? (
                      modalData.latestOurWholesalePriceChanges.map((priceChange) => (
                        <div key={priceChange.id} className="border-b pb-3 last:border-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link
                                href={`/app-routes/products/${priceChange.product_id}`}
                                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                target="_blank"
                              >
                                {priceChange.products.name}
                              </Link>
                              <p className="text-sm text-gray-500">
                                {priceChange.integrations?.name || 'Unknown integration'}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${(priceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(priceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(priceChange.price_change_percentage || 0).toFixed(2)}%
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatCurrency(priceChange.old_our_wholesale_price || 0)} → {formatCurrency(priceChange.new_our_wholesale_price || 0)}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(priceChange.changed_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No recent wholesale price changes</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(activity.latestOurWholesalePriceChanges || []).length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recent wholesale price changes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(activity.latestOurWholesalePriceChanges || []).map((priceChange) => (
                  <div key={priceChange.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link
                          href={`/app-routes/products/${priceChange.product_id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {priceChange.products.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {priceChange.integrations?.name || 'Unknown integration'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${(priceChange.price_change_percentage || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(priceChange.price_change_percentage || 0) > 0 ? '+' : ''}{(priceChange.price_change_percentage || 0).toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(priceChange.old_our_wholesale_price || 0)} → {formatCurrency(priceChange.new_our_wholesale_price || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(priceChange.changed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Third row for other content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Products */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recently Added Products</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={fetchModalData}>
                    See more
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[50vw] !max-w-none max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Recently Added Products (Latest 50)</DialogTitle>
                    <DialogDescription>
                      View the latest 50 products that have been added to your catalog.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-4">
                    {isLoadingModal ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : modalData?.latestProducts ? (
                      modalData.latestProducts.map((product) => (
                        <div key={product.id} className="border-b pb-3 last:border-0">
                          <Link
                            href={`/app-routes/products/${product.id}`}
                            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="text-sm text-gray-500">
                            {product.brands?.name || 'No brand'}
                          </p>
                          <div className="text-xs text-gray-400">
                            {new Date(product.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No products found</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {activity.latestProducts.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recently added products</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.latestProducts.map((product) => (
                  <div key={product.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link 
                          href={`/app-routes/products/${product.id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {product.brands?.name || product.brand || 'No brand'}
                        </p>
                      </div>
                      {product.our_price && (
                        <div className="text-right font-medium">
                          {formatCurrency(product.our_price)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(product.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Stock Changes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Stock Changes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={fetchModalData}>
                    See more
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[50vw] !max-w-none max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Recent Stock Changes (Latest 50)</DialogTitle>
                    <DialogDescription>
                      View the latest 50 stock quantity changes from your competitors.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-4">
                    {isLoadingModal ? (
                      <div className="text-center py-8">Loading...</div>
                    ) : modalData?.latestStockChanges ? (
                      modalData.latestStockChanges.map((stockChange) => (
                        <div key={stockChange.id} className="border-b pb-3 last:border-0">
                          {/* Row 1: Product name + Stock badge */}
                          <div className="flex justify-between items-start">
                            <Link
                              href={`/app-routes/products/${stockChange.product_id}`}
                              className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {stockChange.products.name}
                            </Link>
                            <StockBadgeCompact
                              stockQuantity={stockChange.new_stock_quantity}
                              stockStatus={stockChange.new_stock_status}
                            />
                          </div>

                          {/* Row 2: Competitor name + Stock change quantity */}
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500">
                              {stockChange.competitors.name}
                            </p>
                            <div className={`font-medium ${(stockChange.stock_change_quantity || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(stockChange.stock_change_quantity || 0) > 0 ? '+' : ''}{stockChange.stock_change_quantity || 0}
                            </div>
                          </div>

                          {/* Row 3: Date + Old → New quantity */}
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-gray-400">
                              {new Date(stockChange.changed_at).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {stockChange.old_stock_quantity || 0} → {stockChange.new_stock_quantity || 0}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No stock changes found</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {(activity.latestStockChanges || []).length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recent stock changes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(activity.latestStockChanges || []).map((stockChange) => (
                  <div key={stockChange.id} className="border-b pb-3 last:border-0">
                    {/* Row 1: Product name + Stock badge */}
                    <div className="flex justify-between items-start">
                      <Link
                        href={`/app-routes/products/${stockChange.product_id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {stockChange.products.name}
                      </Link>
                      <StockBadgeCompact
                        stockQuantity={stockChange.new_stock_quantity}
                        stockStatus={stockChange.new_stock_status}
                      />
                    </div>

                    {/* Row 2: Competitor name + Stock change quantity */}
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        {stockChange.competitors.name}
                      </p>
                      <div className={`font-medium ${(stockChange.stock_change_quantity || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(stockChange.stock_change_quantity || 0) > 0 ? '+' : ''}{stockChange.stock_change_quantity || 0}
                      </div>
                    </div>

                    {/* Row 3: Date + Old → New quantity */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-400">
                        {new Date(stockChange.changed_at).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {stockChange.old_stock_quantity || 0} → {stockChange.new_stock_quantity || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </div>
  );
};

export default DashboardTab;
