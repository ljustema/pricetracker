/**
 * Format a number as currency
 * @param value The number to format
 * @param currencyCode The ISO currency code (default: 'SEK')
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | null | undefined, currencyCode: string = 'SEK'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage value
 * @param value The number to format as percentage
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date to a localized string
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('sv-SE', options).format(dateObj);
}

/**
 * Format a number with thousand separators
 * @param value The number to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(0);
  }
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
