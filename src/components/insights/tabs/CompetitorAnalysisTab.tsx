'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Types for competitor analysis data
interface PriceComparisonData {
  competitor_id: string;
  competitor_name: string;
  avg_diff_percentage: number;
  total_products: number;
}

interface ChangeFrequencyData {
  days: number;
  data: {
    competitor_id: string;
    competitor_name: string;
    count: number;
  }[];
}

interface ChangeDaysData {
  competitor_id: string;
  competitor_name: string;
  days: {
    day: string;
    count: number;
  }[];
}

interface MarketCoverageData {
  total_products: number;
  competitors: {
    competitor_id: string;
    competitor_name: string;
    product_count: number;
    coverage_percentage: number;
  }[];
}

interface BrandFocusData {
  competitor_id: string;
  competitor_name: string;
  top_brand: {
    brand_id: string;
    brand_name: string;
    product_count: number;
  } | null;
}

// Custom tooltip for price comparison chart
const PriceComparisonTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.competitor_name}</p>
        <p className="text-sm">
          Average Price Difference: <span className={data.avg_diff_percentage > 0 ? 'text-red-500' : 'text-green-500'}>
            {formatPercentage(data.avg_diff_percentage)}
          </span>
        </p>
        <p className="text-sm">Products: {formatNumber(data.total_products)}</p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for change frequency chart
const ChangeFrequencyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.competitor_name}</p>
        <p className="text-sm">
          Price Changes: {formatNumber(data.count)}
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for market coverage chart
const MarketCoverageTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
        <p className="font-medium">{data.competitor_name}</p>
        <p className="text-sm">
          Coverage: {formatPercentage(data.coverage_percentage)}
        </p>
        <p className="text-sm">
          Products: {formatNumber(data.product_count)} of {formatNumber(data.total_products)}
        </p>
      </div>
    );
  }
  return null;
};

// Colors for charts
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

const CompetitorAnalysisTab: React.FC = () => {
  const [priceComparisonData, setPriceComparisonData] = useState<PriceComparisonData[]>([]);
  const [changeFrequencyData, setChangeFrequencyData] = useState<ChangeFrequencyData | null>(null);
  const [changeDaysData, setChangeDaysData] = useState<ChangeDaysData[]>([]);
  const [marketCoverageData, setMarketCoverageData] = useState<MarketCoverageData | null>(null);
  const [brandFocusData, setBrandFocusData] = useState<BrandFocusData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState('price-comparison');
  const { toast } = useToast();

  // Fetch competitor analysis data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch price comparison data
        const priceComparisonResponse = await fetch('/api/insights/competitors/price-comparison');
        if (!priceComparisonResponse.ok) {
          throw new Error(`Failed to fetch price comparison data: ${priceComparisonResponse.statusText}`);
        }
        const priceComparisonData = await priceComparisonResponse.json();

        // Fetch change frequency data
        const changeFrequencyResponse = await fetch('/api/insights/competitors/change-frequency?days=30');
        if (!changeFrequencyResponse.ok) {
          throw new Error(`Failed to fetch change frequency data: ${changeFrequencyResponse.statusText}`);
        }
        const changeFrequencyData = await changeFrequencyResponse.json();

        // Fetch change days data
        const changeDaysResponse = await fetch('/api/insights/competitors/change-days');
        if (!changeDaysResponse.ok) {
          throw new Error(`Failed to fetch change days data: ${changeDaysResponse.statusText}`);
        }
        const changeDaysData = await changeDaysResponse.json();

        // Fetch market coverage data
        const marketCoverageResponse = await fetch('/api/insights/competitors/market-coverage');
        if (!marketCoverageResponse.ok) {
          throw new Error(`Failed to fetch market coverage data: ${marketCoverageResponse.statusText}`);
        }
        const marketCoverageData = await marketCoverageResponse.json();

        // Fetch brand focus data
        const brandFocusResponse = await fetch('/api/insights/competitors/brand-focus');
        if (!brandFocusResponse.ok) {
          throw new Error(`Failed to fetch brand focus data: ${brandFocusResponse.statusText}`);
        }
        const brandFocusData = await brandFocusResponse.json();

        // Update state with fetched data
        setPriceComparisonData(priceComparisonData);
        setChangeFrequencyData(changeFrequencyData);
        setChangeDaysData(changeDaysData);
        setMarketCoverageData(marketCoverageData);
        setBrandFocusData(brandFocusData);
      } catch (err) {
        console.error('Error fetching competitor analysis data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch competitor analysis data');
        toast({
          title: 'Error',
          description: 'Failed to load competitor analysis data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  if (isLoading) {
    return <div className="text-center py-8">Loading competitor analysis data...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  // Prepare data for market coverage pie chart
  const marketCoveragePieData = marketCoverageData?.competitors.map(competitor => ({
    name: competitor.competitor_name,
    value: competitor.product_count,
    competitor_name: competitor.competitor_name,
    coverage_percentage: competitor.coverage_percentage,
    product_count: competitor.product_count,
    total_products: marketCoverageData.total_products
  })) || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue={activeSubTab} value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-5">
          <TabsTrigger value="price-comparison">Price Comparison</TabsTrigger>
          <TabsTrigger value="change-frequency">Change Frequency</TabsTrigger>
          <TabsTrigger value="change-days">Change Days</TabsTrigger>
          <TabsTrigger value="market-coverage">Market Coverage</TabsTrigger>
          <TabsTrigger value="brand-focus">Brand Focus</TabsTrigger>
        </TabsList>

        {/* Price Comparison Tab */}
        <TabsContent value="price-comparison">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Price Comparison</CardTitle>
              <CardDescription>
                Average price difference between your prices and competitor prices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {priceComparisonData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No price comparison data available</p>
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={priceComparisonData.sort((a, b) => a.avg_diff_percentage - b.avg_diff_percentage)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="competitor_name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        tickFormatter={(value) => `${value}%`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<PriceComparisonTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="avg_diff_percentage"
                        name="Avg. Price Difference (%)"
                        fill={(data) => data.avg_diff_percentage > 0 ? '#ef4444' : '#10b981'}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Change Frequency Tab */}
        <TabsContent value="change-frequency">
          <Card>
            <CardHeader>
              <CardTitle>Price Change Frequency</CardTitle>
              <CardDescription>
                Number of price changes per competitor in the last {changeFrequencyData?.days || 30} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!changeFrequencyData || changeFrequencyData.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No change frequency data available</p>
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={changeFrequencyData.data.sort((a, b) => b.count - a.count)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="competitor_name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip content={<ChangeFrequencyTooltip />} />
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
        </TabsContent>

        {/* Change Days Tab */}
        <TabsContent value="change-days">
          <Card>
            <CardHeader>
              <CardTitle>Price Change Days</CardTitle>
              <CardDescription>
                Distribution of price changes by day of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {changeDaysData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No change days data available</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {changeDaysData.map((competitor, index) => (
                    <div key={competitor.competitor_id} className="space-y-2">
                      <h3 className="font-medium">{competitor.competitor_name}</h3>
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={competitor.days}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip />
                            <Bar
                              dataKey="count"
                              name="Price Changes"
                              fill={COLORS[index % COLORS.length]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market Coverage Tab */}
        <TabsContent value="market-coverage">
          <Card>
            <CardHeader>
              <CardTitle>Market Coverage</CardTitle>
              <CardDescription>
                Percentage of your products covered by each competitor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!marketCoverageData || marketCoverageData.competitors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No market coverage data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={marketCoverageData.competitors
                          .sort((a, b) => b.coverage_percentage - a.coverage_percentage)
                          .map(competitor => ({
                            ...competitor,
                            total_products: marketCoverageData.total_products
                          }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="competitor_name"
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis
                          tickFormatter={(value) => `${value}%`}
                          domain={[0, 100]}
                        />
                        <Tooltip content={<MarketCoverageTooltip />} />
                        <Legend />
                        <Bar
                          dataKey="coverage_percentage"
                          name="Coverage (%)"
                          fill="#8884d8"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={marketCoveragePieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {marketCoveragePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand Focus Tab */}
        <TabsContent value="brand-focus">
          <Card>
            <CardHeader>
              <CardTitle>Brand Focus</CardTitle>
              <CardDescription>
                Top brands for each competitor based on product count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {brandFocusData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No brand focus data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brandFocusData.map((competitor) => (
                    <div
                      key={competitor.competitor_id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <h3 className="font-medium text-gray-900 mb-2">{competitor.competitor_name}</h3>
                      {competitor.top_brand ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Top Brand:</span>
                            <span className="font-medium">{competitor.top_brand.brand_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Product Count:</span>
                            <span className="font-medium">{competitor.top_brand.product_count}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No brand data available</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompetitorAnalysisTab;
