import React from 'react';
import { Database } from '@/lib/supabase/database.types';
import BrandStatisticsClient from './BrandStatisticsClient';

type Brand = Database['public']['Tables']['brands']['Row'] & {
  product_count?: number;
  competitor_count?: number;
  aliases?: string[];
};

// Define types for competitor stats
interface CompetitorStat {
  id: string;
  name: string;
  totalProducts: number;
}

interface BrandStatisticsServerProps {
  brands: Brand[];
  topCompetitors?: CompetitorStat[];
}

const BrandStatisticsServer: React.FC<BrandStatisticsServerProps> = ({
  brands,
  topCompetitors = []
}) => {
  // Calculate total number of brands
  const totalBrands = brands.length;

  // Calculate total number of products across all brands
  const totalProducts = brands.reduce((sum, brand) => sum + (brand.product_count || 0), 0);

  // Get top 5 brands by product count
  const topBrands = [...brands]
    .sort((a, b) => (b.product_count || 0) - (a.product_count || 0))
    .slice(0, 5);

  // Count brands by product count ranges
  const brandsOver1000 = brands.filter(brand => (brand.product_count || 0) >= 1000).length;
  const brands500to999 = brands.filter(brand => (brand.product_count || 0) >= 500 && (brand.product_count || 0) < 1000).length;
  const brands100to499 = brands.filter(brand => (brand.product_count || 0) >= 100 && (brand.product_count || 0) < 500).length;
  const brands10to99 = brands.filter(brand => (brand.product_count || 0) >= 10 && (brand.product_count || 0) < 100).length;
  const brands1to9 = brands.filter(brand => (brand.product_count || 0) >= 1 && (brand.product_count || 0) < 10).length;

  return (
    <BrandStatisticsClient
      brands={brands}
      topCompetitors={topCompetitors}
      totalBrands={totalBrands}
      totalProducts={totalProducts}
      topBrands={topBrands}
      brandsOver1000={brandsOver1000}
      brands500to999={brands500to999}
      brands100to499={brands100to499}
      brands10to99={brands10to99}
      brands1to9={brands1to9}
    />
  );
};

export default BrandStatisticsServer;
