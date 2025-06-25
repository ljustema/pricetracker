"use client";

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Filter, Calendar, Building2 } from 'lucide-react';
import { BarChart, PieChart } from '@/components/charts';

interface StockAnalysisTabProps {
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
}

// Types for our enhanced analysis data
interface AnalysisFilters {
  competitorId: string;
  startDate: string;
  endDate: string;
  brandFilter: string;
  deadStockDays: number;
}

// Type definitions for analysis data
interface SalesAnalysisItem {
  product_name: string;
  brand: string;
  sku: string;
  total_sold: number;
  total_revenue: number;
  avg_daily_sales: number;
  avg_daily_revenue: number;
  revenue_percentage: number | null;
  [key: string]: string | number | null; // Index signature for chart compatibility
}

interface SalesAnalysisData {
  data: SalesAnalysisItem[];
  summary: {
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    avgDailySales: number;
    avgDailyRevenue: number;
  };
}

interface BrandPerformanceItem {
  brand: string;
  products_tracked: number;
  total_sold: number;
  total_revenue: number;
  avg_sales_per_product: number;
  revenue_percentage: number | null;
  avg_daily_sales: number;
  avg_daily_revenue: number;
}

interface BrandPerformanceData {
  data: BrandPerformanceItem[];
  summary: {
    totalBrands: number;
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    topBrand: string | null;
    topBrandRevenue: number;
  };
}

interface GenericAnalysisData {
  data: Array<Record<string, string | number>>;
  summary?: Record<string, string | number>;
}

export default function StockAnalysisTab({
  competitors,
  recentStockChanges: _recentStockChanges,
  stockStats: _stockStats
}: StockAnalysisTabProps) {
  // Enhanced state management
  const [activeModule, setActiveModule] = useState('sales');
  const [filters, setFilters] = useState<AnalysisFilters>({
    competitorId: 'all',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // today
    brandFilter: '',
    deadStockDays: 30
  });

  // Data states for each module
  const [salesData, setSalesData] = useState<SalesAnalysisData | null>(null);
  const [_brandData, setBrandData] = useState<BrandPerformanceData | null>(null);
  const [_currentStockData, setCurrentStockData] = useState<GenericAnalysisData | null>(null);
  const [_availabilityData, setAvailabilityData] = useState<GenericAnalysisData | null>(null);
  const [_turnoverData, setTurnoverData] = useState<GenericAnalysisData | null>(null);
  const [_priceRangeData, setPriceRangeData] = useState<GenericAnalysisData | null>(null);
  const [_summaryData, setSummaryData] = useState<GenericAnalysisData | null>(null);

  // Loading states
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Available brands for filtering
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Data fetching functions
  const fetchSalesAnalysis = useCallback(async () => {
    setLoading(prev => ({ ...prev, sales: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        start_date: filters.startDate,
        end_date: filters.endDate,
        ...(filters.brandFilter && { brand_filter: filters.brandFilter })
      });

      const response = await fetch(`/api/insights/stock-analysis/sales?${params}`);
      const data = await response.json();
      setSalesData(data);
    } catch (error) {
      console.error('Error fetching sales analysis:', error);
    } finally {
      setLoading(prev => ({ ...prev, sales: false }));
    }
  }, [filters]);

  const fetchBrandPerformance = useCallback(async () => {
    setLoading(prev => ({ ...prev, brands: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        start_date: filters.startDate,
        end_date: filters.endDate
      });

      const response = await fetch(`/api/insights/stock-analysis/brands?${params}`);
      const data = await response.json();
      setBrandData(data);
    } catch (error) {
      console.error('Error fetching brand performance:', error);
    } finally {
      setLoading(prev => ({ ...prev, brands: false }));
    }
  }, [filters]);

  const fetchCurrentStock = useCallback(async () => {
    setLoading(prev => ({ ...prev, currentStock: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        ...(filters.brandFilter && { brand_filter: filters.brandFilter })
      });

      const response = await fetch(`/api/insights/stock-analysis/current-stock?${params}`);
      const data = await response.json();
      setCurrentStockData(data);
    } catch (error) {
      console.error('Error fetching current stock:', error);
    } finally {
      setLoading(prev => ({ ...prev, currentStock: false }));
    }
  }, [filters]);

  const fetchAvailability = useCallback(async () => {
    setLoading(prev => ({ ...prev, availability: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId })
      });

      const response = await fetch(`/api/insights/stock-analysis/availability?${params}`);
      const data = await response.json();
      setAvailabilityData(data);
    } catch (error) {
      console.error('Error fetching availability data:', error);
    } finally {
      setLoading(prev => ({ ...prev, availability: false }));
    }
  }, [filters]);

  const fetchTurnover = useCallback(async () => {
    setLoading(prev => ({ ...prev, turnover: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        start_date: filters.startDate,
        end_date: filters.endDate,
        dead_stock_days: filters.deadStockDays.toString()
      });

      const response = await fetch(`/api/insights/stock-analysis/turnover?${params}`);
      const data = await response.json();
      setTurnoverData(data);
    } catch (error) {
      console.error('Error fetching turnover data:', error);
    } finally {
      setLoading(prev => ({ ...prev, turnover: false }));
    }
  }, [filters]);

  const fetchPriceRanges = useCallback(async () => {
    setLoading(prev => ({ ...prev, priceRanges: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        start_date: filters.startDate,
        end_date: filters.endDate
      });

      const response = await fetch(`/api/insights/stock-analysis/price-ranges?${params}`);
      const data = await response.json();
      setPriceRangeData(data);
    } catch (error) {
      console.error('Error fetching price range data:', error);
    } finally {
      setLoading(prev => ({ ...prev, priceRanges: false }));
    }
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    setLoading(prev => ({ ...prev, summary: true }));
    try {
      const params = new URLSearchParams({
        ...(filters.competitorId !== 'all' && { competitor_id: filters.competitorId }),
        start_date: filters.startDate,
        end_date: filters.endDate
      });

      const response = await fetch(`/api/insights/stock-analysis/summary?${params}`);
      const data = await response.json();
      setSummaryData(data);
      setAvailableBrands(data.brands || []);
    } catch (error) {
      console.error('Error fetching summary data:', error);
    } finally {
      setLoading(prev => ({ ...prev, summary: false }));
    }
  }, [filters]);

  // Effects for data fetching
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeModule === 'sales') {
      fetchSalesAnalysis();
    } else if (activeModule === 'brands') {
      fetchBrandPerformance();
    } else if (activeModule === 'currentStock') {
      fetchCurrentStock();
    } else if (activeModule === 'availability') {
      fetchAvailability();
    } else if (activeModule === 'turnover') {
      fetchTurnover();
    } else if (activeModule === 'priceRanges') {
      fetchPriceRanges();
    }
  }, [activeModule, filters, fetchSalesAnalysis, fetchBrandPerformance, fetchCurrentStock, fetchAvailability, fetchTurnover, fetchPriceRanges]);

  // Utility functions
  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(numValue);
  };

  const formatNumber = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('sv-SE').format(numValue);
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.0%';
    }
    return `${value.toFixed(1)}%`;
  };

  const handleFilterChange = (key: keyof AnalysisFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async (module: string, format: string = 'csv') => {
    try {
      const exportData = {
        competitor_id: filters.competitorId !== 'all' ? filters.competitorId : null,
        start_date: filters.startDate,
        end_date: filters.endDate,
        brand_filter: filters.brandFilter || null,
        dead_stock_days: filters.deadStockDays,
        format
      };

      const response = await fetch(`/api/insights/stock-analysis/${module}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      });

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${module}-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Analysis Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Competitor Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="h-4 w-4 inline mr-1" />
                Competitor
              </label>
              <select
                value={filters.competitorId}
                onChange={(e) => handleFilterChange('competitorId', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">All Competitors</option>
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Filter
              </label>
              <select
                value={filters.brandFilter}
                onChange={(e) => handleFilterChange('brandFilter', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">All Brands</option>
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Modules */}
      <Tabs value={activeModule} onValueChange={setActiveModule} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="sales">📈 Sales</TabsTrigger>
          <TabsTrigger value="brands">🏷️ Brands</TabsTrigger>
          <TabsTrigger value="currentStock">📦 Stock</TabsTrigger>
          <TabsTrigger value="availability">✅ Availability</TabsTrigger>
          <TabsTrigger value="turnover">⚡ Turnover</TabsTrigger>
          <TabsTrigger value="priceRanges">💰 Price Ranges</TabsTrigger>
          <TabsTrigger value="summary">📊 Summary</TabsTrigger>
        </TabsList>
        {/* Sales Analysis Module */}
        <TabsContent value="sales">
          <div className="space-y-6">
            {/* Summary Cards */}
            {salesData?.summary && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-medium">📦</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Products
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(salesData.summary.totalProducts)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-medium">📈</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Sales
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(salesData.summary.totalSales)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-medium">💰</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Revenue
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatCurrency(salesData.summary.totalRevenue)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-medium">📊</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Daily Sales
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(salesData.summary.avgDailySales)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm font-medium">�</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Daily Revenue
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatCurrency(salesData.summary.avgDailyRevenue)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts and Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products Bar Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Top 10 Products by Sales</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('sales', 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {salesData?.data && (
                    <BarChart
                      data={salesData.data.slice(0, 10).map(item => ({
                        product_name: item.product_name,
                        brand: item.brand,
                        sku: item.sku,
                        total_sold: item.total_sold,
                        total_revenue: item.total_revenue,
                        avg_daily_sales: item.avg_daily_sales,
                        avg_daily_revenue: item.avg_daily_revenue,
                        revenue_percentage: item.revenue_percentage || 0
                      }))}
                      xKey="product_name"
                      yKey="total_sold"
                      height={300}
                      formatValue={formatNumber}
                      formatLabel={(label) => {
                        const strLabel = String(label);
                        return strLabel.length > 20 ? strLabel.substring(0, 20) + '...' : strLabel;
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Revenue Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Distribution (Top 10)</CardTitle>
                </CardHeader>
                <CardContent>
                  {salesData?.data && (
                    <PieChart
                      data={salesData.data.slice(0, 10).map(item => ({
                        name: item.product_name.length > 15 ? item.product_name.substring(0, 15) + '...' : item.product_name,
                        value: item.total_revenue,
                        percentage: item.revenue_percentage || 0
                      }))}
                      dataKey="value"
                      nameKey="name"
                      height={300}
                      formatValue={formatCurrency}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Sales Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {loading.sales ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : salesData?.data ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Brand
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Sold
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Revenue
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Revenue %
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Avg Daily Sales
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesData.data.slice(0, 20).map((item: SalesAnalysisItem, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.product_name}
                              </div>
                              {item.sku && (
                                <div className="text-sm text-gray-500">
                                  SKU: {item.sku}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.brand}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(item.total_sold)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(item.total_revenue)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatPercentage(item.revenue_percentage)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(item.avg_daily_sales)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No sales data available for the selected period.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Placeholder tabs for other modules - to be implemented */}
        <TabsContent value="brands">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Brand Performance Analysis</h3>
                <p className="text-gray-500">Coming soon - Brand-level sales and revenue analysis</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currentStock">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Current Stock Analysis</h3>
                <p className="text-gray-500">Coming soon - Current inventory levels and values</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Brand Stock Availability</h3>
                <p className="text-gray-500">Coming soon - Stock availability by brand</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="turnover">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Stock Turnover Analysis</h3>
                <p className="text-gray-500">Coming soon - Turnover ratios and dead stock detection</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="priceRanges">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Price Range Analysis</h3>
                <p className="text-gray-500">Coming soon - Sales distribution by price segments</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Comprehensive Summary</h3>
                <p className="text-gray-500">Coming soon - Overall analysis summary</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
