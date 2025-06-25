'use client';

import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

// Type definitions for line chart data
interface LineChartDataItem {
  [key: string]: string | number;
}

interface LineConfig {
  key: string;
  color: string;
  name: string;
  strokeDasharray?: string;
}

interface LineTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | string;
    name: string;
    color: string;
  }>;
  label?: string | number;
}

interface LineChartProps {
  data: LineChartDataItem[];
  xKey: string;
  lines: LineConfig[];
  title?: string;
  height?: number;
  formatValue?: (value: number | string) => string;
  formatLabel?: (label: string | number) => string;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  xKey,
  lines,
  title,
  height = 300,
  formatValue,
  formatLabel
}) => {
  const CustomTooltip = ({ active, payload, label }: LineTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">
            {formatLabel ? formatLabel(label || '') : label}
          </p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${formatValue ? formatValue(entry.value) : entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey={xKey} 
            stroke="#6B7280"
            fontSize={12}
            tickFormatter={formatLabel}
          />
          <YAxis 
            stroke="#6B7280"
            fontSize={12}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray={line.strokeDasharray}
              name={line.name}
              dot={{ fill: line.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: line.color, strokeWidth: 2 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChart;
