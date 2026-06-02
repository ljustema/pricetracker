"use client";

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Filter, Calendar, Building2, ChevronUp, ChevronDown, Package, TrendingUp, DollarSign, Trophy, BarChart3, Archive, CheckCircle, Zap, Target } from 'lucide-react';
import { BarChart, PieChart, DonutChart } from '@/components/charts';
import Link from 'next/link';
import BrandProductsModal from '@/components/insights/BrandProductsModal';
import BrandStockModal from '@/components/insights/BrandStockModal';

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
  product_id: string;
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

interface CurrentStockItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  current_stock: number;
  current_price: number | null;
  inventory_value: number | null;
  in_stock_flag: number;
}

interface CurrentStockData {
  data: CurrentStockItem[];
  summary: {
    totalProducts: number;
    productsInStock: number;
    productsOutOfStock: number;
    inStockPercentage: number;
    outOfStockPercentage: number;
    totalInventoryValue: number;
    avgStockLevel: number;
  };
}

interface BrandAvailabilityItem {
  brand: string;
  total_products: number;
  in_stock_products: number;
  out_of_stock_products: number;
  in_stock_percentage: number;
  out_of_stock_percentage: number;
}

interface BrandAvailabilityData {
  data: BrandAvailabilityItem[];
  summary: {
    totalBrands: number;
    totalProducts: number;
    overallInStockPercentage: number;
    overallOutOfStockPercentage: number;
    bestPerformingBrand: string | null;
    worstPerformingBrand: string | null;
  };
}

interface TurnoverAnalysisItem {
  product_id: string;
  product_name: string;
  brand: string;
  sku: string;
  total_sales: number;
  avg_stock_level: number;
  current_stock: number;
  stock_turnover_ratio: number;
  stock_status: string;
  days_since_last_sale: number;
  velocity_category: string;
}

interface TurnoverAnalysisData {
  data: TurnoverAnalysisItem[];
  summary: {
    totalProducts: number;
    avgTurnoverRatio: number;
    deadStockCount: number;
    deadStockPercentage: number;
    fastMovers: number;
    mediumMovers: number;
    slowMovers: number;
    highestTurnoverProduct: string | null;
    lowestTurnoverProduct: string | null;
  };
}

interface PriceRangeItem {
  price_range: string;
  unique_products: number;
  total_units_sold: number;
  total_revenue: number;
  avg_price_in_range: number;
  revenue_percentage: number;
}

interface PriceRangeData {
  data: PriceRangeItem[];
  summary: {
    totalRanges: number;
    totalProducts: number;
    totalUnits: number;
    totalRevenue: number;
    avgPriceOverall: number;
    mostPopularRange: string | null;
    highestRevenueRange: string | null;
  };
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
    startDate: (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      return `${year}-${month}-01`;
    })(), // 1st of current month
    endDate: new Date().toISOString().split('T')[0], // today
    brandFilter: '',
    deadStockDays: 30
  });

  // Data states for each module
  const [salesData, setSalesData] = useState<SalesAnalysisData | null>(null);
  const [brandData, setBrandData] = useState<BrandPerformanceData | null>(null);
  const [currentStockData, setCurrentStockData] = useState<CurrentStockData | null>(null);
  const [availabilityData, setAvailabilityData] = useState<BrandAvailabilityData | null>(null);
  const [turnoverData, setTurnoverData] = useState<TurnoverAnalysisData | null>(null);
  const [priceRangeData, setPriceRangeData] = useState<PriceRangeData | null>(null);


  // Loading states
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Available brands for filtering (computed from brand data)
  const availableBrands = brandData?.data?.map(brand => brand.brand) || [];

  // Brand products modal state
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // Brand stock modal state
  const [selectedStockBrand, setSelectedStockBrand] = useState<string | null>(null);
  const [isBrandStockModalOpen, setIsBrandStockModalOpen] = useState(false);

  // Sorting state for sales table
  const [sortConfig, setSortConfig] = useState<{
    key: keyof SalesAnalysisItem | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Sorting state for brand table
  const [brandSortConfig, setBrandSortConfig] = useState<{
    key: keyof BrandPerformanceItem | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Sorting state for current stock table
  const [stockSortConfig, setStockSortConfig] = useState<{
    key: keyof CurrentStockItem | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Sorting state for availability table
  const [availabilitySortConfig, setAvailabilitySortConfig] = useState<{
    key: keyof BrandAvailabilityItem | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Sorting state for turnover table
  const [turnoverSortConfig, setTurnoverSortConfig] = useState<{
    key: keyof TurnoverAnalysisItem | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Sorting state for price range table
  const [priceRangeSortConfig, setPriceRangeSortConfig] = useState<{
    key: keyof PriceRangeItem | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Sorting function
  const handleSort = (key: keyof SalesAnalysisItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Brand sorting function
  const handleBrandSort = (key: keyof BrandPerformanceItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (brandSortConfig.key === key && brandSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setBrandSortConfig({ key, direction });
  };

  // Current stock sorting function
  const handleStockSort = (key: keyof CurrentStockItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (stockSortConfig.key === key && stockSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setStockSortConfig({ key, direction });
  };

  // Availability sorting function
  const handleAvailabilitySort = (key: keyof BrandAvailabilityItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (availabilitySortConfig.key === key && availabilitySortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setAvailabilitySortConfig({ key, direction });
  };

  // Turnover sorting function
  const handleTurnoverSort = (key: keyof TurnoverAnalysisItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (turnoverSortConfig.key === key && turnoverSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setTurnoverSortConfig({ key, direction });
  };

  // Price range sorting function
  const handlePriceRangeSort = (key: keyof PriceRangeItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (priceRangeSortConfig.key === key && priceRangeSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setPriceRangeSortConfig({ key, direction });
  };

  // Get sorted sales data
  const getSortedSalesData = () => {
    if (!salesData?.data || !sortConfig.key) {
      return salesData?.data || [];
    }

    return [...salesData.data].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Get sorted brand data
  const getSortedBrandData = () => {
    if (!brandData?.data || !brandSortConfig.key) {
      return brandData?.data || [];
    }

    return [...brandData.data].sort((a, b) => {
      const aValue = a[brandSortConfig.key!];
      const bValue = b[brandSortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return brandSortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return brandSortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Get sorted current stock data
  const getSortedStockData = () => {
    if (!currentStockData?.data || !stockSortConfig.key) {
      return currentStockData?.data || [];
    }

    return [...currentStockData.data].sort((a, b) => {
      const aValue = a[stockSortConfig.key!];
      const bValue = b[stockSortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return stockSortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return stockSortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Get sorted availability data
  const getSortedAvailabilityData = () => {
    if (!availabilityData?.data || !availabilitySortConfig.key) {
      return availabilityData?.data || [];
    }

    return [...availabilityData.data].sort((a, b) => {
      const aValue = a[availabilitySortConfig.key!];
      const bValue = b[availabilitySortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return availabilitySortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return availabilitySortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Get sorted turnover data
  const getSortedTurnoverData = () => {
    if (!turnoverData?.data || !turnoverSortConfig.key) {
      return turnoverData?.data || [];
    }

    return [...turnoverData.data].sort((a, b) => {
      const aValue = a[turnoverSortConfig.key!];
      const bValue = b[turnoverSortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return turnoverSortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return turnoverSortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Get sorted price range data
  const getSortedPriceRangeData = () => {
    if (!priceRangeData?.data || !priceRangeSortConfig.key) {
      return priceRangeData?.data || [];
    }

    return [...priceRangeData.data].sort((a, b) => {
      const aValue = a[priceRangeSortConfig.key!];
      const bValue = b[priceRangeSortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return priceRangeSortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return priceRangeSortConfig.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Sortable header component
  const SortableHeader = ({
    sortKey,
    children,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  }: {
    sortKey: keyof SalesAnalysisItem;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`${className} cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.key === sortKey && (
          sortConfig.direction === 'asc' ?
            <ChevronUp className="h-3 w-3" /> :
            <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  // Sortable header component for brands
  const BrandSortableHeader = ({
    sortKey,
    children,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  }: {
    sortKey: keyof BrandPerformanceItem;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`${className} cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handleBrandSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {brandSortConfig.key === sortKey && (
          brandSortConfig.direction === 'asc' ?
            <ChevronUp className="h-3 w-3" /> :
            <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  // Sortable header component for current stock
  const StockSortableHeader = ({
    sortKey,
    children,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  }: {
    sortKey: keyof CurrentStockItem;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`${className} cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handleStockSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {stockSortConfig.key === sortKey && (
          stockSortConfig.direction === 'asc' ?
            <ChevronUp className="h-3 w-3" /> :
            <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  // Sortable header component for availability
  const AvailabilitySortableHeader = ({
    sortKey,
    children,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  }: {
    sortKey: keyof BrandAvailabilityItem;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`${className} cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handleAvailabilitySort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {availabilitySortConfig.key === sortKey && (
          availabilitySortConfig.direction === 'asc' ?
            <ChevronUp className="h-3 w-3" /> :
            <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  // Sortable header component for turnover
  const TurnoverSortableHeader = ({
    sortKey,
    children,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  }: {
    sortKey: keyof TurnoverAnalysisItem;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`${className} cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handleTurnoverSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {turnoverSortConfig.key === sortKey && (
          turnoverSortConfig.direction === 'asc' ?
            <ChevronUp className="h-3 w-3" /> :
            <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  // Sortable header component for price range
  const PriceRangeSortableHeader = ({
    sortKey,
    children,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  }: {
    sortKey: keyof PriceRangeItem;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`${className} cursor-pointer hover:bg-gray-100 select-none`}
      onClick={() => handlePriceRangeSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {priceRangeSortConfig.key === sortKey && (
          priceRangeSortConfig.direction === 'asc' ?
            <ChevronUp className="h-3 w-3" /> :
            <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

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



  // Effects for data fetching


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

  const handleBrandClick = (brandName: string) => {
    setSelectedBrand(brandName);
    setIsBrandModalOpen(true);
  };

  const handleCloseBrandModal = () => {
    setIsBrandModalOpen(false);
    setSelectedBrand(null);
  };

  const handleStockBrandClick = (brandName: string) => {
    setSelectedStockBrand(brandName);
    setIsBrandStockModalOpen(true);
  };

  const handleCloseStockBrandModal = () => {
    setIsBrandStockModalOpen(false);
    setSelectedStockBrand(null);
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5"
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5"
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5"
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5"
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="sales">
            <BarChart3 className="h-4 w-4 mr-2" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="brands">
            <Building2 className="h-4 w-4 mr-2" />
            Brands
          </TabsTrigger>
          <TabsTrigger value="currentStock">
            <Archive className="h-4 w-4 mr-2" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="availability">
            <CheckCircle className="h-4 w-4 mr-2" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="turnover">
            <Zap className="h-4 w-4 mr-2" />
            Turnover
          </TabsTrigger>
          <TabsTrigger value="priceRanges">
            <Target className="h-4 w-4 mr-2" />
            Price Ranges
          </TabsTrigger>
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
                          <Package className="h-4 w-4 text-white" />
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
                          <DollarSign className="h-4 w-4 text-white" />
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
                          <TrendingUp className="h-4 w-4 text-white" />
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
                        product_id: item.product_id,
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
                      height={400}
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
                      data={[...salesData.data]
                        .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
                        .slice(0, 10)
                        .map(item => ({
                          name: item.product_name.length > 15 ? item.product_name.substring(0, 15) + '...' : item.product_name,
                          value: item.total_revenue,
                          percentage: item.revenue_percentage || 0
                        }))}
                      dataKey="value"
                      nameKey="name"
                      height={400}
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
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <SortableHeader sortKey="product_name">
                            Product
                          </SortableHeader>
                          <SortableHeader sortKey="brand">
                            Brand
                          </SortableHeader>
                          <SortableHeader sortKey="total_sold">
                            Total Sold
                          </SortableHeader>
                          <SortableHeader sortKey="total_revenue">
                            Total Revenue
                          </SortableHeader>
                          <SortableHeader sortKey="revenue_percentage">
                            Revenue %
                          </SortableHeader>
                          <SortableHeader sortKey="avg_daily_sales">
                            Avg Daily Sales
                          </SortableHeader>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedSalesData().slice(0, 100).map((item: SalesAnalysisItem, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium">
                                <Link
                                  href={`/app-routes/products/${item.product_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                >
                                  {item.product_name}
                                </Link>
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

        {/* Brand Performance Analysis Module */}
        <TabsContent value="brands">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Building2 className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Brands with Sales</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {loading.brands ? '...' : (brandData?.summary?.totalBrands || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Products Sold</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {loading.brands ? '...' : (brandData?.summary?.totalProducts || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Sales</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {loading.brands ? '...' : (brandData?.summary?.totalSales || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {loading.brands ? '...' : `${(brandData?.summary?.totalRevenue || 0).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Top Brand</p>
                      <p className="text-lg font-bold text-gray-900 truncate">
                        {loading.brands ? '...' : (brandData?.summary?.topBrand || 'N/A')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales by Brand Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 15 Brands by Sales Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading.brands ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : brandData?.data && brandData.data.length > 0 ? (
                    <BarChart
                      data={brandData.data
                        .sort((a, b) => b.total_sold - a.total_sold)
                        .slice(0, 15)
                        .map(item => ({
                          name: item.brand,
                          value: item.total_sold,
                          label: `${item.brand}: ${item.total_sold} units`
                        }))}
                      xKey="name"
                      yKey="value"
                      height={300}
                      color="#3B82F6"
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No brand sales data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Distribution Pie Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Revenue Distribution by Brand</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('brands', 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading.brands ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : brandData?.data && brandData.data.length > 0 ? (
                    <PieChart
                      data={brandData.data
                        .sort((a, b) => (b.revenue_percentage || 0) - (a.revenue_percentage || 0))
                        .slice(0, 10)
                        .map(item => ({
                          name: item.brand,
                          value: item.revenue_percentage || 0,
                          label: `${item.brand}: ${(item.revenue_percentage || 0).toFixed(1)}%`
                        }))}
                      dataKey="value"
                      nameKey="name"
                      height={300}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No brand revenue data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Brand Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Brand Performance Details</CardTitle>
              </CardHeader>
              <CardContent>
                {loading.brands ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading brand data...</p>
                  </div>
                ) : brandData?.data && brandData.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <BrandSortableHeader sortKey="brand">Brand</BrandSortableHeader>
                          <BrandSortableHeader sortKey="products_tracked">Products</BrandSortableHeader>
                          <BrandSortableHeader sortKey="total_sold">Total Sold</BrandSortableHeader>
                          <BrandSortableHeader sortKey="total_revenue">Total Revenue</BrandSortableHeader>
                          <BrandSortableHeader sortKey="revenue_percentage">Revenue %</BrandSortableHeader>
                          <BrandSortableHeader sortKey="avg_daily_sales">Avg Daily Sales</BrandSortableHeader>
                          <BrandSortableHeader sortKey="avg_daily_revenue">Avg Daily Revenue</BrandSortableHeader>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedBrandData().map((brand, index) => (
                          <tr key={brand.brand} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleBrandClick(brand.brand)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {brand.brand}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{brand.products_tracked}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">{brand.total_sold}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">
                                {brand.total_revenue.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {(brand.revenue_percentage || 0).toFixed(1)}%
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {brand.avg_daily_sales.toFixed(1)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {brand.avg_daily_revenue.toFixed(2)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No brand data available for the selected period.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="currentStock">
          <div className="space-y-6">
            {/* Summary Cards */}
            {currentStockData?.summary && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <Package className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Products
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(currentStockData.summary.totalProducts)}
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
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            In Stock
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(currentStockData.summary.productsInStock)}
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
                          <DollarSign className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Inventory Value
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatCurrency(currentStockData.summary.totalInventoryValue)}
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
                          <TrendingUp className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Stock Level
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(currentStockData.summary.avgStockLevel)}
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
              {/* Top Products by Stock Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Products by Stock Level</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentStockData?.data && (
                    <BarChart
                      data={currentStockData.data
                        .sort((a, b) => b.current_stock - a.current_stock)
                        .slice(0, 10)
                        .map(item => ({
                          product_id: item.product_id,
                          product_name: item.product_name,
                          brand: item.brand,
                          sku: item.sku,
                          current_stock: item.current_stock,
                          current_price: item.current_price || 0,
                          inventory_value: item.inventory_value || 0,
                          in_stock_flag: item.in_stock_flag
                        }))}
                      xKey="product_name"
                      yKey="current_stock"
                      height={320}
                      formatValue={formatNumber}
                      formatLabel={(label) => {
                        const strLabel = String(label);
                        return strLabel.length > 15 ? strLabel.substring(0, 15) + '...' : strLabel;
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Stock Availability Donut Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Stock Availability Distribution</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('current-stock', 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {currentStockData?.summary && (
                    <DonutChart
                      data={[
                        {
                          name: 'In Stock',
                          value: currentStockData.summary.productsInStock,
                          percentage: currentStockData.summary.inStockPercentage
                        },
                        {
                          name: 'Out of Stock',
                          value: currentStockData.summary.productsOutOfStock,
                          percentage: currentStockData.summary.outOfStockPercentage
                        }
                      ]}
                      dataKey="value"
                      nameKey="name"
                      height={320}
                      outerRadius={120}
                      innerRadius={60}
                      colors={['#10B981', '#EF4444']}
                      formatValue={formatNumber}
                      centerText={`${formatPercentage(currentStockData.summary.inStockPercentage)}`}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Current Stock Table */}
            <Card>
              <CardHeader>
                <CardTitle>Current Stock Details</CardTitle>
              </CardHeader>
              <CardContent>
                {loading.currentStock ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : currentStockData?.data ? (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <StockSortableHeader sortKey="product_name">
                            Product
                          </StockSortableHeader>
                          <StockSortableHeader sortKey="brand">
                            Brand
                          </StockSortableHeader>
                          <StockSortableHeader sortKey="current_stock">
                            Current Stock
                          </StockSortableHeader>
                          <StockSortableHeader sortKey="current_price">
                            Current Price
                          </StockSortableHeader>
                          <StockSortableHeader sortKey="inventory_value">
                            Inventory Value
                          </StockSortableHeader>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedStockData().slice(0, 100).map((item: CurrentStockItem, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium">
                                <Link
                                  href={`/app-routes/products/${item.product_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                >
                                  {item.product_name}
                                </Link>
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
                              <span className="font-bold">
                                {formatNumber(item.current_stock)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.current_price ? formatCurrency(item.current_price) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.inventory_value ? formatCurrency(item.inventory_value) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                item.in_stock_flag > 0
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {item.in_stock_flag > 0 ? 'In Stock' : 'Out of Stock'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No current stock data available.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="availability">
          <div className="space-y-6">
            {/* Summary Cards */}
            {availabilityData?.summary && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Brands
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(availabilityData.summary.totalBrands)}
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
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Overall In Stock
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatPercentage(availabilityData.summary.overallInStockPercentage)}
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
                          <Trophy className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Best Brand
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {availabilityData.summary.bestPerformingBrand || 'N/A'}
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
                          <Package className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Products
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(availabilityData.summary.totalProducts)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Availability Percentage Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Brand Availability Percentage</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading.availability ? (
                    <div className="h-96 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : availabilityData?.data && availabilityData.data.length > 0 ? (
                    <BarChart
                      data={availabilityData.data
                        .sort((a, b) => b.in_stock_percentage - a.in_stock_percentage)
                        .slice(0, 15)
                        .map(item => ({
                          name: item.brand,
                          value: item.in_stock_percentage,
                          label: `${item.brand}: ${item.in_stock_percentage.toFixed(1)}%`
                        }))}
                      xKey="name"
                      yKey="value"
                      height={400}
                      color="#10B981"
                      formatValue={(value) => `${value}%`}
                      formatLabel={(label) => {
                        const strLabel = String(label);
                        return strLabel.length > 12 ? strLabel.substring(0, 12) + '...' : strLabel;
                      }}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No availability data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stacked Bar Chart for In Stock vs Out of Stock */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Stock Status Distribution</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('availability', 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading.availability ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : availabilityData?.data && availabilityData.data.length > 0 ? (
                    <div className="space-y-4">
                      {availabilityData.data
                        .sort((a, b) => b.in_stock_percentage - a.in_stock_percentage)
                        .slice(0, 10)
                        .map((brand, _index) => (
                          <div key={brand.brand} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{brand.brand}</span>
                              <span className="text-gray-500">
                                {brand.in_stock_products}/{brand.total_products} in stock
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                              <div className="flex h-4 rounded-full overflow-hidden">
                                <div
                                  className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                                  style={{ width: `${brand.in_stock_percentage}%` }}
                                >
                                  {brand.in_stock_percentage > 15 && `${brand.in_stock_percentage.toFixed(0)}%`}
                                </div>
                                <div
                                  className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                                  style={{ width: `${brand.out_of_stock_percentage}%` }}
                                >
                                  {brand.out_of_stock_percentage > 15 && `${brand.out_of_stock_percentage.toFixed(0)}%`}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No availability data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Availability Table */}
            <Card>
              <CardHeader>
                <CardTitle>Brand Availability Details</CardTitle>
              </CardHeader>
              <CardContent>
                {loading.availability ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : availabilityData?.data ? (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <AvailabilitySortableHeader sortKey="brand">
                            Brand
                          </AvailabilitySortableHeader>
                          <AvailabilitySortableHeader sortKey="total_products">
                            Total Products
                          </AvailabilitySortableHeader>
                          <AvailabilitySortableHeader sortKey="in_stock_products">
                            In Stock
                          </AvailabilitySortableHeader>
                          <AvailabilitySortableHeader sortKey="out_of_stock_products">
                            Out of Stock
                          </AvailabilitySortableHeader>
                          <AvailabilitySortableHeader sortKey="in_stock_percentage">
                            In Stock %
                          </AvailabilitySortableHeader>
                          <AvailabilitySortableHeader sortKey="out_of_stock_percentage">
                            Out of Stock %
                          </AvailabilitySortableHeader>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedAvailabilityData().map((item: BrandAvailabilityItem, index: number) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleStockBrandClick(item.brand)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {item.brand}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold">
                                {formatNumber(item.total_products)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold text-green-600">
                                {formatNumber(item.in_stock_products)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold text-red-600">
                                {formatNumber(item.out_of_stock_products)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatPercentage(item.in_stock_percentage)}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                    <div
                                      className="bg-green-500 h-2 rounded-full"
                                      style={{ width: `${item.in_stock_percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatPercentage(item.out_of_stock_percentage)}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                    <div
                                      className="bg-red-500 h-2 rounded-full"
                                      style={{ width: `${item.out_of_stock_percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No availability data available.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="turnover">
          <div className="space-y-6">
            {/* Summary Cards */}
            {turnoverData?.summary && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <Zap className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Turnover Ratio
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {turnoverData.summary.avgTurnoverRatio.toFixed(2)}
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
                        <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                          <Archive className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Dead Stock
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(turnoverData.summary.deadStockCount)} ({formatPercentage(turnoverData.summary.deadStockPercentage)})
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
                          <TrendingUp className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Fast Movers
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(turnoverData.summary.fastMovers)}
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
                          <Package className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Medium Movers
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(turnoverData.summary.mediumMovers)}
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
                          <Target className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Slow Movers
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(turnoverData.summary.slowMovers)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Turnover Ratio Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 15 Products by Turnover Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading.turnover ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : turnoverData?.data && turnoverData.data.length > 0 ? (
                    <BarChart
                      data={turnoverData.data
                        .sort((a, b) => b.stock_turnover_ratio - a.stock_turnover_ratio)
                        .slice(0, 15)
                        .map(item => ({
                          name: item.product_name,
                          value: item.stock_turnover_ratio,
                          label: `${item.product_name}: ${item.stock_turnover_ratio.toFixed(2)}`
                        }))}
                      xKey="name"
                      yKey="value"
                      height={300}
                      color="#3B82F6"
                      formatValue={(value) => typeof value === 'number' ? value.toFixed(2) : String(value)}
                      formatLabel={(label) => {
                        const strLabel = String(label);
                        return strLabel.length > 15 ? strLabel.substring(0, 15) + '...' : strLabel;
                      }}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No turnover data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Velocity Distribution Pie Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Velocity Category Distribution</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('turnover', 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading.turnover ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : turnoverData?.summary ? (
                    <PieChart
                      data={[
                        {
                          name: 'Fast Movers',
                          value: turnoverData.summary.fastMovers,
                          percentage: (turnoverData.summary.fastMovers / turnoverData.summary.totalProducts) * 100
                        },
                        {
                          name: 'Medium Movers',
                          value: turnoverData.summary.mediumMovers,
                          percentage: (turnoverData.summary.mediumMovers / turnoverData.summary.totalProducts) * 100
                        },
                        {
                          name: 'Slow Movers',
                          value: turnoverData.summary.slowMovers,
                          percentage: (turnoverData.summary.slowMovers / turnoverData.summary.totalProducts) * 100
                        }
                      ]}
                      dataKey="value"
                      nameKey="name"
                      height={300}
                      colors={['#10B981', '#F59E0B', '#EF4444']}
                      formatValue={formatNumber}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No velocity data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Dead Stock Alert Table */}
            {turnoverData?.data && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-red-500" />
                    Dead Stock Alert ({turnoverData.data.filter(item => item.stock_status === 'Dead Stock').length} items)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {turnoverData.data.filter(item => item.stock_status === 'Dead Stock').length > 0 ? (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-red-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                              Product
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                              Brand
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                              Current Stock
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                              Days Since Last Sale
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                              Turnover Ratio
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {turnoverData.data
                            .filter(item => item.stock_status === 'Dead Stock')
                            .sort((a, b) => b.days_since_last_sale - a.days_since_last_sale)
                            .slice(0, 50)
                            .map((item: TurnoverAnalysisItem, index: number) => (
                              <tr key={index} className="bg-red-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium">
                                    <Link
                                      href={`/app-routes/products/${item.product_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-red-600 hover:text-red-900 hover:underline"
                                    >
                                      {item.product_name}
                                    </Link>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.brand}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className="font-bold text-red-600">
                                    {formatNumber(item.current_stock)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className="font-bold text-red-600">
                                    {formatNumber(item.days_since_last_sale)} days
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.stock_turnover_ratio.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-green-600">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                      <p className="font-medium">No dead stock detected!</p>
                      <p className="text-sm text-gray-500">All products have recent sales activity.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Detailed Turnover Table */}
            <Card>
              <CardHeader>
                <CardTitle>Turnover Analysis Details</CardTitle>
              </CardHeader>
              <CardContent>
                {loading.turnover ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : turnoverData?.data ? (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <TurnoverSortableHeader sortKey="product_name">
                            Product
                          </TurnoverSortableHeader>
                          <TurnoverSortableHeader sortKey="brand">
                            Brand
                          </TurnoverSortableHeader>
                          <TurnoverSortableHeader sortKey="stock_turnover_ratio">
                            Turnover Ratio
                          </TurnoverSortableHeader>
                          <TurnoverSortableHeader sortKey="velocity_category">
                            Velocity
                          </TurnoverSortableHeader>
                          <TurnoverSortableHeader sortKey="current_stock">
                            Current Stock
                          </TurnoverSortableHeader>
                          <TurnoverSortableHeader sortKey="total_sales">
                            Total Sales
                          </TurnoverSortableHeader>
                          <TurnoverSortableHeader sortKey="days_since_last_sale">
                            Days Since Sale
                          </TurnoverSortableHeader>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedTurnoverData().slice(0, 100).map((item: TurnoverAnalysisItem, index: number) => (
                          <tr key={index} className={item.stock_status === 'Dead Stock' ? 'bg-red-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium">
                                <Link
                                  href={`/app-routes/products/${item.product_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                >
                                  {item.product_name}
                                </Link>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.brand}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold">
                                {item.stock_turnover_ratio.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                item.velocity_category === 'Fast Mover'
                                  ? 'bg-green-100 text-green-800'
                                  : item.velocity_category === 'Medium Mover'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {item.velocity_category}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(item.current_stock)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(item.total_sales)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className={item.stock_status === 'Dead Stock' ? 'font-bold text-red-600' : ''}>
                                {formatNumber(item.days_since_last_sale)} days
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No turnover data available.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="priceRanges">
          <div className="space-y-6">
            {/* Summary Cards */}
            {priceRangeData?.summary && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <Target className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Price Ranges
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatNumber(priceRangeData.summary.totalRanges)}
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
                          <DollarSign className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Price
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatCurrency(priceRangeData.summary.avgPriceOverall)}
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
                          <Trophy className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Top Revenue Range
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {priceRangeData.summary.highestRevenueRange || 'N/A'}
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
                          <Package className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Most Popular Range
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {priceRangeData.summary.mostPopularRange || 'N/A'}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Distribution Histogram */}
              <Card>
                <CardHeader>
                  <CardTitle>Sales Distribution by Price Range</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading.priceRanges ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : priceRangeData?.data && priceRangeData.data.length > 0 ? (
                    <BarChart
                      data={priceRangeData.data
                        .sort((a, b) => {
                          // Custom sort for price ranges
                          const rangeOrder = ['1-500', '501-1000', '1001-1500', '1501-2000', '2001-3000', '3000+'];
                          return rangeOrder.indexOf(a.price_range) - rangeOrder.indexOf(b.price_range);
                        })
                        .map(item => ({
                          name: item.price_range,
                          value: item.total_units_sold,
                          label: `${item.price_range}: ${item.total_units_sold} units`
                        }))}
                      xKey="name"
                      yKey="value"
                      height={300}
                      color="#3B82F6"
                      formatValue={formatNumber}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No price range data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Distribution Pie Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Revenue Distribution by Price Range</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('price-ranges', 'csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading.priceRanges ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading chart...</p>
                      </div>
                    </div>
                  ) : priceRangeData?.data && priceRangeData.data.length > 0 ? (
                    <PieChart
                      data={priceRangeData.data
                        .sort((a, b) => b.revenue_percentage - a.revenue_percentage)
                        .map(item => ({
                          name: item.price_range,
                          value: item.revenue_percentage,
                          label: `${item.price_range}: ${item.revenue_percentage.toFixed(1)}%`
                        }))}
                      dataKey="value"
                      nameKey="name"
                      height={300}
                      formatValue={(value) => `${value}%`}
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <p>No price range data available for the selected period.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Price Range Table */}
            <Card>
              <CardHeader>
                <CardTitle>Price Range Analysis Details</CardTitle>
              </CardHeader>
              <CardContent>
                {loading.priceRanges ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : priceRangeData?.data ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <PriceRangeSortableHeader sortKey="price_range">
                            Price Range
                          </PriceRangeSortableHeader>
                          <PriceRangeSortableHeader sortKey="unique_products">
                            Products
                          </PriceRangeSortableHeader>
                          <PriceRangeSortableHeader sortKey="total_units_sold">
                            Units Sold
                          </PriceRangeSortableHeader>
                          <PriceRangeSortableHeader sortKey="total_revenue">
                            Total Revenue
                          </PriceRangeSortableHeader>
                          <PriceRangeSortableHeader sortKey="revenue_percentage">
                            Revenue %
                          </PriceRangeSortableHeader>
                          <PriceRangeSortableHeader sortKey="avg_price_in_range">
                            Avg Price
                          </PriceRangeSortableHeader>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getSortedPriceRangeData().map((item: PriceRangeItem, index: number) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.price_range}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold">
                                {formatNumber(item.unique_products)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold text-blue-600">
                                {formatNumber(item.total_units_sold)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="font-bold text-green-600">
                                {formatCurrency(item.total_revenue)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatPercentage(item.revenue_percentage)}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                    <div
                                      className="bg-blue-500 h-2 rounded-full"
                                      style={{ width: `${Math.min(item.revenue_percentage, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(item.avg_price_in_range)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No price range data available.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>


      </Tabs>

      {/* Brand Products Modal */}
      {selectedBrand && (
        <BrandProductsModal
          isOpen={isBrandModalOpen}
          onClose={handleCloseBrandModal}
          brandName={selectedBrand}
          filters={filters}
        />
      )}

      {/* Brand Stock Modal */}
      {selectedStockBrand && (
        <BrandStockModal
          isOpen={isBrandStockModalOpen}
          onClose={handleCloseStockBrandModal}
          brand={selectedStockBrand}
          competitorId={filters.competitorId !== 'all' ? filters.competitorId : undefined}
        />
      )}
    </div>
  );
}
