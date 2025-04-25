import { XMLParser } from 'fast-xml-parser';

// Define types for Prestashop API responses
export interface PrestashopApiResponse {
  prestashop: {
    products?: {
      $?: { count: string };
      product?: any | any[];
    };
    product?: any;
    currencies?: { // Added currencies property
      currency?: any | any[]; // Structure for currency response
    };
    [key: string]: unknown;
  };
}

// Interface for the output product data
export interface PrestashopProduct {
  id: string;
  name: string;
  price: number;
  wholesale_price: number;
  reference: string; // will contain supplier_reference only
  ean13: string;
  manufacturer_name: string;
  image_url: string;
  active?: boolean;
  currency_code: string; // Added currency code field
}

export class PrestashopClient {
  private apiUrl: string;
  private apiKey: string;
  private parser: XMLParser;
private defaultCurrencyCode: string | null = null;
  private prestashopVersion: string | null = null;

  constructor(apiUrl: string, apiKey: string) {
    // Normalize the API URL
    let normalizedUrl = apiUrl;
    if (normalizedUrl.endsWith('api/')) {
      normalizedUrl = normalizedUrl.slice(0, -4);
    } else if (normalizedUrl.endsWith('api')) {
      normalizedUrl = normalizedUrl.slice(0, -3);
    }

    // Ensure the URL ends with a slash
    this.apiUrl = normalizedUrl.endsWith('/') ? normalizedUrl : `${normalizedUrl}/`;
    this.apiKey = apiKey;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      textNodeName: '_text',
      cdataPropName: '_cdata',
      isArray: (name) => {
        // Make sure images are always treated as an array
        if (name === 'image') return true;
        return false;
      }
    });

    console.log(`Initialized PrestashopClient with API URL: ${this.apiUrl}`);
  }

  /**
   * Detect PrestaShop version
   */
  async detectVersion(): Promise<string> {
    if (this.prestashopVersion) {
      return this.prestashopVersion;
    }

    try {
      // Try to get version from HTTP headers using root API endpoint
      const response = await fetch(`${this.apiUrl}api/`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      // Look for PSWS-Version header (PrestaShop Web Service Version)
      const pswsVersion = response.headers.get('PSWS-Version');
      if (pswsVersion) {
        this.prestashopVersion = pswsVersion;
        console.log(`Detected PrestaShop version: ${this.prestashopVersion} from PSWS-Version header`);
        return this.prestashopVersion;
      }

      // Fall back to checking other headers
      const versionHeader = response.headers.get('X-Prestashop-Version');
      if (versionHeader) {
        this.prestashopVersion = versionHeader;
        console.log(`Detected PrestaShop version: ${this.prestashopVersion} from X-Prestashop-Version header`);
        return this.prestashopVersion;
      }

      // If no version headers found, default to 1.7.x as it's safer
      console.log('No version headers found, defaulting to 1.7.x');
      this.prestashopVersion = '1.7.x';
      return this.prestashopVersion;
    } catch (error) {
      console.error('Error detecting PrestaShop version:', error);
      // Default to 1.7.x if detection fails - safer option
      this.prestashopVersion = '1.7.x';
      console.log(`Defaulting to PrestaShop version ${this.prestashopVersion} after detection error`);
      return this.prestashopVersion;
    }
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders() {
    return {
      'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
      'Accept': 'application/xml',
    };
  }

private async getDefaultCurrency(): Promise<string> {
    if (this.defaultCurrencyCode) {
      return this.defaultCurrencyCode;
    }

    console.log('Fetching default currency code...');
    try {
      // Fetch active currencies, displaying only the iso_code
      const response = await this.makeRequest('currencies?filter[active]=1&display=[iso_code]');

      if (response.prestashop?.currencies?.currency) {
        const currencyData = Array.isArray(response.prestashop.currencies.currency)
          ? response.prestashop.currencies.currency[0] // Assume the first active one is default
          : response.prestashop.currencies.currency;

        const isoCode = this.getStringValue(currencyData?.iso_code);

        if (isoCode && isoCode.length === 3) {
          this.defaultCurrencyCode = isoCode.toUpperCase();
          console.log(`Default currency code set to: ${this.defaultCurrencyCode}`);
          return this.defaultCurrencyCode;
        } else {
           console.warn('Could not extract valid ISO code from currency response:', currencyData);
        }
      } else {
         console.warn('Could not find active currency in response:', response);
      }
    } catch (error) {
      console.error('Error fetching default currency:', error);
    }

    // Fallback currency if detection fails
    console.warn('Defaulting currency code to EUR');
    this.defaultCurrencyCode = 'EUR'; // Default fallback
    return this.defaultCurrencyCode;
  }
  /**
   * Test the connection to the Prestashop API
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing connection to Prestashop API...');
      // Try to fetch a single product to test the connection
      const response = await this.makeRequest('products?limit=1');
      const success = !!(response.prestashop && response.prestashop.products);
      console.log(`Connection test ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error testing Prestashop connection:', error);
      return false;
    }
  }

  /**
   * Get product IDs in a way that's compatible with different PrestaShop versions
   */
  private async getProductIds(): Promise<number[]> {
    const version = await this.detectVersion();
    let productIds: number[] = [];

    try {
      // First, try the simplest approach - get all product IDs in a single request
      console.log('Trying to get all product IDs in a single request');
      try {
        const response = await this.makeRequest('products');

        if (response?.prestashop?.products?.product) {
          const productList = Array.isArray(response.prestashop.products.product)
            ? response.prestashop.products.product
            : [response.prestashop.products.product];

          // Extract IDs from the product list
          productIds = productList.map(product => {
            // Handle different formats of product ID
            if (product.id) {
              return parseInt(this.getStringValue(product.id), 10);
            } else if (typeof product === 'object' && product.$ && product.$.id) {
              return parseInt(product.$.id, 10);
            } else {
              return 0;
            }
          }).filter(id => id > 0);

          console.log(`Retrieved ${productIds.length} product IDs in a single request`);

          // If we got a good number of IDs, return them
          if (productIds.length > 0) {
            return productIds;
          }
        }
      } catch (error) {
        console.error('Error getting all product IDs in a single request:', error);
        // Continue with fallback approaches
      }

      // If the simple approach failed, try version-specific approaches
      if (version.startsWith('8')) {
        // Version 8.x allows display=[id] parameter
        console.log('Using 8.x approach to get product IDs');
        const countResponse = await this.makeRequest('products?display=[id]');

        if (countResponse?.prestashop?.products?.product) {
          const productList = Array.isArray(countResponse.prestashop.products.product)
            ? countResponse.prestashop.products.product
            : [countResponse.prestashop.products.product];

          productIds = productList.map(product => {
            const id = parseInt(this.getStringValue(product.id), 10);
            return isNaN(id) ? 0 : id;
          }).filter(id => id > 0);
        }
      } else {
        // For 1.7.x versions, try batched approach
        console.log('Using batched approach to get product IDs');

        // First, get a small batch to estimate the total count
        const initialResponse = await this.makeRequest('products?display=full&limit=100');

        // Get the total count from the response if available
        let totalCount = 0;
        if (initialResponse?.prestashop?.products?.$?.count) {
          totalCount = parseInt(initialResponse.prestashop.products.$.count, 10);
          console.log(`Total product count from API: ${totalCount}`);
        }

        // If we couldn't get the count, use a large default
        if (!totalCount || isNaN(totalCount)) {
          totalCount = 30000; // Use a large number to ensure we get all products
          console.log(`Using default total count: ${totalCount}`);
        }

        // Calculate how many batches we need (use 500 as batch size)
        const batchSize = 500;
        const numBatches = Math.ceil(totalCount / batchSize);
        console.log(`Will fetch product IDs in ${numBatches} batches of ${batchSize}`);

        // Fetch product IDs in batches
        for (let i = 0; i < numBatches; i++) {
          const offset = i * batchSize;
          console.log(`Fetching product IDs batch ${i+1}/${numBatches} (offset: ${offset}, limit: ${batchSize})`);

          try {
            // Use limit and offset for pagination
            const batchResponse = await this.makeRequest(`products?display=full&limit=${batchSize}&offset=${offset}`);

            if (batchResponse?.prestashop?.products?.product) {
              const batchList = Array.isArray(batchResponse.prestashop.products.product)
                ? batchResponse.prestashop.products.product
                : [batchResponse.prestashop.products.product];

              const batchIds = batchList.map(product => {
                const id = parseInt(this.getStringValue(product.id), 10);
                return isNaN(id) ? 0 : id;
              }).filter(id => id > 0);

              console.log(`Retrieved ${batchIds.length} product IDs in batch ${i+1}`);
              productIds = [...productIds, ...batchIds];

              // If we got fewer IDs than expected, we might have reached the end
              if (batchIds.length < batchSize) {
                break;
              }
            } else {
              // No products in this batch, break the loop
              break;
            }
          } catch (error) {
            console.error(`Error fetching product IDs batch ${i+1}:`, error);
            // Continue with next batch
          }

          // Add a small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Remove duplicates (just in case)
      productIds = [...new Set(productIds)];
      console.log(`Retrieved ${productIds.length} unique product IDs in total`);

      // If we got very few IDs, try the ID generation approach as a last resort
      if (productIds.length < 100) {
        console.log(`Got very few product IDs (${productIds.length}), trying ID generation approach`);

        // Find the highest product ID we've seen or use a default
        const maxId = productIds.length > 0 ? Math.max(...productIds) : 100000;
        console.log(`Highest product ID found: ${maxId}`);

        // Generate a range of IDs from 1 to maxId
        const stepSize = 10; // Use a smaller step size to get more products
        const generatedIds: number[] = [];

        for (let id = 1; id <= maxId; id += stepSize) {
          generatedIds.push(id);
        }

        // Add the specific IDs we already know about
        productIds.forEach(id => {
          if (!generatedIds.includes(id)) {
            generatedIds.push(id);
          }
        });

        // Sort the IDs
        generatedIds.sort((a, b) => a - b);

        console.log(`Generated ${generatedIds.length} product IDs using range approach`);
        return generatedIds;
      }

      return productIds;
    } catch (error) {
      console.error('Error getting product IDs:', error);
      return [];
    }
  }

  /**
   * Fetch products from the Prestashop API using ID range filtering
   */
  async fetchProducts(options: {
    limit?: number;
    page?: number;
    activeOnly?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}): Promise<PrestashopProduct[]> {
    const { onProgress, activeOnly = true } = options;
    console.log(`Starting product fetch with ID range filtering (activeOnly: ${activeOnly})`);

    try {
      // Force version detection before starting
      const version = await this.detectVersion();
      console.log(`Using PrestaShop version: ${version} for fetching products`);

      // Get product IDs with version-compatible approach
      const productIds = await this.getProductIds();

      // Handle empty product list
      if (productIds.length === 0) {
        console.warn('No product IDs retrieved, using fallback approach');
        // Use a fallback approach to estimate products
        const totalProducts = 100;  // Fallback estimate
        const maxProductId = 5000;  // Fallback estimate
        console.log(`Using fallback values: Total products: ${totalProducts}, Max ID: ${maxProductId}`);

        // Continue with chunked approach using estimated values
        return await this.fetchProductsByChunks([], totalProducts, maxProductId, activeOnly, onProgress);
      }

      // Find the max product ID
      const maxProductId = Math.max(...productIds);
      const totalProducts = productIds.length;
      console.log(`Total products: ${totalProducts}, Max ID: ${maxProductId}`);

      // Fetch products by chunks
      return await this.fetchProductsByChunks(productIds, totalProducts, maxProductId, activeOnly, onProgress);
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  /**
   * Fetch products in chunks to handle large catalogs
   */
  private async fetchProductsByChunks(
    productIds: number[],
    _totalProducts: number, // Renamed with underscore to indicate it's not used
    maxProductId: number,
    activeOnly: boolean,
    onProgress?: (current: number, total: number) => void
  ): Promise<PrestashopProduct[]> {
    // Define the chunk size for ID ranges
    const chunkSize = 1000;
    let allProducts: PrestashopProduct[] = [];
    const version = await this.detectVersion();

    // If we have actual product IDs, use those directly
    if (productIds.length > 0) {
      console.log(`Using ${productIds.length} actual product IDs`);

      // Sort the IDs for better organization
      productIds.sort((a, b) => a - b);

      // Split the IDs into chunks
      const chunks: number[][] = [];
      for (let i = 0; i < productIds.length; i += chunkSize) {
        chunks.push(productIds.slice(i, i + chunkSize));
      }

      console.log(`Split product IDs into ${chunks.length} chunks`);

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (onProgress) {
          onProgress(i + 1, chunks.length);
        }

        // Get min and max ID in this chunk
        const minId = Math.min(...chunk);
        const maxId = Math.max(...chunk);

        console.log(`Fetching products with ID range [${minId},${maxId}] (chunk ${i + 1}/${chunks.length})...`);

        // Build a filter string compatible with the PS version
        let endpoint;
        let response;

        if (version.startsWith('8')) {
          // For PrestaShop 8.x, use range filter
          endpoint = `products?display=full&filter[id]=[${minId},${maxId}]`;
          response = await this.makeRequest(endpoint);
        } else if (version.startsWith('1.7.6')) {
          // For PrestaShop 1.7.6.x, the range filter doesn't work properly
          // Instead, fetch products in smaller batches using individual IDs
          console.log(`Using individual ID approach for PrestaShop 1.7.6.x with ${chunk.length} IDs`);

          // Create batches of 50 IDs for individual fetching
          const idBatchSize = 50;
          const idBatches = [];
          for (let j = 0; j < chunk.length; j += idBatchSize) {
            idBatches.push(chunk.slice(j, j + idBatchSize));
          }

          console.log(`Split chunk into ${idBatches.length} ID batches of max ${idBatchSize} IDs each`);

          // Process each batch of IDs
          let allBatchProducts: PrestashopProduct[] = [];
          for (let batchIndex = 0; batchIndex < idBatches.length; batchIndex++) {
            const idBatch = idBatches[batchIndex];
            console.log(`Processing ID batch ${batchIndex + 1}/${idBatches.length} with ${idBatch.length} IDs`);

            // Fetch each product individually and combine results
            const batchProducts = [];
            for (const productId of idBatch) {
              try {
                const productResponse = await this.makeRequest(`products/${productId}`);
                const productArray = await this.parseProducts(productResponse);
                if (productArray.length > 0) {
                  batchProducts.push(productArray[0]);
                }
              } catch (error) {
                console.error(`Error fetching product ID ${productId}:`, error);
                // Continue with next product
              }
            }

            console.log(`Fetched ${batchProducts.length} products from ID batch ${batchIndex + 1}`);
            allBatchProducts = [...allBatchProducts, ...batchProducts];
          }

          // Create a synthetic response with all products
          response = {
            prestashop: {
              products: {
                product: allBatchProducts
              }
            }
          };

          console.log(`Combined ${allBatchProducts.length} products from all ID batches`);
        } else {
          // For other 1.7.x versions, try the pipe syntax
          endpoint = `products?display=full&filter[id]=[${minId}|${maxId}]`;
          response = await this.makeRequest(endpoint);
        }
        const products = await this.parseProducts(response);

        console.log(`Fetched ${products.length} products from ID range [${minId},${maxId}]`);

        allProducts = [...allProducts, ...products];
      }
    } else {
      // If we don't have actual IDs, use estimated ranges
      console.log(`Using estimated ID ranges up to ${maxProductId}`);

      // Calculate the number of chunks
      const numChunks = Math.ceil(maxProductId / chunkSize);

      // Process each chunk
      for (let i = 0; i < numChunks; i++) {
        if (onProgress) {
          onProgress(i + 1, numChunks);
        }

        const startId = i * chunkSize + 1;
        const endId = Math.min((i + 1) * chunkSize, maxProductId);

        console.log(`Fetching products with ID range [${startId},${endId}] (chunk ${i + 1}/${numChunks})...`);

        // Build a filter string compatible with the PS version
        let endpoint;
        if (version.startsWith('8')) {
          endpoint = `products?display=full&filter[id]=[${startId},${endId}]`;
        } else {
          // For 1.7.x, use a different filter syntax
          endpoint = `products?display=full&filter[id]=[${startId}|${endId}]`;
        }

        const response = await this.makeRequest(endpoint);
        const products = await this.parseProducts(response);

        console.log(`Fetched ${products.length} products from ID range [${startId},${endId}]`);

        allProducts = [...allProducts, ...products];
      }
    }

    console.log(`Total products fetched: ${allProducts.length}`);
    // Filter active products if requested
    if (activeOnly && allProducts.length > 0) {
      const beforeCount = allProducts.length;
      allProducts = allProducts.filter((product: PrestashopProduct) => {
        return product.active === true;
      });
      console.log(`Filtered to ${allProducts.length} active products out of ${beforeCount} total products`);
    }

    return allProducts;
  }

  /**
   * Make a request to the Prestashop API
   */
  private async makeRequest(endpoint: string, throwOnError: boolean = true): Promise<PrestashopApiResponse> {
    // Construct the URL properly
    let url: string;
    if (this.apiUrl.includes('api/')) {
      url = `${this.apiUrl}${endpoint}`;
    } else {
      url = `${this.apiUrl}api/${endpoint}`;
    }

    console.log(`Making request to: ${url}`);

    try {
      // Try with Authorization header first (recommended approach)
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);

        // If we get a 401 Unauthorized, try with the key in the URL as a fallback
        if (response.status === 401) {
          console.log('Authorization header failed, trying with key in URL...');

          // Add the key as a parameter to the URL
          const urlWithKey = new URL(url);
          urlWithKey.searchParams.append('ws_key', this.apiKey);

          const fallbackResponse = await fetch(urlWithKey.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/xml',
            },
          });

          if (!fallbackResponse.ok) {
            const error = new Error(`Prestashop API error: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
            if (throwOnError) {
              throw error;
            } else {
              console.error(error.message);
              return { prestashop: {} };
            }
          }

          const xmlText = await fallbackResponse.text();
          return this.parser.parse(xmlText);
        }

        const error = new Error(`Prestashop API error: ${response.status} ${response.statusText}`);
        if (throwOnError) {
          throw error;
        } else {
          console.error(error.message);
          return { prestashop: {} };
        }
      }

      const xmlText = await response.text();
      return this.parser.parse(xmlText);
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      if (throwOnError) {
        throw error;
      } else {
        return { prestashop: {} };
      }
    }
  }

  /**
   * Safely extract string value from any object structure
   */
  private getStringValue(obj: any): string {
    if (obj === null || obj === undefined) {
      return '';
    }

    if (typeof obj === 'string') {
      return obj;
    }

    if (typeof obj === 'number') {
      return String(obj);
    }

    if (typeof obj === 'boolean') {
      return obj ? '1' : '0';
    }

    if (typeof obj === 'object') {
      // Check for CDATA
      if ('_cdata' in obj && typeof obj._cdata === 'string') {
        return obj._cdata;
      }
      // Check for text node
      if ('_text' in obj && typeof obj._text === 'string') {
        return obj._text;
      }
      // Check for language field
      if ('language' in obj) {
        if (Array.isArray(obj.language) && obj.language.length > 0) {
          return this.getStringValue(obj.language[0]);
        } else {
          return this.getStringValue(obj.language);
        }
      }
    }

    return '';
  }

  /**
   * Safely extract a numeric value
   */
  private getNumberValue(obj: any, defaultValue: number = 0): number {
    const stringValue = this.getStringValue(obj);
    if (stringValue === '') return defaultValue;

    const parsedValue = parseFloat(stringValue);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }

  // Image URLs are now constructed directly in the parseProducts method

  /**
   * Parse the products from the API response
   */
  private async parseProducts(response: PrestashopApiResponse): Promise<PrestashopProduct[]> {
    // Fetch the default currency code once for this batch
    const defaultCurrency = await this.getDefaultCurrency();

    // Handle different response structures
    let productData: any[] = [];

    if (response.prestashop && response.prestashop.products && response.prestashop.products.product) {
      // Standard response with products list
      productData = Array.isArray(response.prestashop.products.product)
        ? response.prestashop.products.product
        : [response.prestashop.products.product];
    } else if (response.prestashop && response.prestashop.product) {
      // Single product response
      productData = [response.prestashop.product];
    } else {
      console.error('Invalid product response structure');
      return [];
    }

    console.log(`Found ${productData.length} products in response`);

    const parsedProducts: PrestashopProduct[] = [];

    for (let index = 0; index < productData.length; index++) {
      const product = productData[index];
      try {
        // Extract basic product details
        const id = this.getStringValue(product.id);
        const name = this.getStringValue(product.name);

        // Get the accurate price with discounts and tax using our new method
        const price = await this.calculateFinalPrice(product);

        // Extract wholesale_price
        const wholesalePrice = this.getNumberValue(product.wholesale_price, 0);

        // Try to get supplier_reference first, then fall back to reference if needed
        let reference = this.getStringValue(product.supplier_reference);

        // If supplier_reference is empty, try to use reference as fallback
        if (!reference && product.reference) {
          reference = this.getStringValue(product.reference);
          if (reference) {
            console.log(`Product ${id}: Using reference as fallback for SKU: ${reference}`);
          }
        }

        // Extract EAN13
        const ean13 = this.getStringValue(product.ean13);

        // Get manufacturer name
        let manufacturerName = this.getStringValue(product.manufacturer_name);
        if (!manufacturerName && product.associations?.manufacturer?.manufacturer?.name) {
          manufacturerName = this.getStringValue(product.associations.manufacturer.manufacturer.name);
        }

        // Get the image URL
        let imageUrl = '';

        // First, check if there's already an image_url in the product data
        if (product.image_url && this.getStringValue(product.image_url) !== '') {
          imageUrl = this.getStringValue(product.image_url);
          console.log(`Product ${id}: Using provided image URL: ${imageUrl}`);
        }
        // Check for id_default_image which is in the XML response
        else if (product.id_default_image) {
          let imageId = null;

          // The id_default_image can be a string or an object with CDATA
          if (typeof product.id_default_image === 'string') {
            imageId = product.id_default_image.trim();
          } else if (product.id_default_image && typeof product.id_default_image === 'object') {
            // Try to extract the CDATA value
            imageId = this.getStringValue(product.id_default_image);
          }

          if (imageId) {
            console.log(`Product ${id}: Found default image ID: ${imageId}`);

            // Get the link_rewrite value for the product (SEO-friendly URL name)
            let linkRewrite = '';
            if (product.link_rewrite) {
              if (typeof product.link_rewrite === 'string') {
                linkRewrite = product.link_rewrite.trim();
              } else if (product.link_rewrite.language && product.link_rewrite.language.length > 0) {
                // Try to get the first language value
                linkRewrite = this.getStringValue(product.link_rewrite.language[0]);
              } else if (product.link_rewrite.language) {
                // If it's a single language object
                linkRewrite = this.getStringValue(product.link_rewrite.language);
              }
            }

            // For PrestaShop 1.7.6.x, construct the image URL directly
            const baseUrl = this.apiUrl.replace(/\/api\/?$/, '');
            const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

            // If no link_rewrite is provided, use a generic one
            const safeRewrite = linkRewrite || 'product';

            // Construct the public URL directly
            imageUrl = `${baseUrlWithoutTrailingSlash}/${imageId}-home_default/${safeRewrite}.jpg`;

            console.log(`Product ${id}: Generated image URL from id_default_image: ${imageUrl}`);
          }
        }
        // If no direct image_url or id_default_image, try to construct it from associations
        else if (product.associations?.images?.image) {
          let imageId = null;

          // Handle array of images
          if (Array.isArray(product.associations.images.image) && product.associations.images.image.length > 0) {
            const firstImage = product.associations.images.image[0];
            imageId = this.getStringValue(firstImage?.id);
          }
          // Handle single image
          else if (product.associations.images.image.id) {
            imageId = this.getStringValue(product.associations.images.image.id);
          }

          if (imageId) {
            // Get the link_rewrite value for the product (SEO-friendly URL name)
            let linkRewrite = '';
            if (product.link_rewrite) {
              if (typeof product.link_rewrite === 'string') {
                linkRewrite = product.link_rewrite.trim();
              } else if (product.link_rewrite.language && product.link_rewrite.language.length > 0) {
                // Try to get the first language value
                linkRewrite = this.getStringValue(product.link_rewrite.language[0]);
              } else if (product.link_rewrite.language) {
                // If it's a single language object
                linkRewrite = this.getStringValue(product.link_rewrite.language);
              }
            }

            // For PrestaShop 1.7.6.x, construct the image URL directly
            const baseUrl = this.apiUrl.replace(/\/api\/?$/, '');
            const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

            // If no link_rewrite is provided, use a generic one
            const safeRewrite = linkRewrite || 'product';

            // Construct the public URL directly
            imageUrl = `${baseUrlWithoutTrailingSlash}/${imageId}-home_default/${safeRewrite}.jpg`;

            console.log(`Product ${id}: Generated image URL from associations: ${imageUrl}`);
          }
        }

        // If we still don't have an image URL, try to construct one from the product ID
        if (!imageUrl && id) {
          // Try to construct a default image URL based on product ID
          // This is a fallback approach that might work for some PrestaShop installations
          const baseUrl = this.apiUrl.replace(/\/api\/?$/, '');
          const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

          // Get the link_rewrite value for the product (SEO-friendly URL name)
          let linkRewrite = '';
          if (product.link_rewrite) {
            if (typeof product.link_rewrite === 'string') {
              linkRewrite = product.link_rewrite.trim();
            } else if (product.link_rewrite.language && product.link_rewrite.language.length > 0) {
              // Try to get the first language value
              linkRewrite = this.getStringValue(product.link_rewrite.language[0]);
            } else if (product.link_rewrite.language) {
              // If it's a single language object
              linkRewrite = this.getStringValue(product.link_rewrite.language);
            }
          }

          // If no link_rewrite is provided, use a generic one
          const safeRewrite = linkRewrite || 'product';

          // Try to find the default image ID (often it's the product ID)
          imageUrl = `${baseUrlWithoutTrailingSlash}/img/p/${id.split('').join('/')}/${id}-home_default/${safeRewrite}.jpg`;

          console.log(`Product ${id}: Generated fallback image URL: ${imageUrl}`);
        }

        // Extract active status if available
        let active = false;

        // Handle different formats of active status
        if (product.active !== undefined) {
          const activeStr = this.getStringValue(product.active);
          // In Prestashop, active can be '1', 'true', or other truthy values
          active = activeStr === '1' || activeStr.toLowerCase() === 'true';

          // Only log in debug mode
          const isDebug = process.env.LOG_LEVEL === 'debug';
          if (isDebug) {
            console.log(`Product ${id}: Active status = ${activeStr} (parsed as ${active})`);

            if (typeof product.active === 'object') {
              console.log(`Product ${id}: Raw active value:`, JSON.stringify(product.active));
            } else {
              console.log(`Product ${id}: Raw active value: ${product.active}`);
            }
          }
        } else {
          // If active status is not available, default to true for backward compatibility
          active = true;
          if (process.env.LOG_LEVEL === 'debug') {
            console.log(`Product ${id}: No active status found, defaulting to true`);
          }
        }

        // Create parsed product with the fields we want
        const parsedProduct: PrestashopProduct = {
          id,
          name,
          price,
          wholesale_price: wholesalePrice,
          reference, // ONLY supplier_reference, no fallback
          ean13,
          manufacturer_name: manufacturerName,
          image_url: imageUrl,
          active,
          currency_code: defaultCurrency // Added currency_code
        };

        // In test mode, log detailed info; in full sync mode, be quiet
        const isTestRun = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development';
        if (isTestRun) {
          if (wholesalePrice > 0) {
            console.log(`Product ${id}: Found wholesale_price: ${wholesalePrice}`);
          }
          if (ean13) {
            console.log(`Product ${id}: Found EAN13: ${ean13}`);
          }
          console.log(`Product ${id}: Final price with tax and discounts: ${price}`);
        }

        parsedProducts.push(parsedProduct);
      } catch (error) {
        console.error(`Error parsing product at index ${index}:`, error);
      }
    }

    return parsedProducts;
  }

  /**
   * Get products with filtering options
   * @param options Options for filtering products
   * @returns Filtered list of products
   */
  async getProducts(options?: { limit?: number, activeOnly?: boolean, random?: boolean }): Promise<PrestashopProduct[]> {
    try {
      const limit = options?.limit || 10;
      const activeOnly = options?.activeOnly !== false; // Default to true
      const random = options?.random !== false; // Default to true for test runs

      // Force version detection first
      const version = await this.detectVersion();
      console.log(`Using PrestaShop version: ${version} for getProducts`);

      // Get product IDs using version-compatible approach
      const productIds = await this.getProductIds();

      if (productIds.length === 0) {
        console.warn('No product IDs retrieved');
        return [];
      }

      console.log(`Retrieved ${productIds.length} product IDs`);

      // For PrestaShop 1.7.x, use a different approach than range filtering
      if (!version.startsWith('8')) {
        // For 1.7.x, get individual products if possible
        const shuffledIds = [...productIds];
        // Shuffle the array to get random products
        if (random) {
          for (let i = shuffledIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
          }
        }

        // Take up to 20 random IDs (more than we need in case some are inactive)
        const selectedIds = shuffledIds.slice(0, Math.min(20, shuffledIds.length));
        console.log(`Selected ${selectedIds.length} random product IDs to fetch`);

        // Fetch products one by one (more reliable in 1.7.x)
        const products: PrestashopProduct[] = [];

        for (const id of selectedIds) {
          if (products.length >= limit) break;

          try {
            console.log(`Fetching product ID ${id}...`);
            const response = await this.makeRequest(`products/${id}`);
            const productArray = await this.parseProducts(response);

            if (productArray.length > 0) {
              const product = productArray[0];
              // Check if product is active if needed
              if (!activeOnly || product.active) {
                products.push(product);
                console.log(`Added product ${id}: ${product.name} (Active: ${product.active})`);
              } else {
                console.log(`Skipped inactive product ${id}: ${product.name}`);
              }
            }
          } catch (error) {
            console.error(`Error fetching product ID ${id}:`, error);
          }
        }

        console.log(`Returning ${products.length} products for test run`);
        return products.slice(0, limit);
      }

      let totalProducts = productIds.length;
      let maxProductId = productIds.length > 0 ? Math.max(...productIds) : 5000;

      console.log(`Found ${totalProducts} total products, max ID approximately ${maxProductId}`);

      // For test runs, we'll try to get products using ID range filtering
      let products: PrestashopProduct[] = [];

      // Generate a random ID range for test runs
      let startId = 1;
      let endId = 100;

      if (random && maxProductId > 100) {
        // Generate a random range of 1000 IDs within the available range
        const rangeSize = 1000;
        startId = Math.max(1, Math.floor(Math.random() * (maxProductId - rangeSize)));
        endId = startId + rangeSize;
        console.log(`Using random ID range [${startId},${endId}] for test run`);
      } else {
        // Use the last 1000 IDs for non-random or small stores
        startId = Math.max(1, maxProductId - 1000);
        endId = maxProductId;
        console.log(`Using last ID range [${startId},${endId}] for test run`);
      }

      // Fetch products using ID range filtering with version-compatible approach
      console.log(`Fetching products with ID range [${startId},${endId}]...`);

      // Build endpoint based on PrestaShop version
      let endpoint;
      let response;

      if (version.startsWith('8')) {
        // For PrestaShop 8.x, use range filter
        endpoint = `products?display=full&filter[id]=[${startId},${endId}]`;
        response = await this.makeRequest(endpoint);
      } else if (version.startsWith('1.7.6')) {
        // For PrestaShop 1.7.6.x, the range filter doesn't work properly
        // Instead, fetch a sample of products directly
        console.log(`Using direct product fetch approach for PrestaShop 1.7.6.x`);

        // Get a sample of product IDs within the range
        const sampleSize = Math.min(50, Math.ceil((endId - startId) / 100));
        const sampleIds: number[] = [];

        // Generate evenly distributed sample IDs
        for (let i = 0; i < sampleSize; i++) {
          const id = Math.floor(startId + (i * (endId - startId) / sampleSize));
          sampleIds.push(id);
        }

        console.log(`Generated ${sampleIds.length} sample IDs from range [${startId},${endId}]`);

        // Fetch each product individually and combine results
        const sampleProducts: PrestashopProduct[] = [];
        for (const productId of sampleIds) {
          try {
            const productResponse = await this.makeRequest(`products/${productId}`);
            const productArray = await this.parseProducts(productResponse);
            if (productArray.length > 0) {
              sampleProducts.push(productArray[0]);
            }
          } catch (error) {
            // Ignore errors for individual products
            console.log(`Could not fetch product ID ${productId}`);
          }
        }

        console.log(`Fetched ${sampleProducts.length} sample products`);

        // Create a synthetic response with all products
        response = {
          prestashop: {
            products: {
              product: sampleProducts
            }
          }
        };
      } else {
        // For other 1.7.x versions, try the pipe syntax
        endpoint = `products?display=full&filter[id]=[${startId}|${endId}]`;
        response = await this.makeRequest(endpoint);
      }
      let filteredProducts = await this.parseProducts(response);

      // Log the first few product IDs to verify we're getting different products
      if (filteredProducts.length > 0) {
        console.log(`First few product IDs in range:`,
          filteredProducts.slice(0, 3).map(p => p.id).join(', '));
      } else {
        console.log(`No products found in ID range [${startId},${endId}]`);

        // Try a different range if no products found
        if (random) {
          console.log(`Trying a different ID range...`);
          startId = Math.max(1, Math.floor(Math.random() * (maxProductId - 1000)));
          endId = startId + 1000;
          console.log(`Using alternate ID range [${startId},${endId}]`);

          // Build endpoint based on PrestaShop version
          let altResponse;

          if (version.startsWith('8')) {
            // For PrestaShop 8.x, use range filter
            endpoint = `products?display=full&filter[id]=[${startId},${endId}]`;
            altResponse = await this.makeRequest(endpoint);
          } else if (version.startsWith('1.7.6')) {
            // For PrestaShop 1.7.6.x, the range filter doesn't work properly
            // Instead, fetch a sample of products directly
            console.log(`Using direct product fetch approach for PrestaShop 1.7.6.x (alternate range)`);

            // Get a sample of product IDs within the range
            const sampleSize = Math.min(50, Math.ceil((endId - startId) / 100));
            const sampleIds: number[] = [];

            // Generate evenly distributed sample IDs
            for (let i = 0; i < sampleSize; i++) {
              const id = Math.floor(startId + (i * (endId - startId) / sampleSize));
              sampleIds.push(id);
            }

            console.log(`Generated ${sampleIds.length} sample IDs from alternate range [${startId},${endId}]`);

            // Fetch each product individually and combine results
            const sampleProducts: PrestashopProduct[] = [];
            for (const productId of sampleIds) {
              try {
                const productResponse = await this.makeRequest(`products/${productId}`);
                const productArray = await this.parseProducts(productResponse);
                if (productArray.length > 0) {
                  sampleProducts.push(productArray[0]);
                }
              } catch (error) {
                // Ignore errors for individual products
                console.log(`Could not fetch product ID ${productId}`);
              }
            }

            console.log(`Fetched ${sampleProducts.length} sample products from alternate range`);

            // Create a synthetic response with all products
            altResponse = {
              prestashop: {
                products: {
                  product: sampleProducts
                }
              }
            };
          } else {
            // For other 1.7.x versions, try the pipe syntax
            endpoint = `products?display=full&filter[id]=[${startId}|${endId}]`;
            altResponse = await this.makeRequest(endpoint);
          }
          filteredProducts = await this.parseProducts(altResponse);

          if (filteredProducts.length === 0) {
            // Last resort: try the first 1000 IDs
            console.log(`Still no products found. Trying first 1000 IDs...`);

            // Build endpoint based on PrestaShop version
            let firstResponse;

            if (version.startsWith('8')) {
              // For PrestaShop 8.x, use range filter
              endpoint = `products?display=full&filter[id]=[1,1000]`;
              firstResponse = await this.makeRequest(endpoint);
            } else if (version.startsWith('1.7.6')) {
              // For PrestaShop 1.7.6.x, the range filter doesn't work properly
              // Instead, fetch a sample of products directly
              console.log(`Using direct product fetch approach for PrestaShop 1.7.6.x (first 1000 IDs)`);

              // Get a sample of product IDs within the first 1000
              const sampleSize = 50; // Get 50 evenly distributed IDs
              const sampleIds: number[] = [];

              // Generate evenly distributed sample IDs
              for (let i = 0; i < sampleSize; i++) {
                const id = Math.floor(1 + (i * 1000 / sampleSize));
                sampleIds.push(id);
              }

              console.log(`Generated ${sampleIds.length} sample IDs from first 1000 IDs`);

              // Fetch each product individually and combine results
              const sampleProducts: PrestashopProduct[] = [];
              for (const productId of sampleIds) {
                try {
                  const productResponse = await this.makeRequest(`products/${productId}`);
                  const productArray = await this.parseProducts(productResponse);
                  if (productArray.length > 0) {
                    sampleProducts.push(productArray[0]);
                  }
                } catch (error) {
                  // Ignore errors for individual products
                  console.log(`Could not fetch product ID ${productId}`);
                }
              }

              console.log(`Fetched ${sampleProducts.length} sample products from first 1000 IDs`);

              // Create a synthetic response with all products
              firstResponse = {
                prestashop: {
                  products: {
                    product: sampleProducts
                  }
                }
              };
            } else {
              // For other 1.7.x versions, try the pipe syntax
              endpoint = `products?display=full&filter[id]=[1|1000]`;
              firstResponse = await this.makeRequest(endpoint);
            }
            filteredProducts = await this.parseProducts(firstResponse);
          }
        }
      }

      // Filter active products if requested
      if (activeOnly && filteredProducts.length > 0) {
        const beforeCount = filteredProducts.length;
        filteredProducts = filteredProducts.filter((product: PrestashopProduct) => {
          return product.active === true;
        });

        console.log(`Found ${filteredProducts.length} active products out of ${beforeCount} in ID range`);

        // If no active products found and this is a test run, try without the filter
        if (filteredProducts.length === 0 && random) {
          console.warn(`WARNING: No active products found in the selected ID range.`);
          console.warn(`If you need to see products, try unchecking the 'Only import active products' option.`);
          return [];
        }
      }

      // Use these products as our collection
      products = filteredProducts;

      // Try to get more products if we haven't reached the requested limit
      if (products.length < limit && random) {
        // Try up to 3 more random ranges to get additional products
        for (let attempt = 0; attempt < 3 && products.length < limit; attempt++) {
          startId = Math.max(1, Math.floor(Math.random() * (maxProductId - 1000)));
          endId = startId + 1000;
          console.log(`Getting more products with ID range [${startId},${endId}] (attempt ${attempt + 1})...`);

          // Build endpoint based on PrestaShop version
          let moreResponse;

          if (version.startsWith('8')) {
            // For PrestaShop 8.x, use range filter
            endpoint = `products?display=full&filter[id]=[${startId},${endId}]`;
            moreResponse = await this.makeRequest(endpoint);
          } else if (version.startsWith('1.7.6')) {
            // For PrestaShop 1.7.6.x, the range filter doesn't work properly
            // Instead, fetch a sample of products directly
            console.log(`Using direct product fetch approach for PrestaShop 1.7.6.x (additional products)`);

            // Get a sample of product IDs within the range
            const sampleSize = Math.min(50, Math.ceil((endId - startId) / 100));
            const sampleIds: number[] = [];

            // Generate evenly distributed sample IDs
            for (let i = 0; i < sampleSize; i++) {
              const id = Math.floor(startId + (i * (endId - startId) / sampleSize));
              sampleIds.push(id);
            }

            console.log(`Generated ${sampleIds.length} sample IDs from range [${startId},${endId}] (attempt ${attempt + 1})`);

            // Fetch each product individually and combine results
            const sampleProducts: PrestashopProduct[] = [];
            for (const productId of sampleIds) {
              try {
                const productResponse = await this.makeRequest(`products/${productId}`);
                const productArray = await this.parseProducts(productResponse);
                if (productArray.length > 0) {
                  sampleProducts.push(productArray[0]);
                }
              } catch (error) {
                // Ignore errors for individual products
                console.log(`Could not fetch product ID ${productId}`);
              }
            }

            console.log(`Fetched ${sampleProducts.length} sample products (attempt ${attempt + 1})`);

            // Create a synthetic response with all products
            moreResponse = {
              prestashop: {
                products: {
                  product: sampleProducts
                }
              }
            };
          } else {
            // For other 1.7.x versions, try the pipe syntax
            endpoint = `products?display=full&filter[id]=[${startId}|${endId}]`;
            moreResponse = await this.makeRequest(endpoint);
          }
          let moreProducts = await this.parseProducts(moreResponse);

          // Filter active products if requested
          if (activeOnly && moreProducts.length > 0) {
            moreProducts = moreProducts.filter((product: PrestashopProduct) => {
              return product.active === true;
            });
          }

          // Add new products, avoiding duplicates
          const existingIds = new Set(products.map(p => p.id));
          const newProducts = moreProducts.filter(p => !existingIds.has(p.id));

          console.log(`Found ${newProducts.length} additional unique products`);
          products = [...products, ...newProducts];

          if (newProducts.length === 0) {
            // If we didn't find any new products, try a completely different range next time
            continue;
          }
        }
      }

      // Randomize the products if we have more than we need
      if (random && products.length > limit) {
        // Fisher-Yates shuffle algorithm
        for (let i = products.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [products[i], products[j]] = [products[j], products[i]];
        }
        console.log(`Randomized ${products.length} products`);
      }

      // Apply final limit
      if (products.length > limit) {
        products = products.slice(0, limit);
      }

      console.log(`Returning ${products.length} ${activeOnly ? 'active ' : ''}products for test run`);
      return products;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  /**
   * Get product price with tax and discounts using a simple method (works in PrestaShop 8.x)
   */
  private async getProductPriceWithTax(productId: string): Promise<number | null> {
    try {
      // Try the new API method for PrestaShop 8.x
      const response = await this.makeRequest(`products/${productId}?price[final_price][use_tax]=1`, false);

      if (response?.prestashop?.product?.final_price) {
        const price = this.getNumberValue(response.prestashop.product.final_price);
        console.log(`Got final price with tax from API for product ${productId}: ${price}`);
        return price;
      }

      return null; // No price found with the new method
    } catch (error) {
      console.log(`Could not get price with new method for product ${productId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Calculate the final price for a product including discounts and taxes
   */
  private async calculateFinalPrice(product: any): Promise<number> {
    try {
      const id = this.getStringValue(product.id);

      // First try with the new method for PrestaShop 8.x
      const newMethodPrice = await this.getProductPriceWithTax(id);
      if (newMethodPrice !== null) {
        return newMethodPrice;
      }

      console.log(`Using fallback price calculation method for product ${id}`);

      // Get base price
      let basePrice = this.getNumberValue(product.price, 0);

      // Get potential discounts
      const specificPricesResponse = await this.makeRequest(`specific_prices?filter[id_product]=${id}`, false);

      let bestReduction = 0;
      let bestReductionType = '';

      if (specificPricesResponse?.prestashop) {
        const prestashop = specificPricesResponse.prestashop as any;
        if (prestashop.specific_prices?.specific_price) {
          const specificPriceIds: string[] = [];

          // Gather all specific price IDs
          if (Array.isArray(prestashop.specific_prices.specific_price)) {
            prestashop.specific_prices.specific_price.forEach((sp: any) => {
              specificPriceIds.push(this.getStringValue(sp.id || sp));
            });
          } else {
            const specificPrice = prestashop.specific_prices.specific_price as any;
            specificPriceIds.push(this.getStringValue(specificPrice.id || specificPrice));
          }

          console.log(`Found ${specificPriceIds.length} specific prices for product ${id}`);

          // Get details for each discount and find the best one
          const now = new Date();

          for (const specificPriceId of specificPriceIds) {
            const specificPriceResponse = await this.makeRequest(`specific_prices/${specificPriceId}`, false);

            if (specificPriceResponse?.prestashop?.specific_price) {
              const specificPrice = specificPriceResponse.prestashop.specific_price as any;

              const reductionType = this.getStringValue(specificPrice.reduction_type);
              const reduction = this.getNumberValue(specificPrice.reduction);

              // Check if the discount is valid
              const fromDate = this.getStringValue(specificPrice.from);
              const toDate = this.getStringValue(specificPrice.to);

              let isValid = true;

              // Check dates if specified
              if (fromDate && fromDate !== '0000-00-00 00:00:00') {
                isValid = isValid && (now >= new Date(fromDate));
              }
              if (toDate && toDate !== '0000-00-00 00:00:00') {
                isValid = isValid && (now <= new Date(toDate));
              }

              console.log(`Specific price ${specificPriceId}: type=${reductionType}, value=${reduction}, valid=${isValid}`);

              // If discount is valid and better than what we have, update
              if (isValid && reductionType === 'percentage' && reduction > bestReduction) {
                bestReduction = reduction;
                bestReductionType = reductionType;
              } else if (isValid && reductionType === 'amount') {
                // For 'amount' discounts, convert to percentage for comparison
                const percentEquivalent = reduction / basePrice;
                if (percentEquivalent > bestReduction) {
                  bestReduction = reduction;
                  bestReductionType = reductionType;
                }
              }
            }
          }
        }
      }

      // Apply the best discount
      let discountedPrice = basePrice;
      if (bestReduction > 0) {
        if (bestReductionType === 'percentage') {
          discountedPrice = basePrice * (1 - bestReduction);
        } else if (bestReductionType === 'amount') {
          discountedPrice = basePrice - bestReduction;
        }
        console.log(`Applied best reduction: ${bestReduction} ${bestReductionType} -> ${discountedPrice}`);
      }

      // Get tax rate
      let taxRate = 0.25; // Standard 25% VAT
      const taxRuleGroupId = this.getStringValue(product.id_tax_rules_group);

      if (taxRuleGroupId) {
        try {
          // For simplicity, we use the first tax rule
          const taxRulesResponse = await this.makeRequest(`tax_rules?filter[id_tax_rules_group]=${taxRuleGroupId}`, false);

          if (taxRulesResponse?.prestashop) {
            const prestashop = taxRulesResponse.prestashop as any;
            if (prestashop.tax_rules?.tax_rule) {
              let firstTaxRuleId;

              if (Array.isArray(prestashop.tax_rules.tax_rule)) {
                const taxRule = prestashop.tax_rules.tax_rule[0] as any;
                firstTaxRuleId = this.getStringValue(taxRule.id || taxRule);
              } else {
                const taxRule = prestashop.tax_rules.tax_rule as any;
                firstTaxRuleId = this.getStringValue(taxRule.id || taxRule);
              }

              if (firstTaxRuleId) {
                const taxRuleResponse = await this.makeRequest(`tax_rules/${firstTaxRuleId}`, false);

                if (taxRuleResponse?.prestashop?.tax_rule) {
                  const taxRule = taxRuleResponse.prestashop.tax_rule as any;
                  if (taxRule.id_tax) {
                    const taxId = this.getStringValue(taxRule.id_tax);

                    const taxResponse = await this.makeRequest(`taxes/${taxId}`, false);
                    if (taxResponse?.prestashop?.tax) {
                      const tax = taxResponse.prestashop.tax as any;
                      if (tax.rate) {
                        taxRate = this.getNumberValue(tax.rate) / 100;
                        console.log(`Found tax rate: ${taxRate * 100}%`);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching tax rate: ${error}`);
          // Continue with standard VAT
        }
      }

      // Calculate final price with VAT
      const finalPrice = discountedPrice * (1 + taxRate);

      console.log(`Final price calculation for product ${id}:`, {
        basePrice,
        bestReduction,
        bestReductionType,
        discountedPrice,
        taxRate,
        finalPrice
      });

      // Round to two decimals
      return Math.round(finalPrice * 100) / 100;
    } catch (error) {
      console.error(`Error calculating final price for product ${product.id}:`, error);
      // Fallback to base price + standard VAT
      return Math.round(this.getNumberValue(product.price, 0) * 1.25 * 100) / 100;
    }
  }
}