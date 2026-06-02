'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPercentage, formatNumber } from '@/lib/utils/format';
import { Download, Target, AlertTriangle, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import PriceCompetitivenessTrendChart from '@/components/insights/charts/PriceCompetitivenessTrendChart';

// Types for new competitor analysis data
interface PriceCompetitivenessData {
  competitor_id: string;
  competitor_name: string;
  competitor_website: string;
  total_matching_products: number;
  our_products_cheaper: number;
  our_products_more_expensive: number;
  our_products_same_price: number;
  avg_price_difference_percentage: number;
  avg_our_price: number;
  avg_competitor_price: number;
  market_coverage_percentage: number;
}

interface CompetitorPressureData {
  competitor_id: string;
  competitor_name: string;
  products_where_lowest: number;
  total_products_tracked: number;
  lowest_price_percentage: number;
  avg_price_when_lowest: number;
  is_integration: boolean;
}

interface PriorityProductData {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_brand: string;
  product_ean: string;
  our_price: number;
  lowest_competitor_price: number;
  price_difference: number;
  price_difference_percentage: number;
  potential_savings: number;
  competitor_count: number;
  most_competitive_competitor_name: string;
}

interface MarketPositioningData {
  total_our_products: number;
  products_with_competitor_data: number;
  market_coverage_percentage: number;
  competitive_products: number;
  overpriced_products: number;
  competitive_percentage: number;
  avg_price_premium_percentage: number;
  total_competitors: number;
  most_competitive_against: string;
  least_competitive_against: string;
}

interface PriceChangeFrequencyData {
  competitor_id: string;
  competitor_name: string;
  total_price_changes: number;
  products_with_changes: number;
  avg_changes_per_product: number;
  price_increases: number;
  price_decreases: number;
  avg_change_percentage: number;
  most_active_day: string;
  is_integration: boolean;
}

// Competitor interface
interface Competitor {
  id: string;
  name: string;
  website?: string;
}

const CompetitorAnalysisTab: React.FC = () => {
  // State for all analysis data
  const [_priceCompetitivenessData, setPriceCompetitivenessData] = useState<PriceCompetitivenessData[]>([]);
  const [_competitorPressureData, setCompetitorPressureData] = useState<CompetitorPressureData[]>([]);
  const [_priorityProductsData, setPriorityProductsData] = useState<PriorityProductData[]>([]);
  const [_marketPositioningData, setMarketPositioningData] = useState<MarketPositioningData | null>(null);
  const [_priceChangeFrequencyData, setPriceChangeFrequencyData] = useState<PriceChangeFrequencyData[]>([]);
  const [_priceChangeFrequencyPeriod, _setPriceChangeFrequencyPeriod] = useState<string>('14'); // Default to 2 weeks
  const [_priceChangeFrequencyLoading, _setPriceChangeFrequencyLoading] = useState<boolean>(false);

  // Competitors state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch competitors
  const fetchCompetitors = useCallback(async () => {
    try {
      const response = await fetch('/api/competitors');
      if (!response.ok) throw new Error('Failed to fetch competitors');

      const competitorsData = await response.json();
      setCompetitors(competitorsData || []);
    } catch (error) {
      console.error('Error fetching competitors:', error);
      toast({
        title: "Error",
        description: "Failed to fetch competitors",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch functions for each analysis type
  const fetchPriceCompetitiveness = useCallback(async () => {
    try {
      // No date filtering - show current status of all products
      const response = await fetch('/api/insights/competitor-analysis/price-competitiveness');
      if (!response.ok) throw new Error('Failed to fetch price competitiveness data');

      const result = await response.json();
      setPriceCompetitivenessData(result.data || []);
    } catch (error) {
      console.error('Error fetching price competitiveness:', error);
      toast({
        title: "Error",
        description: "Failed to fetch price competitiveness data",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchCompetitorPressure = useCallback(async () => {
    try {
      // No date filtering - show current status
      const response = await fetch('/api/insights/competitor-analysis/pressure-analysis');
      if (!response.ok) throw new Error('Failed to fetch competitor pressure data');

      const result = await response.json();
      setCompetitorPressureData(result.data || []);
    } catch (error) {
      console.error('Error fetching competitor pressure:', error);
      toast({
        title: "Error",
        description: "Failed to fetch competitor pressure data",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchPriorityProducts = useCallback(async () => {
    try {
      // Show top 20 priority products without date filtering
      const response = await fetch('/api/insights/competitor-analysis/priority-products?limit=20');
      if (!response.ok) throw new Error('Failed to fetch priority products data');

      const result = await response.json();
      setPriorityProductsData(result.data || []);
    } catch (error) {
      console.error('Error fetching priority products:', error);
      toast({
        title: "Error",
        description: "Failed to fetch priority products data",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchMarketPositioning = useCallback(async () => {
    try {
      // No date filtering - show current market positioning
      const response = await fetch('/api/insights/competitor-analysis/market-positioning');
      if (!response.ok) throw new Error('Failed to fetch market positioning data');

      const result = await response.json();
      setMarketPositioningData(result.data || null);
    } catch (error) {
      console.error('Error fetching market positioning:', error);
      toast({
        title: "Error",
        description: "Failed to fetch market positioning data",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchPriceChangeFrequency = useCallback(async () => {
    try {
      _setPriceChangeFrequencyLoading(true);
      const response = await fetch(`/api/insights/competitor-analysis/price-change-frequency?days=${_priceChangeFrequencyPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch price change frequency data');

      const result = await response.json();
      setPriceChangeFrequencyData(result.data || []);
    } catch (error) {
      console.error('Error fetching price change frequency:', error);
      toast({
        title: "Error",
        description: "Failed to fetch price change frequency data",
        variant: "destructive",
      });
    } finally {
      _setPriceChangeFrequencyLoading(false);
    }
  }, [_priceChangeFrequencyPeriod, toast]);

  // Fetch initial data (excluding price change frequency)
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchCompetitors(),
        fetchPriceCompetitiveness(),
        fetchCompetitorPressure(),
        fetchPriorityProducts(),
        fetchMarketPositioning()
      ]);
    } catch (error) {
      console.error('Error fetching competitor analysis data:', error);
      setError('Failed to fetch competitor analysis data');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCompetitors, fetchPriceCompetitiveness, fetchCompetitorPressure, fetchPriorityProducts, fetchMarketPositioning]);

  // Separate function for all data (used by retry button)
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchCompetitors(),
        fetchPriceCompetitiveness(),
        fetchCompetitorPressure(),
        fetchPriorityProducts(),
        fetchMarketPositioning(),
        fetchPriceChangeFrequency()
      ]);
    } catch (error) {
      console.error('Error fetching competitor analysis data:', error);
      setError('Failed to fetch competitor analysis data');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCompetitors, fetchPriceCompetitiveness, fetchCompetitorPressure, fetchPriorityProducts, fetchMarketPositioning, fetchPriceChangeFrequency]);

  // Initial data fetch
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Separate effect for price change frequency to avoid reloading all data
  useEffect(() => {
    fetchPriceChangeFrequency();
  }, [_priceChangeFrequencyPeriod, fetchPriceChangeFrequency]);



  const _exportPriorityProducts = async () => {
    try {
      // Fetch all products in batches to avoid Supabase 1000 limit
      let allProducts: PriorityProductData[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      toast({
        title: "Exporting...",
        description: "Fetching all products that need price matching. This may take a moment.",
      });

      while (hasMore) {
        const response = await fetch('/api/insights/competitor-analysis/priority-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_filter: null,
            limit: batchSize,
            offset: offset,
            format: 'json' // Get JSON first to check if there are more
          })
        });

        if (!response.ok) throw new Error('Failed to fetch priority products');

        const result = await response.json();
        const batchProducts = result.data || [];

        allProducts = allProducts.concat(batchProducts);

        // Check if we got a full batch (indicating there might be more)
        hasMore = batchProducts.length === batchSize;
        offset += batchSize;

        // Safety check to prevent infinite loops
        if (offset > 50000) {
          console.warn('Reached safety limit of 50,000 products');
          break;
        }
      }

      // Convert to CSV
      if (allProducts.length === 0) {
        toast({
          title: "No Data",
          description: "No products found that need price matching",
        });
        return;
      }

      const headers = [
        'Product Name',
        'SKU',
        'Brand',
        'EAN',
        'Our Price',
        'Lowest Competitor Price',
        'Price Difference',
        'Price Difference %',
        'Competitor Count',
        'Competitor with lowest price'
      ];

      const csvContent = [
        headers.join(','),
        ...allProducts.map(product => [
          `"${product.product_name?.replace(/"/g, '""') || ''}"`,
          `"${product.product_sku || ''}"`,
          `"${product.product_brand?.replace(/"/g, '""') || ''}"`,
          `"${product.product_ean || ''}"`,
          product.our_price || '',
          product.lowest_competitor_price || '',
          product.price_difference || '',
          product.price_difference_percentage || '',
          product.competitor_count || '',
          `"${product.most_competitive_competitor_name?.replace(/"/g, '""') || ''}"`
        ].join(','))
      ].join('\n');

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `price-matching-list-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Exported ${formatNumber(allProducts.length)} products that need price matching`,
      });
    } catch (error) {
      console.error('Error exporting priority products:', error);
      toast({
        title: "Error",
        description: "Failed to export price matching list",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-500">
            <p className="text-lg font-medium">Loading competitor analysis...</p>
            <p className="mt-1">Analyzing price competitiveness and market positioning.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-red-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium">Error loading competitor analysis</p>
            <p className="mt-1">{error}</p>
            <Button onClick={fetchAllData} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Price Competitiveness Trend Chart */}
      <PriceCompetitivenessTrendChart
        competitors={competitors}
      />

      {/* Market Positioning Overview */}
      {_marketPositioningData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Market Positioning Overview
            </CardTitle>
            <CardDescription>
              Overall competitive position and market coverage. This shows how many of your products have competitor data and how competitive your pricing is overall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(_marketPositioningData.total_our_products)}
                </div>
                <div className="text-sm text-gray-600">Total Our Products</div>
                <div className="text-xs text-gray-500 mt-1">All products in your catalog</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(_marketPositioningData.market_coverage_percentage)}
                </div>
                <div className="text-sm text-gray-600">Market Coverage</div>
                <div className="text-xs text-gray-500 mt-1">Products with competitor data</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">
                  {formatPercentage(_marketPositioningData.competitive_percentage)}
                </div>
                <div className="text-sm text-gray-600">Competitive Products</div>
                <div className="text-xs text-gray-500 mt-1">Products priced at or below competitors</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {formatPercentage(_marketPositioningData.avg_price_premium_percentage)}
                </div>
                <div className="text-sm text-gray-600">Avg Price Premium</div>
                <div className="text-xs text-gray-500 mt-1">How much higher your prices are on average</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Most Competitive Against</div>
                <div className="font-semibold text-green-600">
                  {_marketPositioningData.most_competitive_against || 'N/A'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Competitor you price best against</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Least Competitive Against</div>
                <div className="font-semibold text-red-600">
                  {_marketPositioningData.least_competitive_against || 'N/A'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Competitor you need to improve against</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Price Competitiveness per Competitor */}
      {_priceCompetitivenessData && _priceCompetitivenessData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Price Competitiveness per Competitor
            </CardTitle>
            <CardDescription>
              Detailed breakdown of how your prices compare to each competitor. Shows exactly how many products you're cheaper, more expensive, or same price on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {_priceCompetitivenessData.map((competitor: PriceCompetitivenessData) => (
                <div key={competitor.competitor_id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">{competitor.competitor_name}</h4>
                    <span className="text-sm text-gray-500">
                      {formatNumber(competitor.total_matching_products)} products compared
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 bg-green-50 rounded">
                      <div className="text-lg font-bold text-green-600">
                        {formatNumber(competitor.our_products_cheaper)}
                      </div>
                      <div className="text-xs text-gray-600">We're Cheaper</div>
                    </div>
                    <div className="p-2 bg-red-50 rounded">
                      <div className="text-lg font-bold text-red-600">
                        {formatNumber(competitor.our_products_more_expensive)}
                      </div>
                      <div className="text-xs text-gray-600">We're More Expensive</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-600">
                        {formatNumber(competitor.our_products_same_price)}
                      </div>
                      <div className="text-xs text-gray-600">Same Price</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">
                        We are cheaper or same price on{' '}
                        <span className="font-semibold text-green-600">
                          {formatPercentage(
                            ((competitor.our_products_cheaper + competitor.our_products_same_price) /
                             competitor.total_matching_products) * 100
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-gray-600">
                        We are more expensive on{' '}
                        <span className="font-semibold text-red-600">
                          {formatPercentage(
                            (competitor.our_products_more_expensive /
                             competitor.total_matching_products) * 100
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t text-gray-500">
                      Market coverage: {formatPercentage(competitor.market_coverage_percentage)} of your products
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitor Pressure Analysis */}
      {_competitorPressureData && _competitorPressureData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Competitor Pressure Analysis
            </CardTitle>
            <CardDescription>
              Shows which competitors have the lowest prices on the most products. This identifies market leaders and pricing pressure points.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {_competitorPressureData.map((competitor: CompetitorPressureData) => (
                <div key={competitor.competitor_id || 'our-integration'} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{competitor.competitor_name}</h4>
                      {competitor.is_integration && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Our Integration
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`text-center p-3 rounded ${
                      competitor.is_integration
                        ? 'bg-green-50'
                        : 'bg-red-50'
                    }`}>
                      <div className={`text-xl font-bold ${
                        competitor.is_integration
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {formatNumber(competitor.products_where_lowest)}
                      </div>
                      <div className="text-sm text-gray-600">Products Where Lowest</div>
                      <div className="text-xs text-gray-500">Out of {formatNumber(competitor.total_products_tracked)} tracked</div>
                    </div>
                    <div className={`text-center p-3 rounded ${
                      competitor.is_integration
                        ? 'bg-emerald-50'
                        : 'bg-orange-50'
                    }`}>
                      <div className={`text-xl font-bold ${
                        competitor.is_integration
                          ? 'text-emerald-600'
                          : 'text-orange-600'
                      }`}>
                        {formatPercentage(competitor.lowest_price_percentage)}
                      </div>
                      <div className="text-sm text-gray-600">Market Pressure</div>
                      <div className="text-xs text-gray-500">Percentage of products {competitor.is_integration ? 'we' : 'they'} dominate</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Products for Repricing */}
      {_priorityProductsData && _priorityProductsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Priority Products for Repricing
            </CardTitle>
            <CardDescription>
              Products where you're significantly more expensive than competitors. These are your highest priority for price adjustments to stay competitive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Our Price</th>
                    <th className="text-right p-2">Lowest Competitor</th>
                    <th className="text-right p-2">Difference</th>
                    <th className="text-right p-2">% Higher</th>
                    <th className="text-left p-2">Competitor with lowest price</th>
                  </tr>
                </thead>
                <tbody>
                  {_priorityProductsData.slice(0, 10).map((product: PriorityProductData, index: number) => (
                    <tr key={`${product.product_id}-${index}`} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <div className="font-medium">
                          <a
                            href={`/app-routes/products/${product.product_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {product.product_name}
                          </a>
                        </div>
                        <div className="text-xs text-gray-500">{product.product_sku}</div>
                      </td>
                      <td className="text-right p-2 font-medium">
                        {formatNumber(product.our_price)} kr
                      </td>
                      <td className="text-right p-2 text-green-600">
                        {formatNumber(product.lowest_competitor_price)} kr
                      </td>
                      <td className="text-right p-2 text-red-600 font-medium">
                        +{formatNumber(product.price_difference)} kr
                      </td>
                      <td className="text-right p-2 text-red-600 font-medium">
                        +{formatPercentage(product.price_difference_percentage)}
                      </td>
                      <td className="p-2 text-sm">
                        {product.most_competitive_competitor_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {_priorityProductsData.length > 10 && (
              <div className="mt-4 text-center">
                <Button onClick={_exportPriorityProducts} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Complete Price Matching List
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Price Change Frequency */}
      {_priceChangeFrequencyData && _priceChangeFrequencyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Price Change Frequency Analysis
            </CardTitle>
            <CardDescription>
              How often competitors change their prices in the selected period. This helps you understand competitor pricing strategies and market dynamics.
            </CardDescription>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <label htmlFor="frequency-period" className="text-sm font-medium">
                  Period:
                </label>
                <Select
                  value={_priceChangeFrequencyPeriod}
                  onValueChange={_setPriceChangeFrequencyPeriod}
                  disabled={_priceChangeFrequencyLoading}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">1 Week</SelectItem>
                    <SelectItem value="14">2 Weeks</SelectItem>
                    <SelectItem value="30">1 Month</SelectItem>
                    <SelectItem value="90">3 Months</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="9999">All Time</SelectItem>
                  </SelectContent>
                </Select>
                {_priceChangeFrequencyLoading && (
                  <div className="text-sm text-gray-500">Loading...</div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {_priceChangeFrequencyData.map((competitor: PriceChangeFrequencyData) => (
                <div key={competitor.competitor_id || 'our-company'} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{competitor.competitor_name}</h4>
                      {competitor.is_integration && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Our Integration
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {competitor.most_active_day} is {competitor.is_integration ? 'our' : 'their'} most active day
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`text-center p-3 rounded ${
                      competitor.is_integration
                        ? 'bg-green-50'
                        : 'bg-blue-50'
                    }`}>
                      <div className={`text-xl font-bold ${
                        competitor.is_integration
                          ? 'text-green-600'
                          : 'text-blue-600'
                      }`}>
                        {formatNumber(competitor.total_price_changes)}
                      </div>
                      <div className="text-sm text-gray-600">Total Changes</div>
                      <div className="text-xs text-gray-500">Price modifications</div>
                    </div>
                    <div className={`text-center p-3 rounded ${
                      competitor.is_integration
                        ? 'bg-emerald-50'
                        : 'bg-purple-50'
                    }`}>
                      <div className={`text-xl font-bold ${
                        competitor.is_integration
                          ? 'text-emerald-600'
                          : 'text-purple-600'
                      }`}>
                        {formatNumber(competitor.avg_changes_per_product, 1)}
                      </div>
                      <div className="text-sm text-gray-600">Avg per Product</div>
                      <div className="text-xs text-gray-500">Changes per product</div>
                    </div>
                    <div className={`text-center p-3 rounded ${
                      competitor.is_integration
                        ? 'bg-teal-50'
                        : 'bg-indigo-50'
                    }`}>
                      <div className={`text-xl font-bold ${
                        competitor.is_integration
                          ? 'text-teal-600'
                          : 'text-indigo-600'
                      }`}>
                        {competitor.most_active_day}
                      </div>
                      <div className="text-sm text-gray-600">Most Active Day</div>
                      <div className="text-xs text-gray-500">Peak pricing activity</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CompetitorAnalysisTab;
