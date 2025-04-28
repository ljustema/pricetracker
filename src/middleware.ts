import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Check if the host is 'pricetracker.se' without the 'www' prefix
  if (request.headers.get('host') === 'pricetracker.se') {
    // Create the new URL with 'www' prefix
    const url = request.nextUrl.clone();
    url.host = 'www.pricetracker.se';
    
    // Return a redirect response
    return NextResponse.redirect(url);
  }
  
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
