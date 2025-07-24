'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, ExternalLink, Eye } from 'lucide-react';
import { formatNumber, formatPercentage, formatCurrency } from '@/lib/utils/format';

interface BrandCompetitivenessData {
  brand_name: string;
  total_products_with_prices: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: number;
  same_price_percentage: number;
  more_expensive_percentage: number;
  avg_price_difference_when_higher: number;
  avg_price_difference_percentage_when_higher: number;
  market_dominance_percentage: number;
}

interface BrandCompetitivenessTableProps {
  data: BrandCompetitivenessData[];
  isLoading?: boolean;
  showTopOnly?: boolean;
  topCount?: number;
  onBrandClick?: (brandName: string) => void;
  onViewAll?: () => void;
}

type SortKey = keyof BrandCompetitivenessData;
type SortDirection = 'asc' | 'desc';

const BrandCompetitivenessTable: React.FC<BrandCompetitivenessTableProps> = ({
  data,
  isLoading = false,
  showTopOnly = true,
  topCount = 15,
  onBrandClick,
  onViewAll
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('market_dominance_percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const handleBrandClick = (brandName: string) => {
    if (onBrandClick) {
      onBrandClick(brandName);
    } else {
      // Default behavior: open products page with brand filter
      const url = `/app-routes/products?brand=${encodeURIComponent(brandName)}`;
      window.open(url, '_blank');
    }
  };

  const getSortedData = () => {
    const sortedData = [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const aNum = Number(aValue) || 0;
      const bNum = Number(bValue) || 0;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return showTopOnly ? sortedData.slice(0, topCount) : sortedData;
  };

  const SortableHeader: React.FC<{ sortKey: SortKey; children: React.ReactNode }> = ({ 
    sortKey: key, 
    children 
  }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortKey === key && (
          sortDirection === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </th>
  );

  const getCompetitivenessColor = (percentage: number) => {
    if (percentage >= 70) return 'text-green-600 bg-green-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brand Competitiveness</CardTitle>
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

  const displayData = getSortedData();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Brand Competitiveness</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Price competitiveness and market dominance per brand
          </p>
        </div>
        {showTopOnly && data.length > topCount && onViewAll && (
          <Button variant="outline" onClick={onViewAll} className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View All ({data.length})
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No brand competitiveness data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader sortKey="brand_name">Brand</SortableHeader>
                  <SortableHeader sortKey="total_products_with_prices">Products</SortableHeader>
                  <SortableHeader sortKey="market_dominance_percentage">Market Dominance</SortableHeader>
                  <SortableHeader sortKey="cheapest_percentage">Cheapest %</SortableHeader>
                  <SortableHeader sortKey="same_price_percentage">Same Price %</SortableHeader>
                  <SortableHeader sortKey="more_expensive_percentage">More Expensive %</SortableHeader>
                  <SortableHeader sortKey="avg_price_difference_when_higher">Avg Diff</SortableHeader>
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
                      {formatNumber(brand.total_products_with_prices)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getCompetitivenessColor(brand.market_dominance_percentage)}>
                        {formatPercentage(brand.market_dominance_percentage)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatPercentage(brand.cheapest_percentage)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatPercentage(brand.same_price_percentage)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {formatPercentage(brand.more_expensive_percentage)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {brand.avg_price_difference_when_higher > 0 ? (
                        <div>
                          <div>{formatCurrency(brand.avg_price_difference_when_higher)}</div>
                          <div className="text-xs text-gray-500">
                            ({formatPercentage(brand.avg_price_difference_percentage_when_higher)})
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
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

export default BrandCompetitivenessTable;
