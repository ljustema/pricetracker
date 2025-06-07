"use client";

import { useMemo, useState } from "react";
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
import { SupplierPriceChange } from "@/lib/services/supplier-service";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

interface PriceHistoryChartProps {
  retailPriceHistory?: PriceChange[];
  supplierPriceHistory?: SupplierPriceChange[];
  ourRetailPrice?: number | null;
  ourWholesalePrice?: number | null;
}

interface ChartDataPoint {
  date: string;
  formattedDate: string;
  competitorPrice: number | null;
  integrationPrice: number | null;
  supplierPrice: number | null;
  ourPrice: number | null;
}

type ChartMode = 'retail' | 'supplier';

// Custom dot component to show different colors based on price comparison
const CustomDot = (props: { cx?: number; cy?: number; payload?: ChartDataPoint }) => {
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

const PriceHistoryChart = ({
  retailPriceHistory = [],
  supplierPriceHistory = [],
  ourRetailPrice: _ourRetailPrice,
  ourWholesalePrice
}: PriceHistoryChartProps) => {
  const { formatPrice } = useCurrencyFormatter();
  const [chartMode, setChartMode] = useState<ChartMode>('retail');

  // Process the data for the chart
  const { chartData } = useMemo(() => {
    const currentPriceHistory = chartMode === 'retail' ? retailPriceHistory : [];
    const currentSupplierHistory = chartMode === 'supplier' ? supplierPriceHistory : [];

    if (chartMode === 'retail' && !currentPriceHistory.length) {
      return { chartData: [] };
    }
    if (chartMode === 'supplier' && !currentSupplierHistory.length) {
      return { chartData: [] };
    }

    if (chartMode === 'retail') {
      // Process retail price history
      const competitorPrices: PriceChange[] = [];
      const integrationPrices: PriceChange[] = [];

      currentPriceHistory.forEach(change => {
        if (change.integration_id || change.source_type === 'integration') {
          integrationPrices.push(change);
        } else if (change.competitor_id || change.source_type === 'competitor') {
          competitorPrices.push(change);
        }
      });

      // Sort by date (oldest first)
      competitorPrices.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
      integrationPrices.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

      // Get the date range
      const allChanges = [...competitorPrices, ...integrationPrices];
      if (allChanges.length === 0) return { chartData: [] };

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

      // Create a map of competitor prices by date - keep the LOWEST price for each date
      const competitorPricesByDate = new Map<string, number>();
      competitorPrices.forEach(change => {
        const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
        const price = change.new_competitor_price;
        if (price && (!competitorPricesByDate.has(dateStr) || price < competitorPricesByDate.get(dateStr)!)) {
          competitorPricesByDate.set(dateStr, price);
        }
      });

      // Create a map of integration prices by date - use our retail price
      const integrationPricesByDate = new Map<string, number>();
      integrationPrices.forEach(change => {
        const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
        const price = change.new_our_retail_price;
        if (price) {
          integrationPricesByDate.set(dateStr, price);
        }
      });

      // First, find the earliest integration price and backfill it to the start
      if (integrationPrices.length > 0) {
        const earliestIntegrationPrice = integrationPrices[0].new_our_retail_price;
        if (earliestIntegrationPrice) {
          lastIntegrationPrice = earliestIntegrationPrice;
        }
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
          integrationPrice: lastIntegrationPrice,
          supplierPrice: null,
          ourPrice: lastIntegrationPrice
        });
      });

      return { chartData: chartPoints };
    } else {
      // Process supplier price history
      const supplierPrices = currentSupplierHistory;

      if (supplierPrices.length === 0) return { chartData: [] };

      // Sort by date (oldest first)
      supplierPrices.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

      const startDate = new Date(Math.min(...supplierPrices.map(c => new Date(c.changed_at).getTime())));
      const endDate = new Date();

      // Create a map of all dates in the range
      const allDates: string[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        allDates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const chartPoints: ChartDataPoint[] = [];
      let lastSupplierPrice: number | null = null;
      const lastOurWholesalePrice: number | null = ourWholesalePrice || null;

      // Create a map of supplier prices by date - keep the LOWEST price for each date
      const supplierPricesByDate = new Map<string, number>();
      supplierPrices.forEach(change => {
        const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
        const price = change.new_supplier_price;
        if (price && (!supplierPricesByDate.has(dateStr) || price < supplierPricesByDate.get(dateStr)!)) {
          supplierPricesByDate.set(dateStr, price);
        }
      });

      // Create data points for each date
      allDates.forEach(dateStr => {
        if (supplierPricesByDate.has(dateStr)) {
          lastSupplierPrice = supplierPricesByDate.get(dateStr)!;
        }

        const date = new Date(dateStr);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;

        chartPoints.push({
          date: dateStr,
          formattedDate,
          competitorPrice: null,
          integrationPrice: null,
          supplierPrice: lastSupplierPrice,
          ourPrice: lastOurWholesalePrice
        });
      });

      return { chartData: chartPoints };
    }
  }, [retailPriceHistory, supplierPriceHistory, chartMode, ourWholesalePrice]);

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

  // Check if we have data for the current mode
  const hasData = (chartMode === 'retail' && retailPriceHistory.length > 0) ||
                  (chartMode === 'supplier' && supplierPriceHistory.length > 0);

  return (
    <div className="w-full mt-4">
      {/* Toggle buttons */}
      <div className="flex mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setChartMode('retail')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            chartMode === 'retail'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Retail Prices
        </button>
        <button
          onClick={() => setChartMode('supplier')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            chartMode === 'supplier'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Supplier Prices
        </button>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-gray-500">
          No {chartMode} price history data available
        </div>
      ) : (
        <div className="w-full h-96">
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

          {chartMode === 'retail' ? (
            <>
              {/* Competitor price line for retail mode */}
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

              {/* Our retail price line */}
              <Line
                type="monotone"
                dataKey="integrationPrice"
                name="Our Retail Price"
                stroke="#10b981" // Green for our price
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            </>
          ) : (
            <>
              {/* Supplier price line for supplier mode */}
              <Line
                type="monotone"
                dataKey="supplierPrice"
                name="Lowest Supplier Price"
                stroke="#6366f1" // Indigo/blue line for supplier prices
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />

              {/* Our wholesale price line */}
              <Line
                type="monotone"
                dataKey="ourPrice"
                name="Our Wholesale Price"
                stroke="#10b981" // Green for our price
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            </>
          )}

          {/* We no longer use the product's ourPrice as a fallback */}
        </LineChart>
      </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PriceHistoryChart;
