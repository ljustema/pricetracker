import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');

  // Check if the host is 'pricetracker.se' without the 'www' prefix
  // or if it's using a Railway preview URL
  if (host === 'pricetracker.se' || (host && !host.startsWith('www.') && host.includes('pricetracker.se'))) {
    // Create the new URL with 'www' prefix
    const url = request.nextUrl.clone();

    // Handle different protocols (http/https)
    const protocol = request.headers.get('x-forwarded-proto') || 'https';

    // Set the full URL with www prefix
    url.href = `${protocol}://www.pricetracker.se${request.nextUrl.pathname}${request.nextUrl.search}`;

    // Return a permanent redirect response (301)
    return NextResponse.redirect(url, 301);
  }

  // Admin route protection is handled by requireAdmin() in each admin page
  // No middleware protection needed since the pages themselves check authentication and admin roles

  // Continue with the request if no redirect is needed
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  // - public folder
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
