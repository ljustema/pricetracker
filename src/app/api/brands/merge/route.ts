import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { z } from 'zod';
import { getServerSession } from 'next-auth'; // Import getServerSession
import { authOptions } from '@/lib/auth/options'; // Import authOptions


// Define schema for the merge request body
const mergeBrandsSchema = z.object({
  primaryBrandId: z.string().uuid('Invalid primary brand ID format.'),
  brandIdsToMerge: z.array(z.string().uuid('Invalid brand ID format in array.')).min(1, 'At least one brand ID to merge is required.'),
});

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();

    // Validate request body
    const validationResult = mergeBrandsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.errors }, { status: 400 });
    }

    const { primaryBrandId, brandIdsToMerge } = validationResult.data;

    // Basic check to prevent merging a brand into itself via the list
    if (brandIdsToMerge.includes(primaryBrandId)) {
        return NextResponse.json({ error: 'Primary brand ID cannot be in the list of brands to merge.' }, { status: 400 });
    }

    const brandService = new BrandService();
    // Pass the userId to the service method
    await brandService.mergeBrands(userId, primaryBrandId, brandIdsToMerge);

    return NextResponse.json({ message: 'Brands merged successfully.' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error merging brands:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
     if (errorMessage === 'User not authenticated.') { // This error might still come from the service if userId is missing
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
     if (errorMessage.includes('Could not find all brands to merge') || errorMessage.includes('permission denied')) {
         return NextResponse.json({ error: 'One or more brands not found or permission denied.' }, { status: 404 });
     }
     if (errorMessage.includes('Primary brand ID cannot be included')) {
         return NextResponse.json({ error: errorMessage }, { status: 400 });
     }
    // Handle other potential errors from the service
    return NextResponse.json({ error: 'Failed to merge brands', details: errorMessage }, { status: 500 });
  }
}