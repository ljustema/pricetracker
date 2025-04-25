import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { z } from 'zod';
import { Database } from '@/lib/supabase/database.types';
import { getServerSession } from 'next-auth'; // Import getServerSession
import { authOptions } from '@/lib/auth/options'; // Import authOptions


// Define schema for brand update (subset of BrandUpdate)
// Allow optional fields. user_id is handled by the service.
const updateBrandSchema = z.object({
  name: z.string().min(1, 'Brand name cannot be empty.').optional(),
  is_active: z.boolean().optional(),
  needs_review: z.boolean().optional(),
  // Add other updatable fields from database.types.ts if needed
}).strict(); // Use strict to prevent extra fields

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  // Get the authenticated user's session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = session.user.id;

  // Extract brandId from params
  const { id: brandId } = params;
  if (!brandId) {
    return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Validate request body
    const validationResult = updateBrandSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.errors }, { status: 400 });
    }

    // Prepare data for service (user_id check is handled by the service)
    const brandData: Database['public']['Tables']['brands']['Update'] = validationResult.data;

    // Prevent updating user_id or id via the request body
    delete brandData.user_id;
    delete brandData.id;

    if (Object.keys(brandData).length === 0) {
         return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    const brandService = new BrandService();
    // Pass the userId to the service method
    const updatedBrand = await brandService.updateBrand(userId, brandId, brandData);

    if (!updatedBrand) {
        // This could happen if the brand wasn't found or didn't belong to the user
        return NextResponse.json({ error: 'Brand not found or update failed' }, { status: 404 });
    }

    return NextResponse.json(updatedBrand);
  } catch (error: unknown) {
    console.error(`Error updating brand ${brandId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
     if (errorMessage === 'User not authenticated.') { // This error might still come from the service if userId is missing
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // Handle potential database constraint errors (e.g., unique name violation)
    if (errorMessage.includes('unique constraint')) {
        return NextResponse.json({ error: 'Brand name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update brand', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  // Get the authenticated user's session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = session.user.id;

  // Extract brandId from params - must await params in App Router
  const params = await context.params;
  const brandId = params.id;
  if (!brandId) {
    return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
  }

  try {
    const brandService = new BrandService();
    // Pass the userId to the service method
    await brandService.deleteBrand(userId, brandId);

    // If deleteBrand succeeds, return 204 No Content
    return new NextResponse(null, { status: 204 }); // 204 No Content indicates successful deletion
  } catch (error: unknown) {
    console.error(`Error deleting brand ${brandId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if the error is about products still referencing the brand
    if (errorMessage.includes('still referenced by') && errorMessage.includes('product')) {
      return NextResponse.json({
        error: 'Cannot delete brand',
        details: errorMessage
      }, { status: 409 }); // 409 Conflict is appropriate for this case
    }

    // Handle other errors
    return NextResponse.json({ error: 'Failed to delete brand', details: errorMessage }, { status: 500 });
  }
}