import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { z } from 'zod';
import { Database } from '@/lib/supabase/database.types';
import { getServerSession } from 'next-auth'; // Import getServerSession
import { authOptions } from '@/lib/auth/options'; // Import authOptions

// Define schema for brand creation (subset of BrandInsert)
// Ensure required fields like 'name' are present.
// user_id will be added by the service based on the authenticated user.
const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name cannot be empty.'),
  is_active: z.boolean().optional(), // Defaults handled by service/DB
  needs_review: z.boolean().optional(), // Defaults handled by service/DB
  // Add other insertable fields from database.types.ts if needed
});

// Define schema for query parameters for GET request
const getBrandsQuerySchema = z.object({
    isActive: z.string().optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    needsReview: z.string().optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    // Add other potential query params like search, page, limit etc.
});


export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validationResult = getBrandsQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.errors }, { status: 400 });
    }
    const { isActive, needsReview } = validationResult.data;

    const brandService = new BrandService();
    // Pass the userId to the service method
    const brands = await brandService.getAllBrands(userId, { isActive, needsReview });


    return NextResponse.json(brands); // Return the filtered brands directly
  } catch (error: unknown) {
    console.error('Error fetching brands:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    // Consider more specific error codes based on the error type
     if (errorMessage === 'User not authenticated.') { // This error might still come from the service if userId is missing
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch brands', details: errorMessage }, { status: 500 });
  }
}

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
    const validationResult = createBrandSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.errors }, { status: 400 });
    }

    // Prepare data for service. The service method expects the full Insert type,
    // but it will correctly set/overwrite user_id based on the authenticated user.
    // We only provide the fields validated from the request body.
    const brandData: Partial<Database['public']['Tables']['brands']['Insert']> = {
        name: validationResult.data.name,
        is_active: validationResult.data.is_active, // Will default in service/DB if undefined
        needs_review: validationResult.data.needs_review, // Will default in service/DB if undefined
    };


    const brandService = new BrandService();
    // Pass the userId and cast to the required type
    const newBrand = await brandService.createBrand(userId, brandData as Database['public']['Tables']['brands']['Insert']);

    return NextResponse.json(newBrand, { status: 201 }); // 201 Created
  } catch (error: unknown) {
    console.error('Error creating brand:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
     if (errorMessage === 'User not authenticated.') { // This error might still come from the service if userId is missing
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // Handle potential database constraint errors (e.g., unique name violation)
    if (errorMessage.includes('unique constraint')) { // Basic check, might need refinement
        return NextResponse.json({ error: 'Brand name already exists' }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ error: 'Failed to create brand', details: errorMessage }, { status: 500 });
  }
}