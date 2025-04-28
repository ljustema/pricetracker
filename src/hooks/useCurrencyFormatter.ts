"use client";

import { useState, useEffect } from "react";

interface CurrencySettings {
  primary_currency: string;
  currency_format: string;
}

/**
 * Hook to format prices according to user's currency settings
 */
export function useCurrencyFormatter() {
  const [settings, setSettings] = useState<CurrencySettings>({
    primary_currency: "USD",
    currency_format: "#,##0.00",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrencySettings = async () => {
      try {
        const response = await fetch("/api/settings/currency");
        if (response.ok) {
          const data = await response.json();
          setSettings({
            primary_currency: data.primary_currency || "USD",
            currency_format: data.currency_format || "#,##0.00",
          });
        }
      } catch (error) {
        console.error("Error fetching currency settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrencySettings();
  }, []);

  /**
   * Format a price according to the user's currency settings
   */
  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined) return "-";

    // Get currency symbol and format based on currency code
    const currencySymbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      SEK: "kr",
      NOK: "kr",
      DKK: "kr",
    };

    const symbol = currencySymbols[settings.primary_currency] || settings.primary_currency;
    
    // Format the number based on the currency_format setting
    let formattedNumber = "";
    
    switch (settings.currency_format) {
      case "#,##0.00": // 1,234.56
        formattedNumber = new Intl.NumberFormat('en-US', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(price);
        break;
      case "#.##0,00": // 1.234,56
        formattedNumber = new Intl.NumberFormat('de-DE', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(price);
        break;
      case "# ##0.00": // 1 234.56
        formattedNumber = new Intl.NumberFormat('en-CA', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(price);
        break;
      case "# ##0,00": // 1 234,56
        formattedNumber = new Intl.NumberFormat('sv-SE', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(price);
        break;
      default:
        formattedNumber = price.toFixed(2);
    }

    // Return the formatted price with the currency symbol
    // For SEK, NOK, DKK, the symbol comes after the number
    if (['SEK', 'NOK', 'DKK'].includes(settings.primary_currency)) {
      return `${formattedNumber} ${symbol}`;
    }
    
    // For other currencies, the symbol comes before the number
    return `${symbol}${formattedNumber}`;
  };

  return { formatPrice, isLoading, settings };
}
