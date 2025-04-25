import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Define a type for database errors
interface DatabaseError extends Error {
  code?: string;
  message?: string;
}

// Define schema for the dismiss-duplicates request body
const dismissDuplicatesSchema = z.object({
  groupKey: z.string().min(1, 'Group key is required.'),
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
    const validationResult = dismissDuplicatesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.errors }, { status: 400 });
    }

    const { groupKey, brandIds } = validationResult.data;

    const brandService = new BrandService();

    // Dismiss duplicates
    await brandService.dismissDuplicates(userId, groupKey, brandIds);

    return NextResponse.json({ message: `Successfully marked brands as not duplicates.` }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error dismissing duplicates:', error);

    // Extract error details for better error messages
    let errorMessage = 'An unknown error occurred';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific database errors
      const dbError = error as DatabaseError;
      if (dbError.code === '23514' && dbError.message?.includes('brand_id_order')) {
        errorMessage = 'Database constraint violation';
        errorDetails = 'There was an issue with the order of brand IDs. This has been fixed, please try again.';
      } else if (dbError.code) {
        errorDetails = `Database error code: ${dbError.code}`;
      }
    }

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to dismiss duplicates',
      message: errorMessage,
      details: errorDetails || errorMessage
    }, { status: 500 });
  }
}
