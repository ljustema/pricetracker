'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Edit, Trash2, RefreshCw, History, FlaskConical } from 'lucide-react';
import { Integration } from '@/lib/services/integration-service';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface IntegrationCardProps {
  integration: Integration;
  onEdit: (integration: Integration) => void;
  onDelete: (integration: Integration) => void;
  onSync: (integration: Integration) => void;
  onViewHistory?: (integration: Integration) => void;
  onTestRun?: (integration: Integration) => void;
  isRunning?: boolean;
  runId?: string;
}

export function IntegrationCard({
  integration,
  onEdit,
  onDelete,
  onSync,
  onViewHistory,
  onTestRun,
  isRunning = false,
  runId
}: IntegrationCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Format the last sync time
  const lastSyncFormatted = integration.last_sync_at
    ? new Date(integration.last_sync_at).toLocaleString()
    : 'Never';

  // Get the status badge color and icon
  const getStatusBadge = () => {
    // If the integration is currently running, show that first
    if (isRunning) {
      return {
        color: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
        icon: <RefreshCw className="h-4 w-4 mr-1 animate-spin" />,
        text: 'Running',
      };
    }

    // Otherwise show the regular status
    switch (integration.status) {
      case 'active':
        return {
          color: 'bg-green-100 text-green-800 hover:bg-green-200',
          icon: <CheckCircle className="h-4 w-4 mr-1" />,
          text: 'Active',
        };
      case 'inactive':
        return {
          color: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
          icon: <Clock className="h-4 w-4 mr-1" />,
          text: 'Inactive',
        };
      case 'error':
        return {
          color: 'bg-red-100 text-red-800 hover:bg-red-200',
          icon: <AlertCircle className="h-4 w-4 mr-1" />,
          text: 'Error',
        };
      case 'pending_test_run':
        return {
          color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
          icon: <FlaskConical className="h-4 w-4 mr-1" />,
          text: 'Pending Test Run',
        };
      case 'pending_setup':
      default:
        return {
          color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
          icon: <Clock className="h-4 w-4 mr-1" />,
          text: 'Pending Test Run',
        };
    }
  };

  // Get the platform logo/icon
  const getPlatformIcon = () => {
    switch (integration.platform.toLowerCase()) {
      case 'prestashop':
        return '/icons/prestashop-logo.png'; // Add this image to your public folder
      case 'shopify':
        return '/icons/shopify-logo.png';
      case 'woocommerce':
        return '/icons/woocommerce-logo.png';
      default:
        return '/icons/store-icon.png';
    }
  };

  // Handle sync button click
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSync(integration);
      toast({
        title: 'Sync started',
        description: `Sync job for ${integration.name} has been queued.`,
      });
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync job',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle test run button click
  const handleTestRun = () => {
    if (!onTestRun) return;
    onTestRun(integration);
  };

  const statusBadge = getStatusBadge();

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center">
          <div className="w-10 h-10 mr-3 flex items-center justify-center bg-gray-100 rounded-md">
            <img
              src={getPlatformIcon()}
              alt={integration.platform}
              className="w-6 h-6"
              onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLImageElement).src = '/icons/store-icon.png';
              }}
            />
          </div>
          <div>
            <CardTitle className="text-xl">{integration.name}</CardTitle>
            <CardDescription>{integration.platform}</CardDescription>
          </div>
        </div>
        <Badge className={`flex items-center ${statusBadge.color}`}>
          {statusBadge.icon}
          {statusBadge.text}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">API URL:</span>
            <span className="font-mono text-xs truncate max-w-[200px]">{integration.api_url}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Last Sync:</span>
            <span>{lastSyncFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sync Status:</span>
            <span>
              {isRunning ? (
                <span className="flex items-center text-blue-600">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Running
                </span>
              ) : (
                integration.last_sync_status || 'N/A'
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Frequency:</span>
            <span className="capitalize">{integration.sync_frequency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Active Products Only:</span>
            <span>
              {integration.configuration?.activeOnly !== false ? (
                <span className="text-green-600">Yes</span>
              ) : (
                <span className="text-gray-600">No</span>
              )}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <div className="flex flex-wrap gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(integration)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewHistory && onViewHistory(integration)}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => onDelete(integration)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>

          {onTestRun && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestRun}
              disabled={isRunning}
              title={isRunning ? 'Integration is currently running' : ''}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200 ml-auto"
            >
              <FlaskConical className="h-4 w-4 mr-1" />
              Test Run
            </Button>
          )}

          <div className="flex flex-col items-end ml-auto">
            <Button
              variant="default"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || isRunning || integration.status === 'pending_setup' || integration.status === 'pending_test_run'}
              title={
                isRunning
                  ? 'Integration is currently running'
                  : (!integration.last_sync_at || integration.status === 'pending_setup' || integration.status === 'pending_test_run')
                    ? 'Run a test first'
                    : ''
              }
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Running...
                </>
              ) : integration.status === 'pending_setup' || integration.status === 'pending_test_run' ? (
                <>
                  <FlaskConical className="h-4 w-4 mr-1" />
                  Test Required
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
