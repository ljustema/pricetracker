import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get active runs from the database
    const supabase = createSupabaseAdminClient();
    const { data: runs, error } = await supabase
      .from('integration_runs')
      .select('id, integration_id, status, started_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .order('started_at', { ascending: false });

    if (error) {
      console.error("Error fetching active integration runs:", error);
      return NextResponse.json(
        { error: "Failed to fetch active integration runs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Unexpected error in active-runs API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
