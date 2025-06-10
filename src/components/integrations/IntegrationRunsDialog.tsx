'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Integration } from '@/lib/services/integration-service';
import { useToast } from '@/components/ui/use-toast';

interface IntegrationRun {
  id: string;
  integration_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  products_processed: number;
  products_updated: number;
  products_created: number;
  error_message: string | null;
}

interface IntegrationRunsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: Integration | null;
}

export function IntegrationRunsDialog({ open, onOpenChange, integration }: IntegrationRunsDialogProps) {
  const [runs, setRuns] = useState<IntegrationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Fetch integration runs
  const fetchRuns = useCallback(async () => {
    if (!integration) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/integrations/${integration.id}/runs`);

      if (!response.ok) {
        throw new Error('Failed to fetch integration runs');
      }

      const data = await response.json();
      setRuns(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch integration runs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [integration, toast]);

  // Fetch integration runs when the dialog opens
  useEffect(() => {
    if (open && integration) {
      fetchRuns();
    }
  }, [open, integration, fetchRuns]);

  // Refresh integration runs
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRuns();
    setRefreshing(false);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Integration Runs</DialogTitle>
          <DialogDescription>
            {integration ? `Sync history for ${integration.name}` : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          // Loading skeleton
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex space-x-2">
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          // Empty state
          <div className="text-center py-8 border rounded-lg bg-gray-50">
            <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <h3 className="text-lg font-medium mb-1">No sync history</h3>
            <p className="text-gray-500">
              This integration hasn't been synced yet.
            </p>
          </div>
        ) : (
          // Table of runs
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(run.status)}
                        <span className="capitalize">{run.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(run.started_at || run.created_at)}</TableCell>
                    <TableCell>{formatDate(run.completed_at)}</TableCell>
                    <TableCell className="text-right">{run.products_processed}</TableCell>
                    <TableCell className="text-right">{run.products_updated}</TableCell>
                    <TableCell className="text-right">{run.products_created}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {runs.length > 0 && runs.some(run => run.error_message) && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Errors</h4>
            <div className="space-y-2">
              {runs
                .filter(run => run.error_message)
                .map(run => (
                  <div key={`${run.id}-error`} className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    <div className="font-medium mb-1">Error on {formatDate(run.completed_at || run.created_at)}</div>
                    <div>{run.error_message}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
