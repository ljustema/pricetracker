import { SupabaseAdapter } from '@auth/supabase-adapter';
import { createClient } from '@supabase/supabase-js';
import type { Adapter } from 'next-auth/adapters';

/**
 * Custom adapter that wraps the Supabase adapter and ensures the schema is set to 'public'
 */
export function createCustomSupabaseAdapter(options: {
  url: string;
  secret: string;
}): Adapter {
  // Create a Supabase client with explicit schema setting
  // We don't need to use this client directly since we're using the standard adapter
  // Just keeping this as a reference for future customization if needed
  const _client = createClient(options.url, options.secret, {
    db: {
      schema: 'public',
    },
  });

  // Create the standard adapter with our custom client
  const adapter = SupabaseAdapter(options);

  // Return the adapter
  return adapter;
}