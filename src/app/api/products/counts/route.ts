import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // Get count of pending EAN conflict reviews
    const { count: conflictCount, error: conflictError } = await supabase
      .from('product_match_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', 'pending');

    if (conflictError) {
      console.error('Error counting EAN conflicts:', conflictError);
      return NextResponse.json(
        { error: 'Failed to count EAN conflicts', details: conflictError.message },
        { status: 500 }
      );
    }

    // Get count of potential duplicates
    let duplicateCount = 0;
    try {
      const { data: duplicatesData, error: duplicatesError } = await supabase.rpc(
        'find_potential_duplicates',
        {
          p_user_id: session.user.id,
          p_limit: 1000 // High limit to get accurate count
        }
      );

      if (!duplicatesError && duplicatesData) {
        duplicateCount = duplicatesData.length;
      } else if (duplicatesError) {
        console.error('Error counting duplicates:', duplicatesError);
        // Don't fail the entire request if duplicates count fails
      }
    } catch (error) {
      console.error('Error in duplicates RPC call:', error);
      // Don't fail the entire request if duplicates count fails
    }

    return NextResponse.json({
      eanConflicts: conflictCount || 0,
      duplicates: duplicateCount
    });

  } catch (error) {
    console.error('Unexpected error in products counts API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
