import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Define schema for the direct merge request body
const directMergeSchema = z.object({
  brandToMergeId: z.string().uuid('Invalid brand ID format.'),
  targetBrandId: z.string().uuid('Invalid target brand ID format.'),
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
    const validationResult = directMergeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.errors }, { status: 400 });
    }

    const { brandToMergeId, targetBrandId } = validationResult.data;

    // Basic check to prevent merging a brand into itself
    if (brandToMergeId === targetBrandId) {
      return NextResponse.json({ error: 'Cannot merge a brand into itself.' }, { status: 400 });
    }

    const brandService = new BrandService();
    // Pass the userId to the service method
    await brandService.mergeBrands(userId, targetBrandId, [brandToMergeId]);

    return NextResponse.json({ message: 'Brand merged successfully.' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in direct brand merge:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage === 'User not authenticated.') {
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
