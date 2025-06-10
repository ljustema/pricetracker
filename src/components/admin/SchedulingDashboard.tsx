'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Play, Settings, AlertTriangle, CheckCircle } from 'lucide-react';

interface SchedulingStats {
  metric_name: string;
  metric_value: number;
  description: string;
}

interface UserWorkload {
  user_id: string;
  user_name: string;
  user_email: string;
  active_scrapers: number;
  active_integrations: number;
  jobs_today: number;
  jobs_this_week: number;
  jobs_this_month: number;
  avg_execution_time_ms: number;
}

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  jobname: string;
  active: boolean;
}

interface RecentJob {
  id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  scraper_type: string;
  is_test_run: boolean;
  scrapers: {
    name: string;
    user_id: string;
    user_profiles: {
      name: string;
      email: string;
    };
  };
}

interface ScheduledScraper {
  id: string;
  name: string;
  schedule: {
    frequency: string;
    time?: string;
    day?: number;
  };
  last_run: string | null;
  is_active: boolean;
  scraper_type: string;
  user_id: string;
  competitors: {
    name: string;
  };
  user_profiles: {
    name: string;
    email: string;
  };
}

interface ScheduledIntegration {
  id: string;
  name: string;
  platform: string;
  sync_frequency: string;
  last_sync_at: string | null;
  next_run_time: string | null;
  status: string;
  user_id: string;
  user_profiles: {
    name: string;
    email: string;
  };
}

interface RecentIntegrationRun {
  id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  products_processed: number | null;
  integrations: {
    name: string;
    platform: string;
    user_id: string;
    user_profiles: {
      name: string;
      email: string;
    };
  };
}

interface SchedulingData {
  stats: SchedulingStats[];
  userWorkload: UserWorkload[];
  cronJobs: CronJob[];
  recentJobs: RecentJob[];
  recentIntegrations: RecentIntegrationRun[];
  scheduledScrapers: ScheduledScraper[];
  scheduledIntegrations: ScheduledIntegration[];
  timestamp: string;
}

// Utility function to format execution time from milliseconds to minutes and seconds
const formatExecutionTime = (ms: number | null): string => {
  if (!ms) return 'N/A';

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

// Utility function to calculate execution time for integration runs
const calculateIntegrationExecutionTime = (startedAt: string | null, completedAt: string | null): number | null => {
  if (!startedAt || !completedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();

  return end - start;
};

export default function SchedulingDashboard() {
  const [data, setData] = useState<SchedulingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/scheduling');
      if (!response.ok) {
        throw new Error('Failed to fetch scheduling data');
      }
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching scheduling data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch scheduling data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const executeAction = async (action: string, description: string) => {
    try {
      setActionLoading(action);
      const response = await fetch('/api/admin/scheduling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute ${action}`);
      }

      const result = await response.json();
      toast({
        title: 'Success',
        description: result.message || `${description} completed successfully`,
      });

      // Refresh data after action
      await fetchData();
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${description.toLowerCase()}`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading scheduling data...</span>
      </div>
    );
  }

  const getStatValue = (statName: string): number => {
    return data?.stats.find(s => s.metric_name === statName)?.metric_value || 0;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const calculateNextRunTime = (schedule: ScheduledScraper['schedule'], lastRun: string | null): Date => {
    const now = new Date();
    const timeOfDay = schedule.time || '02:00';
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    if (schedule.frequency === 'daily') {
      // If last run was today, schedule for tomorrow
      if (lastRun) {
        const lastRunDate = new Date(lastRun);
        if (lastRunDate.toDateString() === now.toDateString()) {
          nextRun.setDate(nextRun.getDate() + 1);
        } else if (nextRun <= now) {
          // Time has passed today, schedule for tomorrow
          nextRun.setDate(nextRun.getDate() + 1);
        }
      } else if (nextRun <= now) {
        // Never run before and time has passed today
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (schedule.frequency === 'weekly') {
      const dayOfWeek = schedule.day || 1; // Default to Monday
      const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
      nextRun.setDate(now.getDate() + (daysUntilNext || 7));
    } else if (schedule.frequency === 'monthly') {
      nextRun.setMonth(nextRun.getMonth() + 1, 1);
    }

    return nextRun;
  };

  const isScraperDue = (scraper: ScheduledScraper): boolean => {
    const nextRun = calculateNextRunTime(scraper.schedule, scraper.last_run);
    return nextRun <= new Date();
  };

  const isIntegrationDue = (integration: ScheduledIntegration): boolean => {
    if (!integration.next_run_time) return false;
    const nextRun = new Date(integration.next_run_time);
    return nextRun <= new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduling Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage automated task scheduling
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Overview - 2 rows with 3 cards each */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Scrapers</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatValue('active_scrapers')}</div>
            <p className="text-xs text-muted-foreground">
              Approved and active scrapers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Scrapers</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{getStatValue('due_scrapers')}</div>
            <p className="text-xs text-muted-foreground">
              Scrapers that should have run by now
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Integrations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{getStatValue('due_integrations')}</div>
            <p className="text-xs text-muted-foreground">
              Integration jobs waiting to run
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatValue('pending_scraper_jobs') + getStatValue('pending_integration_jobs')}
            </div>
            <p className="text-xs text-muted-foreground">
              Waiting for worker pickup
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Jobs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatValue('running_scraper_jobs') + getStatValue('processing_integration_jobs')}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently executing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatValue('jobs_completed_today')}</div>
            <p className="text-xs text-muted-foreground">
              Completed successfully
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Administrative Actions</CardTitle>
          <CardDescription>
            Manually trigger scheduling operations and maintenance tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => executeAction('create_scraper_jobs', 'Create scraper jobs')}
              disabled={actionLoading === 'create_scraper_jobs'}
              variant="outline"
            >
              {actionLoading === 'create_scraper_jobs' && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Scraper Jobs
            </Button>

            <Button
              onClick={() => executeAction('create_integration_jobs', 'Create integration jobs')}
              disabled={actionLoading === 'create_integration_jobs'}
              variant="outline"
            >
              {actionLoading === 'create_integration_jobs' && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Integration Jobs
            </Button>

            <Button
              onClick={() => executeAction('optimize_schedules', 'Optimize schedules')}
              disabled={actionLoading === 'optimize_schedules'}
              variant="outline"
            >
              {actionLoading === 'optimize_schedules' && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Optimize Schedules
            </Button>

            <Button
              onClick={() => executeAction('process_timeouts', 'Process timeouts')}
              disabled={actionLoading === 'process_timeouts'}
              variant="outline"
            >
              {actionLoading === 'process_timeouts' && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Process Timeouts
            </Button>

            <Button
              onClick={() => executeAction('cleanup_old_runs', 'Cleanup old runs')}
              disabled={actionLoading === 'cleanup_old_runs'}
              variant="outline"
            >
              {actionLoading === 'cleanup_old_runs' && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Cleanup Old Runs
            </Button>

            <Button
              onClick={() => executeAction('create_utility_jobs', 'Create utility jobs')}
              disabled={actionLoading === 'create_utility_jobs'}
              variant="outline"
            >
              {actionLoading === 'create_utility_jobs' && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Utility Jobs
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="scheduled" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scheduled">Scheduled Scrapers</TabsTrigger>
          <TabsTrigger value="integrations">Scheduled Integrations</TabsTrigger>
          <TabsTrigger value="jobs">Recent Jobs</TabsTrigger>
          <TabsTrigger value="users">User Workload</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Scrapers</CardTitle>
              <CardDescription>Active scrapers with their schedules and next run times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.scheduledScrapers.map((scraper) => {
                  const nextRun = calculateNextRunTime(scraper.schedule, scraper.last_run);
                  const isDue = isScraperDue(scraper);
                  const lastRunDate = scraper.last_run ? new Date(scraper.last_run) : null;

                  return (
                    <div key={scraper.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{scraper.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {scraper.competitors.name} • {scraper.scraper_type} • {scraper.schedule.frequency}
                          {scraper.schedule.time && ` at ${scraper.schedule.time}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Owner: {scraper.user_profiles.name} ({scraper.user_profiles.email}) • Last run: {lastRunDate ? lastRunDate.toLocaleString() : 'Never'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isDue && (
                          <Badge variant="destructive">Due Now</Badge>
                        )}
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            Next: {nextRun.toLocaleDateString()} {nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isDue ? 'Overdue' : `In ${Math.ceil((nextRun.getTime() - Date.now()) / (1000 * 60 * 60))} hours`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!data?.scheduledScrapers || data.scheduledScrapers.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled scrapers found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Integrations</CardTitle>
              <CardDescription>Active integrations with their sync frequencies and next run times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.scheduledIntegrations.map((integration) => {
                  const isDue = isIntegrationDue(integration);
                  const lastSyncDate = integration.last_sync_at ? new Date(integration.last_sync_at) : null;
                  const nextRun = integration.next_run_time ? new Date(integration.next_run_time) : null;

                  return (
                    <div key={integration.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.platform} • {integration.sync_frequency} sync • ts-util-worker
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Owner: {integration.user_profiles.name} ({integration.user_profiles.email}) • Last sync: {lastSyncDate ? lastSyncDate.toLocaleString() : 'Never'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isDue && (
                          <Badge variant="destructive">Due Now</Badge>
                        )}
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            Next: {nextRun ? `${nextRun.toLocaleDateString()} ${nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not scheduled'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isDue ? 'Overdue' : nextRun ? `In ${Math.ceil((nextRun.getTime() - Date.now()) / (1000 * 60 * 60))} hours` : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!data?.scheduledIntegrations || data.scheduledIntegrations.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled integrations found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Latest scraper and integration job executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  // Combine scraper jobs and integration jobs, then sort by creation date
                  const scraperJobs = (data?.recentJobs || []).map(job => ({
                    ...job,
                    type: 'scraper' as const,
                    sortDate: new Date(job.created_at).getTime()
                  }));

                  const integrationJobs = (data?.recentIntegrations || []).map(run => ({
                    ...run,
                    type: 'integration' as const,
                    sortDate: new Date(run.created_at).getTime()
                  }));

                  const allJobs = [...scraperJobs, ...integrationJobs]
                    .sort((a, b) => b.sortDate - a.sortDate)
                    .slice(0, 15);

                  return allJobs.map((job) => (
                    <div key={`${job.type}-${job.id}`} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        {job.type === 'scraper' ? (
                          <>
                            <div className="font-medium">{job.scrapers.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {job.scraper_type} • {new Date(job.created_at).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Owner: {job.scrapers.user_profiles.name} ({job.scrapers.user_profiles.email})
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium">{job.integrations.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {job.integrations.platform} Integration • {new Date(job.created_at).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Owner: {job.integrations.user_profiles.name} ({job.integrations.user_profiles.email})
                              {job.products_processed && ` • ${job.products_processed} products processed`}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={job.type === 'scraper' ? 'default' : 'secondary'}>
                          {job.type === 'scraper' ? 'Scraper' : 'Integration'}
                        </Badge>
                        {job.type === 'scraper' && job.is_test_run && (
                          <Badge variant="outline">Test</Badge>
                        )}
                        {getStatusBadge(job.status)}
                        {job.type === 'scraper' && job.execution_time_ms && (
                          <span className="text-sm text-muted-foreground">
                            {formatExecutionTime(job.execution_time_ms)}
                          </span>
                        )}
                        {job.type === 'integration' && (
                          <span className="text-sm text-muted-foreground">
                            {formatExecutionTime(calculateIntegrationExecutionTime(job.started_at, job.completed_at))}
                          </span>
                        )}
                      </div>
                    </div>
                  ));
                })()}
                {(!data?.recentJobs || data.recentJobs.length === 0) && (!data?.recentIntegrations || data.recentIntegrations.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent jobs found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Workload Distribution</CardTitle>
              <CardDescription>Active users and their job statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.userWorkload.slice(0, 10).map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{user.user_name || 'Unknown User'}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.user_email} • {user.active_scrapers} scrapers • {user.active_integrations} integrations
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{user.jobs_today} jobs today</div>
                      <div className="text-sm text-muted-foreground">
                        {user.jobs_this_week} jobs this week • {user.jobs_this_month} jobs this month
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg: {formatExecutionTime(user.avg_execution_time_ms)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>pg_cron Jobs</CardTitle>
              <CardDescription>
                Automated background tasks scheduled in the database using cron expressions.
                <br />
                <span className="text-xs font-mono mt-1 block">
                  Format: minute hour day month weekday (e.g., &quot;*/5 * * * *&quot; = every 5 minutes)
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.cronJobs.map((job) => {
                  const getJobDescription = (jobName: string, schedule: string) => {
                    switch (jobName) {
                      case 'scraper_job_creator':
                        return {
                          description: 'Creates pending scraper jobs for due scrapers',
                          details: 'Checks all active scrapers and creates jobs for those that need to run based on their schedules. Runs every 5 minutes.',
                          worker: 'py-worker & ts-worker'
                        };
                      case 'integration_job_creator':
                        return {
                          description: 'Creates pending integration sync jobs',
                          details: 'Checks all active integrations and creates sync jobs for those due based on their sync frequency. Runs every 10 minutes.',
                          worker: 'ts-util-worker'
                        };
                      case 'utility_job_creator':
                        return {
                          description: 'Performs maintenance and cleanup tasks',
                          details: 'Handles cleanup of old runs, debug logs, and processes timed-out jobs. Runs every hour.',
                          worker: 'Database maintenance'
                        };
                      default:
                        return {
                          description: 'Custom scheduled task',
                          details: `Runs on schedule: ${schedule}`,
                          worker: 'Various'
                        };
                    }
                  };

                  const jobInfo = getJobDescription(job.jobname, job.schedule);

                  return (
                    <div key={job.jobid} className="flex items-center justify-between p-4 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{job.jobname}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {jobInfo.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">{job.schedule}</span>
                          <span className="ml-2">• {jobInfo.details}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Worker:</span> {jobInfo.worker}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={job.active ? 'default' : 'secondary'}>
                          {job.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {(!data?.cronJobs || data.cronJobs.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No cron jobs found. pg_cron extension may not be available.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {data && (
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
