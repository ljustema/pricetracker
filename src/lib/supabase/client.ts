"use client"; // This ensures it can be used in client components

import { createBrowserClient } from '@supabase/ssr';

// Ensure environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseAnonKey!
  );

// Export a singleton instance if preferred, or use createClient() directly
// export const supabase = createClient();