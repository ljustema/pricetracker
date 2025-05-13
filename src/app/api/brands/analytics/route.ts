import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Add cache headers to improve performance
const CACHE_MAX_AGE = 60; // Cache for 60 seconds

/**
 * GET handler to fetch analytics data for all brands or a specific brand
 * Query parameters:
 * - brandId (optional): If provided, returns analytics for just that brand
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get the brandId from the query parameters if provided
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId') || undefined;

    const brandService = new BrandService();

    // Generate a unique label for each API call to avoid "Label already exists" warning
    const apiTimeLabel = `api-brands-analytics-${Date.now()}`;
    console.time(apiTimeLabel);

    // Get brand analytics data (now includes aliases)
    const analyticsData = await brandService.getBrandAnalytics(userId, brandId);

    console.timeEnd(apiTimeLabel);

    // Add cache headers to the response
    const response = NextResponse.json(analyticsData);

    // Set cache headers
    response.headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    response.headers.set('Expires', new Date(Date.now() + CACHE_MAX_AGE * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error fetching brand analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch brand analytics', details: errorMessage },
      { status: 500 }
    );
  }
}
