'use client';

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Type definitions for chart data
interface ChartDataItem {
  [key: string]: string | number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | string;
    name: string;
  }>;
  label?: string | number;
}

interface BarChartProps {
  data: ChartDataItem[];
  xKey: string;
  yKey: string;
  title?: string;
  height?: number;
  color?: string;
  formatValue?: (value: number | string) => string;
  formatLabel?: (label: string | number) => string;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  xKey,
  yKey,
  title,
  height = 300,
  color = '#3B82F6',
  formatValue,
  formatLabel
}) => {
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">
            {formatLabel ? formatLabel(label || '') : label}
          </p>
          <p className="text-blue-600">
            {`${yKey}: ${formatValue ? formatValue(payload[0].value) : payload[0].value}`}
          </p>
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
        <RechartsBarChart
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
          <Bar 
            dataKey={yKey} 
            fill={color}
            radius={[4, 4, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;
