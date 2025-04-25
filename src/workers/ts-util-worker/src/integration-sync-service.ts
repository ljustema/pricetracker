import { updateIntegrationStatus } from './integration-service';

interface SyncResult {
  success: boolean;
  productsProcessed: number;
  productsUpdated: number;
  productsCreated: number;
  errorMessage?: string;
  logDetails?: Record<string, any>[];
}

export class IntegrationSyncService {
  private userId: string;
  private integrationId: string;
  private runId: string;
  private supabase: any;
  private logs: Record<string, any>[] = [];

  constructor(userId: string, integrationId: string, runId: string, supabase: any) {
    this.userId = userId;
    this.integrationId = integrationId;
    this.runId = runId;
    this.supabase = supabase;
  }

  /**
   * Log a message during the sync process
   */
  private log(level: string, phase: string, message: string, data?: any): void {
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
      .catch((error: any) => {
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
    const updateData: Record<string, any> = { status };

    if (status === 'processing') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (stats) {
      if (stats.productsProcessed !== undefined) {
        updateData.products_processed = stats.productsProcessed;
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
      throw new Error(`Failed to update run status: ${error.message}`);
    }
  }

  /**
   * Execute the sync process for a Prestashop integration using the staged approach
   */
  private async syncPrestashop(integration: any): Promise<SyncResult> {
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

    // Fetch products from Prestashop
    this.log('info', 'FETCH_PRODUCTS', 'Fetching products from Prestashop');

    // Check if we should only import active products
    const activeOnly = integration.configuration?.activeOnly !== false; // Default to true if not specified
    this.log('info', 'FETCH_CONFIG', `Only importing active products: ${activeOnly}`);

    const products = await client.fetchProducts({
      onProgress: (current, total) => {
        this.log('info', 'FETCH_PROGRESS', `Fetching page ${current} of ${total}`);
      },
      activeOnly: activeOnly, // Pass the activeOnly parameter to the client
    });

    this.log('info', 'FETCH_COMPLETE', `Fetched ${products.length} products from Prestashop`);

    // Stage the products in the staged_integration_products table
    this.log('info', 'STAGING', 'Staging products for processing');

    // Process products in batches to avoid large inserts
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < products.length; i += batchSize) {
      batches.push(products.slice(i, i + batchSize));
    }

    this.log('info', 'BATCHING', `Created ${batches.length} batches of products for staging`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.log('info', 'BATCH_PROCESSING', `Processing batch ${i + 1}/${batches.length} (${batch.length} products)`);

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

        return {
          integration_run_id: this.runId,
          integration_id: this.integrationId,
          user_id: this.userId,
          prestashop_product_id: product.id,
          name: product.name,
          sku: sku,
          ean: ean,
          brand: brand,
          price: product.price,
          wholesale_price: product.wholesale_price || null,
          image_url: imageUrl,
          raw_data: product, // Store the raw product data for reference
          status: 'pending',
          created_at: new Date().toISOString()
        };
      });

      // Insert the batch into the staged_integration_products table
      console.log(`Inserting ${stagedProducts.length} products into staged_integration_products table`);
      console.log('First product in batch:', JSON.stringify(stagedProducts[0], null, 2));

      const { data: insertData, error: insertError } = await this.supabase
        .from('staged_integration_products')
        .insert(stagedProducts)
        .select();

      console.log(`Insert response: ${insertError ? 'ERROR' : 'SUCCESS'}`);
      if (insertData) {
        console.log(`Inserted ${insertData.length} rows`);
      }

      if (insertError) {
        this.log('error', 'STAGING_ERROR', `Error staging batch ${i + 1}: ${insertError.message}`);
        throw new Error(`Failed to stage products: ${insertError.message}`);
      }

      productsProcessed += batch.length;
      this.log('info', 'BATCH_STAGED', `Staged batch ${i + 1}/${batches.length} (${batch.length} products)`);

      // Update the run status with progress
      await this.updateRunStatus('processing', { productsProcessed });
    }

    // With the trigger-based approach, we don't need to call a function to process the products
    // The database trigger will automatically process each product as it's inserted
    this.log('info', 'DB_PROCESSING', 'Products will be processed automatically by database triggers');

    // Check if the staged_integration_products table has any records for this run
    const { data: stagedCount, error: countError } = await this.supabase
      .from('staged_integration_products')
      .select('id', { count: 'exact' })
      .eq('integration_run_id', this.runId);

    if (countError) {
      this.log('error', 'DB_COUNT_ERROR', `Error counting staged products: ${countError.message}`);
    } else {
      this.log('info', 'DB_COUNT', `Staged ${stagedCount?.length || 0} products for run ${this.runId}`);

      // Set the processed count to the number of staged products
      productsProcessed = stagedCount?.length || 0;
    }

    // Wait a moment for triggers to process
    this.log('info', 'DB_PROCESSING_WAIT', 'Waiting for database triggers to process products...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    // Get statistics on processed products
    try {
      const { data: stats, error: statsError } = await this.supabase
        .from('staged_integration_products')
        .select('status')
        .eq('integration_run_id', this.runId);

      if (statsError) {
        this.log('error', 'DB_STATS_ERROR', `Error getting product statistics: ${statsError.message}`);
      } else if (stats) {
        // Count products by status
        const processed = stats.filter((p: { status: string }) => p.status === 'processed').length;
        const errors = stats.filter((p: { status: string }) => p.status === 'error').length;
        const pending = stats.filter((p: { status: string }) => p.status === 'pending').length;

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

      if (integrationError) {
        throw new Error(`Failed to fetch integration: ${integrationError.message}`);
      }

      // Execute the appropriate sync method based on the platform
      let result: SyncResult;

      switch (integration.platform.toLowerCase()) {
        case 'prestashop':
          result = await this.syncPrestashop(integration);
          break;

        default:
          throw new Error(`Unsupported platform: ${integration.platform}`);
      }

      // Update run status to completed
      await this.updateRunStatus('completed', {
        productsProcessed: result.productsProcessed,
        productsUpdated: result.productsUpdated,
        productsCreated: result.productsCreated,
      });

      // Update integration status
      await updateIntegrationStatus(
        this.supabase,
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
        this.supabase,
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
