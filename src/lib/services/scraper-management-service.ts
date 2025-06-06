import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Service for managing scrapers (approval, activation)
 */
export class ScraperManagementService {
  // Note: Approval logic removed since scrapers can only be saved to database if already approved
  // The approval process now happens in the UI before saving to database

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