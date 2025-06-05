import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admin users (you can adjust this check as needed)
    // For now, we'll allow any authenticated user, but you might want to add role checking
    
    const supabase = createSupabaseAdminClient();
    
    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_stalled_integration_runs');
    
    if (error) {
      console.error('Error calling cleanup function:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup stalled integration runs' },
        { status: 500 }
      );
    }

    const cleanedUpCount = data || 0;
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedUpCount} stalled integration run(s)`,
      cleanedUpCount
    });

  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    
    // Get information about potentially stalled runs without cleaning them up
    const { data: stalledRuns, error } = await supabase
      .from('integration_runs')
      .select(`
        id,
        status,
        started_at,
        last_progress_update,
        products_processed,
        integrations:integrations (name)
      `)
      .eq('status', 'processing')
      .order('started_at', { ascending: true });

    if (error) {
      console.error('Error fetching integration runs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch integration runs' },
        { status: 500 }
      );
    }

    // Calculate which ones would be considered stalled
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const potentiallyStalled = stalledRuns?.filter(run => {
      if (run.last_progress_update) {
        return new Date(run.last_progress_update) < oneHourAgo;
      } else if (run.started_at) {
        return new Date(run.started_at) < oneHourAgo;
      }
      return false;
    }) || [];

    return NextResponse.json({
      success: true,
      totalProcessingRuns: stalledRuns?.length || 0,
      potentiallyStalledRuns: potentiallyStalled.length,
      runs: stalledRuns?.map(run => ({
        id: run.id,
        integration_name: run.integrations?.name || 'Unknown',
        started_at: run.started_at,
        last_progress_update: run.last_progress_update,
        products_processed: run.products_processed,
        minutes_since_progress: run.last_progress_update 
          ? Math.floor((now.getTime() - new Date(run.last_progress_update).getTime()) / (1000 * 60))
          : run.started_at 
            ? Math.floor((now.getTime() - new Date(run.started_at).getTime()) / (1000 * 60))
            : null,
        is_potentially_stalled: potentiallyStalled.some(stalled => stalled.id === run.id)
      }))
    });

  } catch (error) {
    console.error('Error in cleanup info endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
