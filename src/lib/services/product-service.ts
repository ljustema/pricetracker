import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from '@/lib/utils/uuid';
import { BrandService } from "./brand-service"; // Import BrandService

export interface Product {
  id: string;
  user_id: string;
  name: string;
  sku: string | null; // Allow null
  ean: string | null; // Allow null
  brand: string | null; // Keep the original brand text for now, but brand_id is source of truth
  brand_id: string | null; // Add brand_id, allow null
  category: string | null; // Allow null
  description: string | null; // Allow null
  image_url: string | null; // Allow null
  our_price: number | null; // Allow null
  wholesale_price: number | null; // Allow null
  is_active: boolean;
  created_at: string;
  updated_at: string;
  competitor_prices?: { [key: string]: number }; // Added field for competitor prices { competitor_id: price }
  source_prices?: {
    [key: string]: {
      price: number;
      source_type: 'competitor' | 'integration';
      source_name: string;
    }
  }; // New field for source prices with type information
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
  competitor_id?: string;
  integration_id?: string;
  source_id?: string; // Either competitor_id or integration_id
  source_name?: string; // Name of the competitor or integration
  source_type?: 'competitor' | 'integration';
  old_price: number;
  new_price: number;
  price_change_percentage: number;
  changed_at: string;
  url?: string; // URL to the product on the competitor's website
  currency_code?: string;
  competitors?: {
    id?: string;
    name: string;
    website?: string;
  };
  source?: {
    name: string;
    website?: string;
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
    .from("temp_competitors_scraped_data")
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

  const dataToInsert: Partial<Product> = {
    user_id: uuid,
    name: productData.name,
    sku: productData.sku || null,
    ean: productData.ean || null,
    // brand: productData.brand || null, // Keep original brand text for now
    category: productData.category || null,
    description: productData.description || null,
    image_url: productData.image_url || null,
    our_price: productData.our_price || null,
    wholesale_price: productData.wholesale_price || null,
    is_active: productData.is_active !== undefined ? productData.is_active : true,
  };

  // Handle brand standardization if brand text is provided
  if (productData.brand) {
      const brandService = new BrandService();
      try {
          // Find or create the brand and get its ID
          const brand = await brandService.findOrCreateBrandByName(userId, productData.brand);
          if (brand?.id) {
              dataToInsert.brand_id = brand.id;
              // Optionally, remove the original brand text if brand_id is set
              // delete dataToInsert.brand;
          } else {
              console.warn(`Could not find or create brand for name "${productData.brand}" for product creation.`);
              // Keep the brand text if brand_id could not be set
              dataToInsert.brand = productData.brand;
          }
      } catch (brandError) {
          console.error(`Error processing brand "${productData.brand}" during product creation:`, brandError);
           // Keep the brand text if brand processing fails
          dataToInsert.brand = productData.brand;
      }
  } else {
      // If no brand text is provided, ensure brand_id is null
      dataToInsert.brand_id = null;
      dataToInsert.brand = null;
  }

  const { data, error } = await supabase
    .from("products")
    .insert(dataToInsert)
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

  // Prepare the data to update
  const dataToUpdate: Partial<Product> = {
    name: productData.name,
    sku: productData.sku || null,
    ean: productData.ean || null,
    category: productData.category || null,
    description: productData.description || null,
    image_url: productData.image_url || null,
    our_price: productData.our_price || null,
    wholesale_price: productData.wholesale_price || null,
    is_active: productData.is_active !== undefined ? productData.is_active : true,
    updated_at: new Date().toISOString(),
  };

  // Handle brand standardization if brand text is provided
  if (productData.brand) {
    const brandService = new BrandService();
    try {
      // Find or create the brand and get its ID
      const brand = await brandService.findOrCreateBrandByName(uuid, productData.brand);
      if (brand?.id) {
        dataToUpdate.brand_id = brand.id;
        dataToUpdate.brand = productData.brand; // Keep the original brand text for reference
      } else {
        console.warn(`Could not find or create brand for name "${productData.brand}" for product update.`);
        // Keep the brand text if brand_id could not be set
        dataToUpdate.brand = productData.brand;
      }
    } catch (brandError) {
      console.error(`Error processing brand "${productData.brand}" during product update:`, brandError);
      // Keep the brand text if brand processing fails
      dataToUpdate.brand = productData.brand;
    }
  } else if (productData.brand === null) {
    // If brand is explicitly set to null, clear both brand and brand_id
    dataToUpdate.brand = null;
    dataToUpdate.brand_id = null;
  }

  const { data, error } = await supabase
    .from("products")
    .update(dataToUpdate)
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
 * Get the latest competitor and integration prices for a product
 */
export async function getLatestCompetitorPrices(
  userId: string,
  productId: string
): Promise<PriceChange[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  // Use the database function that handles both competitor and integration prices
  try {
    const { data, error } = await supabase
      .rpc('get_latest_competitor_prices', {
        p_user_id: uuid,
        p_product_id: productId
      });

    if (error) {
      console.error("Error fetching latest prices:", error);
      // Fall back to direct query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("price_changes")
        .select(`
          *,
          competitors(name, website)
        `)
        .eq("user_id", uuid)
        .eq("product_id", productId)
        .order("changed_at", { ascending: false });

      if (fallbackError) {
        console.error("Error in fallback latest prices query:", fallbackError);
        return [];
      }

      // Get only the latest price change for each competitor
      const latestPrices = new Map<string, PriceChange>();
      fallbackData.forEach((priceChange: PriceChange) => {
        const sourceId = priceChange.competitor_id || priceChange.integration_id;
        if (sourceId && !latestPrices.has(sourceId)) {
          latestPrices.set(sourceId, priceChange);
        }
      });

      return Array.from(latestPrices.values());
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error fetching latest prices:", error);
    return [];
  }
}

/**
 * Get price history for a product from a specific source (competitor or integration)
 */
export async function getProductPriceHistory(
  userId: string,
  productId: string,
  sourceId?: string,
  limit: number = 50
): Promise<PriceChange[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  // Use the database function that handles both competitor and integration prices
  try {
    const { data, error } = await supabase
      .rpc('get_product_price_history', {
        p_user_id: uuid,
        p_product_id: productId,
        p_source_id: sourceId || null,
        p_limit: limit
      });

    if (error) {
      console.error("Error fetching price history:", error);
      // Fall back to direct query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("price_changes")
        .select(`
          *,
          competitors(name, website)
        `)
        .eq("user_id", uuid)
        .eq("product_id", productId)
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (fallbackError) {
        console.error("Error in fallback price history query:", fallbackError);
        return [];
      }

      return fallbackData || [];
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error fetching price history:", error);
    return [];
  }

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
  sourceId?: string; // Can be either competitor_id or integration_id
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
    p_source_id: filters.sourceId || null,
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