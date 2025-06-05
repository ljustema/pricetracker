import { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { createClient } from '@supabase/supabase-js';

// Ensure environment variables are defined
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Needed for adapter
const appName = process.env.NEXTAUTH_APP_NAME || 'PriceTracker'; // Use environment variable or default

// We've fixed the schema issues by running the SQL script
// No need to modify the URL anymore

if (!googleClientId) {
  throw new Error("Missing env.GOOGLE_CLIENT_ID");
}
if (!googleClientSecret) {
  throw new Error("Missing env.GOOGLE_CLIENT_SECRET");
}
if (!nextAuthSecret) {
  throw new Error("Missing env.NEXTAUTH_SECRET");
}
if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseServiceRoleKey) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      name: appName, // Use the app name from environment variable
      // Set explicit authorization parameters including the app name
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile",
          // Add login_hint to potentially override the displayed name
          login_hint: appName
        }
      },
      // Add profile to include additional user information
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    // Add a credentials provider for email/password login
    // This provider works with Supabase Auth
    {
      id: "credentials",
      name: "Email & Password",
      type: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Create a Supabase client with the service role key
          // This is safe because it only runs on the server
          const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          });

          // Sign in with Supabase
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error || !data?.user) {
            console.error("Supabase auth error:", error);
            return null;
          }

          // Return the user object for NextAuth
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
            image: data.user.user_metadata?.avatar_url,
          };
        } catch (error) {
          console.error("Error in authorize function:", error);
          return null;
        }
      }
    }
  ],
  adapter: SupabaseAdapter({
    url: supabaseUrl,
    secret: supabaseServiceRoleKey
  }),
  session: {
    strategy: 'jwt',
  },
  jwt: {
    secret: nextAuthSecret,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `${appName}.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    // Handle sign-in event
    async signIn({ user, account, profile, credentials }) {
      console.log('NextAuth signIn callback called:', {
        provider: account?.provider,
        email: profile?.email,
        userId: user?.id
      });

      // If it's a Google sign-in
      if (account?.provider === 'google' && profile?.email) {
        // Just allow the sign-in, user creation will happen in jwt callback
        return true;
      }

      // If it's a credentials sign-in (email/password)
      if (credentials) {
        // The authorize function has already verified the credentials
        return true;
      }

      // For other providers or if email is missing, deny sign in
      return !!profile?.email;
    },

    // Include user.id and admin role on session
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;

        // Add admin role information from token
        if (token.adminRole !== undefined) {
          session.user.adminRole = token.adminRole as string | null;
          session.user.isAdmin = !!token.adminRole;
          session.user.isSuspended = token.isSuspended as boolean;
        }
      }
      return session;
    },

    // Include user.id and admin role on token
    async jwt({ token, user, account, profile: _profile }) {
      // Initial sign in
      if (account && _profile) {
        token.provider = account.provider;
      }

      // On subsequent calls, user is undefined
      if (user?.id) {
        token.sub = user.id;

        // If this is a new user sign-in (Google or credentials), create user profile/settings
        if ((account?.provider === 'google' && _profile?.email) ||
            (account?.provider === 'credentials' && user?.email)) {
          try {
            const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

            // Check if user profile already exists
            const { data: existingProfile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('id', user.id)
              .single();

            // If profile doesn't exist, create it
            if (!existingProfile) {
              // Get user data from either profile (Google) or user object (credentials)
              const userEmail = _profile?.email || user.email;
              const userName = _profile?.name || user.name;
              const userAvatar = (_profile as { picture?: string })?.picture || user.image;

              console.log('Creating user profile and settings for:', userEmail);

              // Create user profile
              const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                  id: user.id,
                  email: userEmail,
                  name: userName,
                  avatar_url: userAvatar,
                  admin_role: null,
                  is_suspended: false,
                  subscription_tier: 'free',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (profileError) {
                console.error('Error creating user profile:', profileError);
              } else {
                console.log('Created user profile for:', userEmail);
              }

              // Create user settings
              const { error: settingsError } = await supabase
                .from('user_settings')
                .insert({
                  user_id: user.id,
                  name: userName,
                  primary_currency: 'SEK',
                  currency_format: 'sv-SE',
                  matching_rules: {
                    ean_priority: true,
                    sku_brand_fallback: true,
                    fuzzy_name_matching: false
                  },
                  price_thresholds: {
                    low_stock: 10,
                    price_change_alert: 5
                  },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (settingsError) {
                console.error('Error creating user settings:', settingsError);
              } else {
                console.log('Created user settings for:', userEmail);
              }
            }
          } catch (error) {
            console.error('Error in JWT callback user creation:', error);
          }
        }
      }

      // Fetch admin role information if we have a user ID and don't already have it
      if (token.sub && token.adminRole === undefined) {
        try {
          const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('admin_role, is_suspended')
            .eq('id', token.sub)
            .single();

          // Store admin role info in token
          token.adminRole = userProfile?.admin_role || null;
          token.isSuspended = userProfile?.is_suspended || false;
        } catch (error) {
          console.error('Error fetching admin role for JWT:', error);
          // Set defaults if query fails
          token.adminRole = null;
          token.isSuspended = false;
        }
      }

      return token;
    },

    // Potentially redirect after sign-in
    async redirect({ baseUrl }) {
      // Always redirect to the app dashboard after successful sign-in
      return `${baseUrl}/app-routes/dashboard`;
    }
  },
  secret: nextAuthSecret,
  // Optional: Add custom pages if needed
  pages: {
    signIn: '/auth-routes/login', // Corrected path after folder restructure
    // signOut: '/auth/signout', // Default is usually fine
    // error: '/auth/error', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request', // (used for check email message)
    // newUser: null // Disable new user redirection for now
  }
};