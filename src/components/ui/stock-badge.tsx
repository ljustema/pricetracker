import React from 'react';
import { getStockDisplay, getStockBadgeClasses, formatAvailabilityDate, StockDisplayInfo } from '@/lib/utils/stock-utils';

interface StockBadgeProps {
  stockQuantity: number | null;
  stockStatus: string | null;
  availabilityDate?: string | null;
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StockBadge({
  stockQuantity,
  stockStatus,
  availabilityDate,
  showIcon = true,
  showTooltip = true,
  size = 'sm',
  className = ''
}: StockBadgeProps) {
  const stockInfo = getStockDisplay(stockQuantity, stockStatus, availabilityDate);
  const badgeClasses = getStockBadgeClasses(stockInfo.color);
  
  // Size variations
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const tooltipContent = React.useMemo(() => {
    const parts = [];
    
    if (stockQuantity !== null) {
      parts.push(`Quantity: ${stockQuantity}`);
    }
    
    if (stockStatus) {
      parts.push(`Status: ${stockStatus.replace('_', ' ')}`);
    }
    
    if (availabilityDate) {
      parts.push(`Available: ${formatAvailabilityDate(availabilityDate)}`);
    }
    
    return parts.join('\n');
  }, [stockQuantity, stockStatus, availabilityDate]);

  const badge = (
    <span 
      className={`
        inline-flex items-center rounded-full font-medium
        ${sizeClasses[size]}
        ${badgeClasses}
        ${className}
      `}
      title={showTooltip ? tooltipContent : undefined}
    >
      {showIcon && stockInfo.icon && (
        <span className="mr-1" aria-hidden="true">
          {stockInfo.icon}
        </span>
      )}
      {stockInfo.badge}
    </span>
  );

  return badge;
}

// Compact version for table cells
export function StockBadgeCompact({
  stockQuantity,
  stockStatus,
  availabilityDate,
  className = ''
}: Omit<StockBadgeProps, 'size' | 'showIcon' | 'showTooltip'>) {
  return (
    <StockBadge
      stockQuantity={stockQuantity}
      stockStatus={stockStatus}
      availabilityDate={availabilityDate}
      size="sm"
      showIcon={false}
      showTooltip={true}
      className={className}
    />
  );
}

// Text-only version for product cards (same height as price text)
export function StockText({
  stockQuantity,
  stockStatus,
  availabilityDate,
  className = ''
}: Omit<StockBadgeProps, 'size' | 'showIcon' | 'showTooltip'>) {
  const stockInfo = getStockDisplay(stockQuantity, stockStatus, availabilityDate);

  // Get text color based on stock status
  const getTextColor = (color: StockDisplayInfo['color']): string => {
    switch (color) {
      case 'green':
        return 'text-green-600';
      case 'yellow':
        return 'text-yellow-600';
      case 'orange':
        return 'text-orange-600';
      case 'red':
        return 'text-red-600';
      case 'blue':
        return 'text-blue-600';
      case 'gray':
      default:
        return 'text-gray-600';
    }
  };

  return (
    <span
      className={`text-xs font-medium ${getTextColor(stockInfo.color)} ${className}`}
      title={`${stockInfo.text}${stockQuantity !== null ? ` (${stockQuantity})` : ''}`}
    >
      {stockInfo.badge}
    </span>
  );
}

// Detailed version with quantity display
export function StockBadgeDetailed({
  stockQuantity,
  stockStatus,
  availabilityDate,
  className = ''
}: Omit<StockBadgeProps, 'size' | 'showIcon' | 'showTooltip'>) {
  const stockInfo = getStockDisplay(stockQuantity, stockStatus, availabilityDate);
  const badgeClasses = getStockBadgeClasses(stockInfo.color);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClasses}`}>
        {stockInfo.icon && (
          <span className="mr-1" aria-hidden="true">
            {stockInfo.icon}
          </span>
        )}
        {stockInfo.badge}
      </span>
      <span className="text-sm text-gray-600">
        {stockInfo.text}
      </span>
    </div>
  );
}
