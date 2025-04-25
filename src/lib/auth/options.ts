import { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
// import EmailProvider from 'next-auth/providers/email'; // We'll use this structure but adapt for Supabase password auth
import { SupabaseAdapter } from '@auth/supabase-adapter';

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
    // This will be used by the login form
    // Note: This is just a placeholder and doesn't actually verify credentials
    // The actual verification happens in the Supabase client in the login page
    // We include it here so NextAuth knows about this sign-in method
    {
      id: "credentials",
      name: "Email & Password",
      type: "credentials", // Add the required type property
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(_credentials) {
        // This function is not actually used for verification
        // since we're handling that directly with Supabase in the login page
        // Return null to indicate that verification should be handled elsewhere
        return null;
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
    async signIn({ user: _user, account, profile }) {
      // If it's a Google sign-in
      if (account?.provider === 'google' && profile?.email) {
        // The user object already contains the basic profile info from Google
        // We don't need to do anything special here since we're using JWT sessions
        // and not relying on the adapter to store user data
        
        // Return true to allow sign in
        return true;
      }
      
      // For other providers or if email is missing, deny sign in
      return !!profile?.email;
    },
    
    // Include user.id on session
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    
    // Include user.id on token
    async jwt({ token, user, account, profile: _profile }) {
      // Initial sign in
      if (account && _profile) {
        token.provider = account.provider;
        // You can add additional profile info to the token if needed
        // e.g., token.picture = profile.picture;
      }
      
      // On subsequent calls, user is undefined
      if (user?.id) {
        token.sub = user.id;
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