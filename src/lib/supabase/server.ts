import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Ensure environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Function to create a server client for Server Components/Actions/Route Handlers
// This client uses the user's session cookie for authentication.
// Marked async to handle potential promise from cookies()
export const createSupabaseServerClient = async () => {
  // Get the cookie store directly from next/headers, awaiting if necessary
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          // Now that cookieStore is awaited, .get should exist
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Now that cookieStore is awaited, .set should exist
            cookieStore.set({ name, value, ...options });
          } catch (_error) { // Prefix unused variable with _
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            console.warn(`Supabase server client: Failed to set cookie '${name}' from a Server Component. This is expected if using middleware for session refresh.`);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Now that cookieStore is awaited, .set should exist
            cookieStore.set({ name, value: '', ...options });
          } catch (_error) { // Prefix unused variable with _
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
            console.warn(`Supabase server client: Failed to remove cookie '${name}' from a Server Component. This is expected if using middleware for session refresh.`);
          }
        },
      },
    }
  );
};

// Function to create a Supabase client with the service role key
// Use this ONLY for admin-level operations where RLS needs bypassing.
// This client does NOT use user session cookies.
export const createSupabaseAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY. Cannot create admin client.");
  }
  if (!supabaseUrl) {
    // Redundant check, but good practice
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  // Create a client instance that specifically uses the service_role key
  // and does not handle cookies or auth state automatically.
  return createServerClient(supabaseUrl!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false // Ensure it doesn't try to read session from URL
    },
    // Provide a minimal dummy cookie implementation to satisfy types
    cookies: {
      get(_name: string) { // Prefix unused variable with _
        // Admin client doesn't read cookies for auth
        return undefined;
      },
      set(_name: string, _value: string, _options: CookieOptions) { // Prefix unused variables with _
        // Admin client doesn't set cookies for auth
      },
      remove(_name: string, _options: CookieOptions) { // Prefix unused variables with _
        // Admin client doesn't remove cookies for auth
      },
    },
    db: {
      schema: 'public', // Explicitly set the schema to 'public'
    },
  });
};