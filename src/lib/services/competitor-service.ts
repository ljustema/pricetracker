import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "./product-service"; // Assuming ensureUUID is reusable

export interface Competitor {
  id: string;
  user_id: string;
  name: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all competitors for a given user.
 * @param userId The UUID of the user.
 * @returns A promise that resolves to an array of Competitor objects.
 */
export async function getCompetitors(userId: string): Promise<Competitor[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = ensureUUID(userId);

  const { data, error } = await supabase
    .from("competitors") // Assuming the table name is 'competitors'
    .select("*")
    .eq("user_id", uuid)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching competitors:", error);
    throw new Error(`Failed to fetch competitors: ${error.message}`);
  }

  return data || [];
}

// Add other competitor-related functions here if needed (e.g., create, update, delete)