import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from '@/lib/utils/uuid';

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
  competitor_prices?: { [key: string]: number }; // Added field for competitor prices { competitor_id: price }
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

// Removed ProductWithPrices interface and getProductsWithPrices function as they are now redundant.
// The competitor_prices field is now directly part of the Product interface.

export async function getProducts(userId: string): Promise<Product[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", uuid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching products:", error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}


export async function getProduct(userId: string, productId: string): Promise<Product> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", uuid)
    .single();

  if (error) {
    console.error("Error fetching product:", error);
    throw new Error(`Failed to fetch product: ${error.message}`);
  }

  return data;
}

export async function getScrapedProducts(
  userId: string,
  filters: { productId?: string; competitorId?: string; scraperId?: string } = {}
): Promise<ScrapedProduct[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  let query = supabase
    .from("scraped_products")
    .select(`
      *,
      competitors(name, website),
      scrapers(name, url)
    `)
    .eq("user_id", uuid);

  if (filters.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters.competitorId) {
    query = query.eq("competitor_id", filters.competitorId);
  }

  if (filters.scraperId) {
    query = query.eq("scraper_id", filters.scraperId);
  }

  query = query.order("scraped_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching scraped products:", error);
    throw new Error(`Failed to fetch scraped products: ${error.message}`);
  }

  return data || [];
}

export async function getPriceChanges(
  userId: string,
  filters: { productId?: string; competitorId?: string; limit?: number } = {}
): Promise<PriceChange[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  let query = supabase
    .from("price_changes")
    .select(`
      *,
      competitors(name)
    `)
    .eq("user_id", uuid);

  if (filters.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters.competitorId) {
    query = query.eq("competitor_id", filters.competitorId);
  }

  query = query.order("changed_at", { ascending: false });

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching price changes:", error);
    throw new Error(`Failed to fetch price changes: ${error.message}`);
  }

  return data || [];
}

export async function createProduct(userId: string, productData: Partial<Product>): Promise<Product> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: uuid,
      name: productData.name,
      sku: productData.sku || null,
      ean: productData.ean || null,
      brand: productData.brand || null,
      category: productData.category || null,
      description: productData.description || null,
      image_url: productData.image_url || null,
      our_price: productData.our_price || null,
      cost_price: productData.cost_price || null,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating product:", error);
    throw new Error(`Failed to create product: ${error.message}`);
  }

  return data;
}

export async function updateProduct(
  userId: string,
  productId: string,
  productData: Partial<Product>
): Promise<Product> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("products")
    .update({
      name: productData.name,
      sku: productData.sku || null,
      ean: productData.ean || null,
      brand: productData.brand || null,
      category: productData.category || null,
      description: productData.description || null,
      image_url: productData.image_url || null,
      our_price: productData.our_price || null,
      cost_price: productData.cost_price || null,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("user_id", uuid)
    .select()
    .single();

  if (error) {
    console.error("Error updating product:", error);
    throw new Error(`Failed to update product: ${error.message}`);
  }

  return data;
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", uuid);

  if (error) {
    console.error("Error deleting product:", error);
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}

/**
 * Get the latest competitor prices for a product
 */
export async function getLatestCompetitorPrices(
  userId: string,
  productId: string
): Promise<PriceChange[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  // Get the latest price change for each competitor for this product
  const { data, error } = await supabase
    .from("price_changes")
    .select(`
      *,
      competitors(name, website)
    `)
    .eq("user_id", uuid)
    .eq("product_id", productId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("Error fetching competitor prices:", error);
    throw new Error(`Failed to fetch competitor prices: ${error.message}`);
  }

  // Get only the latest price change for each competitor
  const latestPrices = new Map<string, PriceChange>();
  data.forEach((priceChange: PriceChange) => {
    if (!latestPrices.has(priceChange.competitor_id)) {
      latestPrices.set(priceChange.competitor_id, priceChange);
    }
  });

  return Array.from(latestPrices.values());
}

/**
 * Get price history for a product from a specific competitor
 */
export async function getProductPriceHistory(
  userId: string,
  productId: string,
  competitorId?: string,
  limit: number = 50
): Promise<PriceChange[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  let query = supabase
    .from("price_changes")
    .select(`
      *,
      competitors(name, website)
    `)
    .eq("user_id", uuid)
    .eq("product_id", productId)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (competitorId) {
    query = query.eq("competitor_id", competitorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching price history:", error);
    throw new Error(`Failed to fetch price history: ${error.message}`);
  }

  return data || [];
}


export interface FilteredProductsResponse {
  data: Product[];
  totalCount: number;
}

export interface ProductFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  brand?: string;
  category?: string;
  search?: string;
  isActive?: boolean;
  competitorId?: string;
  hasPrice?: boolean;
}

/**
 * Get products with filtering, sorting, and pagination using the DB function
 */
export async function getFilteredProducts(
  userId: string,
  filters: ProductFilters = {}
): Promise<FilteredProductsResponse> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase.rpc('get_products_filtered', {
    p_user_id: uuid,
    p_page: filters.page || 1,
    p_page_size: filters.pageSize || 12,
    p_sort_by: filters.sortBy || 'created_at',
    p_sort_order: filters.sortOrder || 'desc',
    p_brand: filters.brand || null,
    p_category: filters.category || null,
    p_search: filters.search || null,
    p_is_active: filters.isActive !== undefined ? filters.isActive : null,
    p_competitor_id: filters.competitorId || null,
    p_has_price: filters.hasPrice !== undefined ? filters.hasPrice : null,
  });

  if (error) {
    console.error("Error fetching filtered products:", error);
    // Attempt to provide a more specific error message if possible
    const dbErrorMessage = error.details ? `${error.message} - ${error.details}` : error.message;
    throw new Error(`Failed to fetch filtered products: ${dbErrorMessage}`);
  }

  // The RPC function returns a JSON object { "data": [], "totalCount": 0 }
  // Ensure the structure matches FilteredProductsResponse
  if (data && typeof data === 'object' && 'data' in data && 'totalCount' in data) {
    return data as FilteredProductsResponse;
  } else {
    console.error("Unexpected response structure from get_products_filtered RPC:", data);
    throw new Error("Received unexpected data structure from the database function.");
  }
}