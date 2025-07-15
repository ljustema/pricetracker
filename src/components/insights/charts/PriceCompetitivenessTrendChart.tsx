'use client';

import React, { useState, useEffect } from 'react';
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

// Types for the price trends data
interface PriceTrendData {
  snapshot_date: string;
  competitor_id: string | null;
  competitor_name: string;
  brand_filter: string | null;
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

// Props for the component
interface PriceCompetitivenessTrendChartProps {
  title?: string;
  description?: string;
  competitors?: Array<{id: string; name: string}>;
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
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm">
                {entry.name}: {formatPercentage(entry.value as number)}
              </span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {payload[0].payload.total_products} products analyzed
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

const PriceCompetitivenessTrendChart: React.FC<PriceCompetitivenessTrendChartProps> = ({
  title = "Daily Price Competitiveness Trend",
  description = "Historical trend of our price competitiveness over time, showing the percentage of products where we are cheapest, same price, or more expensive than competitors.",
  competitors = []
}) => {
  const [trendData, setTrendData] = useState<PriceTrendData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Local state for filters
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>("");
  const [combineSamePrice, setCombineSamePrice] = useState(true); // Default to combined view

  // Fetch trend data
  useEffect(() => {
    const fetchTrendData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('start_date', startDate);
        params.append('end_date', endDate);
        if (selectedCompetitor && selectedCompetitor !== "") {
          params.append('competitor_id', selectedCompetitor);
        }

        const response = await fetch(`/api/insights/competitor-analysis/price-trends?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch price trend data');
        }

        const result = await response.json();
        setTrendData(result.data || []);
      } catch (err) {
        console.error('Error fetching price trend data:', err);
        setError('Failed to load price competitiveness trend data');
        toast({
          title: "Error",
          description: "Failed to load price trend data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrendData();
  }, [startDate, endDate, selectedCompetitor, toast]);

  // Format data for the chart
  const chartData = trendData.map(item => {
    // Ensure percentages are valid numbers and not extreme values
    const cheapest = Math.max(0, Math.min(100, Number(item.cheapest_percentage) || 0));
    const samePrice = Math.max(0, Math.min(100, Number(item.same_price_percentage) || 0));
    const moreExpensive = Math.max(0, Math.min(100, Number(item.more_expensive_percentage) || 0));

    if (combineSamePrice) {
      // Combine "Same Price" with "We're Cheapest"
      const combinedCheapest = cheapest + samePrice;
      // Ensure the total doesn't exceed 100%
      const normalizedCheapest = Math.min(100, combinedCheapest);
      const normalizedMoreExpensive = Math.min(100 - normalizedCheapest, moreExpensive);

      return {
        date: item.snapshot_date,
        cheapest: Number(normalizedCheapest.toFixed(2)),
        samePrice: 0, // Not used in combined view
        moreExpensive: Number(normalizedMoreExpensive.toFixed(2)),
        total_products: item.total_products,
        competitor_name: item.competitor_name
      };
    } else {
      // Separate view - normalize to ensure total is 100%
      const total = cheapest + samePrice + moreExpensive;
      const normalizer = total > 0 ? 100 / total : 1;

      return {
        date: item.snapshot_date,
        cheapest: Number((cheapest * normalizer).toFixed(2)),
        samePrice: Number((samePrice * normalizer).toFixed(2)),
        moreExpensive: Number((moreExpensive * normalizer).toFixed(2)),
        total_products: item.total_products,
        competitor_name: item.competitor_name
      };
    }
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
        total_products: item.total_products,
        competitor_name: item.competitor_name
      };
    }

    const prevItem = chartData[index - 1];
    return {
      date: item.date,
      cheapestDelta: Number((item.cheapest - prevItem.cheapest).toFixed(2)),
      samePriceDelta: combineSamePrice ? 0 : Number((item.samePrice - prevItem.samePrice).toFixed(2)),
      moreExpensiveDelta: Number((item.moreExpensive - prevItem.moreExpensive).toFixed(2)),
      zeroLine: 0, // Reference line at 0
      total_products: item.total_products,
      competitor_name: item.competitor_name
    };
  });

  // Determine subtitle based on filters
  const getSubtitle = () => {
    let subtitle = "Comparing against ";

    if (selectedCompetitor && selectedCompetitor !== "") {
      const competitorName = trendData.length > 0 ? trendData[0].competitor_name : "selected competitor";
      subtitle += competitorName;
    } else {
      subtitle += "all competitors";
    }

    return subtitle;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        {trendData.length > 0 && (
          <div className="mt-1 text-sm font-medium text-muted-foreground">
            {getSubtitle()}
          </div>
        )}

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
            <Label htmlFor="competitor-select">Competitor</Label>
            <Select
              value={selectedCompetitor || "all"}
              onValueChange={(value) => setSelectedCompetitor(value === "all" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Competitors" />
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
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                    type="number"
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
                    dataKey="moreExpensive"
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

export default PriceCompetitivenessTrendChart;
