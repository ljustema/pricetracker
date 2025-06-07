'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { IntegrationRunsDialog } from '@/components/integrations/IntegrationRunsDialog';
import { IntegrationForm } from '@/components/integrations/IntegrationForm';
import { TestRunDialog } from '@/components/integrations/TestRunDialog';
import { Integration, CreateIntegrationData, UpdateIntegrationData } from '@/lib/services/integration-service';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [testRunDialogOpen, setTestRunDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRuns, setActiveRuns] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const _router = useRouter(); // Kept for potential future navigation needs

  // Fetch integrations from the API
  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/integrations');

      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      setIntegrations(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch integrations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Function to check for active runs
  const checkActiveRuns = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/active-runs');
      if (!response.ok) {
        console.error('Failed to fetch active integration runs');
        return;
      }
      const data = await response.json();

      // Create a map of integration IDs to run IDs
      const activeRunsMap: {[key: string]: string} = {};
      if (data && data.runs) {
        data.runs.forEach((run: { integration_id: string; id: string }) => {
          activeRunsMap[run.integration_id] = run.id;
        });
      }

      setActiveRuns(activeRunsMap);
    } catch (error) {
      console.error('Error checking active runs:', error);
    }
  }, []);

  // Fetch integrations and active runs on component mount
  useEffect(() => {
    fetchIntegrations();
    checkActiveRuns();

    // Set up polling for active runs every 30 seconds
    const interval = setInterval(checkActiveRuns, 30000);
    return () => clearInterval(interval);
  }, [fetchIntegrations, checkActiveRuns]);


  // Refresh integrations and active runs
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchIntegrations(), checkActiveRuns()]);
    setRefreshing(false);
  };

  // Handle form submission (create/update)
  const handleFormSubmit = async (values: CreateIntegrationData | UpdateIntegrationData) => {
    if (editingIntegration) {
      // Update existing integration
      const response = await fetch(`/api/integrations/${editingIntegration.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update integration');
      }

      // Refresh the integrations list
      await fetchIntegrations();
    } else {
      // Create new integration
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create integration');
      }

      // Refresh the integrations list
      await fetchIntegrations();
    }
  };

  // Handle edit button click
  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormOpen(true);
  };

  // Handle view history button click
  const handleViewHistory = (integration: Integration) => {
    setSelectedIntegration(integration);
    setHistoryDialogOpen(true);
  };

  // Handle test run button click
  const handleTestRun = (integration: Integration) => {
    setSelectedIntegration(integration);
    setTestRunDialogOpen(true);
  };

  // Handle delete button click
  const handleDelete = (integration: Integration) => {
    setIntegrationToDelete(integration);
    setDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (!integrationToDelete) return;

    try {
      const response = await fetch(`/api/integrations/${integrationToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete integration');
      }

      toast({
        title: 'Integration deleted',
        description: `${integrationToDelete.name} has been deleted successfully.`,
      });

      // Refresh the integrations list
      await fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete integration',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setIntegrationToDelete(null);
    }
  };

  // Handle sync button click
  const handleSync = async (integration: Integration) => {
    try {
      const response = await fetch(`/api/integrations/${integration.id}/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();

        // Special handling for the test run required error
        if (error.error === 'Test run required') {
          toast({
            title: 'Test Run Required',
            description: 'You need to run and approve a test before proceeding with a full sync.',
            variant: 'destructive',
          });

          // Automatically open the test run dialog
          setSelectedIntegration(integration);
          setTestRunDialogOpen(true);
          return;
        }

        throw new Error(error.error || 'Failed to start sync');
      }

      const result = await response.json();

      toast({
        title: 'Sync started',
        description: `Sync job for ${integration.name} has been queued.`,
      });

      // Refresh the integrations list after a short delay
      setTimeout(() => fetchIntegrations(), 1000);

      return result;
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync job',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Open the form for creating a new integration
  const handleAddNew = () => {
    setEditingIntegration(undefined);
    setFormOpen(true);
  };

  // Close the form and reset editing state
  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingIntegration(undefined);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add Integration
          </Button>
        </div>
      </div>

      {loading ? (
        // Loading skeleton
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex justify-between pt-2">
                <div className="space-x-2">
                  <Skeleton className="h-8 w-16 inline-block" />
                  <Skeleton className="h-8 w-16 inline-block" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        // Empty state
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-2">No integrations found</h3>
          <p className="text-gray-500 mb-4">
            Connect your e-commerce platform to automatically sync product data.
          </p>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add Your First Integration
          </Button>
        </div>
      ) : (
        // List of integrations
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSync={handleSync}
              onViewHistory={handleViewHistory}
              onTestRun={handleTestRun}
              isRunning={!!activeRuns[integration.id]}
              runId={activeRuns[integration.id]}
            />
          ))}
        </div>
      )}

      {/* Integration Form Dialog */}
      <IntegrationForm
        open={formOpen}
        onOpenChange={handleFormClose}
        integration={editingIntegration}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the integration
              {integrationToDelete && <strong> &quot;{integrationToDelete.name}&quot;</strong>}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Integration Runs Dialog */}
      <IntegrationRunsDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        integration={selectedIntegration}
      />

      {/* Test Run Dialog */}
      <TestRunDialog
        open={testRunDialogOpen}
        onOpenChange={setTestRunDialogOpen}
        integration={selectedIntegration}
        onStartFullSync={handleSync}
      />
    </div>
  );
}
