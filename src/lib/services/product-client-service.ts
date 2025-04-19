"use client";

export interface Product {
  id: string;
  user_id: string;
  name: string;
  sku?: string;
  ean?: string;
  brand?: string;
  category?: string;
  description?: string;
  image_url?: string;
  our_price?: number;
  cost_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScrapedProduct {
  id: string;
  user_id: string;
  scraper_id: string;
  competitor_id: string;
  product_id: string;
  name: string;
  price: number;
  currency: string;
  url?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  scraped_at: string;
  competitors?: {
    name: string;
    website?: string;
  };
  scrapers?: {
    name: string;
    url: string;
  };
}

export interface PriceChange {
  id: string;
  user_id: string;
  product_id: string;
  competitor_id: string;
  old_price: number;
  new_price: number;
  price_change_percentage: number;
  changed_at: string;
  competitors?: {
    name: string;
  };
}

export interface CreateProductData {
  name: string;
  sku?: string;
  ean?: string;
  brand?: string;
  category?: string;
  description?: string;
  image_url?: string;
  our_price?: number;
  cost_price?: number;
  is_active?: boolean;
}

export interface UpdateProductData extends CreateProductData {
  id: string;
}

export async function getProducts(): Promise<Product[]> {
  const response = await fetch('/api/products', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch products');
  }
  
  return response.json();
}

export async function getProduct(productId: string): Promise<Product> {
  const response = await fetch(`/api/products/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch product');
  }
  
  return response.json();
}

export async function createProduct(data: CreateProductData): Promise<Product> {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create product');
  }
  
  return response.json();
}

export async function updateProduct(productId: string, data: CreateProductData): Promise<Product> {
  const response = await fetch(`/api/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update product');
  }
  
  return response.json();
}

export async function deleteProduct(productId: string): Promise<void> {
  const response = await fetch(`/api/products/${productId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete product');
  }
}

export async function getScrapedProducts(filters: {
  productId?: string;
  competitorId?: string;
  scraperId?: string;
} = {}): Promise<ScrapedProduct[]> {
  // Build query string from filters
  const queryParams = new URLSearchParams();
  
  if (filters.productId) {
    queryParams.append('productId', filters.productId);
  }
  
  if (filters.competitorId) {
    queryParams.append('competitorId', filters.competitorId);
  }
  
  if (filters.scraperId) {
    queryParams.append('scraperId', filters.scraperId);
  }
  
  const queryString = queryParams.toString();
  const url = `/api/scraped-products${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scraped products');
  }
  
  return response.json();
}

/**
 * Get the latest competitor prices for a product
 */
export async function getLatestCompetitorPrices(
  productId: string
): Promise<PriceChange[]> {
  const queryParams = new URLSearchParams({
    latest: 'true'
  });
  
  const response = await fetch(`/api/products/${productId}/prices?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch competitor prices');
  }
  
  return response.json();
}

/**
 * Get price history for a product from a specific competitor
 */
export async function getProductPriceHistory(
  productId: string,
  competitorId?: string,
  limit: number = 50
): Promise<PriceChange[]> {
  const queryParams = new URLSearchParams({
    limit: limit.toString()
  });
  
  if (competitorId) {
    queryParams.append('competitorId', competitorId);
  }
  
  const response = await fetch(`/api/products/${productId}/prices?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch price history');
  }
  
  return response.json();
}

/**
 * Upload a CSV file with product prices for a specific competitor
 */
export async function uploadProductsCSV(
  competitorId: string,
  file: File
): Promise<{ success: boolean; productsAdded: number; pricesUpdated: number }> {
  const formData = new FormData();
  formData.append('competitorId', competitorId);
  formData.append('file', file);

  const response = await fetch('/api/products/csv-upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload CSV file');
  }

  return response.json();
}

/**
 * Get a CSV template for product uploads
 */
export async function getProductCSVTemplate(): Promise<string> {
  const response = await fetch('/api/products/csv-template', {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get CSV template');
  }

  return response.text();
}