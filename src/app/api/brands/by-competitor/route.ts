import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get the competitor ID from the query parameters
    const { searchParams } = new URL(request.url);
    const competitorId = searchParams.get('competitorId');

    if (!competitorId) {
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Use the database function to get brand IDs for this competitor
    const { data: brandIds, error: brandIdsError } = await supabase.rpc(
      'get_brands_for_competitor',
      {
        p_user_id: userId,
        p_competitor_id: competitorId
      }
    );

    if (brandIdsError) {
      console.error('Error fetching brand IDs for competitor:', brandIdsError);
      return NextResponse.json(
        { error: 'Failed to fetch brand IDs', details: brandIdsError.message },
        { status: 500 }
      );
    }

    if (!brandIds || brandIds.length === 0) {
      return NextResponse.json([]);
    }

    // Extract the brand IDs from the result
    const ids = brandIds.map((item: { brand_id: string }) => item.brand_id);

    // Fetch the full brand details for these IDs
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId)
      .in('id', ids);

    if (brandsError) {
      console.error('Error fetching brands for competitor:', brandsError);
      return NextResponse.json(
        { error: 'Failed to fetch brands', details: brandsError.message },
        { status: 500 }
      );
    }

    // Add cache headers to the response
    const response = NextResponse.json(brands || []);
    response.headers.set('Cache-Control', 'public, max-age=60'); // Cache for 60 seconds
    response.headers.set('Expires', new Date(Date.now() + 60 * 1000).toUTCString());

    return response;
  } catch (error: unknown) {
    console.error('Error in brands by competitor API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch brands by competitor', details: errorMessage },
      { status: 500 }
    );
  }
}
