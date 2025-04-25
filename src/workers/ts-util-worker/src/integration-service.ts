import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from './utils';

// This is a simplified version of the integration service for the worker
// It only includes the functions needed for the worker

export async function updateIntegrationStatus(
  supabase: any,
  integrationId: string,
  status: 'active' | 'inactive' | 'error',
  lastSyncStatus: 'success' | 'failed' | null = null
): Promise<void> {
  const dataToUpdate: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (lastSyncStatus) {
    dataToUpdate.last_sync_status = lastSyncStatus;
    dataToUpdate.last_sync_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('integrations')
    .update(dataToUpdate)
    .eq('id', integrationId);

  if (error) {
    console.error('Error updating integration status:', error);
    throw new Error(`Failed to update integration status: ${error.message}`);
  }
}
