/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

// Type definitions for API responses
interface LoginSettingsData {
  userLoggedIn?: boolean;
  [key: string]: unknown;
}

interface ProductsData {
  parts?: unknown[];
  [key: string]: unknown;
}

interface BalanceData {
  [partId: string]: {
    Balance: string;
    BalanceTable: unknown;
    IconColor: unknown;
    IconText: unknown;
    IsInStock: boolean;
  };
}

interface ExtraFieldsData {
  ExtraFields?: Array<{
    Name: string;
    Value: string;
    RowNumber: number;
  }>;
  [key: string]: unknown;
}

interface TraitData {
  GroupName: string;
  Name: string;
  [key: string]: unknown;
}

interface ProductData {
  PartId?: string;
  PartNumber?: string;
  Description?: string;
  GS1Code?: string;
  Traits?: TraitData[];
  Balance?: string;
  [key: string]: unknown;
}

interface CategoryData {
  DisplayId?: number;
  Text?: string;
  [key: string]: unknown;
}

interface PriceData {
  ItemPriceValueWithoutVat?: string | number;
  GrossPrice?: string | number;
  Discount?: string | number;
  PriceBeforeCampaign?: string | number;
  CampaignColor?: string;
  Currency?: string;
  PartId?: string;
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5'); // Get more products to test balance API
    const categoryId = searchParams.get('categoryId') || null;

    // Belid API credentials (from your supplier record)
    const credentials = {
      username: "info@ljustema.se",
      password: "CCfMDu4KcTvM",
      baseUrl: "https://shop.belidlightinggroup.com"
    };

    // Simple API client class
    class BelidDebugClient {
      private baseUrl: string;
      private cookies: Record<string, string> = {};
      private headers: Record<string, string>;

      constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'sv-SE,sv;q=0.9,en-SE;q=0.8,en;q=0.7,en-US;q=0.6',
          'Content-Type': 'application/json; charset=UTF-8',
          'Origin': this.baseUrl,
          'Referer': `${this.baseUrl}/shop`,
          'X-Requested-With': 'XMLHttpRequest'
        };
      }

      private getCookieString(): string {
        return Object.entries(this.cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
      }

      private updateCookies(response: Response): void {
        const setCookieHeaders = response.headers.getSetCookie?.() || [];
        console.log(`Set-Cookie headers:`, setCookieHeaders);

        for (const cookieHeader of setCookieHeaders) {
          const [nameValue] = cookieHeader.split(';');
          const [name, value] = nameValue.split('=');
          if (name && value) {
            this.cookies[name.trim()] = value.trim();
            console.log(`Updated cookie: ${name.trim()} = ${value.trim()}`);
          }
        }

        // Fallback to old method if getSetCookie is not available
        if (setCookieHeaders.length === 0) {
          const setCookieHeader = response.headers.get('set-cookie');
          if (setCookieHeader) {
            console.log(`Fallback set-cookie header:`, setCookieHeader);
            const cookies = setCookieHeader.split(',');
            for (const cookie of cookies) {
              const [nameValue] = cookie.split(';');
              const [name, value] = nameValue.split('=');
              if (name && value) {
                this.cookies[name.trim()] = value.trim();
                console.log(`Updated cookie (fallback): ${name.trim()} = ${value.trim()}`);
              }
            }
          }
        }

        console.log(`Current cookies:`, this.cookies);
      }

      async makeRequest(endpoint: string, data: Record<string, unknown> | null = null, isPut: boolean = false): Promise<{ status: number; data: unknown; error: string | null }> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { ...this.headers };

        if (Object.keys(this.cookies).length > 0) {
          headers['Cookie'] = this.getCookieString();
        }

        const options: RequestInit = {
          method: data ? (isPut ? 'PUT' : 'POST') : 'GET',
          headers,
        };

        if (data) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        this.updateCookies(response);

        const responseData = await response.json().catch(() => ({}));
        
        return {
          status: response.status,
          data: responseData,
          error: response.ok ? null : `HTTP ${response.status}`
        };
      }

      async getInitialCookies(): Promise<void> {
        console.log(`Getting initial cookies...`);
        const result = await this.makeRequest('/shared/get-cookie?cname=cookiePolicyAccepted');
        console.log(`Initial cookies result:`, result);
      }

      async authenticate(username: string, password: string): Promise<boolean> {
        console.log(`Attempting login with username: ${username}`);

        // Get initial cookies first (critical step from PHP code)
        await this.getInitialCookies();

        console.log(`Making login request with payload:`, { username, password: '***' });

        const loginResult = await this.makeRequest('/main/api/login-user', {
          username,
          password
        }, true); // Use PUT method like PHP code

        console.log(`Login result:`, loginResult);
        console.log(`Login response headers and cookies:`, Object.keys(this.cookies));

        if (loginResult.status !== 200) {
          throw new Error(`Login failed: ${loginResult.error} - ${JSON.stringify(loginResult.data)}`);
        }

        // Verify login
        console.log(`Verifying login...`);
        const settingsResult = await this.makeRequest('/main/api/login-setting');
        console.log(`Settings result:`, settingsResult);

        if (settingsResult.status === 200 && settingsResult.data) {
          // Use strict verification like PHP code - only accept userLoggedIn === true
          const data = settingsResult.data as LoginSettingsData;
          const isLoggedIn = data?.userLoggedIn === true;

          console.log(`Login verification result: ${isLoggedIn}`, data);

          if (!isLoggedIn) {
            console.log(`Login failed - userLoggedIn is not true. Full response:`, data);
            return false;
          }

          return true;
        }

        return false;
      }

      async getAllCategories(): Promise<unknown[]> {
        console.log(`Fetching categories...`);
        const result = await this.makeRequest('/api/menu/get-part-menu-items'); // Use correct endpoint from PHP code
        console.log(`Categories API result:`, result);

        const data = result.data || {};
        console.log(`Categories data type: ${typeof data}, isArray: ${Array.isArray(data)}, keys: ${Object.keys(data)}`);

        // Handle both array and object responses
        if (Array.isArray(data)) {
          return data;
        } else if (typeof data === 'object' && data !== null) {
          // Convert object to array if needed
          const values = Object.values(data);
          console.log(`Converted object to array, length: ${values.length}`);
          return values;
        }
        return [];
      }

      async getProductsInCategory(categoryId: string): Promise<unknown[]> {
        console.log(`Fetching products for category: ${categoryId}`);

        // Use the correct endpoint from PHP code with pagination
        const result = await this.makeRequest('/api/category/parts', {
          categoryId: categoryId,
          page: 1
        }, true); // Use PUT method like PHP code

        console.log(`Products API result:`, result);

        if (result.status === 200 && result.data) {
          const data = result.data as ProductsData;
          if (data.parts) {
            console.log(`Found ${data.parts.length} products in category ${categoryId}`);
            return data.parts;
          }
        }

        console.log(`No products found in category ${categoryId}`);
        return [];
      }

      async getProductPrices(partIds: string[]): Promise<Record<string, unknown> | unknown[]> {
        console.log(`Fetching prices for ${partIds.length} parts:`, partIds);

        // Use the correct endpoint from PHP code with PUT method
        const result = await this.makeRequest('/api/category/prices', {
          partIds: partIds
        }, true); // Use PUT method like PHP code

        console.log(`Prices API result:`, result);

        const data = result.data || {};

        // Return the data as-is (object keyed by PartId or array)
        if (typeof data === 'object' && data !== null) {
          const itemCount = Array.isArray(data) ? data.length : Object.keys(data).length;
          console.log(`Prices returned as ${Array.isArray(data) ? 'array' : 'object'} with ${itemCount} items`);
          return data as Record<string, unknown> | unknown[];
        }

        console.log(`No valid prices data returned`);
        return {};
      }

      async getProductBalance(partIds: string[]): Promise<Record<string, { Balance: string; BalanceTable: unknown; IconColor: unknown; IconText: unknown; IsInStock: boolean }> | null> {
        console.log(`Fetching balance/stock info for ${partIds.length} parts:`, partIds);

        // Use the correct balance endpoint found in network tab
        const result = await this.makeRequest('/api/category/balances', {
          stringIds: partIds  // Use stringIds parameter as shown in network tab
        }, true); // Use PUT method like other APIs

        console.log(`Balance API result:`, result);

        if (result.status === 200 && result.data) {
          console.log(`Found balance data:`, result.data);
          return result.data as Record<string, { Balance: string; BalanceTable: unknown; IconColor: unknown; IconText: unknown; IsInStock: boolean }>;
        }

        console.log(`No balance info found for parts:`, partIds);
        return null;
      }

      async getDeliveryTime(partId: string, quantity: number = 1): Promise<string | null> {
        console.log(`Fetching delivery time for part: ${partId}, quantity: ${quantity}`);

        // Use the delivery time endpoint found in network tab
        const result = await this.makeRequest('/api/part/update-delivery-time', {
          sPartId: partId,
          quantity: quantity
        }, true); // Use PUT method

        console.log(`Delivery time API result for ${partId}:`, result);

        if (result.status === 200 && result.data) {
          // Response is a string like "Beräknat leveransdatum ifrån oss: 2025-07-03"
          console.log(`Found delivery time for ${partId}:`, result.data);
          return result.data as string;
        }

        console.log(`No delivery time found for part:`, partId);
        return null;
      }

      async getExtraFields(partId: string): Promise<ExtraFieldsData | null> {
        console.log(`Fetching extra fields for part: ${partId}`);

        // Use the extra fields endpoint
        const result = await this.makeRequest(`/api/part/get-extra-fields/${partId}`);

        console.log(`Extra fields API result for ${partId}:`, result);

        if (result.status === 200 && result.data) {
          const data = result.data as ExtraFieldsData;
          console.log(`Found ${data.ExtraFields?.length || 0} extra fields for ${partId}`);
          return data;
        }

        console.log(`No extra fields found for part:`, partId);
        return null;
      }
    }

    // Initialize client and authenticate
    const client = new BelidDebugClient(credentials.baseUrl);

    console.log("Authenticating with Belid API...");
    let authenticated = false;
    let authError = null;

    try {
      authenticated = await client.authenticate(credentials.username, credentials.password);
    } catch (error) {
      authError = error instanceof Error ? error.message : String(error);
      console.error("Authentication error:", authError);
    }

    if (!authenticated) {
      return NextResponse.json({
        error: "Failed to authenticate with Belid API",
        authError: authError,
        credentials: { username: credentials.username, baseUrl: credentials.baseUrl }
      }, { status: 500 });
    }

    console.log("Authentication successful, fetching data...");

    // Get categories
    const categories = await client.getAllCategories();
    console.log(`Found ${categories.length} categories`);

    // Use specific category, "Alla produkter" (DisplayId: 217), or first available
    let targetCategoryId = categoryId;
    if (!targetCategoryId) {
      // Look for "Alla produkter" category first
      const allaProduktCategory = categories.find(cat => {
        const category = cat as CategoryData;
        return category.DisplayId === 217 || category.Text === "Alla produkter";
      });
      const firstCategory = categories[0] as CategoryData | undefined;
      targetCategoryId = allaProduktCategory ? String((allaProduktCategory as CategoryData).DisplayId) : (categories.length > 0 ? String(firstCategory?.DisplayId) : null);
    }

    if (!targetCategoryId) {
      return NextResponse.json({
        error: "No categories found or invalid category structure",
        categories: categories,
        categoriesType: typeof categories,
        categoriesLength: categories.length
      }, { status: 500 });
    }

    // Get products from category and search for Herstal products
    const products = await client.getProductsInCategory(targetCategoryId);
    console.log(`Found ${products.length} products in category ${targetCategoryId}`);

    // Ensure products is an array
    const productsArray = Array.isArray(products) ? products : [];

    // Search for Herstal products specifically
    const herstalProducts = productsArray.filter(product => {
      const productData = product as ProductData;
      const brand = productData?.Traits?.find((t: TraitData) => t.GroupName === 'Varumärke')?.Name;
      return brand === 'Herstal';
    });

    console.log(`Found ${herstalProducts.length} Herstal products out of ${productsArray.length} total products`);

    // If we found Herstal products, use them; otherwise use first few products for debugging
    const limitedProducts = herstalProducts.length > 0
      ? herstalProducts.slice(0, Math.min(limit, herstalProducts.length))
      : productsArray.slice(0, limit);

    console.log(`Using ${limitedProducts.length} products for analysis`);
    if (limitedProducts[0]) {
      const firstProduct = limitedProducts[0] as ProductData;
      const brand = firstProduct?.Traits?.find((t: TraitData) => t.GroupName === 'Varumärke')?.Name || 'Unknown';
      console.log(`First product sample - PartId: ${firstProduct.PartId}, PartNumber: ${firstProduct.PartNumber}, Brand: ${brand}`);
    }
    const partIds = limitedProducts.map(p => (p as ProductData)?.PartId).filter((id): id is string => Boolean(id));

    // Get prices for products
    const prices = await client.getProductPrices(partIds);
    console.log(`Got prices for ${typeof prices === 'object' && !Array.isArray(prices) ? Object.keys(prices).length : Array.isArray(prices) ? prices.length : 0} products`);

    // Get balance/stock information for products
    const balanceData = await client.getProductBalance(partIds);

    // Get delivery time and extra fields for the first product (as example)
    let deliveryTime = null;
    let extraFields = null;
    if (limitedProducts.length > 0) {
      const firstProduct = limitedProducts[0] as ProductData;
      if (firstProduct?.PartId) {
        deliveryTime = await client.getDeliveryTime(firstProduct.PartId);
        extraFields = await client.getExtraFields(firstProduct.PartId);
      }
    }

    // Combine product and price data
    console.log(`Combining ${limitedProducts.length} products with ${prices.length} prices`);

    const combinedData = limitedProducts.map((product) => {
      const productData = product as ProductData;
      // The prices API returns an object keyed by PartId, not an array
      let priceInfo = null;
      if (typeof prices === 'object' && !Array.isArray(prices) && productData?.PartId) {
        // If prices is an object, get by PartId key directly
        priceInfo = prices[productData.PartId];
      } else if (Array.isArray(prices)) {
        // If prices is an array, find by PartId
        priceInfo = prices.find(p => (p as PriceData)?.PartId === productData?.PartId);
      }

      // Get balance info for this product from balanceData
      let balanceInfo = null;
      if (balanceData && productData?.PartId) {
        balanceInfo = balanceData[productData.PartId] || balanceData;
      }

      console.log(`Product ${productData?.PartId}: found price info = ${!!priceInfo}`, priceInfo ? Object.keys(priceInfo) : 'no price info');
      console.log(`Product ${productData?.PartId} balance/stock info:`, balanceInfo || productData?.Balance || 'no balance info');

      // Helper function to format price from strings like "1234.56 SEK" to float
      const formatPrice = (price: string | number | undefined | null): number => {
        if (typeof price === 'number') return price;
        if (typeof price === 'string') {
          const cleanPrice = price.replace(/[^\d.,]/g, '').replace(',', '.');
          return parseFloat(cleanPrice) || 0;
        }
        return 0;
      };

      // Helper function to extract gross price from strings like "Bruttopris: 1234.56 SEK"
      const extractGrossPrice = (grossPrice: string | number | undefined | null): number => {
        if (typeof grossPrice === 'string') {
          const cleanPrice = grossPrice.replace(/^Bruttopris:\s*/, '').replace(/[^\d.,]/g, '').replace(',', '.');
          return parseFloat(cleanPrice) || 0;
        }
        return formatPrice(grossPrice);
      };

      const priceData = priceInfo as PriceData;
      const supplierPrice = formatPrice(priceData?.ItemPriceValueWithoutVat);
      const grossPrice = extractGrossPrice(priceData?.GrossPrice);

      // Extract stock quantity from Balance field
      const extractStockQuantity = (balance: unknown): number => {
        if (!balance) return 0;
        if (typeof balance === 'object' && balance !== null && 'Balance' in balance) {
          // Extract number from strings like "Saldo 15 st."
          const balanceText = (balance as { Balance: string }).Balance;
          if (typeof balanceText === 'string') {
            const match = balanceText.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          }
        }
        if (typeof balance === 'string') {
          const match = balance.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }
        return 0;
      };

      const stockQuantity = extractStockQuantity(balanceInfo || productData?.Balance);

      // Helper function to parse delivery date from response
      const parseDeliveryDate = (deliveryResponse: string | null): { date: string | null; days: number | null } => {
        if (!deliveryResponse || typeof deliveryResponse !== 'string') {
          return { date: null, days: null };
        }

        // Extract date from "Beräknat leveransdatum ifrån oss: 2025-07-03"
        const dateMatch = deliveryResponse.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const deliveryDate = new Date(dateMatch[1]);
          const today = new Date();
          const diffTime = deliveryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            date: dateMatch[1],
            days: diffDays > 0 ? diffDays : 0
          };
        }

        return { date: null, days: null };
      };

      // Extract brand from Traits
      const extractBrand = (traits: unknown): string => {
        if (!Array.isArray(traits)) return 'Belid';
        for (const trait of traits) {
          if (typeof trait === 'object' && trait !== null && 'GroupName' in trait && 'Name' in trait) {
            const t = trait as { GroupName: string; Name: string };
            if (t.GroupName === 'Varumärke') {
              return t.Name;
            }
          }
        }
        return 'Belid';
      };

      // Calculate supplier recommended price: gross price + 25% tax, rounded to nearest 9
      const calculateRecommendedPrice = (grossPrice: number): number => {
        if (grossPrice <= 0) return 0;
        const withTax = grossPrice * 1.25; // Add 25% tax
        const rounded = Math.ceil(withTax / 10) * 10 - 1; // Round up to nearest 9 (e.g., 2479 -> 2489, 2480 -> 2489)
        return rounded;
      };

      // For the first product, include delivery time info
      const firstProductData = limitedProducts[0] as ProductData;
      const isFirstProduct = productData?.PartId === firstProductData?.PartId;
      const delivery = isFirstProduct ? parseDeliveryDate(deliveryTime) : { date: null, days: null };

      const brand = extractBrand(productData?.Traits);
      const recommendedPrice = calculateRecommendedPrice(grossPrice);

      // Create raw_data with Traits (without the brand trait) and extra fields for first product
      const traitsData = Array.isArray(productData?.Traits)
        ? productData.Traits.filter((trait: unknown) => {
            return !(typeof trait === 'object' && trait !== null && 'GroupName' in trait && (trait as { GroupName: string }).GroupName === 'Varumärke');
          })
        : [];

      const rawData = {
        traits: traitsData,
        extraFields: isFirstProduct ? (extraFields?.ExtraFields || []) : []
      };

      return {
        product: productData,
        priceInfo: priceData,
        balanceInfo: balanceInfo,
        deliveryInfo: isFirstProduct ? deliveryTime : null,
        formatted: {
          name: productData?.Description || `Belid ${productData?.PartNumber || productData?.PartId}`,
          sku: productData?.PartNumber,
          brand: brand,
          ean: productData?.GS1Code,
          partId: productData?.PartId,
          supplier_price: supplierPrice,
          gross_price: grossPrice,
          supplier_recommended_price: recommendedPrice,
          discount: parseInt(String(priceData?.Discount)) || 0,
          is_campaign: !!(priceData?.PriceBeforeCampaign && priceData?.CampaignColor),
          stock_quantity: stockQuantity,
          stock_status: stockQuantity > 0 ? `In Stock (${stockQuantity})` : 'Out of Stock',
          is_in_stock: balanceInfo?.IsInStock || false,
          lead_time_days: delivery.days,
          availability_date: delivery.date,
          currency: priceData?.Currency || 'SEK',
          raw_data: rawData
        }
      };
    });

    // Get Herstal products count for summary
    const herstalCount = productsArray.filter(product => {
      const productData = product as ProductData;
      const brand = productData?.Traits?.find((t: TraitData) => t.GroupName === 'Varumärke')?.Name;
      return brand === 'Herstal';
    }).length;

    return NextResponse.json({
      success: true,
      summary: {
        authenticated: true,
        totalCategories: categories.length,
        usedCategoryId: targetCategoryId,
        totalProductsInCategory: products.length,
        herstalProductsFound: herstalCount,
        returnedProducts: combinedData.length,
        pricesRetrieved: typeof prices === 'object' && !Array.isArray(prices) ? Object.keys(prices).length : Array.isArray(prices) ? prices.length : 0,
        brandsFound: [...new Set(productsArray.map(p => (p as ProductData)?.Traits?.find((t: TraitData) => t.GroupName === 'Varumärke')?.Name || 'Unknown'))]
      },
      products: combinedData
    });

  } catch (error) {
    console.error("Belid API debug error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch Belid data",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
