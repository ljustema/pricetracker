import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Service for managing scrapers (approval, activation)
 */
export class ScraperManagementService {
  /**
   * Approve a scraper after testing
   */
  static async approveScraper(scraperId: string) {
    const supabase = await createSupabaseServerClient();
    
    // Get the scraper to ensure it has been tested
    const { data: scraper } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (!scraper) {
      throw new Error('Scraper not found');
    }
    
    if (!scraper.test_results) {
      throw new Error('Scraper must be tested before approval');
    }
    
    // Update the scraper to approved status
    const { data, error } = await supabase
      .from('scrapers')
      .update({
        is_approved: true,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', scraperId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to approve scraper: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Activate a scraper (deactivating others for the same competitor)
   */
  static async activateScraper(scraperId: string) {
    const supabase = await createSupabaseServerClient();
    
    // Get the scraper to ensure it has been approved
    const { data: scraper } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .single();
    
    if (!scraper) {
      throw new Error('Scraper not found');
    }
    
    if (!scraper.is_approved) {
      throw new Error('Scraper must be approved before activation');
    }
    
    // The database trigger will handle deactivating other scrapers
    const { data, error } = await supabase
      .from('scrapers')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scraperId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to activate scraper: ${error.message}`);
    }
    
    return data;
  }
}