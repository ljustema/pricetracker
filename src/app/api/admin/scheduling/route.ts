import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';



// GET /api/admin/scheduling - Get scheduling statistics and status
export async function GET(_request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();

    // Get scheduling statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_scheduling_stats');

    if (statsError) {
      console.error('Error fetching scheduling stats:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduling statistics' },
        { status: 500 }
      );
    }

    // Get user workload distribution
    const { data: userWorkload, error: workloadError } = await supabase
      .rpc('get_user_workload_stats');

    if (workloadError) {
      console.error('Error fetching user workload:', workloadError);
      return NextResponse.json(
        { error: 'Failed to fetch user workload statistics' },
        { status: 500 }
      );
    }

    // Get current pg_cron jobs using our safe function
    let cronJobs = [];
    try {
      const { data, error: cronError } = await supabase
        .rpc('get_cron_jobs');

      if (cronError) {
        console.warn('pg_cron not available or accessible:', cronError.message);
        // Continue without cron jobs data
      } else {
        cronJobs = data || [];
      }
    } catch (error) {
      console.warn('pg_cron extension not available:', error);
      // Continue without cron jobs data
    }

    // Get recent job execution history
    const { data: recentJobsRaw, error: jobsError } = await supabase
      .from('scraper_runs')
      .select(`
        id,
        status,
        created_at,
        started_at,
        completed_at,
        execution_time_ms,
        scraper_type,
        is_test_run,
        scrapers!inner(name, user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (jobsError) {
      console.error('Error fetching recent jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch recent jobs' },
        { status: 500 }
      );
    }

    // Get user profiles for recent jobs
    const recentJobUserIds = recentJobsRaw?.map(job => (job.scrapers as unknown as { user_id: string }).user_id) || [];
    const { data: recentJobUserProfiles, error: recentJobUsersError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', recentJobUserIds);

    if (recentJobUsersError) {
      console.error('Error fetching recent job user profiles:', recentJobUsersError);
      return NextResponse.json(
        { error: 'Failed to fetch recent job user profiles' },
        { status: 500 }
      );
    }

    // Combine recent jobs with user profiles
    const recentJobs = recentJobsRaw?.map(job => ({
      ...job,
      scrapers: {
        ...job.scrapers,
        user_profiles: recentJobUserProfiles?.find(u => u.id === (job.scrapers as unknown as { user_id: string }).user_id) || { name: 'Unknown', email: 'unknown@example.com' }
      }
    }));

    // Get recent integration runs
    const { data: recentIntegrationsRaw, error: integrationsError } = await supabase
      .from('integration_runs')
      .select(`
        id,
        status,
        created_at,
        started_at,
        completed_at,
        products_processed,
        integrations!inner(name, platform, user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (integrationsError) {
      console.error('Error fetching recent integrations:', integrationsError);
      return NextResponse.json(
        { error: 'Failed to fetch recent integrations' },
        { status: 500 }
      );
    }

    // Get user profiles for recent integration runs
    const integrationRunUserIds = recentIntegrationsRaw?.map(run => (run.integrations as unknown as { user_id: string }).user_id) || [];
    const { data: integrationRunUserProfiles, error: integrationRunUsersError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', integrationRunUserIds);

    if (integrationRunUsersError) {
      console.error('Error fetching integration run user profiles:', integrationRunUsersError);
      return NextResponse.json(
        { error: 'Failed to fetch integration run user profiles' },
        { status: 500 }
      );
    }

    // Combine recent integration runs with user profiles
    const recentIntegrations = recentIntegrationsRaw?.map(run => ({
      ...run,
      integrations: {
        ...run.integrations,
        user_profiles: integrationRunUserProfiles?.find(u => u.id === (run.integrations as unknown as { user_id: string }).user_id) || { name: 'Unknown', email: 'unknown@example.com' }
      }
    }));

    // Get scheduled scrapers with their next run times and user information
    const { data: scheduledScrapersRaw, error: scheduledError } = await supabase
      .from('scrapers')
      .select(`
        id,
        name,
        schedule,
        last_run,
        is_active,
        scraper_type,
        user_id,
        competitors!inner(name)
      `)
      .eq('is_active', true)
      .not('schedule', 'is', null)
      .order('name');

    if (scheduledError) {
      console.error('Error fetching scheduled scrapers:', scheduledError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled scrapers' },
        { status: 500 }
      );
    }

    // Get user profiles for scrapers
    const scraperUserIds = scheduledScrapersRaw?.map((s: Record<string, unknown>) => s.user_id as string) || [];
    const { data: scraperUserProfiles, error: scraperUsersError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', scraperUserIds);

    if (scraperUsersError) {
      console.error('Error fetching scraper user profiles:', scraperUsersError);
      return NextResponse.json(
        { error: 'Failed to fetch scraper user profiles' },
        { status: 500 }
      );
    }

    // Combine scrapers with user profiles
    const scheduledScrapers = scheduledScrapersRaw?.map((scraper: Record<string, unknown>) => ({
      ...scraper,
      user_profiles: scraperUserProfiles?.find(u => u.id === scraper.user_id) || { name: 'Unknown', email: 'unknown@example.com' }
    }));

    // Get scheduled integrations with their sync frequencies and calculated next run times
    const { data: scheduledIntegrationsRaw, error: integrationsScheduledError } = await supabase
      .from('integrations')
      .select(`
        id,
        name,
        platform,
        sync_frequency,
        last_sync_at,
        status,
        user_id
      `)
      .eq('status', 'active')
      .not('sync_frequency', 'is', null)
      .order('name');

    if (integrationsScheduledError) {
      console.error('Error fetching scheduled integrations:', integrationsScheduledError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled integrations' },
        { status: 500 }
      );
    }

    // Get user profiles for integrations
    const integrationUserIds = scheduledIntegrationsRaw?.map(i => i.user_id) || [];
    const { data: integrationUserProfiles, error: integrationUsersError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', integrationUserIds);

    if (integrationUsersError) {
      console.error('Error fetching integration user profiles:', integrationUsersError);
      return NextResponse.json(
        { error: 'Failed to fetch integration user profiles' },
        { status: 500 }
      );
    }

    // Calculate next run times for integrations using database function
    const scheduledIntegrations = await Promise.all(
      (scheduledIntegrationsRaw || []).map(async (integration) => {
        // Calculate next run time using the database function
        const { data: nextRunData, error: nextRunError } = await supabase
          .rpc('calculate_next_integration_run_time', {
            sync_frequency: integration.sync_frequency,
            last_sync_at: integration.last_sync_at
          });

        if (nextRunError) {
          console.error('Error calculating next run time for integration:', integration.id, nextRunError);
        }

        return {
          ...integration,
          next_run_time: nextRunData || null,
          user_profiles: integrationUserProfiles?.find(u => u.id === integration.user_id) || { name: 'Unknown', email: 'unknown@example.com' }
        };
      })
    );

    // Calculate due scrapers and integrations by checking pending jobs in database
    let dueScrapersCount = 0;
    let dueIntegrationsCount = 0;

    // Count pending scraper runs
    const { data: pendingScraperRuns, error: scraperRunsError } = await supabase
      .from('scraper_runs')
      .select('id')
      .eq('status', 'pending');

    if (scraperRunsError) {
      console.error('Error fetching pending scraper runs:', scraperRunsError);
    } else {
      dueScrapersCount = pendingScraperRuns?.length || 0;
    }

    // Count pending integration runs
    const { data: pendingIntegrationRuns, error: integrationRunsError } = await supabase
      .from('integration_runs')
      .select('id')
      .eq('status', 'pending');

    if (integrationRunsError) {
      console.error('Error fetching pending integration runs:', integrationRunsError);
    } else {
      dueIntegrationsCount = pendingIntegrationRuns?.length || 0;
    }



    // Add due counts to stats
    const enhancedStats = [
      ...(stats || []),
      {
        metric_name: 'due_scrapers',
        metric_value: dueScrapersCount,
        description: 'Number of scrapers due to run'
      },
      {
        metric_name: 'due_integrations',
        metric_value: dueIntegrationsCount,
        description: 'Number of integrations due to sync'
      }
    ];

    return NextResponse.json({
      stats: enhancedStats,
      userWorkload: userWorkload || [],
      cronJobs: cronJobs || [],
      recentJobs: recentJobs || [],
      recentIntegrations: recentIntegrations || [],
      scheduledScrapers: scheduledScrapers || [],
      scheduledIntegrations: scheduledIntegrations || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in scheduling admin endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/scheduling - Execute administrative actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ..._params } = body;

    const supabase = createSupabaseAdminClient();

    switch (action) {
      case 'optimize_schedules':
        // Optimize scraper schedules to distribute load
        const { data: optimizeResult, error: optimizeError } = await supabase
          .rpc('optimize_scraper_schedules');

        if (optimizeError) {
          console.error('Error optimizing schedules:', optimizeError);
          return NextResponse.json(
            { error: 'Failed to optimize schedules' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Optimized ${optimizeResult} scraper schedules`,
          updatedScrapers: optimizeResult
        });

      case 'create_scraper_jobs':
        // Manually trigger scraper job creation
        const { data: scraperJobsResult, error: scraperJobsError } = await supabase
          .rpc('create_scheduled_scraper_jobs');

        if (scraperJobsError) {
          console.error('Error creating scraper jobs:', scraperJobsError);
          return NextResponse.json(
            { error: 'Failed to create scraper jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created ${scraperJobsResult[0]?.jobs_created || 0} scraper jobs`,
          jobsCreated: scraperJobsResult[0]?.jobs_created || 0
        });

      case 'create_integration_jobs':
        // Manually trigger integration job creation
        const { data: integrationJobsResult, error: integrationJobsError } = await supabase
          .rpc('create_scheduled_integration_jobs');

        if (integrationJobsError) {
          console.error('Error creating integration jobs:', integrationJobsError);
          return NextResponse.json(
            { error: 'Failed to create integration jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created ${integrationJobsResult[0]?.jobs_created || 0} integration jobs`,
          jobsCreated: integrationJobsResult[0]?.jobs_created || 0
        });

      case 'create_utility_jobs':
        // Manually trigger utility job creation
        const { data: utilityJobsResult, error: utilityJobsError } = await supabase
          .rpc('create_utility_jobs');

        if (utilityJobsError) {
          console.error('Error creating utility jobs:', utilityJobsError);
          return NextResponse.json(
            { error: 'Failed to create utility jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Created ${utilityJobsResult[0]?.jobs_created || 0} utility jobs`,
          jobsCreated: utilityJobsResult[0]?.jobs_created || 0
        });

      case 'cleanup_old_runs':
        // Manually trigger cleanup of old scraper runs
        const { data: cleanupResult, error: cleanupError } = await supabase
          .rpc('cleanup_old_scraper_runs');

        if (cleanupError) {
          console.error('Error cleaning up old runs:', cleanupError);
          return NextResponse.json(
            { error: 'Failed to cleanup old runs' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleanupResult} old scraper runs`,
          deletedRuns: cleanupResult
        });

      case 'process_timeouts':
        // Manually trigger timeout processing
        const { data: timeoutResult, error: timeoutError } = await supabase
          .rpc('process_scraper_timeouts');

        if (timeoutError) {
          console.error('Error processing timeouts:', timeoutError);
          return NextResponse.json(
            { error: 'Failed to process timeouts' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Processed ${timeoutResult} timed out jobs`,
          timedOutJobs: timeoutResult
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in scheduling admin POST endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/scheduling - Update scheduling configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, schedule, isActive } = body;

    const supabase = createSupabaseAdminClient();

    if (type === 'scraper') {
      // Update scraper schedule
      const { error } = await supabase
        .from('scrapers')
        .update({
          schedule: schedule,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error updating scraper schedule:', error);
        return NextResponse.json(
          { error: 'Failed to update scraper schedule' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Scraper schedule updated successfully'
      });

    } else if (type === 'integration') {
      // Update integration sync frequency
      const { error } = await supabase
        .from('integrations')
        .update({
          sync_frequency: schedule.frequency,
          status: isActive ? 'active' : 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error updating integration schedule:', error);
        return NextResponse.json(
          { error: 'Failed to update integration schedule' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Integration schedule updated successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "scraper" or "integration"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in scheduling admin PUT endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
