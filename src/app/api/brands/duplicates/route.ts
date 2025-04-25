import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { getServerSession } from 'next-auth'; // Import getServerSession
import { authOptions } from '@/lib/auth/options'; // Import authOptions

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds


export async function GET(_request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    const brandService = new BrandService();
    // Pass the userId to the service method
    const duplicateBrands = await brandService.findPotentialDuplicateBrands(userId);

    // Add cache headers to the response
    const response = NextResponse.json(duplicateBrands);

    // Set cache headers
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching potential duplicate brands:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
     if (errorMessage === 'User not authenticated.') { // This error might still come from the service if userId is missing
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch potential duplicate brands', details: errorMessage }, { status: 500 });
  }
}