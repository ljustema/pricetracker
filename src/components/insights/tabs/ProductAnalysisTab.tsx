'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatPercentage, formatNumber, formatDate } from '@/lib/utils/format';
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
  Cell,
  LineChart,
  Line
} from 'recharts';

// Types for product analysis data
interface ProductTrend {
  product_id: string;
  product_name: string;
  total_changes: number;
  total_percentage_change: number;
  avg_percentage_change: number;
  competitor_count: number;
  first_price: number;
  last_price: number;
  overall_change_percentage: number;
  last_changed_at: string;
}

interface ProductSensitivity {
  product_id: string;
  product_name: string;
  our_price: number | null;
  count: number;
}

interface ProductMatchingStatus {
  total_products: number;
  matched_products: number;
  unmatched_products: number;
  matching_percentage: number;
  brand_matching: {
    brand_id: string;
    brand_name: string;
    total_products: number;
    matched_products: number;
    unmatched_products: number;
    matching_percentage: number;
  }[];
}

// Custom tooltip for trends chart
const TrendsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.product_name}</p>
        <p className="text-sm">
          Overall Change: <span className={data.overall_change_percentage > 0 ? 'text-red-500' : 'text-green-500'}>
            {formatPercentage(data.overall_change_percentage)}
          </span>
        </p>
        <p className="text-sm">
          First Price: {formatCurrency(data.first_price)}
        </p>
        <p className="text-sm">
          Last Price: {formatCurrency(data.last_price)}
        </p>
        <p className="text-sm">
          Total Changes: {formatNumber(data.total_changes)}
        </p>
        <p className="text-sm">
          Last Changed: {formatDate(new Date(data.last_changed_at))}
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for sensitivity chart
const SensitivityTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.product_name}</p>
        <p className="text-sm">
          Price Changes: {formatNumber(data.count)}
        </p>
        {data.our_price && (
          <p className="text-sm">
            Our Price: {formatCurrency(data.our_price)}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Colors for charts
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];
const MATCHING_COLORS = ['#10b981', '#ef4444']; // Green for matched, red for unmatched

const ProductAnalysisTab: React.FC = () => {
  const [trendsData, setTrendsData] = useState<{ days: number; trends: ProductTrend[] } | null>(null);
  const [sensitivityData, setSensitivityData] = useState<{ days: number; products: ProductSensitivity[] } | null>(null);
  const [matchingStatusData, setMatchingStatusData] = useState<ProductMatchingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch product analysis data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch trends data
        const trendsResponse = await fetch('/api/insights/products/trends?days=30&limit=10');
        if (!trendsResponse.ok) {
          throw new Error(`Failed to fetch trends data: ${trendsResponse.statusText}`);
        }
        const trendsData = await trendsResponse.json();

        // Fetch sensitivity data
        const sensitivityResponse = await fetch('/api/insights/products/sensitivity?days=30&limit=10');
        if (!sensitivityResponse.ok) {
          throw new Error(`Failed to fetch sensitivity data: ${sensitivityResponse.statusText}`);
        }
        const sensitivityData = await sensitivityResponse.json();

        // Fetch matching status data
        const matchingStatusResponse = await fetch('/api/insights/products/matching-status');
        if (!matchingStatusResponse.ok) {
          throw new Error(`Failed to fetch matching status data: ${matchingStatusResponse.statusText}`);
        }
        const matchingStatusData = await matchingStatusResponse.json();

        // Update state with fetched data
        setTrendsData(trendsData);
        setSensitivityData(sensitivityData);
        setMatchingStatusData(matchingStatusData);
      } catch (err) {
        console.error('Error fetching product analysis data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch product analysis data');
        toast({
          title: 'Error',
          description: 'Failed to load product analysis data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  if (isLoading) {
    return <div className="text-center py-8">Loading product analysis data...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  // Prepare data for matching status pie chart
  const matchingStatusPieData = matchingStatusData ? [
    { name: 'Matched Products', value: matchingStatusData.matched_products },
    { name: 'Unmatched Products', value: matchingStatusData.unmatched_products }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Price Trends Card */}
        <Card>
          <CardHeader>
            <CardTitle>Product Price Trends</CardTitle>
            <CardDescription>
              Products with the most significant price changes in the last {trendsData?.days || 30} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!trendsData || trendsData.trends.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No price trends data available</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={trendsData.trends}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="product_name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}%`}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<TrendsTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="overall_change_percentage"
                      name="Overall Price Change (%)"
                      fill={(data) => data.overall_change_percentage > 0 ? '#ef4444' : '#10b981'}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Sensitivity Card */}
        <Card>
          <CardHeader>
            <CardTitle>Product Price Sensitivity</CardTitle>
            <CardDescription>
              Products with the most frequent price changes in the last {sensitivityData?.days || 30} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sensitivityData || sensitivityData.products.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No price sensitivity data available</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sensitivityData.products}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="product_name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis />
                    <Tooltip content={<SensitivityTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="Price Changes"
                      fill="#8884d8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Matching Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Product Matching Status</CardTitle>
            <CardDescription>
              Overview of matched vs. unmatched products across your catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!matchingStatusData ? (
              <div className="text-center py-8 text-gray-500">
                <p>No matching status data available</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(matchingStatusData.total_products)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Matched Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{formatNumber(matchingStatusData.matched_products)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Unmatched Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{formatNumber(matchingStatusData.unmatched_products)}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={matchingStatusPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {matchingStatusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={MATCHING_COLORS[index % MATCHING_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={matchingStatusData.brand_matching
                          .filter(brand => brand.total_products >= 3) // Only show brands with at least 3 products
                          .sort((a, b) => b.matching_percentage - a.matching_percentage)
                          .slice(0, 10)} // Show top 10 brands
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
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="matching_percentage"
                          name="Matching %"
                          fill="#8884d8"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductAnalysisTab;
