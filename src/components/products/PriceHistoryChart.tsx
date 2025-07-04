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
  competitorName: string | null; // Track which competitor has the lowest price
  integrationPrice: number | null;
  supplierPrice: number | null;
  ourPrice: number | null;
}

type ChartMode = 'retail' | 'supplier';

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

      if (allChanges.length === 0) {
        return { chartData: [] };
      }

      const startDate = new Date(Math.min(...allChanges.map(c => new Date(c.changed_at).getTime())));
      const endDate = new Date();

      // Set endDate to end of today to ensure today is included
      endDate.setHours(23, 59, 59, 999);

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
      let lastCompetitorName: string | null = null;
      let lastIntegrationPrice: number | null = null;

      // Create a map of competitor prices by date with competitor info
      const competitorPricesByDate = new Map<string, { price: number; name: string }[]>();
      competitorPrices.forEach(change => {
        const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
        const price = change.new_competitor_price;
        // Convert string to number if needed
        const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
        const competitorName = change.source_name || change.competitors?.name || 'Unknown Competitor';

        if (numericPrice) {
          if (!competitorPricesByDate.has(dateStr)) {
            competitorPricesByDate.set(dateStr, []);
          }
          competitorPricesByDate.get(dateStr)!.push({ price: numericPrice, name: competitorName });
        }
      });

      // Create a map of integration prices by date - use our retail price
      const integrationPricesByDate = new Map<string, number>();
      integrationPrices.forEach(change => {
        const dateStr = new Date(change.changed_at).toISOString().split('T')[0];
        const price = change.new_our_retail_price;
        // Convert string to number if needed
        const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
        if (numericPrice) {
          integrationPricesByDate.set(dateStr, numericPrice);
        }
      });

      // First, find the earliest integration price and backfill it to the start
      if (integrationPrices.length > 0) {
        const earliestIntegrationPrice = integrationPrices[0].new_our_retail_price;
        // Convert string to number if needed
        const numericPrice = typeof earliestIntegrationPrice === 'string' ? parseFloat(earliestIntegrationPrice) : earliestIntegrationPrice;
        if (numericPrice) {
          lastIntegrationPrice = numericPrice;
        }
      }

      // Track current prices for all competitors
      const currentCompetitorPrices = new Map<string, { price: number; name: string }>();

      // Create data points for each date
      allDates.forEach(dateStr => {
        // Check if there are new competitor prices for this date
        if (competitorPricesByDate.has(dateStr)) {
          const dayPrices = competitorPricesByDate.get(dateStr)!;
          // Update current prices for competitors that changed on this date
          dayPrices.forEach(priceEntry => {
            const competitorKey = priceEntry.name;
            currentCompetitorPrices.set(competitorKey, priceEntry);
          });
        }

        // Find the current lowest competitor price from all active competitors
        if (currentCompetitorPrices.size > 0) {
          const allCurrentPrices = Array.from(currentCompetitorPrices.values());
          const lowestPriceEntry = allCurrentPrices.reduce((lowest, current) =>
            current.price < lowest.price ? current : lowest
          );
          lastCompetitorPrice = lowestPriceEntry.price;
          lastCompetitorName = lowestPriceEntry.name;
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
          competitorName: lastCompetitorName,
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

      // Set endDate to end of today to ensure today is included
      endDate.setHours(23, 59, 59, 999);

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
        // Convert string to number if needed
        const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
        if (numericPrice && (!supplierPricesByDate.has(dateStr) || numericPrice < supplierPricesByDate.get(dateStr)!)) {
          supplierPricesByDate.set(dateStr, numericPrice);
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
          competitorName: null,
          integrationPrice: null,
          supplierPrice: lastSupplierPrice,
          ourPrice: lastOurWholesalePrice
        });
      });

      return { chartData: chartPoints };
    }
  }, [retailPriceHistory, supplierPriceHistory, chartMode, ourWholesalePrice]);



  // We no longer need to track the last known prices since we removed the reference line

  // Chart data is ready for rendering

  // Check if we have data for the current mode
  const hasData = chartData.length > 0;



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
            dataKey="formattedDate"
          />
          <YAxis
            tickFormatter={(value) => formatPrice(value)}
          />
          <Tooltip
            content={(props) => {
              if (!props.active || !props.payload || !props.payload.length) {
                return null;
              }

              // Get the data point from the payload
              const dataPoint = props.payload[0]?.payload;
              if (!dataPoint) return null;

              // Calculate if our price is lower
              const isOurPriceLower = dataPoint.integrationPrice !== null &&
                                     dataPoint.competitorPrice !== null &&
                                     dataPoint.integrationPrice < dataPoint.competitorPrice;

              return (
                <div className="bg-white p-3 border border-gray-200 shadow-sm rounded-md">
                  <p className="font-medium">{dataPoint.formattedDate}</p>
                  {props.payload.map((entry, index) => {
                    // Set the correct color for each entry
                    let color;
                    let displayName = entry.name || '';

                    if (entry.dataKey === "integrationPrice") {
                      // For integration prices, use green when cheaper, red when more expensive
                      color = isOurPriceLower ? "#10b981" : "#ef4444";
                      displayName = "Our Price";
                    } else if (entry.dataKey === "competitorPrice") {
                      // For competitor prices, use blue and show competitor name
                      color = "#6366f1";
                      displayName = dataPoint.competitorName ? `${dataPoint.competitorName}` : "Competitor Price";
                    } else if (entry.dataKey === "supplierPrice") {
                      color = "#8b5cf6";
                      displayName = "Supplier Price";
                    } else {
                      color = "#6366f1";
                    }

                    return entry.value !== null && entry.value !== undefined && (
                      <p key={index} style={{ color }}>
                        {displayName}: {formatPrice(Number(entry.value))}
                      </p>
                    );
                  })}
                  {dataPoint.integrationPrice !== null && dataPoint.competitorPrice !== null && (
                    <p className={`text-xs mt-1 ${isOurPriceLower ? "text-green-600" : "text-red-600"}`}>
                      {isOurPriceLower
                        ? `${((1 - (dataPoint.integrationPrice / dataPoint.competitorPrice)) * 100).toFixed(1)}% cheaper than ${dataPoint.competitorName || 'competitors'}`
                        : `${(((dataPoint.integrationPrice / dataPoint.competitorPrice) - 1) * 100).toFixed(1)}% more expensive than ${dataPoint.competitorName || 'competitors'}`}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend />

          {/* Competitor price line for retail mode */}
          <Line
            type="monotone"
            dataKey="competitorPrice"
            name="Competitor Price"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />

          {/* Our retail price line */}
          <Line
            type="monotone"
            dataKey="integrationPrice"
            name="Our Price"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PriceHistoryChart;
