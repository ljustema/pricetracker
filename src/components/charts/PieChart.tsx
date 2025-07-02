'use client';

import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

// Type definitions for pie chart data
interface PieChartDataItem {
  [key: string]: string | number;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PieChartDataItem;
    value: number | string;
    name: string;
  }>;
}

interface PieChartProps {
  data: PieChartDataItem[];
  dataKey: string;
  nameKey: string;
  title?: string;
  height?: number;
  colors?: string[];
  formatValue?: (value: number | string) => string;
  showLegend?: boolean;
}

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const PieChart: React.FC<PieChartProps> = ({
  data,
  dataKey,
  nameKey,
  title,
  height = 300,
  colors = COLORS,
  formatValue,
  showLegend = true
}) => {
  const CustomTooltip = ({ active, payload }: PieTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data[nameKey]}</p>
          <p className="text-blue-600">
            {`${dataKey}: ${formatValue ? formatValue(data[dataKey]) : data[dataKey]}`}
          </p>
          {typeof data.percentage === 'number' && (
            <p className="text-gray-600">
              {`Percentage: ${data.percentage.toFixed(1)}%`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  interface PieLegendPayloadItem {
    value: string;
    color: string;
  }

  interface PieLegendProps {
    payload?: PieLegendPayloadItem[];
  }

  const CustomLegend = ({ payload }: PieLegendProps) => {
    // Calculate total for percentages
    const total = data.reduce((sum, item) => sum + Number(item[dataKey]), 0);

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: PieLegendPayloadItem, index: number) => {
          const dataItem = data.find(item => item[nameKey] === entry.value);
          const percentage = dataItem ? ((Number(dataItem[dataKey]) / total) * 100).toFixed(1) : '0';

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600">
                {entry.value} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="40%"
            labelLine={false}
            outerRadius={Math.min(height * 0.25, 100)}
            fill="#8884d8"
            dataKey={dataKey}
            label={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend content={<CustomLegend />} />}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChart;
