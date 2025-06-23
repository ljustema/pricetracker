/**
 * Utility functions for stock display and formatting
 */

export interface StockDisplayInfo {
  text: string;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'gray' | 'blue';
  badge: string;
  icon?: string;
}

/**
 * Get display information for stock quantity and status
 */
export function getStockDisplay(
  stockQuantity: number | null,
  stockStatus: string | null,
  availabilityDate?: string | null
): StockDisplayInfo {
  // Debug logging
  console.log('getStockDisplay called with:', { stockQuantity, stockStatus, availabilityDate });
  // Handle null/undefined stock
  if (stockQuantity === null && !stockStatus) {
    return { 
      text: "Unknown", 
      color: "gray", 
      badge: "Unknown",
      icon: "❓"
    };
  }

  // Handle negative stock (oversold/pre-orders)
  if (stockQuantity !== null && stockQuantity < 0) {
    const absStock = Math.abs(stockQuantity);
    return { 
      text: `Pre-order (${absStock})`, 
      color: "orange", 
      badge: "Pre-order",
      icon: "📋"
    };
  }

  // Handle zero stock
  if (stockQuantity === 0) {
    // Check if there's a future availability date
    if (availabilityDate) {
      const date = new Date(availabilityDate);
      const today = new Date();
      if (date > today) {
        return { 
          text: `Coming ${date.toLocaleDateString()}`, 
          color: "blue", 
          badge: "Coming Soon",
          icon: "📅"
        };
      }
    }
    
    return { 
      text: "Out of stock", 
      color: "red", 
      badge: "Out of Stock",
      icon: "❌"
    };
  }

  // Handle positive stock quantities
  if (stockQuantity !== null) {
    if (stockQuantity <= 5) {
      return { 
        text: `Low stock (${stockQuantity})`, 
        color: "yellow", 
        badge: "Low Stock",
        icon: "⚠️"
      };
    } else if (stockQuantity <= 20) {
      return { 
        text: `${stockQuantity} in stock`, 
        color: "green", 
        badge: "In Stock",
        icon: "✅"
      };
    } else {
      return {
        text: `${stockQuantity} in stock`,
        color: "green",
        badge: "In Stock",
        icon: "✅"
      };
    }
  }

  // Handle status-only information
  if (stockStatus) {
    switch (stockStatus.toLowerCase()) {
      case 'in_stock':
        return { 
          text: "In stock", 
          color: "green", 
          badge: "In Stock",
          icon: "✅"
        };
      case 'out_of_stock':
        return { 
          text: "Out of stock", 
          color: "red", 
          badge: "Out of Stock",
          icon: "❌"
        };
      case 'limited_stock':
        return { 
          text: "Limited stock", 
          color: "yellow", 
          badge: "Limited",
          icon: "⚠️"
        };
      case 'back_order':
        // If we have a specific quantity for back orders, show it
        if (stockQuantity !== null && stockQuantity < 0) {
          const absStock = Math.abs(stockQuantity);
          return {
            text: `Pre-order (${absStock})`,
            color: "orange",
            badge: "Pre-order",
            icon: "📋"
          };
        }
        return {
          text: "Back order",
          color: "orange",
          badge: "Back Order",
          icon: "📋"
        };
      case 'coming_soon':
        if (availabilityDate) {
          const date = new Date(availabilityDate);
          return { 
            text: `Coming ${date.toLocaleDateString()}`, 
            color: "blue", 
            badge: "Coming Soon",
            icon: "📅"
          };
        }
        return { 
          text: "Coming soon", 
          color: "blue", 
          badge: "Coming Soon",
          icon: "📅"
        };
      case 'discontinued':
        return { 
          text: "Discontinued", 
          color: "gray", 
          badge: "Discontinued",
          icon: "🚫"
        };
      default:
        return { 
          text: stockStatus, 
          color: "gray", 
          badge: "Unknown",
          icon: "❓"
        };
    }
  }

  // Fallback
  return { 
    text: "Unknown", 
    color: "gray", 
    badge: "Unknown",
    icon: "❓"
  };
}

/**
 * Get CSS classes for stock badge styling
 */
export function getStockBadgeClasses(color: StockDisplayInfo['color']): string {
  const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
  
  switch (color) {
    case 'green':
      return `${baseClasses} bg-green-100 text-green-800`;
    case 'yellow':
      return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case 'orange':
      return `${baseClasses} bg-orange-100 text-orange-800`;
    case 'red':
      return `${baseClasses} bg-red-100 text-red-800`;
    case 'blue':
      return `${baseClasses} bg-blue-100 text-blue-800`;
    case 'gray':
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`;
  }
}

/**
 * Calculate sales velocity from stock changes
 */
export function calculateSalesVelocity(stockChanges: Array<{
  stock_change_quantity: number | null;
  changed_at: string;
}>): {
  dailyAverage: number;
  totalSales: number;
  daysTracked: number;
} {
  if (!stockChanges || stockChanges.length === 0) {
    return { dailyAverage: 0, totalSales: 0, daysTracked: 0 };
  }

  // Filter for stock decreases (sales)
  const salesChanges = stockChanges.filter(change => 
    change.stock_change_quantity !== null && change.stock_change_quantity < 0
  );

  if (salesChanges.length === 0) {
    return { dailyAverage: 0, totalSales: 0, daysTracked: 0 };
  }

  // Calculate total sales (absolute value of negative changes)
  const totalSales = salesChanges.reduce((sum, change) => 
    sum + Math.abs(change.stock_change_quantity || 0), 0
  );

  // Calculate unique days with sales
  const uniqueDays = new Set(
    salesChanges.map(change => 
      new Date(change.changed_at).toDateString()
    )
  ).size;

  const dailyAverage = uniqueDays > 0 ? totalSales / uniqueDays : 0;

  return {
    dailyAverage: Math.round(dailyAverage * 100) / 100, // Round to 2 decimal places
    totalSales,
    daysTracked: uniqueDays
  };
}

/**
 * Format availability date for display
 */
export function formatAvailabilityDate(dateString: string | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'Past due';
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays <= 7) {
    return `In ${diffDays} days`;
  } else {
    return date.toLocaleDateString();
  }
}
