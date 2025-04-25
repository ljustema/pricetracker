import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Helper function to get brand ID from context
function getBrandIdFromContext(context: { params?: { id?: string } }): string | null {
  return context.params?.id || null;
}

/**
 * GET handler to fetch analytics data for a specific brand by ID
 */
export async function GET(_request: NextRequest, context: { params?: { id?: string } }) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get the brand ID from the URL path
    const brandId = getBrandIdFromContext(context);
    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    const brandService = new BrandService();
    
    // Get analytics for the specific brand
    const analyticsData = await brandService.getBrandAnalytics(userId, brandId);

    // If no data was found for this brand ID, return 404
    if (!analyticsData || analyticsData.length === 0) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Return the first (and only) item in the array
    return NextResponse.json(analyticsData[0]);
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
