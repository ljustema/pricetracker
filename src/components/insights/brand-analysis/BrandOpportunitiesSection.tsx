'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, Eye, Target, Package, TrendingUp } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/lib/utils/format';

interface BrandsWithoutPricesData {
  brand_name: string;
  competitor_product_count: number;
  competitor_count: number;
  avg_competitor_price: number;
  min_competitor_price: number;
  max_competitor_price: number;
  avg_stock_level: number;
  products_in_stock: number;
  products_out_of_stock: number;
  opportunity_score: number;
}

interface CrossDockingOpportunitiesData {
  brand_name: string;
  total_products: number;
  competitor_count: number;
  avg_stock_level: number;
  products_with_low_stock: number;
  low_stock_percentage: number;
  avg_competitor_price: number;
  stock_turnover_indicator: string;
  cross_docking_suitability_score: number;
  suitability_reason: string;
}

interface TrendingBrandsData {
  brand_name: string;
  first_seen_date: string;
  days_since_first_seen: number;
  current_product_count: number;
  competitor_count: number;
  product_growth_rate: number;
  avg_competitor_price: number;
  price_trend: string;
  avg_stock_level: number;
  trending_score: number;
  trend_category: string;
}

interface BrandOpportunitiesSectionProps {
  brandsWithoutPricesData: BrandsWithoutPricesData[];
  crossDockingData: CrossDockingOpportunitiesData[];
  trendingBrandsData: TrendingBrandsData[];
  isLoading?: boolean;
  onBrandClick?: (brandName: string) => void;
  onExport?: (type: 'brands-without-prices' | 'cross-docking' | 'trending') => void;
}

const BrandOpportunitiesSection: React.FC<BrandOpportunitiesSectionProps> = ({
  brandsWithoutPricesData,
  crossDockingData,
  trendingBrandsData,
  isLoading = false,
  onBrandClick,
  onExport
}) => {
  const [showAllBrandsWithoutPrices, setShowAllBrandsWithoutPrices] = useState(false);
  const [showAllCrossDocking, setShowAllCrossDocking] = useState(false);
  const [showAllTrending, setShowAllTrending] = useState(false);

  const handleBrandClick = (brandName: string) => {
    if (onBrandClick) {
      onBrandClick(brandName);
    } else {
      const url = `/app-routes/products?brand=${encodeURIComponent(brandName)}`;
      window.open(url, '_blank');
    }
  };

  const getOpportunityScoreColor = (score: number) => {
    if (score >= 100) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSuitabilityScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendingScoreColor = (score: number) => {
    if (score >= 80) return 'text-purple-600 bg-purple-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getTrendCategoryColor = (category: string) => {
    switch (category) {
      case 'Hot New Brand': return 'bg-red-100 text-red-800';
      case 'Rapidly Growing': return 'bg-orange-100 text-orange-800';
      case 'Fast Growing': return 'bg-yellow-100 text-yellow-800';
      case 'Established Trending': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brand Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Brand Opportunities
        </CardTitle>
        <p className="text-sm text-gray-500">
          Discover new brand opportunities and expansion possibilities
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="brands-without-prices" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="brands-without-prices" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Missing Brands ({brandsWithoutPricesData.length})
            </TabsTrigger>
            <TabsTrigger value="cross-docking" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Cross-Docking ({crossDockingData.length})
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending ({trendingBrandsData.length})
            </TabsTrigger>
          </TabsList>

          {/* Brands Without Our Prices */}
          <TabsContent value="brands-without-prices">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Brands that competitors sell but we don't have prices for
                </p>
                <div className="flex gap-2">
                  {onExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onExport('brands-without-prices')}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                  {brandsWithoutPricesData.length > 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllBrandsWithoutPrices(!showAllBrandsWithoutPrices)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      {showAllBrandsWithoutPrices ? 'Show Top 10' : `View All (${brandsWithoutPricesData.length})`}
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Competitors</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opportunity Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(showAllBrandsWithoutPrices ? brandsWithoutPricesData : brandsWithoutPricesData.slice(0, 10))
                      .map((brand, index) => (
                      <tr key={brand.brand_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleBrandClick(brand.brand_name)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {brand.brand_name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(brand.competitor_product_count)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {brand.competitor_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(brand.avg_competitor_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getOpportunityScoreColor(brand.opportunity_score)}>
                            {brand.opportunity_score.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBrandClick(brand.brand_name)}
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Cross-Docking Opportunities */}
          <TabsContent value="cross-docking">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Brands suitable for cross-docking model based on low stock levels
                </p>
                <div className="flex gap-2">
                  {onExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onExport('cross-docking')}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                  {crossDockingData.length > 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllCrossDocking(!showAllCrossDocking)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      {showAllCrossDocking ? 'Show Top 10' : `View All (${crossDockingData.length})`}
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Low Stock %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suitability</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(showAllCrossDocking ? crossDockingData : crossDockingData.slice(0, 10))
                      .map((brand, index) => (
                      <tr key={brand.brand_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleBrandClick(brand.brand_name)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {brand.brand_name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(brand.total_products)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {brand.avg_stock_level.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {brand.low_stock_percentage.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getSuitabilityScoreColor(brand.cross_docking_suitability_score)}>
                            {brand.cross_docking_suitability_score.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBrandClick(brand.brand_name)}
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Trending Brands */}
          <TabsContent value="trending">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  New and trending brands based on recent appearance and growth
                </p>
                <div className="flex gap-2">
                  {onExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onExport('trending')}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                  {trendingBrandsData.length > 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllTrending(!showAllTrending)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      {showAllTrending ? 'Show Top 10' : `View All (${trendingBrandsData.length})`}
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Growth Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trending Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(showAllTrending ? trendingBrandsData : trendingBrandsData.slice(0, 10))
                      .map((brand, index) => (
                      <tr key={brand.brand_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleBrandClick(brand.brand_name)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {brand.brand_name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(brand.current_product_count)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {brand.product_growth_rate > 0 ? '+' : ''}{brand.product_growth_rate.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getTrendCategoryColor(brand.trend_category)}>
                            {brand.trend_category}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getTrendingScoreColor(brand.trending_score)}>
                            {brand.trending_score.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBrandClick(brand.brand_name)}
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BrandOpportunitiesSection;
