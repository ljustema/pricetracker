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

// Type definitions for donut chart data
interface DonutChartDataItem {
  [key: string]: string | number;
}

interface DonutTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DonutChartDataItem;
    value: number | string;
    name: string;
  }>;
}

interface DonutChartProps {
  data: DonutChartDataItem[];
  dataKey: string;
  nameKey: string;
  title?: string;
  height?: number;
  colors?: string[];
  formatValue?: (value: number | string) => string;
  showLegend?: boolean;
  centerText?: string;
  outerRadius?: number;
  innerRadius?: number;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'];

const DonutChart: React.FC<DonutChartProps> = ({
  data,
  dataKey,
  nameKey,
  title,
  height = 300,
  colors = COLORS,
  formatValue,
  showLegend = true,
  centerText,
  outerRadius = 80,
  innerRadius = 40
}) => {
  const CustomTooltip = ({ active, payload }: DonutTooltipProps) => {
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

  interface LegendPayloadItem {
    value: string;
    color: string;
  }

  interface LegendProps {
    payload?: LegendPayloadItem[];
  }

  const CustomLegend = ({ payload }: LegendProps) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: LegendPayloadItem, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-600">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full relative">
      {title && (
        <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey={dataKey}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend content={<CustomLegend />} />}
        </RechartsPieChart>
      </ResponsiveContainer>
      
      {centerText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{centerText}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonutChart;
