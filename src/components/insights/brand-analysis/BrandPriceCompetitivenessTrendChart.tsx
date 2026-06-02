'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { formatPercentage, formatDate } from '@/lib/utils/format';
import { TrendingUp } from 'lucide-react';

// Types for the brand price trends data
interface BrandPriceTrendData {
  snapshot_date: string;
  brand_name: string | null;
  total_products: number;
  products_we_are_cheapest: number;
  products_we_are_same_price: number;
  products_we_are_more_expensive: number;
  cheapest_percentage: number;
  same_price_percentage: number;
  more_expensive_percentage: number;
  avg_price_difference_when_higher: number;
  total_potential_savings: number;
}

interface BrandData {
  name: string;
  product_count: number;
}

// Props for the component
interface BrandPriceCompetitivenessTrendChartProps {
  title?: string;
  description?: string;
}

// Custom tooltip component for stacked area chart
const CustomAreaTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-md shadow-md">
        <p className="font-medium">
          {(() => {
            try {
              const dateStr = typeof label === 'string' ? label : String(label);
              const date = new Date(dateStr + 'T00:00:00');
              return formatDate(date);
            } catch (_error) {
              return String(label);
            }
          })()}
        </p>
        <div className="space-y-1 mt-2">
          {payload.map((entry, index) => (
            <div key={`tooltip-${index}`} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm">
                {entry.name}: {formatPercentage(entry.value || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Custom tooltip component for delta chart
const CustomDeltaTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-md shadow-md">
        <p className="font-medium">
          {(() => {
            try {
              const dateStr = typeof label === 'string' ? label : String(label);
              const date = new Date(dateStr + 'T00:00:00');
              return formatDate(date);
            } catch (_error) {
              return String(label);
            }
          })()}
        </p>
        <div className="space-y-1 mt-2">
          {payload.map((entry, index) => {
            const value = entry.value as number;
            const isPositive = value > 0;
            const isNegative = value < 0;
            return (
              <div key={`delta-tooltip-${index}`} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm">
                  {entry.name}:
                  <span className={`ml-1 ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'}`}>
                    {isPositive ? '+' : ''}{value.toFixed(2)}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Day-over-day change
        </div>
      </div>
    );
  }
  return null;
};



const BrandPriceCompetitivenessTrendChart: React.FC<BrandPriceCompetitivenessTrendChartProps> = ({
  title = "Brand Price Competitiveness Trends",
  description = "Historical price competitiveness trends with brand filtering capability"
}) => {
  // State for chart data and controls
  const [data, setData] = useState<BrandPriceTrendData[]>([]);
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 14); // Default to 14 days ago
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [combineSamePrice, setCombineSamePrice] = useState(true);

  const { toast } = useToast();

  // Fetch brands for dropdown
  const fetchBrands = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/brand-analysis/brands?min_products=1');
      if (!response.ok) throw new Error('Failed to fetch brands');

      const result = await response.json();
      setBrands(result.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast({
        title: "Error",
        description: "Failed to fetch brands data",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch price trends data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      if (selectedBrand && selectedBrand !== 'all') {
        params.append('brand_filter', selectedBrand);
      }

      const response = await fetch(`/api/insights/brand-analysis/price-trends?${params}`);
      if (!response.ok) throw new Error('Failed to fetch price trends data');

      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      console.error('Error fetching price trends:', err);
      setError('Failed to load price competitiveness trend data');
      toast({
        title: "Error",
        description: "Failed to fetch price trends data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedBrand, toast]);

  // Initial data fetch
  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Prepare chart data
  const chartData = data.map(item => {
    const cheapest = Number(item.cheapest_percentage) || 0;
    const samePrice = Number(item.same_price_percentage) || 0;
    const expensive = Number(item.more_expensive_percentage) || 0;

    return {
      date: item.snapshot_date,
      cheapest: combineSamePrice ? cheapest + samePrice : cheapest,
      samePrice: combineSamePrice ? 0 : samePrice,
      expensive: expensive,
      total_products: Number(item.total_products) || 0
    };
  });

  // Calculate delta data (day-over-day changes)
  const deltaData = chartData.map((item, index) => {
    if (index === 0) {
      return {
        date: item.date,
        cheapestDelta: 0,
        samePriceDelta: combineSamePrice ? 0 : 0, // Hide in combined view
        moreExpensiveDelta: 0,
        zeroLine: 0, // Reference line at 0
        total_products: item.total_products
      };
    }

    const prevItem = chartData[index - 1];
    return {
      date: item.date,
      cheapestDelta: Number((item.cheapest - prevItem.cheapest).toFixed(2)),
      samePriceDelta: combineSamePrice ? 0 : Number((item.samePrice - prevItem.samePrice).toFixed(2)),
      moreExpensiveDelta: Number((item.expensive - prevItem.expensive).toFixed(2)),
      zeroLine: 0, // Reference line at 0
      total_products: item.total_products
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="brand-select">Brand</Label>
            <Select
              value={selectedBrand || "all"}
              onValueChange={(value) => setSelectedBrand(value === "all" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.name} value={brand.name}>
                    {brand.name} ({brand.product_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="combine-same-price"
              checked={combineSamePrice}
              onCheckedChange={setCombineSamePrice}
            />
            <Label htmlFor="combine-same-price" className="text-sm">
              Combine "Same Price"
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>

        {isLoading ? (
          <div className="w-full h-[300px] flex items-center justify-center">
            <div className="space-y-2 w-full">
              <Skeleton className="h-[300px] w-full rounded-md" />
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-[300px] flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="w-full h-[300px] flex items-center justify-center text-gray-500">
            <p>No trend data available for the selected period.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stacked Area Chart */}
            <div className="w-full h-[300px]">
              <h4 className="text-sm font-medium mb-2">Price Competitiveness Distribution</h4>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      try {
                        const dateStr = typeof value === 'string' ? value : String(value);
                        const date = new Date(dateStr + 'T00:00:00');
                        return formatDate(date, { month: 'short', day: 'numeric' });
                      } catch (error) {
                        console.warn('Date formatting error:', error, value);
                        return String(value);
                      }
                    }}
                  />
                  <YAxis
                    tickFormatter={(value) => {
                      const clampedValue = Math.min(100, Math.max(0, Number(value) || 0));
                      return `${clampedValue}%`;
                    }}
                    domain={[0, 100]}
                    type="number"
                    allowDataOverflow={false}
                    scale="linear"
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cheapest"
                    stackId="1"
                    name={combineSamePrice ? "We're Cheapest/Same Price" : "We're Cheapest"}
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.8}
                  />
                  {!combineSamePrice && (
                    <Area
                      type="monotone"
                      dataKey="samePrice"
                      stackId="1"
                      name="Same Price"
                      stroke="#6b7280"
                      fill="#6b7280"
                      fillOpacity={0.8}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="expensive"
                    stackId="1"
                    name="We're More Expensive"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Delta Chart */}
            <div className="w-full h-[200px]">
              <h4 className="text-sm font-medium mb-2">Daily Changes (Δ)</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={deltaData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      try {
                        // Ensure we have a valid date string
                        const dateStr = typeof value === 'string' ? value : String(value);
                        // Parse the date and format it consistently
                        const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
                        return formatDate(date, { month: 'short', day: 'numeric' });
                      } catch (error) {
                        console.warn('Date formatting error:', error, value);
                        return String(value);
                      }
                    }}
                  />
                  <YAxis
                    tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`}
                  />
                  <Tooltip content={<CustomDeltaTooltip />} />
                  <Legend />
                  {/* Reference line at 0 */}
                  <Line
                    type="monotone"
                    dataKey="zeroLine"
                    stroke="#d1d5db"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="cheapestDelta"
                    name={combineSamePrice ? "Cheapest/Same Δ" : "Cheapest Δ"}
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                  {!combineSamePrice && (
                    <Line
                      type="monotone"
                      dataKey="samePriceDelta"
                      name="Same Price Δ"
                      stroke="#6b7280"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="moreExpensiveDelta"
                    name="More Expensive Δ"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BrandPriceCompetitivenessTrendChart;
