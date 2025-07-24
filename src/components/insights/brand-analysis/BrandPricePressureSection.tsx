'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye, ExternalLink } from 'lucide-react';
import { formatNumber } from '@/lib/utils/format';

interface BrandPricePressureData {
  brand_name: string;
  total_products: number;
  total_price_changes: number;
  avg_price_changes_per_product: number;
  price_change_frequency_score: number;
  avg_price_change_percentage: number;
  price_increases: number;
  price_decreases: number;
  net_price_direction: string;
  most_volatile_product_name: string;
  most_volatile_product_changes: number;
  pressure_level: string;
}

interface BrandPricePressureSectionProps {
  data: BrandPricePressureData[];
  isLoading?: boolean;
  showTopOnly?: boolean;
  topCount?: number;
  onBrandClick?: (brandName: string) => void;
  onViewAll?: () => void;
}

const BrandPricePressureSection: React.FC<BrandPricePressureSectionProps> = ({
  data,
  isLoading = false,
  showTopOnly = true,
  topCount = 10,
  onBrandClick,
  onViewAll: _onViewAll
}) => {
  const [showAll, setShowAll] = useState(false);

  const handleBrandClick = (brandName: string) => {
    if (onBrandClick) {
      onBrandClick(brandName);
    } else {
      const url = `/app-routes/products?brand=${encodeURIComponent(brandName)}`;
      window.open(url, '_blank');
    }
  };

  const getPressureLevelColor = (level: string) => {
    switch (level) {
      case 'Very High': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Moderate': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'Increasing': return 'text-red-600';
      case 'Decreasing': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Pressure Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayData = showTopOnly && !showAll ? data.slice(0, topCount) : data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Price Pressure Analysis
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Brands experiencing high price volatility and competitive pressure
          </p>
        </div>
        {showTopOnly && data.length > topCount && (
          <Button 
            variant="outline" 
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {showAll ? `Show Top ${topCount}` : `View All (${data.length})`}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No price pressure data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Products
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price Changes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Frequency Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Direction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pressure Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayData.map((brand, index) => (
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
                      <div>
                        <div>{formatNumber(brand.total_price_changes)} total</div>
                        <div className="text-xs text-gray-500">
                          {brand.avg_price_changes_per_product.toFixed(2)} per product
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {brand.price_change_frequency_score.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getDirectionColor(brand.net_price_direction)}`}>
                        {brand.net_price_direction}
                      </div>
                      <div className="text-xs text-gray-500">
                        ↑{brand.price_increases} ↓{brand.price_decreases}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getPressureLevelColor(brand.pressure_level)}>
                        {brand.pressure_level}
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
        )}
      </CardContent>
    </Card>
  );
};

export default BrandPricePressureSection;
