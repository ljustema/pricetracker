// IMPORTANT: After applying database schema changes (like adding columns or tables),
// you MUST regenerate the Supabase types by running the following command in your terminal:
// `supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/supabase/database.types.ts`
// Replace <your-project-id> with your actual Supabase project ID.
// This will update the `Database` type and resolve related TypeScript errors.

import { createSupabaseAdminClient } from '@/lib/supabase/server';
// Removed cookies import as it's not needed with admin client
import { Database } from '@/lib/supabase/database.types';

type Brand = Database['public']['Tables']['brands']['Row'];
// Product type removed as it's not used in this file

export class BrandService {
  // Using the admin client to bypass RLS and session issues, aligning with product-service.ts.
  // WARNING: This bypasses RLS. Security relies solely on filtering by user_id in the service methods.
  // For better security, configure RLS and use createSupabaseServerClient if possible.

  /**
   * Extracts distinct brand names from the products table and populates the brands table.
   * Sets is_active to true and needs_review to false for newly created brands.
   */
  async populateBrandsFromProducts(userId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call as admin client doesn't use user session

    // 1. Get distinct non-empty brand names from products table for the current user
    const { data: distinctBrands, error: distinctError } = await supabase
      .from('products')
      .select('brand')
      .eq('user_id', userId) // Still filter by user_id for data isolation
      .not('brand', 'is', null)
      .neq('brand', '');

    if (distinctError) {
      console.error('Error fetching distinct brands from products:', distinctError);
      throw distinctError;
    }

    if (!distinctBrands || distinctBrands.length === 0) {
      console.log('No distinct brands found in products to populate.');
      return;
    }

    // 2. Prepare data for insertion into the brands table
    // Explicitly type the item in map and brandName in filter/map
    const brandsToInsert = distinctBrands
      .map((item: { brand: string | null }) => item.brand)
      .filter((brandName: string | null | undefined): brandName is string => brandName !== null && brandName !== undefined && brandName.trim() !== '') // Ensure brandName is a non-empty string
      .map((brandName: string) => ({
        user_id: userId, // Ensure user_id is set for data isolation
        name: brandName.trim(), // Trim whitespace
        is_active: true,
        needs_review: false,
      }));

    if (brandsToInsert.length === 0) {
       console.log('No valid brand names found after filtering.');
       return;
    }

    // 3. Upsert distinct brands into the brands table, ignoring conflicts on the unique_user_brand constraint
    const { error: upsertError } = await supabase
      .from('brands')
      .upsert(brandsToInsert, {
        onConflict: 'unique_user_brand', // Specify the constraint name to check for conflicts
        ignoreDuplicates: true,      // If a conflict occurs, ignore the new row
        // defaultToNull: false // Ensure default values are used if not provided
      });

    if (upsertError) {
      console.error('Error upserting distinct brands into brands table:', upsertError);
      throw upsertError;
    }

    console.log(`Successfully populated brands table with ${brandsToInsert.length} distinct brands.`);
  }

  /**
   * Normalizes a brand name for comparison (lowercase, trim, remove common prefixes).
   * @param name The brand name.
   * @returns The normalized brand name.
   */
  private normalizeBrandName(name: string | null | undefined): string {
    if (!name) return '';

    let normalized = name.trim().toLowerCase();

    // Remove common prefixes like "by", "from", etc.
    normalized = normalized.replace(/^(by|from|made by)\s+/i, '');

    // Remove common suffixes
    normalized = normalized.replace(/\s+(brand|official|store|shop)$/i, '');

    // Remove special characters and extra spaces
    normalized = normalized.replace(/[\-_\.\&\+]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Identifies potential duplicate brands based on normalized names and similarity.
   * Returns a list of brands that share a normalized name or are very similar to at least one other active brand.
   * Excludes brand pairs that have been previously dismissed as duplicates.
   */
  async findPotentialDuplicateBrands(userId: string): Promise<Brand[]> {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch all active brands for the user
    const { data: activeBrands, error: fetchError } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true); // Only consider active brands for duplication checks

    if (fetchError) {
      console.error('Error fetching active brands:', fetchError);
      throw fetchError;
    }

    if (!activeBrands || activeBrands.length < 2) {
      return []; // Need at least two brands to have duplicates
    }

    // 1.5. Fetch dismissed duplicate pairs to exclude them
    const { data: dismissedPairs, error: dismissedError } = await supabase
      .from('dismissed_duplicates')
      .select('brand_id_1, brand_id_2')
      .eq('user_id', userId);

    if (dismissedError) {
      console.error('Error fetching dismissed duplicates:', dismissedError);
      // Continue without exclusions if there's an error
    }

    // Create a set of dismissed pairs for quick lookup
    const dismissedPairsSet = new Set<string>();
    if (dismissedPairs) {
      dismissedPairs.forEach(pair => {
        // Store both directions for easier lookup
        dismissedPairsSet.add(`${pair.brand_id_1}:${pair.brand_id_2}`);
        dismissedPairsSet.add(`${pair.brand_id_2}:${pair.brand_id_1}`);
      });
    }

    // Helper function to check if a pair is dismissed
    const isPairDismissed = (id1: string, id2: string): boolean => {
      return dismissedPairsSet.has(`${id1}:${id2}`) || dismissedPairsSet.has(`${id2}:${id1}`);
    };

    // 2. Group brands by normalized name
    const brandsByNormalizedName = new Map<string, Brand[]>();

    // Also keep track of brands we've already assigned to a group
    const processedBrands = new Set<string>();

    // First pass: exact normalized name matches
    for (const brand of activeBrands) {
      const normalized = this.normalizeBrandName(brand.name);
      if (normalized) { // Ignore empty names after normalization
        const group = brandsByNormalizedName.get(normalized) || [];

        // Check if this brand is dismissed with any existing brand in the group
        const shouldAdd = group.every(existingBrand => {
          return !isPairDismissed(brand.id, existingBrand.id);
        });

        if (shouldAdd) {
          group.push(brand);
          brandsByNormalizedName.set(normalized, group);

          if (group.length > 1) {
            // Mark all brands in this group as processed
            group.forEach(b => processedBrands.add(b.id));
          }
        }
      }
    }

    // Second pass: find similar brands that weren't caught in the first pass
    for (let i = 0; i < activeBrands.length; i++) {
      const brand1 = activeBrands[i];

      // Skip if this brand is already in a duplicate group
      if (processedBrands.has(brand1.id)) continue;

      const normalized1 = this.normalizeBrandName(brand1.name);
      if (!normalized1) continue;

      const similarBrands: Brand[] = [brand1];

      for (let j = i + 1; j < activeBrands.length; j++) {
        const brand2 = activeBrands[j];

        // Skip if this brand is already in a duplicate group
        if (processedBrands.has(brand2.id)) continue;

        const normalized2 = this.normalizeBrandName(brand2.name);
        if (!normalized2) continue;

        // Check if this pair has been dismissed
        const isDismissed = isPairDismissed(brand1.id, brand2.id);

        // Check for contained substrings (e.g., "Calixter" and "By Calixter")
        if (!isDismissed && (
          normalized1.includes(normalized2) ||
          normalized2.includes(normalized1) ||
          this.calculateSimilarity(normalized1, normalized2) > 0.8 // 80% similarity threshold
        )) {
          similarBrands.push(brand2);
          processedBrands.add(brand2.id);
        }
      }

      if (similarBrands.length > 1) {
        // Create a new group for these similar brands
        const key = `similar_${normalized1}`;
        brandsByNormalizedName.set(key, similarBrands);
        processedBrands.add(brand1.id);
      }
    }

    // 3. Filter groups to find duplicates and flatten the result
    const duplicateBrands: Brand[] = [];
    for (const group of brandsByNormalizedName.values()) {
      if (group.length > 1) {
        duplicateBrands.push(...group);
      }
    }

    // Sort by name for consistent UI presentation
    duplicateBrands.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    return duplicateBrands;
  }

  /**
   * Calculates the similarity between two strings using Levenshtein distance.
   * @param str1 First string
   * @param str2 Second string
   * @returns A value between 0 and 1, where 1 means identical
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);

    // Convert to similarity score (1 - normalized distance)
    return 1.0 - distance / Math.max(str1.length, str2.length);
  }

  /**
   * Calculates the Levenshtein distance between two strings.
   * @param str1 First string
   * @param str2 Second string
   * @returns The Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create a matrix of size (m+1) x (n+1)
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize the first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Merges selected brands into a primary brand entry.
   * Updates products linked to the merged brands (either by text name or by brand_id) to point to the primary brand.
   * Deactivates the merged brands.
   * @param primaryBrandId The ID of the brand to keep.
   * @param brandIdsToMerge An array of IDs for brands to merge into the primary brand.
   */
  async mergeBrands(userId: string, primaryBrandId: string, brandIdsToMerge: string[]): Promise<void> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    // 1. Validate input
    if (!primaryBrandId || !brandIdsToMerge || brandIdsToMerge.length === 0) {
      console.warn('MergeBrands called with invalid arguments.');
      return;
    }
    if (brandIdsToMerge.includes(primaryBrandId)) {
      throw new Error('Primary brand ID cannot be included in the list of brands to merge.');
    }

    // 2. Fetch the brands to merge to get their names (ensure they belong to the user)
    const { data: brandsToMergeData, error: fetchMergeError } = await supabase
      .from('brands')
      .select('id, name')
      .in('id', brandIdsToMerge)
      .eq('user_id', userId); // Still filter by user_id

    if (fetchMergeError) {
      console.error('Error fetching brands to merge:', fetchMergeError);
      throw fetchMergeError;
    }
    if (!brandsToMergeData || brandsToMergeData.length !== brandIdsToMerge.length) {
        // This could happen if some IDs didn't exist or didn't belong to the user
        console.warn('Mismatch between requested brand IDs to merge and fetched brands. Aborting merge.');
        throw new Error('Could not find all brands to merge or permission denied.');
    }

    const mergedBrandNames = brandsToMergeData
        .map(b => b.name)
        .filter((name): name is string => name !== null && name !== undefined && name.trim() !== ''); // Filter out null/empty names

    // 3. Update products
    // Update products that either have a brand_id matching one of the merged brands
    // OR have a text brand name matching one of the merged brands (for legacy data before brand_id was populated)
    const updateProductsQuery = supabase
      .from('products')
      .update({ brand_id: primaryBrandId })
      .eq('user_id', userId) // Still filter by user_id
      .in('brand_id', brandIdsToMerge); // Match by existing brand_id first

    // Conditionally add the text-based match if there are names to match
    // This is less efficient but necessary for the transition period
    // Note: Supabase JS client doesn't directly support complex OR conditions across different columns easily in a single filter.
    // We might need two separate updates or a stored procedure for optimal performance.
    // For simplicity here, we'll do the brand_id update first, then a separate one for text match if needed.

    const { error: updateByIdError } = await updateProductsQuery;

    if (updateByIdError) {
      console.error('Error updating products by brand_id during merge:', updateByIdError);
      throw updateByIdError;
    }

    // Now update products based on text match where brand_id might still be null or wasn't caught above
    if (mergedBrandNames.length > 0) {
        const { error: updateByTextError } = await supabase
            .from('products')
            .update({ brand_id: primaryBrandId })
            .eq('user_id', userId) // Still filter by user_id
            .in('brand', mergedBrandNames) // Match by text name
            .is('brand_id', null); // Optionally only update those not yet linked

         if (updateByTextError) {
            console.error('Error updating products by brand text during merge:', updateByTextError);
            // Don't necessarily throw here, as the main ID-based update might have succeeded. Log it.
            console.warn('Partial merge success: Could not update all products based on text match.');
         }
    }


    // 4. Add brand aliases for the merged brands
    const aliasEntries = [];
    for (const brand of brandsToMergeData) {
      if (brand.name && brand.name.trim() !== '') {
        aliasEntries.push({
          user_id: userId,
          brand_id: primaryBrandId,
          alias_name: brand.name,
          created_at: new Date().toISOString()
        });
      }
    }

    if (aliasEntries.length > 0) {
      const { error: aliasError } = await supabase
        .from('brand_aliases')
        .upsert(aliasEntries, { onConflict: 'user_id,brand_id,alias_name' });

      if (aliasError) {
        console.error('Error adding brand aliases:', aliasError);
        // Don't throw here if product update succeeded, but log the issue
        console.warn('Merge partially failed: Could not add all brand aliases.');
      }
    }

    // 5. Check if merged brands have 0 products and 0 competitors
    for (const brandId of brandIdsToMerge) {
      try {
        const productCount = await this.getProductCountForBrand(userId, brandId);
        const competitorCount = await this.getCompetitorCountForBrand(userId, brandId);

        if (productCount === 0 && competitorCount === 0) {
          // Delete the brand if it has no products and no competitors
          const { error: deleteError } = await supabase
            .from('brands')
            .delete()
            .eq('id', brandId)
            .eq('user_id', userId);

          if (deleteError) {
            console.error(`Error deleting empty brand ${brandId}:`, deleteError);
            // If deletion fails, deactivate instead
            const { error: deactivateError } = await supabase
              .from('brands')
              .update({ is_active: false, needs_review: false })
              .eq('id', brandId)
              .eq('user_id', userId);

            if (deactivateError) {
              console.error(`Error deactivating brand ${brandId}:`, deactivateError);
            }
          } else {
            console.log(`Deleted empty brand ${brandId} after merging.`);
          }
        } else {
          // Deactivate the brand if it still has products or competitors
          const { error: deactivateError } = await supabase
            .from('brands')
            .update({ is_active: false, needs_review: false })
            .eq('id', brandId)
            .eq('user_id', userId);

          if (deactivateError) {
            console.error(`Error deactivating brand ${brandId}:`, deactivateError);
          }
        }
      } catch (error) {
        console.error(`Error checking product/competitor count for brand ${brandId}:`, error);
        // Deactivate as fallback if checking counts fails
        const { error: deactivateError } = await supabase
          .from('brands')
          .update({ is_active: false, needs_review: false })
          .eq('id', brandId)
          .eq('user_id', userId);

        if (deactivateError) {
          console.error(`Error deactivating brand ${brandId}:`, deactivateError);
        }
      }
    }

    console.log(`Successfully merged brands [${brandIdsToMerge.join(', ')}] into primary brand ${primaryBrandId}.`);
  }

  /**
   * Sets needs_review = true for a specific brand.
   * @param brandId The ID of the brand to flag.
   */
  async flagBrandForReview(userId: string, brandId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    const { error } = await supabase
      .from('brands')
      .update({ needs_review: true })
      .eq('id', brandId)
      .eq('user_id', userId); // Still filter by user_id

    if (error) {
      console.error(`Error flagging brand ${brandId} for review:`, error);
      throw error;
    }
     console.log(`Brand ${brandId} flagged for review.`);
  }

  /**
   * Sets needs_review = false for a specific brand.
   * @param brandId The ID of the brand to unflag.
   */
  async unflagBrandForReview(userId: string, brandId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    const { error } = await supabase
      .from('brands')
      .update({ needs_review: false })
      .eq('id', brandId)
      .eq('user_id', userId); // Still filter by user_id

    if (error) {
      console.error(`Error unflagging brand ${brandId} for review:`, error);
      throw error;
    }
    console.log(`Brand ${brandId} unflagged for review.`);
  }

  /**
   * Sets needs_review = false for multiple brands at once.
   * @param userId The ID of the user.
   * @param brandIds Array of brand IDs to unflag.
   */
  async confirmAllBrands(userId: string, brandIds: string[]): Promise<void> {
    if (!brandIds || brandIds.length === 0) {
      console.warn('confirmAllBrands called with empty brandIds array');
      return;
    }

    const supabase = createSupabaseAdminClient();

    // Update all brands in a single query
    const { error } = await supabase
      .from('brands')
      .update({ needs_review: false })
      .in('id', brandIds)
      .eq('user_id', userId); // Ensure we only update the user's brands

    if (error) {
      console.error(`Error confirming ${brandIds.length} brands:`, error);
      throw error;
    }

    console.log(`Successfully confirmed ${brandIds.length} brands.`);
  }

  /**
   * Marks a group of brands as not duplicates by adding them to the dismissed_duplicates table.
   * This prevents them from appearing in the potential duplicates list in the future.
   * @param userId The ID of the user.
   * @param groupKey The key that identifies the group of duplicates.
   * @param brandIds Array of brand IDs to mark as not duplicates.
   */
  async dismissDuplicates(userId: string, groupKey: string, brandIds: string[]): Promise<void> {
    if (!brandIds || brandIds.length === 0 || !groupKey) {
      console.warn('dismissDuplicates called with invalid parameters');
      return;
    }

    const supabase = createSupabaseAdminClient();

    // Create entries in the dismissed_duplicates table
    // First, create a unique key for this group of duplicates
    const dismissalKey = `${groupKey}_${new Date().getTime()}`;

    // Create entries for each pair of brands in the group
    const entries = [];
    for (let i = 0; i < brandIds.length; i++) {
      for (let j = i + 1; j < brandIds.length; j++) {
        // Ensure brand_id_1 is always less than brand_id_2 to satisfy the constraint
        const [smallerId, largerId] = brandIds[i] < brandIds[j]
          ? [brandIds[i], brandIds[j]]
          : [brandIds[j], brandIds[i]];

        entries.push({
          user_id: userId,
          brand_id_1: smallerId,
          brand_id_2: largerId,
          dismissal_key: dismissalKey,
          dismissed_at: new Date().toISOString(),
        });
      }
    }

    if (entries.length === 0) {
      return; // Nothing to insert
    }

    // Insert the entries
    const { error } = await supabase
      .from('dismissed_duplicates')
      .insert(entries);

    if (error) {
      console.error(`Error dismissing duplicates:`, error);
      throw error;
    }

    console.log(`Successfully dismissed ${brandIds.length} brands as duplicates.`);
  }

  // Basic CRUD functions are already implemented below
  // Create, Read, Update name/active/needs_review, Delete.

  /**
   * Get brands for the current user, with optional filtering.
   * @param filters Optional filters for isActive and needsReview status.
   */
  async getAllBrands(userId: string, filters?: { isActive?: boolean; needsReview?: boolean }): Promise<Brand[]> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    let query = supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId); // Still filter by user_id

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }
    if (filters?.needsReview !== undefined) {
      query = query.eq('needs_review', filters.needsReview);
    }

    // Add ordering for consistency
    query = query.order('name', { ascending: true });


    const { data, error } = await query;

    if (error) {
      console.error('Error fetching brands:', error);
      throw error;
    }
    return data || []; // Return empty array if data is null
  }

  /**
   * Get a brand by its ID.
   */
  async getBrandById(userId: string, brandId: string): Promise<Brand | null> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .eq('user_id', userId) // Still filter by user_id
      .single();

    if (error) {
      console.error(`Error fetching brand with ID ${brandId}:`, error);
      throw error;
    }
    return data;
  }

  /**
   * Create a new brand.
   */
  async createBrand(userId: string, brandData: Database['public']['Tables']['brands']['Insert']): Promise<Brand | null> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    // Ensure user_id is set and needs_review defaults to false if not provided
    const dataToInsert = {
      ...brandData,
      user_id: userId, // Ensure user_id is set
      needs_review: brandData.needs_review ?? false,
      is_active: brandData.is_active ?? true, // Default to active
    };


    const { data, error } = await supabase
      .from('brands')
      .insert(dataToInsert)
      .select() // Select the inserted row
      .single();

    if (error) {
      console.error('Error creating brand:', error);
      throw error;
    }
    return data;
  }

  /**
   * Update an existing brand.
   */
  async updateBrand(userId: string, brandId: string, brandData: Database['public']['Tables']['brands']['Update']): Promise<Brand | null> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    const { data, error } = await supabase
      .from('brands')
      .update(brandData)
      .eq('id', brandId)
      .eq('user_id', userId) // Still filter by user_id
      .select() // Select the updated row
      .single();

    if (error) {
      console.error(`Error updating brand with ID ${brandId}:`, error);
      throw error;
    }
    return data;
  }

  /**
   * Delete a brand by its ID.
   * Checks if the brand is referenced by any products and throws an error if it is.
   */
  async deleteBrand(userId: string, brandId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();

    // First check if there are any products referencing this brand
    const productCount = await this.getProductCountForBrand(userId, brandId);

    if (productCount > 0) {
      throw new Error(`Cannot delete brand: it is still referenced by ${productCount} product(s). Please update or delete these products first.`);
    }

    // If no products reference the brand, proceed with deletion
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', brandId)
      .eq('user_id', userId); // Still filter by user_id

    if (error) {
      console.error(`Error deleting brand with ID ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Gets all aliases for a brand.
   * @param userId The ID of the user.
   * @param brandId The ID of the brand.
   * @returns An array of alias names.
   */
  async getBrandAliases(userId: string, brandId: string): Promise<string[]> {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('brand_aliases')
      .select('alias_name')
      .eq('user_id', userId)
      .eq('brand_id', brandId);

    if (error) {
      console.error(`Error fetching aliases for brand ${brandId}:`, error);
      return []; // Return empty array instead of throwing to avoid breaking the UI
    }

    return data?.map(alias => alias.alias_name) || [];
  }

  /**
   * Gets a brand by its ID with aliases.
   * @param userId The ID of the user.
   * @param brandId The ID of the brand.
   * @returns The brand with an additional aliases array.
   */
  async getBrandWithAliases(userId: string, brandId: string): Promise<(Brand & { aliases: string[] }) | null> {
    try {
      const brand = await this.getBrandById(userId, brandId);
      if (!brand) return null;

      const aliases = await this.getBrandAliases(userId, brandId);

      return {
        ...brand,
        aliases
      };
    } catch (error) {
      console.error(`Error fetching brand with aliases for ID ${brandId}:`, error);
      throw error;
    }
  }

    /**
     * Finds an existing brand by name (case-insensitive) for a user, or creates a new one if not found.
     * Newly created brands are marked as needing review.
     * @param userId The ID of the user.
     * @param brandName The name of the brand to find or create.
     * @returns The found or newly created brand, or null if the input name is empty/invalid.
     */
    async findOrCreateBrandByName(userId: string, brandName: string): Promise<Brand | null> {
      const trimmedBrandName = brandName?.trim();
      if (!trimmedBrandName) {
        console.warn('findOrCreateBrandByName called with empty brand name.');
        return null; // Cannot process empty brand names
      }

      const supabase = createSupabaseAdminClient();
      const normalizedName = this.normalizeBrandName(trimmedBrandName); // Use existing normalization

      // 1. Try to find existing brand (case-insensitive)
      const { data: existingBrands, error: findError } = await supabase
        .from('brands')
        .select('*') // Select all columns to return the full Brand object
        .eq('user_id', userId)
        .ilike('name', normalizedName) // Case-insensitive search
        .limit(1);

      if (findError) {
        console.error(`Error finding brand by name "${trimmedBrandName}":`, findError);
        throw findError; // Re-throw error if finding fails
      }

      if (existingBrands && existingBrands.length > 0) {
        // Found existing brand
        return existingBrands[0];
      }

      // 2. Try to find by alias
      const { data: brandByAlias, error: aliasError } = await supabase
        .from('brand_aliases')
        .select('brand_id')
        .eq('user_id', userId)
        .ilike('alias_name', normalizedName)
        .limit(1);

      if (aliasError) {
        console.error(`Error finding brand by alias "${trimmedBrandName}":`, aliasError);
        // Continue to create a new brand if alias lookup fails
      } else if (brandByAlias && brandByAlias.length > 0 && brandByAlias[0].brand_id) {
        // Found brand by alias, now fetch the actual brand
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('*')
          .eq('id', brandByAlias[0].brand_id)
          .single();

        if (brandError) {
          console.error(`Error fetching brand by alias ID ${brandByAlias[0].brand_id}:`, brandError);
          // Continue to create a new brand if brand fetch fails
        } else if (brandData) {
          return brandData;
        }
      }

      // 2. Brand not found, create a new one
      console.log(`Brand "${trimmedBrandName}" not found. Creating new brand.`);
      try {
        const newBrand = await this.createBrand(userId, {
          name: trimmedBrandName, // Use the original trimmed name
          is_active: true,
          needs_review: true, // Mark for review
          user_id: userId, // Add the required user_id field
        });
        return newBrand;
      } catch (createError) {
        console.error(`Error creating new brand "${trimmedBrandName}":`, createError);
        // Decide if we should throw or return null. Throwing might be better
        // as it indicates a failure in a necessary step.
        throw createError;
      }
    }
  /**
   * Gets the count of products for a specific brand.
   * @param userId The ID of the user.
   * @param brandId The ID of the brand.
   * @returns The number of products associated with the brand.
   */
  async getProductCountForBrand(userId: string, brandId: string): Promise<number> {
    const supabase = createSupabaseAdminClient();

    const { count, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('brand_id', brandId);

    if (error) {
      console.error(`Error getting product count for brand ${brandId}:`, error);
      throw error;
    }

    return count || 0;
  }

  /**
   * Gets the count of competitors that have products matching a specific brand.
   * @param userId The ID of the user.
   * @param brandId The ID of the brand.
   * @returns The number of distinct competitors associated with the brand's products.
   */
  async getCompetitorCountForBrand(userId: string, brandId: string): Promise<number> {
    try {
      const supabase = createSupabaseAdminClient();

      // First get all product IDs for this brand
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .eq('brand_id', brandId);

      if (productsError) {
        console.error(`Error getting products for brand ${brandId}:`, productsError);
        return 0; // Return 0 instead of throwing to avoid breaking the UI
      }

      if (!products || products.length === 0) {
        return 0; // No products, so no competitors
      }

      // Use a direct SQL query with COUNT DISTINCT to avoid URL size limitations
      // and improve performance
      const { data, error } = await supabase.rpc('count_distinct_competitors_for_brand', {
        p_user_id: userId,
        p_brand_id: brandId
      });

      if (error) {
        console.error(`Error getting competitor count for brand ${brandId} using RPC:`, error);

        // Fallback to a simpler query if RPC fails
        const { count, error: fallbackError } = await supabase
          .from('price_changes')
          .select('competitor_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('brand_id', brandId);

        if (fallbackError) {
          console.error(`Fallback query also failed for brand ${brandId}:`, fallbackError);
          return 0;
        }

        return count || 0;
      }

      return data || 0;
    } catch (error) {
      console.error(`Unexpected error getting competitor count for brand ${brandId}:`, error);
      return 0; // Return 0 instead of throwing to avoid breaking the UI
    }
  }

  /**
   * Gets analysis data for all brands or a specific brand.
   * Uses an optimized database function to get all data in a single query.
   * @param userId The ID of the user.
   * @param brandId Optional: The ID of a specific brand to analyze.
   * @returns An array of brand objects with product and competitor counts.
   */
  async getBrandAnalytics(userId: string, brandId?: string): Promise<Array<{
    id: string;
    name: string;
    is_active: boolean;
    needs_review: boolean;
    product_count: number;
    competitor_count: number;
    aliases?: string[];
    competitor_names?: string[];
  }>> {
    const supabase = createSupabaseAdminClient();

    try {
      console.time('getBrandAnalytics');

      // Use the optimized database function to get all brand analytics in a single query
      const { data: brandsWithAnalytics, error } = await supabase.rpc(
        'get_brand_analytics',
        {
          p_user_id: userId,
          p_brand_id: brandId || null
        }
      );

      if (error) {
        console.error('Error fetching brand analytics:', error);
        throw error;
      }

      if (!brandsWithAnalytics || brandsWithAnalytics.length === 0) {
        return [];
      }

      // Get all brand aliases in a single query
      const { data: allAliases, error: aliasError } = await supabase.rpc(
        'get_brand_aliases',
        { p_user_id: userId }
      );

      if (aliasError) {
        console.error('Error fetching brand aliases:', aliasError);
        // Continue without aliases if there's an error
      }

      // Create a map of brand_id to aliases for quick lookup
      const aliasMap = new Map<string, string[]>();
      if (allAliases) {
        allAliases.forEach((item: { brand_id: string, aliases: string[] }) => {
          aliasMap.set(item.brand_id, item.aliases);
        });
      }

      // Get competitor names for each brand with competitors
      const brandsWithCompetitors = brandsWithAnalytics.filter((brand: any) => brand.competitor_count > 0);

      // Create a map to store competitor names for each brand
      const competitorNamesMap = new Map<string, string[]>();

      // Fetch competitor names for brands with competitors in parallel
      if (brandsWithCompetitors.length > 0) {
        await Promise.all(brandsWithCompetitors.map(async (brand: any) => {
          try {
            const { data: competitorNames, error: competitorNamesError } = await supabase.rpc(
              'get_competitor_names_for_brand',
              {
                p_user_id: userId,
                p_brand_id: brand.id
              }
            );

            if (competitorNamesError) {
              console.error(`Error fetching competitor names for brand ${brand.id}:`, competitorNamesError);
              return;
            }

            if (competitorNames && competitorNames.length > 0) {
              competitorNamesMap.set(brand.id, competitorNames[0].competitor_names || []);
            }
          } catch (error) {
            console.error(`Unexpected error fetching competitor names for brand ${brand.id}:`, error);
          }
        }));
      }

      // Add aliases and competitor names to each brand
      const result = brandsWithAnalytics.map((brand: {
        id: string;
        name: string;
        is_active: boolean;
        needs_review: boolean;
        product_count: number;
        competitor_count: number;
      }) => ({
        ...brand,
        aliases: aliasMap.get(brand.id) || [],
        competitor_names: competitorNamesMap.get(brand.id) || []
      }));

      console.timeEnd('getBrandAnalytics');
      return result;
    } catch (error) {
      console.error('Unexpected error in getBrandAnalytics:', error);
      throw error;
    }
  }

  /**
   * Migrates existing products to link them to standardized brands.
   * Iterates through products with NULL brand_id, finds or creates a brand based on the text name,
   * and updates the product's brand_id.
   */
  async migrateProductBrandIds(userId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    // Removed getUser call

    console.log(`Starting brand ID migration for user: ${userId}`);

    // Fetch products that do not have a brand_id assigned yet for the current user
    const { data: productsToMigrate, error: fetchProductsError } = await supabase
      .from('products')
      .select('id, brand')
      .eq('user_id', userId)
      .is('brand_id', null)
      .not('brand', 'is', null) // Only consider products with a text brand name
      .neq('brand', ''); // And a non-empty text brand name

    if (fetchProductsError) {
      console.error('Error fetching products for migration:', fetchProductsError);
      throw fetchProductsError;
    }

    if (!productsToMigrate || productsToMigrate.length === 0) {
      console.log('No products found needing brand ID migration.');
      return;
    }

    console.log(`Found ${productsToMigrate.length} products to migrate.`);

    // Process products in batches to avoid hitting database limits
    const batchSize = 100; // Define a batch size
    for (let i = 0; i < productsToMigrate.length; i += batchSize) {
      const batch = productsToMigrate.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsToMigrate.length / batchSize)}`);

      await Promise.all(batch.map(async (product) => {
        const productBrandName = product.brand?.trim();
        if (!productBrandName) {
            // Should not happen due to query filter, but as a safeguard
            console.warn(`Product ${product.id} has null or empty brand text despite filter. Skipping.`);
            return;
        }

        // Try to find an existing brand with a matching normalized name for this user
        const normalizedBrandName = this.normalizeBrandName(productBrandName);
        const { data: existingBrands, error: fetchBrandError } = await supabase
          .from('brands')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', normalizedBrandName) // Case-insensitive match
          .limit(1); // We only need one match

        if (fetchBrandError) {
          console.error(`Error finding existing brand for product ${product.id}:`, fetchBrandError);
          // Continue to next product if finding brand fails
          return;
        }

        let brandIdToAssign: string;

        if (existingBrands && existingBrands.length > 0) {
          // Found an existing brand, use its ID
          brandIdToAssign = existingBrands[0].id;
          // console.log(`Found existing brand ${brandIdToAssign} for product ${product.id} (name: "${productBrandName}")`);
        } else {
          // No existing brand found, create a new one
          console.log(`No existing brand found for product ${product.id} (name: "${productBrandName}"). Creating new brand.`);
          const newBrandData: Database['public']['Tables']['brands']['Insert'] = {
            user_id: userId,
            name: productBrandName, // Use the original text name for the new brand entry
            is_active: true,
            needs_review: true, // Mark newly auto-created brands for review
          };
          const { data: newBrand, error: createBrandError } = await supabase
            .from('brands')
            .insert(newBrandData)
            .select('id')
            .single();

          if (createBrandError || !newBrand) {
            console.error(`Error creating new brand for product ${product.id} (name: "${productBrandName}"):`, createBrandError);
             // Continue to next product if creating brand fails
            return;
          }
          brandIdToAssign = newBrand.id;
           console.log(`Created new brand ${brandIdToAssign} for product ${product.id}.`);
        }

        // Update the product with the found or newly created brand_id
        const { error: updateProductError } = await supabase
          .from('products')
          .update({ brand_id: brandIdToAssign })
          .eq('id', product.id)
          .eq('user_id', userId); // Ensure we only update the user's product

        if (updateProductError) {
          console.error(`Error updating product ${product.id} with brand_id ${brandIdToAssign}:`, updateProductError);
          // Continue to next product if updating product fails
          return;
        }
         // console.log(`Successfully updated product ${product.id} with brand_id ${brandIdToAssign}.`);
      }));
    }

    console.log('Brand ID migration process completed.');
  }
}