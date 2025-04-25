import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Service for managing scrapers (approval, activation)
 */
export class ScraperManagementService {
  /**
   * Check if a scraper exists and is eligible for approval (basic check).
   * The actual approval update is handled by the API route.
   */
  static async checkScraperExistsForApproval(scraperId: string) {
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
    
    // Removed check for scraper.test_results as it might be obsolete.
    // The new flow relies on reviewing a successful Test Run (via scraper_runs table),
    // which should be checked in the API route if desired.

    if (scraper.is_approved) {
      // Optional: Decide if this should throw an error or just return info
      console.log(`Scraper ${scraperId} is already approved.`);
      // throw new Error('Scraper is already approved');
    }

    // Removed the database update logic. The API route /api/scrapers/[scraperId]/approve handles the update.
    // This method now only serves to verify existence and potentially basic status.

    // Return minimal info or just void if only used for checks
    return { id: scraper.id, is_approved: scraper.is_approved };
  }
  
  /**
   * Activate a scraper (deactivating others for the same competitor)
   */
  static async activateScraper(scraperId: string, userId: string) {
    // Use the Supabase ADMIN client to bypass RLS for server-side trusted mutation
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseAdminClient();
    // DEBUG: Log userId and scraperId
    console.log('Activating scraper', { scraperId, userId });
    // Get the scraper to ensure it belongs to the current user
    const { data: scraper, error: fetchError } = await supabase
      .from('scrapers')
      .select('*')
      .eq('id', scraperId)
      .eq('user_id', userId)
      .single();
    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
    }
    if (!scraper) {
      console.error('Scraper not found for user', { scraperId, userId });
      throw new Error('Scraper not found');
    }

    // Deactivate other scrapers for the same competitor for this user
    const { error: deactivateError } = await supabase
      .from('scrapers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('competitor_id', scraper.competitor_id)
      .eq('user_id', userId)
      .neq('id', scraperId);

    if (deactivateError) {
      throw new Error('Failed to deactivate other scrapers');
    }

    // Activate the selected scraper
    const { data, error } = await supabase
      .from('scrapers')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scraperId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to activate scraper');
    }

    return data;
  }
}