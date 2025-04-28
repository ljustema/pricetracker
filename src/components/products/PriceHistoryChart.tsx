"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import React from "react";
import { PriceChange } from "@/lib/services/product-service";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

interface PriceHistoryChartProps {
  priceHistory: PriceChange[];
  ourPrice: number | null; // Keep for backward compatibility but we don't use it
}

interface ChartDataPoint {
  date: string;
  formattedDate: string;
  competitorPrice: number | null;
  integrationPrice: number | null;
}

// Custom dot component to show different colors based on price comparison
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;

  // Only render dots at price change points
  if (!payload || !payload.integrationPrice || !payload.competitorPrice) {
    return null;
  }

  // Determine color based on price comparison
  const color = payload.integrationPrice < payload.competitorPrice
    ? "#10b981" // Green when cheaper
    : "#ef4444"; // Red when more expensive

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      stroke="white"
      strokeWidth={1}
    />
  );
};

// Helper function to get the color for a segment
const getSegmentColor = (dataPoint: ChartDataPoint) => {
  if (dataPoint.integrationPrice === null || dataPoint.competitorPrice === null) {
    return "#10b981"; // Default green
  }
  return dataPoint.integrationPrice < dataPoint.competitorPrice
    ? "#10b981" // Green when cheaper
    : "#ef4444"; // Red when more expensive
};

const PriceHistoryChart = ({ priceHistory }: PriceHistoryChartProps) => {
  const { formatPrice } = useCurrencyFormatter();

  // Process the data for the chart
  const { chartData } = useMemo(() => {
    if (!priceHistory.length) return { chartData: [], competitorPrices: [], integrationPrices: [] };

    // Separate competitor and integration prices
    const competitorPrices: PriceChange[] = [];
    const integrationPrices: PriceChange[] = [];

    priceHistory.forEach(change => {
      // Check for integration_id or source_type === 'integration'
      if (change.integration_id || change.source_type === 'integration') {
        integrationPrices.push(change);
      }
      // Check for competitor_id or source_type === 'competitor'
      else if (change.competitor_id || change.source_type === 'competitor') {
        competitorPrices.push(change);
      }
      // If neither condition is met, default to competitor
      else {
        competitorPrices.push(change);
      }
    });

    // Sort by date (oldest first)
    competitorPrices.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
    integrationPrices.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

    // Get the date range
    const allChanges = [...competitorPrices, ...integrationPrices];
    if (allChanges.length === 0) return { chartData: [], competitorPrices: [], integrationPrices: [] };

    const startDate = new Date(Math.min(...allChanges.map(c => new Date(c.changed_at).getTime())));
    const endDate = new Date();

    // Create a map of all dates in the range
    const allDates: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create chart data points
    const chartPoints: ChartDataPoint[] = [];

    // Track the latest prices
    let lastCompetitorPrice: number | null = null;
    let lastIntegrationPrice: number | null = null;

    // Create a map of competitor prices by date
    const competitorPricesByDate = new Map<string, number>();
    competitorPrices.forEach(change => {
      const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
      // Only keep the lowest price for each date
      if (!competitorPricesByDate.has(dateStr) || change.new_price < competitorPricesByDate.get(dateStr)!) {
        competitorPricesByDate.set(dateStr, change.new_price);
      }
    });

    // Create a map of integration prices by date - also keep the lowest price for each date
    const integrationPricesByDate = new Map<string, number>();
    integrationPrices.forEach(change => {
      const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
      // Keep the lowest integration price for each date (same as competitor)
      if (!integrationPricesByDate.has(dateStr) || change.new_price < integrationPricesByDate.get(dateStr)!) {
        integrationPricesByDate.set(dateStr, change.new_price);
      }
    });

    // First, find the earliest integration price and backfill it to the start
    // This ensures we have an integration price from the beginning
    if (integrationPrices.length > 0) {
      // Sort by date (oldest first) to find the earliest integration price
      const earliestIntegrationPrice = integrationPrices[0].new_price;
      lastIntegrationPrice = earliestIntegrationPrice;
    }

    // Create data points for each date
    allDates.forEach(dateStr => {
      // Get competitor price for this date or use the last known price
      if (competitorPricesByDate.has(dateStr)) {
        lastCompetitorPrice = competitorPricesByDate.get(dateStr)!;
      }

      // Get integration price for this date or use the last known price
      if (integrationPricesByDate.has(dateStr)) {
        lastIntegrationPrice = integrationPricesByDate.get(dateStr)!;
      }

      // Format the date for display
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;

      // Add data point
      chartPoints.push({
        date: dateStr,
        formattedDate,
        competitorPrice: lastCompetitorPrice,
        integrationPrice: lastIntegrationPrice
      });
    });

    return {
      chartData: chartPoints,
      competitorPrices,
      integrationPrices
    };
  }, [priceHistory]);

  // Define a type for the tooltip entry
  interface TooltipEntry {
    dataKey: string;
    name: string;
    value: number | null;
    payload: ChartDataPoint;
  }

  // Custom tooltip to format prices
  const CustomTooltip = ({
    active,
    payload,
    label
  }: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string
  }) => {
    if (active && payload && payload.length) {
      // Find the data point for this date
      const dataPoint = chartData.find(point => point.date === label);

      if (!dataPoint) return null;

      // Calculate if our price is lower
      const isOurPriceLower = dataPoint.integrationPrice !== null &&
                             dataPoint.competitorPrice !== null &&
                             dataPoint.integrationPrice < dataPoint.competitorPrice;

      return (
        <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
          <p className="font-medium">{dataPoint.formattedDate}</p>
          {payload.map((entry, index) => {
            // Set the correct color for each entry
            let color;
            if (entry.dataKey === "integrationPrice") {
              // For integration prices, use green when cheaper, red when more expensive
              color = isOurPriceLower ? "#10b981" : "#ef4444";
            } else {
              // For competitor prices, use blue
              color = "#6366f1";
            }

            return entry.value !== null && (
              <p key={index} style={{ color }}>
                {entry.name}: {formatPrice(entry.value)}
              </p>
            );
          })}
          {dataPoint.integrationPrice !== null && dataPoint.competitorPrice !== null && (
            <p className={`text-xs mt-1 ${isOurPriceLower ? "text-green-600" : "text-red-600"}`}>
              {isOurPriceLower
                ? `${((1 - (dataPoint.integrationPrice / dataPoint.competitorPrice)) * 100).toFixed(1)}% cheaper than competitors`
                : `${(((dataPoint.integrationPrice / dataPoint.competitorPrice) - 1) * 100).toFixed(1)}% more expensive than competitors`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // We no longer need to track the last known prices since we removed the reference line

  // Chart data is ready for rendering

  // Only show the no data message if we truly have no price history
  if (priceHistory.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No price history data available
      </div>
    );
  }



  return (
    <div className="w-full h-96 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(dateStr) => {
              const date = new Date(dateStr);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(value) => formatPrice(value)}
            domain={['auto', 'auto']}
            padding={{ top: 40 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* We don't need a reference line since we have the integration price line */}

          {/* Always show competitor price line */}
          <Line
            type="monotone"
            dataKey="competitorPrice"
            name="Lowest Competitor Price"
            stroke="#6366f1" // Indigo/blue line for competitor prices
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            connectNulls
            isAnimationActive={false}
          />

          {/* Single line for integration prices with custom dots and segments */}
          <Line
            type="monotone"
            dataKey="integrationPrice"
            name="Our Price"
            stroke="#10b981" // Default green
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6 }}
            connectNulls
            isAnimationActive={false}
          />

          {/* We no longer use the product's ourPrice as a fallback */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceHistoryChart;
