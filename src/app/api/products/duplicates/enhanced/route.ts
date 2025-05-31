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

interface BasicDuplicateGroup {
  group_id: string;
  match_reason: string;
  products: BasicDuplicateItem[];
}

interface ProductDetails {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
  our_price: number | null;
  wholesale_price: number | null;
  currency_code: string | null;
  url: string | null;
  image_url: string | null;
  category: string | null;
  description: string | null;
}

interface PriceData {
  new_price: number;
  currency_code: string;
  source_name: string;
  source_type: string;
  source_platform?: string;
  source_website?: string;
  changed_at: string;
  url?: string;
}

interface PriceInfo {
  price: number;
  currency: string;
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

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);

    const supabase = createSupabaseAdminClient();

    // Get potential duplicates with basic info - try calling the basic API first
    const duplicatesData: BasicDuplicateItem[] = [];

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/products/duplicates`, {
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });

      if (!response.ok) {
        throw new Error(`Basic duplicates API failed: ${response.status}`);
      }

      const basicDuplicates = await response.json();

      // Extract products from the grouped response
      if (Array.isArray(basicDuplicates)) {
        basicDuplicates.forEach((group: BasicDuplicateGroup) => {
          if (group.products && Array.isArray(group.products)) {
            duplicatesData.push(...group.products);
          }
        });
      }

    } catch (err) {
      console.error("Exception calling basic duplicates API:", err);
      return NextResponse.json(
        {
          error: "Exception calling basic duplicates API",
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

    // Fetch product details
    let productsData: ProductDetails[] = [];
    let productsError = null;

    try {
      // Test with just the first product ID
      const testId = productIds[0];

      const testResult = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("id", testId)
        .eq("user_id", userId)
        .single();

      if (testResult.error) {
        return NextResponse.json(
          {
            error: "Test query failed",
            message: testResult.error.message,
            details: testResult.error
          },
          { status: 500 }
        );
      }

      // If test passes, try a small batch
      const smallBatch = productIds.slice(0, 5);

      const result = await supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          ean,
          brand,
          brand_id,
          our_price,
          wholesale_price,
          currency_code,
          url,
          image_url,
          category,
          description
        `)
        .in("id", smallBatch)
        .eq("user_id", userId);

      if (result.error) {
        productsError = result.error;
      } else {
        productsData = result.data || [];
      }

    } catch (err) {
      return NextResponse.json(
        {
          error: "Exception in product query test",
          message: err instanceof Error ? err.message : String(err),
          details: err instanceof Error ? err.stack : String(err)
        },
        { status: 500 }
      );
    }

    if (productsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch product details",
          message: productsError.message,
          details: productsError
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

    // Fetch prices for each product using the database function
    try {
      for (const productId of productIds) { // Process all products

        const { data: pricesData, error: pricesError } = await supabase.rpc(
          'get_latest_competitor_prices',
          {
            p_user_id: userId,
            p_product_id: productId
          }
        );

        if (pricesError) {
          continue;
        }

        if (pricesData && pricesData.length > 0) {
          const prices = {
            our_prices: [] as Array<{
              price: number;
              currency: string;
              source: string;
              platform?: string;
              updated_at: string;
              url?: string;
            }>,
            competitor_prices: [] as Array<{
              price: number;
              currency: string;
              source: string;
              website?: string;
              updated_at: string;
              url?: string;
            }>
          };

          pricesData.forEach((price: PriceData) => {
            if (price.source_type === 'integration') {
              prices.our_prices.push({
                price: price.new_price,
                currency: price.currency_code,
                source: price.source_name,
                platform: price.source_platform,
                updated_at: price.changed_at,
                url: price.url
              });
            } else if (price.source_type === 'competitor') {
              prices.competitor_prices.push({
                price: price.new_price,
                currency: price.currency_code,
                source: price.source_name,
                website: price.source_website,
                updated_at: price.changed_at,
                url: price.url
              });
            }
          });

          productPricesMap.set(productId, prices);
        }
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
