import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Define schema for the confirm-all request body
const confirmAllSchema = z.object({
  brandIds: z.array(z.string().uuid('Invalid brand ID format.')).min(1, 'At least one brand ID is required.'),
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
    const validationResult = confirmAllSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.errors }, { status: 400 });
    }

    const { brandIds } = validationResult.data;

    const brandService = new BrandService();
    
    // Confirm all brands
    await brandService.confirmAllBrands(userId, brandIds);

    return NextResponse.json({ message: `Successfully confirmed ${brandIds.length} brands.` }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error confirming brands:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to confirm brands', details: errorMessage }, { status: 500 });
  }
}
