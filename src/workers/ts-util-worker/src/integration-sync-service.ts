import { updateIntegrationStatus } from './integration-service';

interface SyncResult {
  success: boolean;
  productsProcessed: number;
  productsUpdated: number;
  productsCreated: number;
  errorMessage?: string;
  logDetails?: Record<string, unknown>[];
}

interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder;
  insert: (data: unknown) => SupabaseQueryBuilder;
  update: (data: Record<string, unknown>) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  single: () => Promise<{ data: unknown; error: unknown }>;
  then: (callback: (result: { data: unknown; error: unknown }) => void) => Promise<void>;
  catch: (callback: (error: unknown) => void) => Promise<void>;
}

interface SupabaseClient {
  from: (table: string) => SupabaseQueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

interface Integration {
  id: string;
  platform: string;
  api_url: string;
  api_key: string;
  configuration?: {
    activeOnly?: boolean;
  };
}

export class IntegrationSyncService {
  private userId: string;
  private integrationId: string;
  private runId: string;
  private supabase: SupabaseClient;
  private logs: Record<string, unknown>[] = [];

  constructor(userId: string, integrationId: string, runId: string, supabase: SupabaseClient) {
    this.userId = userId;
    this.integrationId = integrationId;
    this.runId = runId;
    this.supabase = supabase;
  }

  /**
   * Log a message during the sync process
   */
  private log(level: string, phase: string, message: string, data?: unknown): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      phase,
      message,
      data: data || null,
    };

    console.log(`[${level.toUpperCase()}] [${phase}] ${message}`, data || '');
    this.logs.push(logEntry);

    // Update the run log in the database
    this.supabase
      .from('integration_runs')
      .update({
        log_details: this.logs,
      })
      .eq('id', this.runId)
      .then(() => {})
      .catch((error: unknown) => {
        console.error('Error updating run logs:', error);
      });
  }

  /**
   * Update the status of the integration run
   */
  private async updateRunStatus(
    status: 'processing' | 'completed' | 'failed',
    stats?: {
      productsProcessed?: number;
      productsUpdated?: number;
      productsCreated?: number;
    },
    errorMessage?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'processing') {
      updateData.started_at = new Date().toISOString();
      // Initialize last_progress_update when starting processing
      updateData.last_progress_update = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (stats) {
      if (stats.productsProcessed !== undefined) {
        updateData.products_processed = stats.productsProcessed;
        // Update progress timestamp when products_processed changes during processing
        if (status === 'processing') {
          updateData.last_progress_update = new Date().toISOString();
        }
      }
      if (stats.productsUpdated !== undefined) {
        updateData.products_updated = stats.productsUpdated;
      }
      if (stats.productsCreated !== undefined) {
        updateData.products_created = stats.productsCreated;
      }
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('integration_runs')
      .update(updateData)
      .eq('id', this.runId);

    if (error) {
      console.error('Error updating run status:', error);
      const errorMessage = error && typeof error === 'object' && 'message' in error ? (error as any).message : 'Unknown error';
      throw new Error(`Failed to update run status: ${errorMessage}`);
    }
  }

  /**
   * Execute the sync process for a Prestashop integration using the staged approach
   */
  private async syncPrestashop(integration: Integration): Promise<SyncResult> {
    let productsProcessed = 0;
    let productsUpdated = 0;
    let productsCreated = 0;

    // Import the PrestashopClient dynamically
    const { PrestashopClient } = await import('./prestashop-client');

    // Initialize the Prestashop client
    const client = new PrestashopClient(integration.api_url, integration.api_key);

    // Test the connection
    this.log('info', 'API_CONNECTION', 'Testing API connection');
    const connectionTest = await client.testConnection();
    if (!connectionTest) {
      throw new Error('Failed to connect to Prestashop API');
    }
    this.log('info', 'API_CONNECTION', 'API connection successful');

    // Fetch and process products from Prestashop in batches
    this.log('info', 'FETCH_PRODUCTS', 'Fetching and processing products from Prestashop in batches');

    // Check if we should only import active products
    const activeOnly = integration.configuration?.activeOnly !== false; // Default to true if not specified
    this.log('info', 'FETCH_CONFIG', `Only importing active products: ${activeOnly}`);

    // Define batch size for processing
    const batchSize = 100;
    let totalProductsProcessed = 0;
    let batchNumber = 0;
    let totalBatches = 0; // This will be updated when we know the total count

    // Use the fetchProductsInBatches method instead of fetchProducts
    await client.fetchProductsInBatches({
      batchSize,
      onBatchReceived: async (productBatch, currentPage, totalPages) => {
        // Update total batches estimate if this is the first batch
        if (batchNumber === 0 && totalPages > 0) {
          // Rough estimate of total batches based on pages and average batch size
          totalBatches = totalPages;
          this.log('info', 'FETCH_ESTIMATE', `Estimated total batches: ~${totalBatches} (based on ${totalPages} pages)`);
        }

        batchNumber++;
        this.log('info', 'BATCH_RECEIVED', `Received batch ${batchNumber} with ${productBatch.length} products (page ${currentPage}/${totalPages})`);

        // Process this batch immediately
        await this.processProductBatch(productBatch, batchNumber, totalBatches || '?');

        totalProductsProcessed += productBatch.length;

        // Update the run status with progress
        await this.updateRunStatus('processing', { productsProcessed: totalProductsProcessed });
      },
      onProgress: (current, total) => {
        this.log('info', 'FETCH_PROGRESS', `Fetching page ${current} of ${total}`);
      },
      activeOnly: activeOnly,
    });

    this.log('info', 'FETCH_COMPLETE', `Fetched and processed ${totalProductsProcessed} products in ${batchNumber} batches`);

    // Make sure all products are processed by calling the process function one final time
    this.log('info', 'FINAL_PROCESSING', 'Ensuring all products are processed');

    // Check if the temp_integrations_scraped_data table has any records for this run
    const { data: stagedCount, error: countError } = await this.supabase
      .from('temp_integrations_scraped_data')
      .select('id')
      .eq('integration_run_id', this.runId);

    if (countError) {
      const errorMessage = countError && typeof countError === 'object' && 'message' in countError ? (countError as any).message : 'Unknown error';
      this.log('error', 'DB_COUNT_ERROR', `Error counting staged products: ${errorMessage}`);
    } else {
      const countArray = stagedCount as any[];
      this.log('info', 'DB_COUNT', `Staged ${countArray?.length || 0} products for run ${this.runId}`);

      // Set the processed count to the number of staged products
      productsProcessed = countArray?.length || 0;
    }

    // Call the process_pending_integration_products function one final time to ensure all products are processed
    try {
      this.log('info', 'FINAL_PROCESSING_TRIGGER', 'Triggering final processing for all pending products');

      const { data: finalProcessResult, error: finalProcessError } = await this.supabase
        .rpc('process_pending_integration_products', { run_id: this.runId });

      if (finalProcessError) {
        const errorMessage = finalProcessError && typeof finalProcessError === 'object' && 'message' in finalProcessError ? (finalProcessError as any).message : 'Unknown error';
        this.log('error', 'FINAL_PROCESSING_ERROR', `Error in final processing: ${errorMessage}`);
      } else {
        this.log('info', 'FINAL_PROCESSING_COMPLETE', `Final processing complete: ${JSON.stringify(finalProcessResult)}`);
      }
    } catch (error) {
      this.log('error', 'FINAL_PROCESSING_EXCEPTION', `Exception in final processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Wait a moment for any remaining processing to complete
    this.log('info', 'DB_PROCESSING_WAIT', 'Waiting for processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    // Get statistics on processed products
    try {
      const { data: stats, error: statsError } = await this.supabase
        .from('temp_integrations_scraped_data')
        .select('status')
        .eq('integration_run_id', this.runId);

      if (statsError) {
        const errorMessage = statsError && typeof statsError === 'object' && 'message' in statsError ? (statsError as any).message : 'Unknown error';
        this.log('error', 'DB_STATS_ERROR', `Error getting product statistics: ${errorMessage}`);
      } else if (stats) {
        // Count products by status
        const statsArray = stats as any[];
        const processed = statsArray.filter((p: { status: string }) => p.status === 'processed').length;
        const errors = statsArray.filter((p: { status: string }) => p.status === 'error').length;
        const pending = statsArray.filter((p: { status: string }) => p.status === 'pending').length;

        // Estimate created vs updated (we don't have this info directly)
        // For now, assume all processed products are created
        productsCreated = processed;
        productsUpdated = 0;

        this.log('info', 'DB_PROCESSING_COMPLETE',
          `Processing status: Processed: ${processed}, Created: ${productsCreated}, ` +
          `Updated: ${productsUpdated}, Errors: ${errors}, Pending: ${pending}`);
      }
    } catch (error) {
      this.log('error', 'DB_STATS_ERROR', `Exception getting product statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Full error details:', error);
    }

    return {
      success: true,
      productsProcessed,
      productsUpdated,
      productsCreated,
      logDetails: this.logs,
    };
  }

  /**
   * Process a batch of products
   */
  private async processProductBatch(batch: Record<string, unknown>[], batchNumber: number, totalBatches: number | string): Promise<void> {
    this.log('info', 'BATCH_PROCESSING', `Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

    // Prepare the batch for insertion
    const stagedProducts = batch.map(product => {
      // Log the first product in detail to debug
      if (batch.indexOf(product) === 0) {
        console.log('First product raw data:', JSON.stringify(product, null, 2));
      }

      // Make sure we handle empty strings properly
      const sku = product.reference && product.reference !== '' ? product.reference : null;
      const ean = product.ean13 && product.ean13 !== '' ? product.ean13 : null;
      const brand = product.manufacturer_name && product.manufacturer_name !== '' ? product.manufacturer_name : null;
      const imageUrl = product.image_url && product.image_url !== '' ? product.image_url : null;
      const productUrl = product.product_url && product.product_url !== '' ? product.product_url : null;
      const currencyCode = product.currency_code || 'SEK'; // Default to SEK if not provided

      return {
        integration_run_id: this.runId,
        integration_id: this.integrationId,
        user_id: this.userId,
        prestashop_product_id: product.id,
        name: product.name,
        sku: sku,
        ean: ean,
        brand: brand,
        our_retail_price: product.price,
        our_wholesale_price: product.wholesale_price || null,
        image_url: imageUrl,
        url: productUrl, // Add the product URL to the staged product
        currency_code: currencyCode, // Add the currency code
        raw_data: product, // Store the raw product data for reference
        status: 'pending',
        created_at: new Date().toISOString()
      };
    });

    // Insert the batch into the temp_integrations_scraped_data table
    console.log(`Inserting ${stagedProducts.length} products into temp_integrations_scraped_data table`);
    console.log('First product in batch:', JSON.stringify(stagedProducts[0], null, 2));

    const { data: insertData, error: insertError } = await this.supabase
      .from('temp_integrations_scraped_data')
      .insert(stagedProducts)
      .select();

    console.log(`Insert response: ${insertError ? 'ERROR' : 'SUCCESS'}`);
    if (insertData) {
      const insertArray = insertData as any[];
      console.log(`Inserted ${insertArray.length} rows`);
    }

    if (insertError) {
      const errorMessage = insertError && typeof insertError === 'object' && 'message' in insertError ? (insertError as any).message : 'Unknown error';
      this.log('error', 'STAGING_ERROR', `Error staging batch ${batchNumber}: ${errorMessage}`);
      throw new Error(`Failed to stage products: ${errorMessage}`);
    }

    this.log('info', 'BATCH_STAGED', `Staged batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

    // Process this batch immediately by calling the database function
    try {
      this.log('info', 'BATCH_PROCESSING_TRIGGER', `Triggering processing for batch ${batchNumber}/${totalBatches}`);

      // Call the process_pending_integration_products function to process this batch
      const { data: processResult, error: processError } = await this.supabase
        .rpc('process_pending_integration_products', { run_id: this.runId });

      if (processError) {
        const errorMessage = processError && typeof processError === 'object' && 'message' in processError ? (processError as any).message : 'Unknown error';
        this.log('error', 'BATCH_PROCESSING_ERROR', `Error processing batch ${batchNumber}: ${errorMessage}`);
      } else {
        this.log('info', 'BATCH_PROCESSED', `Processed batch ${batchNumber}/${totalBatches}: ${JSON.stringify(processResult)}`);
      }
    } catch (error) {
      this.log('error', 'BATCH_PROCESSING_EXCEPTION', `Exception processing batch ${batchNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute the sync process based on the integration platform
   */
  async executeSync(): Promise<SyncResult> {
    try {
      // Update run status to processing
      await this.updateRunStatus('processing');
      this.log('info', 'SYNC_START', 'Starting integration sync using staged approach');

      // Fetch the integration details
      const { data: integration, error: integrationError } = await this.supabase
        .from('integrations')
        .select('*')
        .eq('id', this.integrationId)
        .eq('user_id', this.userId)
        .single();

      if (integrationError || !integration) {
        const errorMessage = integrationError && typeof integrationError === 'object' && 'message' in integrationError ? (integrationError as any).message : 'Integration not found';
        throw new Error(`Failed to fetch integration: ${errorMessage}`);
      }

      // Type assertion for the integration data
      const typedIntegration = integration as Integration;

      // Execute the appropriate sync method based on the platform
      let result: SyncResult;

      switch (typedIntegration.platform.toLowerCase()) {
        case 'prestashop':
          result = await this.syncPrestashop(typedIntegration);
          break;

        default:
          throw new Error(`Unsupported platform: ${typedIntegration.platform}`);
      }

      // Update run status to completed
      await this.updateRunStatus('completed', {
        productsProcessed: result.productsProcessed,
        productsUpdated: result.productsUpdated,
        productsCreated: result.productsCreated,
      });

      // Update integration status
      await updateIntegrationStatus(
        this.supabase as any,
        this.integrationId,
        'active',
        'success'
      );

      this.log('info', 'SYNC_COMPLETE', `Sync completed. Processed: ${result.productsProcessed}, Updated: ${result.productsUpdated}, Created: ${result.productsCreated}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during sync';
      this.log('error', 'SYNC_ERROR', `Sync failed: ${errorMessage}`);

      // Update run status to failed
      await this.updateRunStatus('failed', {}, errorMessage);

      // Update integration status
      await updateIntegrationStatus(
        this.supabase as any,
        this.integrationId,
        'error',
        'failed'
      );

      return {
        success: false,
        productsProcessed: 0,
        productsUpdated: 0,
        productsCreated: 0,
        errorMessage,
        logDetails: this.logs,
      };
    }
  }
}
