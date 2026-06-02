'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Filter } from 'lucide-react';
import BrandOverviewCards from '@/components/insights/brand-analysis/BrandOverviewCards';
import BrandCompetitivenessTable from '@/components/insights/brand-analysis/BrandCompetitivenessTable';
import BrandOpportunitiesSection from '@/components/insights/brand-analysis/BrandOpportunitiesSection';
import BrandPricePressureSection from '@/components/insights/brand-analysis/BrandPricePressureSection';
import BrandPriceCompetitivenessTrendChart from '@/components/insights/brand-analysis/BrandPriceCompetitivenessTrendChart';

// Types for new brand analysis data
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

interface BrandMarketPositioningData {
  brand_name: string;
  total_products: number;
  market_position_score: number;
  competitive_strength: string;
  cheapest_percentage: number;
  same_price_percentage: number;
  more_expensive_percentage: number;
  avg_competitor_count: number;
  positioning_category: string;
}

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

interface Competitor {
  id: string;
  name: string;
  website?: string;
}

const BrandAnalysisTab: React.FC = () => {
  // State for all analysis data
  const [competitivenessData, setCompetitivenessData] = useState<BrandCompetitivenessData[]>([]);
  const [positioningData, setPositioningData] = useState<BrandMarketPositioningData[]>([]);
  const [brandsWithoutPricesData, setBrandsWithoutPricesData] = useState<BrandsWithoutPricesData[]>([]);
  const [crossDockingData, setCrossDockingData] = useState<CrossDockingOpportunitiesData[]>([]);
  const [trendingBrandsData, setTrendingBrandsData] = useState<TrendingBrandsData[]>([]);
  const [pricePressureData, setPricePressureData] = useState<BrandPricePressureData[]>([]);
  
  // Competitors state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');
  
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

  // Fetch brand competitiveness data
  const fetchBrandCompetitiveness = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompetitor !== 'all') {
        params.append('competitor_id', selectedCompetitor);
      }

      const response = await fetch(`/api/insights/brand-analysis/competitiveness?${params}`);
      if (!response.ok) throw new Error('Failed to fetch brand competitiveness data');

      const result = await response.json();
      setCompetitivenessData(result.data || []);
    } catch (error) {
      console.error('Error fetching brand competitiveness:', error);
      toast({
        title: "Error",
        description: "Failed to fetch brand competitiveness data",
        variant: "destructive",
      });
    }
  }, [selectedCompetitor, toast]);

  // Fetch brand positioning data
  const fetchBrandPositioning = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompetitor !== 'all') {
        params.append('competitor_id', selectedCompetitor);
      }

      const response = await fetch(`/api/insights/brand-analysis/positioning?${params}`);
      if (!response.ok) throw new Error('Failed to fetch brand positioning data');

      const result = await response.json();
      setPositioningData(result.data || []);
    } catch (error) {
      console.error('Error fetching brand positioning:', error);
      toast({
        title: "Error",
        description: "Failed to fetch brand positioning data",
        variant: "destructive",
      });
    }
  }, [selectedCompetitor, toast]);

  // Fetch brands without our prices
  const fetchBrandsWithoutPrices = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/brand-analysis/brands-without-prices?min_products=50');
      if (!response.ok) throw new Error('Failed to fetch brands without prices data');

      const result = await response.json();
      setBrandsWithoutPricesData(result.data || []);
    } catch (error) {
      console.error('Error fetching brands without prices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch brand opportunities data",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch cross-docking opportunities
  const fetchCrossDockingOpportunities = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/brand-analysis/cross-docking-opportunities?min_products=50');
      if (!response.ok) throw new Error('Failed to fetch cross-docking opportunities data');

      const result = await response.json();
      setCrossDockingData(result.data || []);
    } catch (error) {
      console.error('Error fetching cross-docking opportunities:', error);
      toast({
        title: "Error",
        description: "Failed to fetch cross-docking opportunities data",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch trending brands
  const fetchTrendingBrands = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/brand-analysis/trending-brands?days_back=90');
      if (!response.ok) throw new Error('Failed to fetch trending brands data');

      const result = await response.json();
      setTrendingBrandsData(result.data || []);
    } catch (error) {
      console.error('Error fetching trending brands:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trending brands data",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch price pressure data
  const fetchPricePressure = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/brand-analysis/price-pressure?days_back=30');
      if (!response.ok) throw new Error('Failed to fetch price pressure data');

      const result = await response.json();
      setPricePressureData(result.data || []);
    } catch (error) {
      console.error('Error fetching price pressure:', error);
      toast({
        title: "Error",
        description: "Failed to fetch price pressure data",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchCompetitors(),
        fetchBrandCompetitiveness(),
        fetchBrandPositioning(),
        fetchBrandsWithoutPrices(),
        fetchCrossDockingOpportunities(),
        fetchTrendingBrands(),
        fetchPricePressure()
      ]);
    } catch (err) {
      console.error('Error fetching brand analysis data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch brand analysis data');
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchCompetitors,
    fetchBrandCompetitiveness,
    fetchBrandPositioning,
    fetchBrandsWithoutPrices,
    fetchCrossDockingOpportunities,
    fetchTrendingBrands,
    fetchPricePressure
  ]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Refetch when competitor selection changes
  useEffect(() => {
    if (competitors.length > 0) {
      fetchBrandCompetitiveness();
      fetchBrandPositioning();
    }
  }, [selectedCompetitor, competitors.length, fetchBrandCompetitiveness, fetchBrandPositioning]);

  // Event handlers
  const handleBrandClick = (brandName: string) => {
    const url = `/app-routes/products?brand=${encodeURIComponent(brandName)}`;
    window.open(url, '_blank');
  };

  const handleExport = async (type: 'brands-without-prices' | 'cross-docking' | 'trending') => {
    try {
      let endpoint = '';
      let filename = '';

      switch (type) {
        case 'brands-without-prices':
          endpoint = '/api/insights/brand-analysis/brands-without-prices';
          filename = 'brand-opportunities.csv';
          break;
        case 'cross-docking':
          endpoint = '/api/insights/brand-analysis/cross-docking-opportunities';
          filename = 'cross-docking-opportunities.csv';
          break;
        case 'trending':
          endpoint = '/api/insights/brand-analysis/trending-brands';
          filename = 'trending-brands.csv';
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv' })
      });

      if (!response.ok) throw new Error('Failed to export data');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Data exported successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  // Prepare summary data for overview cards
  const competitivenessSummary = {
    total_brands: competitivenessData.length,
    total_products: competitivenessData.reduce((sum, brand) => sum + brand.total_products_with_prices, 0),
    avg_market_dominance: competitivenessData.length > 0
      ? competitivenessData.reduce((sum, brand) => sum + brand.market_dominance_percentage, 0) / competitivenessData.length
      : 0,
    top_performing_brand: competitivenessData.length > 0 ? competitivenessData[0].brand_name : null,
    worst_performing_brand: competitivenessData.length > 0
      ? competitivenessData.sort((a, b) => a.cheapest_percentage - b.cheapest_percentage)[0].brand_name
      : null
  };

  const positioningSummary = {
    ...competitivenessSummary,
    worst_performing_brand: positioningData.length > 0
      ? positioningData.sort((a, b) => a.market_position_score - b.market_position_score)[0].brand_name
      : null
  };

  const opportunitySummary = {
    ...competitivenessSummary,
    opportunity_brands: brandsWithoutPricesData.length
  };

  const pressureSummary = {
    ...competitivenessSummary,
    brands_under_pressure: pricePressureData.filter(brand =>
      brand.pressure_level === 'Very High' || brand.pressure_level === 'High'
    ).length,
    brands_under_high_pressure: pricePressureData.filter(brand =>
      brand.pressure_level === 'Very High' || brand.pressure_level === 'High'
    ).length,
    most_pressured_brand: pricePressureData.length > 0
      ? pricePressureData.sort((a, b) => b.price_change_frequency_score - a.price_change_frequency_score)[0].brand_name
      : null
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading brand analysis data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-red-600 font-medium">Error loading brand analysis data</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Button onClick={fetchAllData} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Price Competitiveness Trend Chart */}
      <BrandPriceCompetitivenessTrendChart
        title="Brand Price Competitiveness Trends"
        description="Historical price competitiveness trends with brand filtering capability"
      />

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Brand Analysis</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <Select value={selectedCompetitor} onValueChange={setSelectedCompetitor}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select competitor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Competitors</SelectItem>
                    {competitors.map((competitor) => (
                      <SelectItem key={competitor.id} value={competitor.id}>
                        {competitor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardTitle>
          <p className="text-sm text-gray-500">
            Comprehensive brand analysis including competitiveness, opportunities, and market positioning
          </p>
        </CardHeader>
      </Card>

      {/* Overview Cards */}
      <BrandOverviewCards
        competitivenessData={competitivenessSummary}
        positioningData={positioningSummary}
        opportunityData={opportunitySummary}
        pressureData={pressureSummary}
        isLoading={false}
        onBrandClick={handleBrandClick}
      />

      {/* Brand Competitiveness Table */}
      <BrandCompetitivenessTable
        data={competitivenessData}
        isLoading={false}
        onBrandClick={handleBrandClick}
      />

      {/* Brand Price Pressure Section */}
      <BrandPricePressureSection
        data={pricePressureData}
        isLoading={false}
        onBrandClick={handleBrandClick}
      />

      {/* Brand Opportunities Section */}
      <BrandOpportunitiesSection
        brandsWithoutPricesData={brandsWithoutPricesData}
        crossDockingData={crossDockingData}
        trendingBrandsData={trendingBrandsData}
        isLoading={false}
        onBrandClick={handleBrandClick}
        onExport={handleExport}
      />
    </div>
  );
};

export default BrandAnalysisTab;
