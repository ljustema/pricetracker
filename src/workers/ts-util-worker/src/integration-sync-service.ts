import { updateIntegrationStatus } from './integration-service';
import { XMLParser } from 'fast-xml-parser';

interface SyncResult {
  success: boolean;
  productsProcessed: number;
  productsUpdated: number;
  productsCreated: number;
  errorMessage?: string;
  logDetails?: Record<string, unknown>[];
}

interface SupabaseError {
  message: string;
  [key: string]: unknown;
}



interface DatabaseResponse<T = unknown> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder;
  insert: (data: unknown) => SupabaseQueryBuilder;
  update: (data: Record<string, unknown>) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
  range: (from: number, to: number) => SupabaseQueryBuilder;
  single: () => Promise<DatabaseResponse>;
  then: (callback: (result: DatabaseResponse) => void) => Promise<void>;
  catch: (callback: (error: unknown) => void) => Promise<void>;
}

interface SupabaseClient {
  from: (table: string) => SupabaseQueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<DatabaseResponse>;
}

interface Integration {
  id: string;
  platform: string;
  api_url: string;
  api_key: string;
  configuration?: {
    activeOnly?: boolean;
    selectiveImport?: {
      enabled?: boolean;
      fields?: {
        name?: boolean;
        sku?: boolean;
        ean?: boolean;
        brand?: boolean;
        image_url?: boolean;
        currency_code?: boolean;
        url?: boolean;
        our_retail_price?: boolean;
        our_wholesale_price?: boolean;
        stock_status?: boolean;
        availability_date?: boolean;
        raw_data?: boolean;
      };
    };
  };
}

export class IntegrationSyncService {
  private userId: string;
  private integrationId: string;
  private runId: string;
  private supabase: SupabaseClient;
  private logs: Record<string, unknown>[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(userId: string, integrationId: string, runId: string, supabase: SupabaseClient) {
    this.userId = userId;
    this.integrationId = integrationId;
    this.runId = runId;
    this.supabase = supabase;
  }

  /**
   * Start a heartbeat to keep the progress timestamp updated
   */
  private startHeartbeat(): void {
    // Update progress every 30 seconds to prevent stall detection
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.supabase
          .from('integration_runs')
          .update({ last_progress_update: new Date().toISOString() })
          .eq('id', this.runId);
      } catch (error) {
        console.error('Heartbeat update failed:', error);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop the heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
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
   * Update the status of the integration run with retry logic
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
        // Always update progress timestamp when products_processed changes
        updateData.last_progress_update = new Date().toISOString();
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

    // Retry logic for database updates
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const { error } = await this.supabase
          .from('integration_runs')
          .update(updateData)
          .eq('id', this.runId);

        if (!error) {
          // Success, break out of retry loop
          break;
        }

        console.error(`Error updating run status (attempt ${retryCount + 1}):`, error);

        if (retryCount === maxRetries - 1) {
          // Last attempt failed, throw error
          const errorMessage = error && typeof error === 'object' && 'message' in error ? (error as { message: string }).message : 'Unknown error';
          throw new Error(`Failed to update run status after ${maxRetries} attempts: ${errorMessage}`);
        }

        retryCount++;
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));

      } catch (error) {
        if (retryCount === maxRetries - 1) {
          throw error;
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
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

    // Use the fetchProductsInBatches method with better error handling
    try {
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
          await this.processProductBatch(productBatch, batchNumber, totalBatches || '?', integration);

          totalProductsProcessed += productBatch.length;

          // Update the run status with progress more frequently to prevent stall detection
          try {
            await this.updateRunStatus('processing', { productsProcessed: totalProductsProcessed });
            this.log('info', 'PROGRESS_UPDATE', `Updated progress: ${totalProductsProcessed} products processed`);
          } catch (error) {
            // Log but don't fail the entire process if progress update fails
            this.log('error', 'PROGRESS_UPDATE_ERROR', `Failed to update progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
        onProgress: (current, total) => {
          this.log('info', 'FETCH_PROGRESS', `Fetching page ${current} of ${total}`);

          // Update progress timestamp during API fetching to prevent stall detection
          this.supabase
            .from('integration_runs')
            .update({ last_progress_update: new Date().toISOString() })
            .eq('id', this.runId)
            .then(() => {})
            .catch((error) => {
              console.error('Failed to update progress during API fetch:', error);
            });
        },
        activeOnly: activeOnly,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'FETCH_PRODUCTS_ERROR', `Error during product fetching: ${errorMessage}`);
      throw new Error(`Failed to fetch products from Prestashop: ${errorMessage}`);
    }

    this.log('info', 'FETCH_COMPLETE', `Fetched and processed ${totalProductsProcessed} products in ${batchNumber} batches`);

    // Make sure all products are processed by calling the process function one final time
    this.log('info', 'FINAL_PROCESSING', 'Ensuring all products are processed');

    // Check if the temp_integrations_scraped_data table has any records for this run
    const { data: stagedCount, error: countError } = await this.supabase
      .from('temp_integrations_scraped_data')
      .select('id')
      .eq('integration_run_id', this.runId);

    if (countError) {
      const errorMessage = countError && typeof countError === 'object' && 'message' in countError ? (countError as { message: string }).message : 'Unknown error';
      this.log('error', 'DB_COUNT_ERROR', `Error counting staged products: ${errorMessage}`);
    } else {
      const countArray = stagedCount as unknown[];
      this.log('info', 'DB_COUNT', `Staged ${countArray?.length || 0} products for run ${this.runId}`);

      // Set the processed count to the number of staged products
      productsProcessed = countArray?.length || 0;
    }

    // Products are now automatically processed via database triggers
    // No need for manual processing calls
    this.log('info', 'AUTO_PROCESSING', 'Products automatically processed via database triggers');

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
        const errorMessage = statsError && typeof statsError === 'object' && 'message' in statsError ? (statsError as { message: string }).message : 'Unknown error';
        this.log('error', 'DB_STATS_ERROR', `Error getting product statistics: ${errorMessage}`);
      } else if (stats) {
        // Count products by status
        const statsArray = stats as { status: string }[];
        const processed = statsArray.filter((p) => p.status === 'processed').length;
        const errors = statsArray.filter((p) => p.status === 'error').length;
        const pending = statsArray.filter((p) => p.status === 'pending').length;

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
   * Execute the sync process for a Google Feed XML integration
   */
  private async syncGoogleFeed(integration: Integration): Promise<SyncResult> {
    let productsProcessed = 0;
    let productsUpdated = 0;
    let productsCreated = 0;

    this.log('info', 'FEED_FETCH', `Fetching Google Feed XML from: ${integration.api_url}`);

    try {
      // Fetch the XML feed
      const response = await fetch(integration.api_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch XML feed: ${response.status} ${response.statusText}`);
      }

      const xmlContent = await response.text();
      this.log('info', 'FEED_PARSE', 'Parsing XML feed content');

      // Parse XML with fast-xml-parser
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '_',
        parseAttributeValue: true,
        processEntities: false,
        htmlEntities: false,
      });

      const parsedXml = parser.parse(xmlContent);

      // Extract items from the XML structure
      let items: Record<string, unknown>[] = [];

      if (parsedXml.rss?.channel?.item) {
        items = Array.isArray(parsedXml.rss.channel.item)
          ? parsedXml.rss.channel.item
          : [parsedXml.rss.channel.item];
      } else if (parsedXml.feed?.entry) {
        items = Array.isArray(parsedXml.feed.entry)
          ? parsedXml.feed.entry
          : [parsedXml.feed.entry];
      } else if (parsedXml.channel?.item) {
        items = Array.isArray(parsedXml.channel.item)
          ? parsedXml.channel.item
          : [parsedXml.channel.item];
      } else {
        throw new Error('No product items found in XML feed. Expected RSS/channel/item or feed/entry structure.');
      }

      this.log('info', 'FEED_ITEMS', `Found ${items.length} items in XML feed`);

      if (items.length === 0) {
        throw new Error('No product items found in XML feed');
      }

      // Process items in batches
      const batchSize = 500;
      const totalBatches = Math.ceil(items.length / batchSize);

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        this.log('info', 'BATCH_PROCESSING', `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

        await this.processGoogleFeedBatch(batch, batchNumber, totalBatches);

        productsProcessed += batch.length;

        // Update progress
        await this.updateRunStatus('processing', { productsProcessed });
      }

      // Wait for all staging to complete, then run conflict detection
      this.log('info', 'STAGING_COMPLETE', 'All products staged, waiting before conflict detection');

      // Wait a moment to ensure all database operations are complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get final statistics
      const { data: stats, error: statsError } = await this.supabase
        .from('temp_integrations_scraped_data')
        .select('status')
        .eq('integration_run_id', this.runId);

      if (!statsError && stats) {
        const statsArray = stats as { status: string }[];
        const processed = statsArray.filter((p) => p.status === 'processed').length;
        productsCreated = processed; // Assume all are new for now
        productsUpdated = 0;

        this.log('info', 'FINAL_STATS', `Final stats: Processed: ${processed}, Created: ${productsCreated}, Updated: ${productsUpdated}`);
      }

      return {
        success: true,
        productsProcessed,
        productsUpdated,
        productsCreated,
        logDetails: this.logs,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'GOOGLE_FEED_ERROR', `Google Feed sync failed: ${errorMessage}`);
      throw new Error(`Failed to sync Google Feed: ${errorMessage}`);
    }
  }

  /**
   * Process a batch of Google Feed XML items
   */
  private async processGoogleFeedBatch(batch: Record<string, unknown>[], batchNumber: number, totalBatches: number): Promise<void> {
    const stagedProducts = batch.map(item => {
      const extractedData = this.extractProductDataFromXmlItem(item);

      // Skip items without required data
      if (!extractedData.name || extractedData.name.trim() === '') {
        return null;
      }

      return {
        integration_run_id: this.runId,
        integration_id: this.integrationId,
        user_id: this.userId,
        name: extractedData.name.trim(),
        sku: extractedData.sku || null,
        ean: extractedData.ean || null,
        brand: extractedData.brand || null,
        our_retail_price: extractedData.our_retail_price,
        our_wholesale_price: extractedData.our_wholesale_price,
        image_url: extractedData.image_url || null,
        our_url: extractedData.our_url || null, // Updated field name to match database schema
        currency_code: extractedData.currency_code || null, // Let database set user's primary currency
        raw_data: item, // Store the entire XML item for reference
        status: 'pending',
        created_at: new Date().toISOString()
      };
    }).filter(product => product !== null); // Remove null entries

    if (stagedProducts.length === 0) {
      this.log('warn', 'BATCH_EMPTY', `Batch ${batchNumber} contained no valid products`);
      return;
    }

    // Insert the batch into the temp_integrations_scraped_data table
    const { error: insertError } = await this.supabase
      .from('temp_integrations_scraped_data')
      .insert(stagedProducts);

    if (insertError) {
      const errorMessage = insertError && typeof insertError === 'object' && 'message' in insertError ? (insertError as { message: string }).message : 'Unknown error';
      this.log('error', 'STAGING_ERROR', `Error staging batch ${batchNumber}: ${errorMessage}`);
      throw new Error(`Failed to stage products: ${errorMessage}`);
    }

    this.log('info', 'BATCH_STAGED', `Staged batch ${batchNumber}/${totalBatches} (${stagedProducts.length} products)`);
  }

  /**
   * Extract product data from XML item based on Google Feed format
   */
  private extractProductDataFromXmlItem(item: Record<string, unknown>) {
    // Helper function to get value from XML item, handling both direct values and CDATA
    const getValue = (obj: Record<string, unknown> | null, key: string): string | null => {
      if (!obj || typeof obj !== 'object') return null;

      const value = obj[key];
      if (value === undefined || value === null) return null;

      // Handle CDATA sections and direct values
      if (typeof value === 'string') {
        return value.trim();
      }

      // Handle objects with text content
      if (typeof value === 'object' && value && '#text' in value) {
        const textValue = (value as Record<string, unknown>)['#text'];
        return textValue ? textValue.toString().trim() : null;
      }

      return value.toString().trim();
    };

    // Helper function to parse price from string (e.g., "350 SEK" -> 350)
    const parsePrice = (priceStr: string | null): number | null => {
      if (!priceStr) return null;

      // Extract numeric value from price string
      const match = priceStr.match(/[\d,]+\.?\d*/);
      if (match) {
        const numericValue = match[0].replace(/,/g, '');
        const parsed = parseFloat(numericValue);
        return isNaN(parsed) ? null : parsed;
      }

      return null;
    };

    // Extract data according to the mapping specified in the user request
    const title = getValue(item, 'title');
    const link = getValue(item, 'link');
    const imageLink = getValue(item, 'g:image_link');
    const price = getValue(item, 'g:price');
    const salePrice = getValue(item, 'g:sale_price'); // Use sale price if available
    const costOfGoodsSold = getValue(item, 'g:cost_of_goods_sold');
    const gtin = getValue(item, 'g:gtin');
    const brand = getValue(item, 'g:brand');
    const mpn = getValue(item, 'g:mpn');

    // Determine which price to use (sale price takes priority)
    const finalPrice = salePrice || price;
    const retailPrice = parsePrice(finalPrice);
    const wholesalePrice = parsePrice(costOfGoodsSold);

    return {
      name: title,
      our_url: link, // Changed from 'url' to 'our_url' to match database schema
      image_url: imageLink,
      our_retail_price: retailPrice,
      our_wholesale_price: wholesalePrice,
      ean: gtin,
      brand: brand,
      sku: mpn,
      currency_code: null // Let database set user's primary currency, could be extracted from price string if needed
    };
  }

  /**
   * Process a batch of products
   */
  private async processProductBatch(batch: Record<string, unknown>[], batchNumber: number, totalBatches: number | string, integration: Integration): Promise<void> {
    this.log('info', 'BATCH_PROCESSING', `Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

    // Check if we should import raw data based on selective import settings
    const selectiveImportEnabled = integration.configuration?.selectiveImport?.enabled === true;
    const shouldImportRawData = !selectiveImportEnabled || integration.configuration?.selectiveImport?.fields?.raw_data !== false;

    // Prepare the batch for insertion
    const stagedProducts = batch.map(product => {
      // Log the first product in detail to debug
      if (batch.indexOf(product) === 0) {
        console.log('First product raw data:', JSON.stringify(product, null, 2));
        console.log(`Should import raw data: ${shouldImportRawData}`);
      }

      // Make sure we handle empty strings properly
      const sku = product.reference && product.reference !== '' ? product.reference : null;
      const ean = product.ean13 && product.ean13 !== '' ? product.ean13 : null;
      const brand = product.manufacturer_name && product.manufacturer_name !== '' ? product.manufacturer_name : null;
      const imageUrl = product.image_url && product.image_url !== '' ? product.image_url : null;
      const productUrl = product.product_url && product.product_url !== '' ? product.product_url : null;
      const currencyCode = product.currency_code || null; // Let database set user's primary currency

      // Determine what to store in raw_data based on configuration
      let rawDataToStore: Record<string, unknown>;

      if (shouldImportRawData) {
        // Store all extra features and attributes for custom field processing
        rawDataToStore = (product.features as Record<string, unknown>) || {};
      } else {
        // Store minimal data - only basic product information is imported
        rawDataToStore = {};
      }

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
        our_url: productUrl, // Updated field name to match database schema
        currency_code: currencyCode, // Add the currency code
        raw_data: rawDataToStore, // Store custom fields based on configuration
        status: 'pending',
        created_at: new Date().toISOString()
      };
    });

    // Insert the batch into the temp_integrations_scraped_data table with pending status
    console.log(`Inserting ${stagedProducts.length} products into temp_integrations_scraped_data table`);
    console.log('First product in batch:', JSON.stringify(stagedProducts[0], null, 2));

    // Set status to 'pending' for immediate processing
    const stagedProductsWithStatus = stagedProducts.map(product => ({
      ...product,
      status: 'pending'
    }));

    const { data: insertData, error: insertError } = await this.supabase
      .from('temp_integrations_scraped_data')
      .insert(stagedProductsWithStatus)
      .select();

    console.log(`Insert response: ${insertError ? 'ERROR' : 'SUCCESS'}`);
    if (insertData) {
      const insertArray = insertData as unknown[];
      console.log(`Inserted ${insertArray.length} rows`);
    }

    if (insertError) {
      const errorMessage = insertError && typeof insertError === 'object' && 'message' in insertError ? (insertError as { message: string }).message : 'Unknown error';
      this.log('error', 'STAGING_ERROR', `Error staging batch ${batchNumber}: ${errorMessage}`);
      throw new Error(`Failed to stage products: ${errorMessage}`);
    }

    this.log('info', 'BATCH_STAGED', `Staged batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

    // Products are automatically processed via database triggers after insertion
    this.log('info', 'AUTO_PROCESSING', `Batch ${batchNumber}/${totalBatches} automatically processed via database triggers`);
  }

  /**
   * Execute the sync process based on the integration platform
   */
  async executeSync(): Promise<SyncResult> {
    try {
      // Start heartbeat to prevent stall detection
      this.startHeartbeat();

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
        const errorMessage = integrationError && typeof integrationError === 'object' && 'message' in integrationError ? (integrationError as { message: string }).message : 'Integration not found';
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

        case 'google-feed':
          result = await this.syncGoogleFeed(typedIntegration);
          break;

        default:
          throw new Error(`Unsupported platform: ${typedIntegration.platform}`);
      }

      // Simple approach: Enable the auto-processing trigger to handle records automatically
      this.log('info', 'PROCESSING_START', 'Records will be processed automatically by database trigger');

      // Update run status to completed
      await this.updateRunStatus('completed', {
        productsProcessed: result.productsProcessed,
        productsUpdated: result.productsUpdated,
        productsCreated: result.productsCreated,
      });

      // Update integration status
      await updateIntegrationStatus(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Update integration status - keep it active so it can be rescheduled
      await updateIntegrationStatus(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.supabase as any,
        this.integrationId,
        'active',
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
    } finally {
      // Always stop the heartbeat when sync is complete or failed
      this.stopHeartbeat();
    }
  }
}
