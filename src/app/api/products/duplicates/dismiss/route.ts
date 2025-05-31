import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils';
import { z } from 'zod';

// Define a type for database errors
interface DatabaseError extends Error {
  code?: string;
}

// Define schema for the dismiss-duplicates request body
const dismissDuplicatesSchema = z.object({
  groupKey: z.string().min(1, 'Group key is required.'),
  productIds: z.array(z.string().uuid('Invalid product ID format.')).min(2, 'At least two product IDs are required.'),
});

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = ensureUUID(session.user.id);

    const body = await request.json();

    // Validate request body
    const validationResult = dismissDuplicatesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { groupKey: _groupKey, productIds } = validationResult.data;

    const supabase = createSupabaseAdminClient();

    // Verify all products belong to the user
    const { data: products, error: verifyError } = await supabase
      .from("products")
      .select("id")
      .in("id", productIds)
      .eq("user_id", userId);

    if (verifyError) {
      console.error("Error verifying products:", verifyError);
      return NextResponse.json(
        { error: "Failed to verify products" },
        { status: 500 }
      );
    }

    if (!products || products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Some products not found or don't belong to user" },
        { status: 404 }
      );
    }

    // Dismiss all pairs within the group
    const dismissResults = [];
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const { data: result, error: dismissError } = await supabase.rpc(
          "dismiss_product_duplicates",
          {
            p_user_id: userId,
            p_product_id_1: productIds[i],
            p_product_id_2: productIds[j]
          }
        );

        if (dismissError) {
          console.error("Error dismissing product duplicates:", dismissError);
          return NextResponse.json(
            {
              error: "Failed to dismiss duplicates",
              details: dismissError.message
            },
            { status: 500 }
          );
        }

        dismissResults.push(result);
      }
    }

    return NextResponse.json({
      message: `Successfully dismissed ${dismissResults.length} product duplicate pairs.`,
      results: dismissResults
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Error dismissing product duplicates:', error);

    // Extract error details for better error messages
    let errorMessage = 'An unknown error occurred';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific database errors
      const dbError = error as DatabaseError;
      if (dbError.code === '23514' && dbError.message.includes('product_id_order')) {
        errorMessage = 'Database constraint violation';
        errorDetails = 'There was an issue with the order of product IDs. This has been fixed, please try again.';
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
