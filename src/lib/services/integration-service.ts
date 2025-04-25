import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// Define configuration type for integrations
export interface IntegrationConfiguration {
  [key: string]: string | number | boolean | null;
}

// Define log details type
export interface LogDetails {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Integration {
  id: string;
  user_id: string;
  platform: string;
  name: string;
  api_url: string;
  api_key: string;
  status: 'pending_setup' | 'active' | 'inactive' | 'error';
  last_sync_at: string | null;
  last_sync_status: 'success' | 'failed' | null;
  sync_frequency: string;
  configuration: IntegrationConfiguration | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationRun {
  id: string;
  integration_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  products_processed: number;
  products_updated: number;
  products_created: number;
  error_message: string | null;
  log_details: LogDetails[] | null;
  created_at: string;
}

export interface CreateIntegrationData {
  platform: string;
  name: string;
  api_url: string;
  api_key: string;
  sync_frequency?: string;
  configuration?: IntegrationConfiguration;
}

export interface UpdateIntegrationData {
  name?: string;
  api_url?: string;
  api_key?: string;
  status?: 'pending_setup' | 'active' | 'inactive' | 'error';
  sync_frequency?: string;
  configuration?: IntegrationConfiguration;
}

/**
 * Get all integrations for a user
 */
export async function getIntegrations(userId: string): Promise<Integration[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', uuid)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching integrations:', error);
    throw new Error(`Failed to fetch integrations: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific integration by ID
 */
export async function getIntegration(userId: string, integrationId: string): Promise<Integration | null> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('user_id', uuid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching integration:', error);
    throw new Error(`Failed to fetch integration: ${error.message}`);
  }

  return data;
}

/**
 * Create a new integration
 */
export async function createIntegration(
  userId: string,
  integrationData: CreateIntegrationData
): Promise<Integration> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  // Validate the API credentials before creating the integration
  // This would typically involve making a test call to the platform's API
  // For now, we'll just create the integration with pending_setup status

  const dataToInsert = {
    user_id: uuid,
    platform: integrationData.platform,
    name: integrationData.name,
    api_url: integrationData.api_url,
    api_key: integrationData.api_key,
    status: 'pending_setup' as const,
    sync_frequency: integrationData.sync_frequency || 'daily',
    configuration: integrationData.configuration || null,
  };

  const { data, error } = await supabase
    .from('integrations')
    .insert(dataToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error creating integration:', error);
    throw new Error(`Failed to create integration: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing integration
 */
export async function updateIntegration(
  userId: string,
  integrationId: string,
  integrationData: UpdateIntegrationData
): Promise<Integration> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  // If API URL or key is being updated, we should validate the credentials
  // For now, we'll just update the integration

  const dataToUpdate: {
    updated_at: string;
    name?: string;
    api_url?: string;
    api_key?: string;
    status?: 'pending_setup' | 'active' | 'inactive' | 'error';
    sync_frequency?: string;
    configuration?: IntegrationConfiguration;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (integrationData.name !== undefined) {
    dataToUpdate.name = integrationData.name;
  }

  if (integrationData.api_url !== undefined) {
    dataToUpdate.api_url = integrationData.api_url;
  }

  if (integrationData.api_key !== undefined) {
    dataToUpdate.api_key = integrationData.api_key;
  }

  if (integrationData.status !== undefined) {
    dataToUpdate.status = integrationData.status;
  }

  if (integrationData.sync_frequency !== undefined) {
    dataToUpdate.sync_frequency = integrationData.sync_frequency;
  }

  if (integrationData.configuration !== undefined) {
    dataToUpdate.configuration = integrationData.configuration;
  }

  const { data, error } = await supabase
    .from('integrations')
    .update(dataToUpdate)
    .eq('id', integrationId)
    .eq('user_id', uuid)
    .select()
    .single();

  if (error) {
    console.error('Error updating integration:', error);
    throw new Error(`Failed to update integration: ${error.message}`);
  }

  return data;
}

/**
 * Delete an integration
 */
export async function deleteIntegration(userId: string, integrationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', integrationId)
    .eq('user_id', uuid);

  if (error) {
    console.error('Error deleting integration:', error);
    throw new Error(`Failed to delete integration: ${error.message}`);
  }
}

/**
 * Test an integration's API credentials
 */
export async function testIntegrationCredentials(
  platform: string,
  apiUrl: string,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  // This would typically involve making a test call to the platform's API
  // For now, we'll just return success

  try {
    // In a real implementation, we would call the appropriate platform client
    // For example: await prestashopClient.testConnection(apiUrl, apiKey);

    return { success: true, message: 'Connection successful' };
  } catch (error) {
    console.error('Error testing integration credentials:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to the API'
    };
  }
}

/**
 * Create a new integration run (sync job)
 */
export async function createIntegrationRun(
  userId: string,
  integrationId: string
): Promise<IntegrationRun> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  // First, check if the integration exists and belongs to the user
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', integrationId)
    .eq('user_id', uuid)
    .single();

  if (integrationError) {
    console.error('Error fetching integration for run:', integrationError);
    throw new Error(`Integration not found or access denied: ${integrationError.message}`);
  }

  // Create the integration run
  const { data, error } = await supabase
    .from('integration_runs')
    .insert({
      integration_id: integrationId,
      user_id: uuid,
      status: 'pending',
      products_processed: 0,
      products_updated: 0,
      products_created: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating integration run:', error);
    throw new Error(`Failed to create integration run: ${error.message}`);
  }

  return data;
}

/**
 * Get integration runs for a specific integration
 */
export async function getIntegrationRuns(
  userId: string,
  integrationId: string,
  limit: number = 10
): Promise<IntegrationRun[]> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  const { data, error } = await supabase
    .from('integration_runs')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('user_id', uuid)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching integration runs:', error);
    throw new Error(`Failed to fetch integration runs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific integration run by ID
 */
export async function getIntegrationRun(
  userId: string,
  runId: string
): Promise<IntegrationRun | null> {
  const supabase = createSupabaseAdminClient();
  const uuid = userId;

  const { data, error } = await supabase
    .from('integration_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', uuid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching integration run:', error);
    throw new Error(`Failed to fetch integration run: ${error.message}`);
  }

  return data;
}

/**
 * Update the status of an integration based on the latest run
 */
export async function updateIntegrationStatus(
  integrationId: string,
  status: 'active' | 'inactive' | 'error',
  lastSyncStatus: 'success' | 'failed' | null = null
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const dataToUpdate: {
    status: 'active' | 'inactive' | 'error';
    updated_at: string;
    last_sync_status?: 'success' | 'failed' | null;
    last_sync_at?: string;
  } = {
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
