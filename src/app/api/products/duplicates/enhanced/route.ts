import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import crypto from 'crypto';

// Type definitions
interface BasicDuplicateItem {
  product_id: string;
  group_id: string;
  match_reason: string;
}



interface ProductDetails {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
  our_retail_price: number | null;
  our_wholesale_price: number | null;
  currency_code: string | null;
  url: string | null;
  image_url: string | null;
  category: string | null;
  description: string | null;
}

interface PriceData {
  id: string;
  product_id: string;
  competitor_id?: string;
  integration_id?: string;
  old_competitor_price?: number;
  new_competitor_price?: number;
  old_our_retail_price?: number;
  new_our_retail_price?: number;
  price_change_percentage?: number;
  currency_code: string;
  changed_at: string;
  source_type: string;
  source_name: string;
  source_website?: string;
  source_platform?: string;
  source_id: string;
  url?: string;
}

interface PriceInfo {
  price: number;
  currency_code: string;
  source: string;
  platform?: string;
  website?: string;
  updated_at: string;
  url?: string;
}

interface ProductPrices {
  our_prices: PriceInfo[];
  competitor_prices: PriceInfo[];
}

interface EnhancedProduct extends BasicDuplicateItem, Partial<ProductDetails> {
  prices?: ProductPrices;
}

interface EnhancedDuplicateGroup {
  group_id: string;
  match_reason: string;
  products: EnhancedProduct[];
}

// Helper function to ensure user ID is a valid UUID
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID from the ID
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    const supabase = createSupabaseAdminClient();

    // Get potential duplicates directly from database function for better performance
    const duplicatesData: BasicDuplicateItem[] = [];

    try {
      const { data, error } = await supabase.rpc(
        "find_potential_duplicates",
        {
          p_user_id: userId,
          p_limit: 200  // Limit results for better performance
        }
      );

      if (error) {
        console.error("Error finding potential duplicates:", error);
        return NextResponse.json(
          {
            error: "Failed to find potential duplicates",
            details: error.message,
            code: error.code
          },
          { status: 500 }
        );
      }

      if (data && data.length > 0) {
        duplicatesData.push(...data);
      }

    } catch (err) {
      console.error("Exception calling find_potential_duplicates:", err);
      return NextResponse.json(
        {
          error: "Exception calling find_potential_duplicates",
          message: err instanceof Error ? err.message : String(err),
          details: err instanceof Error ? err.stack : String(err)
        },
        { status: 500 }
      );
    }

    if (!duplicatesData || duplicatesData.length === 0) {
      return NextResponse.json([]);
    }

    // Get all unique product IDs
    const productIds = [...new Set(duplicatesData.map((item: BasicDuplicateItem) => item.product_id))];

    // Fetch product details for all duplicate products
    let productsData: ProductDetails[] = [];

    try {
      const result = await supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          ean,
          brand,
          brand_id,
          our_retail_price,
          our_wholesale_price,
          currency_code,
          url,
          image_url,
          category,
          description
        `)
        .in("id", productIds)
        .eq("user_id", userId);

      if (result.error) {
        return NextResponse.json(
          {
            error: "Failed to fetch product details",
            message: result.error.message,
            details: result.error
          },
          { status: 500 }
        );
      }

      productsData = result.data || [];

    } catch (err) {
      return NextResponse.json(
        {
          error: "Exception in product query",
          message: err instanceof Error ? err.message : String(err),
          details: err instanceof Error ? err.stack : String(err)
        },
        { status: 500 }
      );
    }

    // Fetch price data using the database function

    // Create a map of product details
    const productDetailsMap = new Map<string, ProductDetails>();
    productsData?.forEach((product: ProductDetails) => {
      productDetailsMap.set(product.id, product);
    });

    // Create a map of latest prices for each product
    const productPricesMap = new Map<string, ProductPrices>();

    // Fetch prices for all products in a single batch query to avoid N+1 problem
    try {
      // Use the new batch function to get latest prices for all products at once
      const { data: allPricesData, error: pricesError } = await supabase.rpc(
        'get_latest_competitor_prices_batch',
        {
          p_user_id: userId,
          p_product_ids: productIds
        }
      );

      if (!pricesError && allPricesData) {
        // Group prices by product_id
        const pricesByProduct = new Map<string, PriceData[]>();

        allPricesData.forEach((price: PriceData) => {
          if (!pricesByProduct.has(price.product_id)) {
            pricesByProduct.set(price.product_id, []);
          }
          pricesByProduct.get(price.product_id)!.push(price);
        });

        // Convert to the expected format
        pricesByProduct.forEach((pricesArray, productId) => {
          const prices = {
            our_prices: [] as Array<{
              price: number;
              currency_code: string; // Fixed: use currency_code instead of currency
              source: string;
              platform?: string;
              updated_at: string;
              url?: string;
            }>,
            competitor_prices: [] as Array<{
              price: number;
              currency_code: string; // Fixed: use currency_code instead of currency
              source: string;
              website?: string;
              updated_at: string;
              url?: string;
            }>
          };

          pricesArray.forEach((price: PriceData) => {
            if (price.source_type === 'integration') {
              prices.our_prices.push({
                price: price.new_our_retail_price || 0, // Use new_our_retail_price for integration prices
                currency_code: price.currency_code,
                source: price.source_name,
                platform: price.source_platform,
                updated_at: price.changed_at,
                url: price.url
              });
            } else if (price.source_type === 'competitor') {
              prices.competitor_prices.push({
                price: price.new_competitor_price || 0, // Use new_competitor_price for competitor prices
                currency_code: price.currency_code,
                source: price.source_name,
                website: price.source_website,
                updated_at: price.changed_at,
                url: price.url
              });
            }
          });

          productPricesMap.set(productId, prices);
        });
      }

    } catch (_err) {
      // Continue without price data rather than failing
    }

    // Enhance duplicates data with product details and prices
    const enhancedDuplicates: EnhancedProduct[] = duplicatesData.map((duplicate: BasicDuplicateItem) => {
      const productDetails = productDetailsMap.get(duplicate.product_id) || {};
      const priceInfo = productPricesMap.get(duplicate.product_id) || {
        our_prices: [],
        competitor_prices: []
      };

      return {
        ...duplicate,
        ...productDetails,
        prices: priceInfo
      };
    });

    // Group duplicates by group_id
    const groupedDuplicates = enhancedDuplicates.reduce((acc: Record<string, EnhancedDuplicateGroup>, product: EnhancedProduct) => {
      const key = product.group_id;

      if (!acc[key]) {
        acc[key] = {
          group_id: product.group_id,
          match_reason: product.match_reason,
          products: []
        };
      }
      acc[key].products.push(product);
      return acc;
    }, {} as Record<string, EnhancedDuplicateGroup>);

    return NextResponse.json(Object.values(groupedDuplicates));
  } catch (error) {
    console.error("Error in enhanced duplicates API route:", error);

    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}
