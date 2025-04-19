import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/options'; // Adjust path as necessary

// The handler initializes NextAuth with your configuration options.
// It automatically creates routes like /api/auth/signin, /api/auth/signout, /api/auth/session, etc.
const handler = NextAuth(authOptions);

// Export the handler for both GET and POST requests, as required by NextAuth.js.
export { handler as GET, handler as POST };