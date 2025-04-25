import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from 'crypto';
import { ScraperConfig } from "@/lib/services/scraper-types";

/**
 * Service for basic CRUD operations on scrapers
 */
export class ScraperCrudService {
  /**
   * Create a new scraper configuration
   */
  static async createScraper(config: Omit<ScraperConfig, 'id' | 'created_at' | 'updated_at'>) {
    const supabase = await createSupabaseServerClient();
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('scrapers')
      .insert({
        ...config,
        created_at: now,
        updated_at: now,
        status: 'idle',
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create scraper: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get a scraper by ID
   */
  static async getScraper(id: string) {
    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to get scraper: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get all scrapers for a user
   */
  static async getScrapersByUser(userId: string) {
    // Import here to avoid circular dependencies
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseAdminClient();
    
    // Ensure the user ID is in UUID format for consistent handling
    const ensureUUID = (id: string): string => {
      // Check if the ID is already a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        return id;
      }
      
      // If not a UUID, create a deterministic UUID v5 from the ID
      // Using the DNS namespace as a base
      return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    };
    
    const { data, error } = await supabase
      .from('scrapers')
      .select('*')
      .eq('user_id', ensureUUID(userId));
    
    if (error) {
      throw new Error(`Failed to get scrapers: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Update a scraper configuration
   */
  static async updateScraper(id: string, updates: Partial<ScraperConfig>) {
    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase
      .from('scrapers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update scraper: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Delete a scraper
   */
  static async deleteScraper(id: string) {
    const supabase = await createSupabaseServerClient();
    
    const { error } = await supabase
      .from('scrapers')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete scraper: ${error.message}`);
    }
    
    return true;
  }
}