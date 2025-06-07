import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils/uuid";

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  website?: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
  notes?: string;
  // Login credentials for automated scraping/API access
  login_username?: string;
  login_password?: string;
  api_key?: string;
  api_url?: string;
  login_url?: string;
  price_file_url?: string;
  // Configuration for automation
  scraping_config?: Record<string, unknown>;
  sync_frequency?: 'daily' | 'weekly' | 'monthly' | 'manual';
  last_sync_at?: string;
  last_sync_status?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierPriceChange {
  id: string;
  user_id: string;
  product_id: string;
  supplier_id?: string;
  integration_id?: string;
  old_supplier_price?: number;
  new_supplier_price?: number;
  old_supplier_recommended_price?: number;
  new_supplier_recommended_price?: number;
  old_our_wholesale_price?: number;
  new_our_wholesale_price?: number;
  price_change_percentage?: number;
  currency_code: string;
  url?: string;
  minimum_order_quantity?: number;
  lead_time_days?: number;
  changed_at: string;
  change_source: 'manual' | 'csv' | 'scraper' | 'integration';
  suppliers?: {
    name: string;
  };
  integrations?: {
    name: string;
  };
}

/**
 * Fetches all suppliers for a given user.
 * @param userId The UUID of the user.
 * @returns A promise that resolves to an array of Supplier objects.
 */
export async function getSuppliers(userId: string): Promise<Supplier[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("user_id", uuid)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching suppliers:", error);
    throw new Error(`Failed to fetch suppliers: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetches a single supplier by ID for a given user.
 * @param userId The UUID of the user.
 * @param supplierId The UUID of the supplier.
 * @returns A promise that resolves to a Supplier object or null.
 */
export async function getSupplier(userId: string, supplierId: string): Promise<Supplier | null> {
  const supabase = createSupabaseAdminClient();
  const userUuid = ensureUUID(userId);
  const supplierUuid = ensureUUID(supplierId);

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("user_id", userUuid)
    .eq("id", supplierUuid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No rows returned
    }
    console.error("Error fetching supplier:", error);
    throw new Error(`Failed to fetch supplier: ${error.message}`);
  }

  return data;
}

/**
 * Creates a new supplier for a given user.
 * @param userId The UUID of the user.
 * @param supplierData The supplier data to create.
 * @returns A promise that resolves to the created Supplier object.
 */
export async function createSupplier(
  userId: string, 
  supplierData: Omit<Supplier, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Supplier> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      user_id: uuid,
      ...supplierData,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating supplier:", error);
    throw new Error(`Failed to create supplier: ${error.message}`);
  }

  return data;
}

/**
 * Updates an existing supplier for a given user.
 * @param userId The UUID of the user.
 * @param supplierId The UUID of the supplier to update.
 * @param supplierData The supplier data to update.
 * @returns A promise that resolves to the updated Supplier object.
 */
export async function updateSupplier(
  userId: string,
  supplierId: string,
  supplierData: Partial<Omit<Supplier, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Supplier> {
  const supabase = createSupabaseAdminClient();
  const userUuid = ensureUUID(userId);
  const supplierUuid = ensureUUID(supplierId);

  const { data, error } = await supabase
    .from("suppliers")
    .update({
      ...supplierData,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userUuid)
    .eq("id", supplierUuid)
    .select()
    .single();

  if (error) {
    console.error("Error updating supplier:", error);
    throw new Error(`Failed to update supplier: ${error.message}`);
  }

  return data;
}

/**
 * Deletes a supplier for a given user.
 * @param userId The UUID of the user.
 * @param supplierId The UUID of the supplier to delete.
 * @returns A promise that resolves when the supplier is deleted.
 */
export async function deleteSupplier(userId: string, supplierId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const userUuid = ensureUUID(userId);
  const supplierUuid = ensureUUID(supplierId);

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("user_id", userUuid)
    .eq("id", supplierUuid);

  if (error) {
    console.error("Error deleting supplier:", error);
    throw new Error(`Failed to delete supplier: ${error.message}`);
  }
}

/**
 * Fetches supplier price changes for a given product and supplier.
 * @param userId The UUID of the user.
 * @param productId The UUID of the product.
 * @param supplierId The UUID of the supplier.
 * @returns A promise that resolves to an array of SupplierPriceChange objects.
 */
export async function getSupplierPriceChanges(
  userId: string,
  productId?: string,
  supplierId?: string
): Promise<SupplierPriceChange[]> {
  const supabase = createSupabaseAdminClient();
  const userUuid = ensureUUID(userId);

  let query = supabase
    .from("price_changes_suppliers")
    .select(`
      *,
      suppliers(name),
      integrations(name)
    `)
    .eq("user_id", userUuid)
    .order("changed_at", { ascending: false });

  if (productId) {
    query = query.eq("product_id", ensureUUID(productId));
  }

  if (supplierId) {
    query = query.eq("supplier_id", ensureUUID(supplierId));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching supplier price changes:", error);
    throw new Error(`Failed to fetch supplier price changes: ${error.message}`);
  }

  return data || [];
}

/**
 * Creates a new supplier price change.
 * @param userId The UUID of the user.
 * @param priceChangeData The price change data to create.
 * @returns A promise that resolves to the created SupplierPriceChange object.
 */
export async function createSupplierPriceChange(
  userId: string,
  priceChangeData: Omit<SupplierPriceChange, 'id' | 'user_id' | 'changed_at'>
): Promise<SupplierPriceChange> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("price_changes_suppliers")
    .insert({
      user_id: uuid,
      ...priceChangeData,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating supplier price change:", error);
    throw new Error(`Failed to create supplier price change: ${error.message}`);
  }

  return data;
}
