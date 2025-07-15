'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatNumber } from '@/lib/utils/format';

interface PriorityProductData {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_brand: string;
  product_ean: string;
  our_price: number;
  lowest_competitor_price: number;
  price_difference: number;
  price_difference_percentage: number;
  potential_savings: number;
  competitor_count: number;
  most_competitive_competitor_name: string;
}

const ExportPriceMatchingButton: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportPriceMatchingList = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    
    try {
      // Fetch all products in batches to avoid Supabase 1000 limit
      let allProducts: PriorityProductData[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      toast({
        title: "Exporting...",
        description: "Fetching all products that need price matching. This may take a moment.",
      });

      while (hasMore) {
        const response = await fetch('/api/insights/competitor-analysis/priority-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_filter: null,
            limit: batchSize,
            offset: offset,
            format: 'json' // Get JSON first to check if there are more
          })
        });

        if (!response.ok) throw new Error('Failed to fetch priority products');

        const result = await response.json();
        const batchProducts = result.data || [];
        
        allProducts = allProducts.concat(batchProducts);
        
        // Check if we got a full batch (indicating there might be more)
        hasMore = batchProducts.length === batchSize;
        offset += batchSize;

        // Safety check to prevent infinite loops
        if (offset > 50000) {
          console.warn('Reached safety limit of 50,000 products');
          break;
        }
      }

      // Convert to CSV
      if (allProducts.length === 0) {
        toast({
          title: "No Data",
          description: "No products found that need price matching",
        });
        return;
      }

      const headers = [
        'Product Name',
        'SKU',
        'Brand',
        'EAN',
        'Our Price',
        'Lowest Competitor Price',
        'Price Difference',
        'Price Difference %',
        'Competitor Count',
        'Competitor with lowest price'
      ];

      const csvContent = [
        headers.join(','),
        ...allProducts.map(product => [
          `"${product.product_name?.replace(/"/g, '""') || ''}"`,
          `"${product.product_sku || ''}"`,
          `"${product.product_brand?.replace(/"/g, '""') || ''}"`,
          `"${product.product_ean || ''}"`,
          product.our_price || '',
          product.lowest_competitor_price || '',
          product.price_difference || '',
          product.price_difference_percentage || '',
          product.competitor_count || '',
          `"${product.most_competitive_competitor_name?.replace(/"/g, '""') || ''}"`
        ].join(','))
      ].join('\n');

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `price-matching-list-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Exported ${formatNumber(allProducts.length)} products that need price matching`,
      });
    } catch (error) {
      console.error('Error exporting price matching list:', error);
      toast({
        title: "Error",
        description: "Failed to export price matching list",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={exportPriceMatchingList}
      disabled={isExporting}
      className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
        <Download className={`h-6 w-6 ${isExporting ? 'animate-pulse' : ''}`} />
      </div>
      <h3 className="mb-1 text-base font-medium text-gray-900">
        {isExporting ? 'Exporting...' : 'Export Price Matching List'}
      </h3>
      <p className="text-center text-sm text-gray-500">
        {isExporting ? 'Please wait...' : 'Download all products that need repricing'}
      </p>
    </button>
  );
};

export default ExportPriceMatchingButton;
