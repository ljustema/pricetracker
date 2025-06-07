'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Edit, Trash2, RefreshCw, History, FlaskConical, Upload, Store } from 'lucide-react';
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
  runId: _runId
}: IntegrationCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [_isTestRunning, _setIsTestRunning] = useState(false);
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
        return { type: 'image', src: '/icons/prestashop-logo.png' };
      case 'shopify':
        return { type: 'image', src: '/icons/shopify-logo.png' };
      case 'woocommerce':
        return { type: 'image', src: '/icons/woocommerce-logo.png' };
      case 'manual':
        return { type: 'icon', component: <Upload className="w-6 h-6 text-blue-600" /> };
      default:
        return { type: 'icon', component: <Store className="w-6 h-6 text-gray-600" /> };
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
            {(() => {
              const platformIcon = getPlatformIcon();
              if (platformIcon.type === 'image') {
                return (
                  <Image
                    src={platformIcon.src}
                    alt={integration.platform}
                    className="w-6 h-6"
                    width={24}
                    height={24}
                    onError={(e) => {
                      // Fallback to Store icon if image fails to load
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '';
                        const storeIcon = document.createElement('div');
                        storeIcon.innerHTML = '<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';
                        parent.appendChild(storeIcon);
                      }
                    }}
                  />
                );
              } else {
                return platformIcon.component;
              }
            })()}
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
          {integration.platform !== 'manual' && (
            <div className="flex justify-between">
              <span className="text-gray-500">API URL:</span>
              <span className="font-mono text-xs truncate max-w-[200px]">{integration.api_url}</span>
            </div>
          )}
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
            <span className="text-gray-500">
              {integration.platform === 'manual' ? 'Type:' : 'Frequency:'}
            </span>
            <span className="capitalize">
              {integration.platform === 'manual' ? 'Manual CSV Upload' : integration.sync_frequency}
            </span>
          </div>
          {integration.platform !== 'manual' && (
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
          )}
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

          {onTestRun && integration.platform !== 'manual' && (
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
            {integration.platform === 'manual' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/app-routes/products')}
                className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200"
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload CSV
              </Button>
            ) : (
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
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
