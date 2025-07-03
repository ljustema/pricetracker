'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
          <TabsTrigger value="stock">Stock Analysis</TabsTrigger>
          <TabsTrigger value="competitors" className="flex items-center gap-2">
            Competitor Analysis
            <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200">Beta</Badge>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            Product Analysis
            <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200">Beta</Badge>
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex items-center gap-2">
            Brand Analysis
            <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200">Beta</Badge>
          </TabsTrigger>
          <TabsTrigger value="margins" className="flex items-center gap-2">
            Margin Analysis
            <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">Coming</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
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
      </Tabs>
    </div>
  );
};

export default InsightsComponent;
