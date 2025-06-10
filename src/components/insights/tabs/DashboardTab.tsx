'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils/format';

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
  price_change_percentage: number;
  changed_at: string;
  products: {
    name: string;
  };
  competitors?: {
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

interface DashboardActivity {
  latestPriceChanges: PriceChange[];
  latestProducts: Product[];
}

const DashboardTab: React.FC = () => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [activity, setActivity] = useState<DashboardActivity | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
        {/* Recent Price Changes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Price Changes</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.latestPriceChanges.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No recent price changes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.latestPriceChanges.map((priceChange) => (
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
                          {priceChange.competitors ? priceChange.competitors.name : 'Your price'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${priceChange.price_change_percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {priceChange.price_change_percentage > 0 ? '+' : ''}{priceChange.price_change_percentage.toFixed(2)}%
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

        {/* Recent Products */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Added Products</CardTitle>
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
      </div>
    </div>
  );
};

export default DashboardTab;
