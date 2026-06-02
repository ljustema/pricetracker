'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';
import { formatNumber, formatPercentage } from '@/lib/utils/format';

interface BrandOverviewData {
  total_brands: number;
  total_products: number;
  avg_market_dominance: number;
  top_performing_brand: string | null;
  worst_performing_brand: string | null;
  brands_under_high_pressure?: number;
  brands_under_pressure?: number;
  most_pressured_brand?: string | null;
  opportunity_brands?: number;
}

interface BrandOverviewCardsProps {
  competitivenessData?: BrandOverviewData;
  positioningData?: BrandOverviewData;
  pressureData?: BrandOverviewData;
  opportunityData?: BrandOverviewData;
  isLoading?: boolean;
  onBrandClick?: (brandName: string) => void;
}

const BrandOverviewCards: React.FC<BrandOverviewCardsProps> = ({
  competitivenessData,
  positioningData: _positioningData,
  pressureData,
  opportunityData,
  isLoading = false,
  onBrandClick
}) => {
  const handleBrandClick = (brandName: string) => {
    if (onBrandClick && brandName) {
      onBrandClick(brandName);
    } else if (brandName) {
      // Default behavior: open products page with brand filter
      const url = `/app-routes/products?brand=${encodeURIComponent(brandName)}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Total Brands Analyzed */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Brands Analyzed</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(competitivenessData?.total_brands || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatNumber(competitivenessData?.total_products || 0)} products
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Brand */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Top Performer</p>
              {competitivenessData?.top_performing_brand ? (
                <button
                  onClick={() => handleBrandClick(competitivenessData.top_performing_brand!)}
                  className="text-lg font-bold text-green-600 hover:text-green-800 hover:underline cursor-pointer text-left"
                >
                  {competitivenessData.top_performing_brand}
                </button>
              ) : (
                <p className="text-lg font-bold text-gray-400">N/A</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {formatPercentage(competitivenessData?.avg_market_dominance || 0)} dominance
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worst Performing Brand */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Needs Attention</p>
              {competitivenessData?.worst_performing_brand ? (
                <button
                  onClick={() => handleBrandClick(competitivenessData.worst_performing_brand!)}
                  className="text-lg font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer text-left"
                >
                  {competitivenessData.worst_performing_brand}
                </button>
              ) : (
                <p className="text-lg font-bold text-gray-400">N/A</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Lowest positioning
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Opportunities */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Opportunities</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatNumber(opportunityData?.opportunity_brands || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Brands without our prices
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Pressure Brands */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Under Pressure</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-orange-600">
                  {formatNumber(pressureData?.brands_under_pressure || 0)}
                </p>
                {(pressureData?.brands_under_pressure || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    High
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Brands with high price volatility
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandOverviewCards;
