'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DashboardTab,
  CompetitorAnalysisTab,
  ProductAnalysisTab,
  BrandAnalysisTab,
  MarginAnalysisTab
} from './tabs';

const InsightsComponent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="competitors">Competitor Analysis</TabsTrigger>
          <TabsTrigger value="products">Product Analysis</TabsTrigger>
          <TabsTrigger value="brands">Brand Analysis</TabsTrigger>
          <TabsTrigger value="margins">Margin Analysis</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default InsightsComponent;
