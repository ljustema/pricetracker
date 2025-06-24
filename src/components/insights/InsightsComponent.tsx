'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DashboardTab,
  CompetitorAnalysisTab,
  ProductAnalysisTab,
  BrandAnalysisTab,
  MarginAnalysisTab,
  StockAnalysisTab
} from './tabs';

interface InsightsComponentProps {
  stockData?: {
    competitors: Array<{
      id: string;
      name: string;
      website?: string;
    }>;
    recentStockChanges: Array<{
      id: string;
      product_id: string;
      competitor_id: string;
      new_stock_quantity: number | null;
      new_stock_status: string | null;
      new_availability_date: string | null;
      stock_change_quantity: number | null;
      changed_at: string;
      url?: string;
      products?: {
        name: string;
        brand?: string;
        sku?: string;
      };
      competitors?: {
        name: string;
      };
    }>;
    stockStats: {
      totalProducts: number;
      totalStockChanges: number;
      productsWithStock: number;
      outOfStockProducts: number;
    } | null;
  };
}

const InsightsComponent: React.FC<InsightsComponentProps> = ({ stockData }) => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="competitors">Competitor Analysis</TabsTrigger>
          <TabsTrigger value="products">Product Analysis</TabsTrigger>
          <TabsTrigger value="brands">Brand Analysis</TabsTrigger>
          <TabsTrigger value="margins">Margin Analysis</TabsTrigger>
          <TabsTrigger value="stock">Stock Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="competitors">
          <CompetitorAnalysisTab />
        </TabsContent>

        <TabsContent value="products">
          <ProductAnalysisTab />
        </TabsContent>

        <TabsContent value="brands">
          <BrandAnalysisTab />
        </TabsContent>

        <TabsContent value="margins">
          <MarginAnalysisTab />
        </TabsContent>

        <TabsContent value="stock">
          {stockData ? (
            <StockAnalysisTab
              competitors={stockData.competitors}
              recentStockChanges={stockData.recentStockChanges}
              stockStats={stockData.stockStats}
            />
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">
                <p className="text-lg font-medium">Stock data not available</p>
                <p className="mt-1">Stock analysis requires stock tracking data.</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InsightsComponent;
