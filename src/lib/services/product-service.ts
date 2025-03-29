import { createSupabaseAdminClient } from "@/lib/supabase/server";
import crypto from 'crypto';

// Helper function to ensure user ID is a valid UUID
export function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  
  // If not a UUID, create a deterministic UUID v5 from the ID
  // Using the DNS namespace as a base
  return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

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

export interface ProductWithPrices extends Product {
  competitor_prices?: {
    competitor_id: string;
    competitor_name: string;
    price: number;
    changed_at: string;
  }[];
}

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

/**
 * Get products with their latest competitor prices
 */
export async function getProductsWithPrices(userId: string): Promise<ProductWithPrices[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);
  
  // First get all products - set a very high limit to ensure we get everything
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", uuid)
    .order("created_at", { ascending: false })
    .limit(10000); // Set a very high limit to ensure we get all products
  
  if (productsError) {
    console.error("Error fetching products:", productsError);
    throw new Error(`Failed to fetch products: ${productsError.message}`);
  }
  
  if (!products || products.length === 0) {
    return [];
  }
  
  // Get the latest price changes for all products
  const productIds = products.map(product => product.id);
  
  // Split product IDs into smaller batches to avoid URL length limits
  const batchSize = 10; // Adjust this number based on your needs
  const batches = [];
  
  for (let i = 0; i < productIds.length; i += batchSize) {
    batches.push(productIds.slice(i, i + batchSize));
  }
  
  // Fetch price changes in batches
  let allPriceChanges: PriceChangeWithCompetitor[] = [];
  
  for (const batch of batches) {
    const { data: batchPriceChanges, error: batchError } = await supabase
      .from("price_changes")
      .select(`
        id,
        product_id,
        competitor_id,
        new_price,
        changed_at,
        competitors(id, name)
      `)
      .eq("user_id", uuid)
      .in("product_id", batch)
      .order("changed_at", { ascending: false })
      .returns<PriceChangeWithCompetitor[]>(); // Explicitly type the return
    
    if (batchError) {
      console.error("Error fetching price changes batch:", batchError);
      throw new Error(`Failed to fetch price changes: ${batchError.message}`);
    }
    
    if (batchPriceChanges) {
      allPriceChanges = [...allPriceChanges, ...batchPriceChanges];
    }
  }
  
  const priceChanges = allPriceChanges;
  
  // Define types for the query results
  interface CompetitorPriceInfo {
    competitor_id: string;
    competitor_name: string;
    price: number;
    changed_at: string;
  }
  
  interface CompetitorData {
    id: string;
    name: string;
  }
  
  interface PriceChangeWithCompetitor {
    id: string;
    product_id: string;
    competitor_id: string;
    new_price: number;
    changed_at: string;
    competitors: CompetitorData;
  }
  
  // Group price changes by product and competitor
  const latestPricesByProduct = new Map<string, Map<string, CompetitorPriceInfo>>();
  
  // Cast the price changes to the correct type
  const typedPriceChanges = priceChanges as unknown as PriceChangeWithCompetitor[];
  
  typedPriceChanges?.forEach(priceChange => {
    const productId = priceChange.product_id;
    const competitorId = priceChange.competitor_id;
    
    if (!latestPricesByProduct.has(productId)) {
      latestPricesByProduct.set(productId, new Map());
    }
    
    const productPrices = latestPricesByProduct.get(productId)!;
    
    if (!productPrices.has(competitorId)) {
      productPrices.set(competitorId, {
        competitor_id: competitorId,
        competitor_name: priceChange.competitors?.name || 'Unknown',
        price: priceChange.new_price,
        changed_at: priceChange.changed_at
      });
    }
  });
  
  // Combine products with their latest competitor prices
  const productsWithPrices = products.map(product => {
    const competitorPrices = latestPricesByProduct.get(product.id);
    
    return {
      ...product,
      competitor_prices: competitorPrices ? Array.from(competitorPrices.values()) : []
    };
  });
  
  return productsWithPrices;
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