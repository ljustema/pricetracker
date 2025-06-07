'use client';

import React from 'react';

interface PriceChangeDisplayProps {
  oldPrice: number;
  newPrice: number;
  currencyCode: string;
  percentage: number;
}

export default function PriceChangeDisplay({ 
  oldPrice, 
  newPrice, 
  currencyCode, 
  percentage 
}: PriceChangeDisplayProps) {
  return (
    <div className="text-right">
      <p className="text-lg font-medium text-red-600">
        {percentage.toFixed(2)}%
      </p>
      <p className="text-sm text-gray-500">
        {new Intl.NumberFormat('sv-SE', { 
          style: 'currency', 
          currency: currencyCode || 'SEK' 
        }).format(oldPrice)} →{' '}
        {new Intl.NumberFormat('sv-SE', { 
          style: 'currency', 
          currency: currencyCode || 'SEK' 
        }).format(newPrice)}
      </p>
    </div>
  );
}
