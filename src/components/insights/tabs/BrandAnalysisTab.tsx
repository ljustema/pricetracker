'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatPercentage, formatNumber } from '@/lib/utils/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Types for brand analysis data
interface BrandCompetition {
  brand_id: string;
  brand_name: string;
  competitor_count: number;
  competitors: {
    competitor_id: string;
    competitor_name: string;
  }[];
}

interface BrandUniqueness {
  brand_id: string;
  brand_name: string;
  total_products: number;
  unique_products: number;
  uniqueness_percentage: number;
}

interface BrandPricePositioning {
  brand_id: string;
  brand_name: string;
  total_products: number;
  cheaper_count: number;
  same_count: number;
  more_expensive_count: number;
  avg_price_difference: number;
}

interface BrandChangeActivity {
  days: number;
  brands: {
    brand_id: string;
    brand_name: string;
    total_products: number;
    total_changes: number;
    changes_per_product: number;
  }[];
}

// Custom tooltip for competition chart
const CompetitionTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { brand_name: string; competitor_count: number; total_products?: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.brand_name}</p>
        <p className="text-sm">
          Competitors: {formatNumber(data.competitor_count)}
        </p>
        <p className="text-sm">
          Products: {formatNumber(data.total_products || 0)}
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for uniqueness chart
const UniquenessTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { brand_name: string; uniqueness_percentage: number; unique_products: number; total_products: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.brand_name}</p>
        <p className="text-sm">
          Uniqueness: {formatPercentage(data.uniqueness_percentage)}
        </p>
        <p className="text-sm">
          Unique Products: {formatNumber(data.unique_products)} of {formatNumber(data.total_products)}
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for price positioning chart
const PricePositioningTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { brand_name: string; avg_price_difference: number; cheaper_count: number; same_count: number; more_expensive_count: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.brand_name}</p>
        <p className="text-sm">
          Avg. Price Difference: <span className={data.avg_price_difference > 0 ? 'text-red-500' : 'text-green-500'}>
            {formatPercentage(data.avg_price_difference)}
          </span>
        </p>
        <p className="text-sm">
          Cheaper: {formatNumber(data.cheaper_count)} products
        </p>
        <p className="text-sm">
          Same: {formatNumber(data.same_count)} products
        </p>
        <p className="text-sm">
          More Expensive: {formatNumber(data.more_expensive_count)} products
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for change activity chart
const ChangeActivityTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { brand_name: string; changes_per_product: number; total_changes: number; total_products: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.brand_name}</p>
        <p className="text-sm">
          Changes per Product: {data.changes_per_product.toFixed(2)}
        </p>
        <p className="text-sm">
          Total Changes: {formatNumber(data.total_changes)}
        </p>
        <p className="text-sm">
          Products: {formatNumber(data.total_products)}
        </p>
      </div>
    );
  }
  return null;
};

// Colors for charts
const _COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];
const PRICE_POSITION_COLORS = ['#10b981', '#6366f1', '#ef4444']; // Green for cheaper, blue for same, red for more expensive

const BrandAnalysisTab: React.FC = () => {
  const [competitionData, setCompetitionData] = useState<BrandCompetition[]>([]);
  const [uniquenessData, setUniquenessData] = useState<BrandUniqueness[]>([]);
  const [pricePositioningData, setPricePositioningData] = useState<BrandPricePositioning[]>([]);
  const [changeActivityData, setChangeActivityData] = useState<BrandChangeActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch brand analysis data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch competition data
        const competitionResponse = await fetch('/api/insights/brands/competition');
        if (!competitionResponse.ok) {
          throw new Error(`Failed to fetch competition data: ${competitionResponse.statusText}`);
        }
        const competitionData = await competitionResponse.json();

        // Fetch uniqueness data
        const uniquenessResponse = await fetch('/api/insights/brands/uniqueness');
        if (!uniquenessResponse.ok) {
          throw new Error(`Failed to fetch uniqueness data: ${uniquenessResponse.statusText}`);
        }
        const uniquenessData = await uniquenessResponse.json();

        // Fetch price positioning data
        const pricePositioningResponse = await fetch('/api/insights/brands/price-positioning');
        if (!pricePositioningResponse.ok) {
          throw new Error(`Failed to fetch price positioning data: ${pricePositioningResponse.statusText}`);
        }
        const pricePositioningData = await pricePositioningResponse.json();

        // Fetch change activity data
        const changeActivityResponse = await fetch('/api/insights/brands/change-activity?days=30');
        if (!changeActivityResponse.ok) {
          throw new Error(`Failed to fetch change activity data: ${changeActivityResponse.statusText}`);
        }
        const changeActivityData = await changeActivityResponse.json();

        // Update state with fetched data
        setCompetitionData(competitionData);
        setUniquenessData(uniquenessData);
        setPricePositioningData(pricePositioningData);
        setChangeActivityData(changeActivityData);
      } catch (err) {
        console.error('Error fetching brand analysis data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch brand analysis data');
        toast({
          title: 'Error',
          description: 'Failed to load brand analysis data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  if (isLoading) {
    return <div className="text-center py-8">Loading brand analysis data...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  // Prepare data for price positioning pie chart
  const pricePositioningPieData = pricePositioningData.length > 0
    ? pricePositioningData
        .filter(brand => brand.total_products > 0)
        .map(brand => [
          { name: 'Cheaper', value: brand.cheaper_count },
          { name: 'Same', value: brand.same_count },
          { name: 'More Expensive', value: brand.more_expensive_count }
        ])
        .reduce((acc, curr) => {
          acc[0].value += curr[0].value;
          acc[1].value += curr[1].value;
          acc[2].value += curr[2].value;
          return acc;
        }, [
          { name: 'Cheaper', value: 0 },
          { name: 'Same', value: 0 },
          { name: 'More Expensive', value: 0 }
        ])
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Brand Competition Card */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Competition</CardTitle>
            <CardDescription>
              Number of competitors per brand
            </CardDescription>
          </CardHeader>
          <CardContent>
            {competitionData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No brand competition data available</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={competitionData
                      .sort((a, b) => b.competitor_count - a.competitor_count)
                      .slice(0, 15)} // Show top 15 brands
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="brand_name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis />
                    <Tooltip content={<CompetitionTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="competitor_count"
                      name="Competitors"
                      fill="#8884d8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Brand Uniqueness Card */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Uniqueness</CardTitle>
            <CardDescription>
              Percentage of products that are unique (only you or a single competitor has them)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uniquenessData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No brand uniqueness data available</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={uniquenessData
                      .filter(brand => brand.total_products >= 3) // Only show brands with at least 3 products
                      .sort((a, b) => b.uniqueness_percentage - a.uniqueness_percentage)
                      .slice(0, 15)} // Show top 15 brands
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="brand_name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<UniquenessTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="uniqueness_percentage"
                      name="Uniqueness %"
                      fill="#82ca9d"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Positioning Card */}
        <Card>
          <CardHeader>
            <CardTitle>Price Positioning</CardTitle>
            <CardDescription>
              Average price position per brand compared to competitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pricePositioningData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No price positioning data available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={pricePositioningData
                        .filter(brand => brand.total_products >= 3) // Only show brands with at least 3 products
                        .sort((a, b) => a.avg_price_difference - b.avg_price_difference)
                        .slice(0, 15)} // Show top 15 brands
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="brand_name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        tickFormatter={(value) => `${value}%`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<PricePositioningTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="avg_price_difference"
                        name="Avg. Price Difference (%)"
                        fill="#8884d8"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pricePositioningPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pricePositioningPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PRICE_POSITION_COLORS[index % PRICE_POSITION_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Activity Card */}
        <Card>
          <CardHeader>
            <CardTitle>Change Activity</CardTitle>
            <CardDescription>
              Price change frequency per brand in the last {changeActivityData?.days || 30} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!changeActivityData || changeActivityData.brands.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No change activity data available</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={changeActivityData.brands
                      .filter(brand => brand.total_products >= 3) // Only show brands with at least 3 products
                      .sort((a, b) => b.changes_per_product - a.changes_per_product)
                      .slice(0, 15)} // Show top 15 brands
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="brand_name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis />
                    <Tooltip content={<ChangeActivityTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="changes_per_product"
                      name="Changes per Product"
                      fill="#ff8042"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BrandAnalysisTab;
