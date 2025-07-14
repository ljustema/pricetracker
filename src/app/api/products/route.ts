import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';

// Type definitions for the RPC function response data
interface CompetitorPriceItem {
  competitor_id?: string;
  integration_id?: string;
  competitor_price: number | null;
  competitor_name?: string;
}

interface SourcePriceItem {
  supplier_id?: string;
  integration_id?: string;
  supplier_price: number | null;
  supplier_name?: string;
}

interface RawProductData {
  competitor_prices?: CompetitorPriceItem[];
  source_prices?: SourcePriceItem[];
  brand_name?: string | null; // Brand name from brands table join
  brand?: string | null; // Legacy brand field from products table
  [key: string]: unknown;
}

// GET handler to fetch all products for the current user
export async function POST(request: NextRequest) { // Changed from GET to POST
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // User creation is now handled by the get_products_filtered function

    // --- Start: Product Fetching Logic using RPC ---

    const body = await request.json(); // Read parameters from request body

    // Prepare parameters for the RPC call, converting types as needed
    const rpcParams = {
      p_user_id: userId,
      p_page: parseInt(body.page || "1", 10),
      p_page_size: parseInt(body.pageSize || "16", 10),
      p_sort_by: body.sortBy || "created_at",
      p_sort_order: body.sortOrder || "desc",
      p_brand: body.brand || null, // Pass brand ID from the brands table
      p_category: body.category || null, // Pass null if empty/undefined
      p_search: body.search || null, // Pass null if empty/undefined
      // Convert isActive: Frontend sends 'true' or undefined (for active) or false (for inactive)
      // Function expects true (active), false (inactive), or null (don't filter)
      p_is_active: body.isActive === 'true' ? true : (body.isActive === false ? false : null),
      p_competitor_ids: (() => {
        // Handle multiple competitor IDs - now using array parameter
        const competitorIds = body.sourceId || body.competitor;
        if (Array.isArray(competitorIds)) {
          return competitorIds.length > 0 ? competitorIds : null;
        }
        return competitorIds ? [competitorIds] : null;
      })(),
      // Convert has_price: Frontend sends true or undefined
      // Function expects true or null
      p_has_price: body.has_price === true ? true : null,
      // Convert not_our_products: Frontend sends true or undefined
      // Function expects true or null
      p_not_our_products: body.not_our_products === true ? true : null,
      // Convert supplier filter: Frontend sends array or undefined
      // Function expects array or null
      p_supplier_ids: (() => {
        // Handle multiple supplier IDs - now using array parameter
        const supplierIds = body.supplierId;
        if (Array.isArray(supplierIds)) {
          return supplierIds.length > 0 ? supplierIds : null;
        }
        return supplierIds ? [supplierIds] : null;
      })(),
      // Add new price comparison filters
      p_price_lower_than_competitors: body.price_lower_than_competitors === true ? true : null,
      p_price_higher_than_competitors: body.price_higher_than_competitors === true ? true : null,
      // Add new stock filter
      p_in_stock_only: body.in_stock_only === true ? true : null,
      // Add new combined filters
      p_our_products_with_competitor_prices: body.our_products_with_competitor_prices === true ? true : null,
      p_our_products_with_supplier_prices: body.our_products_with_supplier_prices === true ? true : null
    };

    // Execute the RPC call
    const { data: rpcResult, error } = await supabase.rpc('get_products_filtered', rpcParams);

    if (error) {
      console.error("Error calling get_products_filtered RPC:", error);
      return NextResponse.json(
        { error: "Database error: " + error.message },
        { status: 500 }
      );
    }

    // The RPC function returns a JSON object like { "data": [], "totalCount": 0 }
    // Extract data and count from the result
    const rawData = rpcResult?.data || [];
    const count = rpcResult?.totalCount || 0;

    // Transform the data to match the expected Product interface format
    const transformedData = rawData.map((product: RawProductData) => {
      // Transform competitor_prices from array to object format
      const competitor_prices: { [key: string]: number } = {};
      if (Array.isArray(product.competitor_prices)) {
        product.competitor_prices.forEach((item: CompetitorPriceItem) => {
          if (item.competitor_id && item.competitor_price !== null && item.competitor_price !== undefined) {
            competitor_prices[item.competitor_id] = item.competitor_price;
          }
          if (item.integration_id && item.competitor_price !== null && item.competitor_price !== undefined) {
            competitor_prices[item.integration_id] = item.competitor_price;
          }
        });
      }

      // Transform source_prices from array to object format
      const source_prices: { [key: string]: { price: number; source_type: 'competitor' | 'integration'; source_name: string; } } = {};
      if (Array.isArray(product.competitor_prices)) {
        product.competitor_prices.forEach((item: CompetitorPriceItem) => {
          if (item.competitor_price !== null && item.competitor_price !== undefined) {
            const sourceId = item.competitor_id || item.integration_id;
            const sourceType = item.competitor_id ? 'competitor' : 'integration';
            if (sourceId && item.competitor_name) {
              source_prices[sourceId] = {
                price: item.competitor_price,
                source_type: sourceType,
                source_name: item.competitor_name
              };
            }
          }
        });
      }

      // Also process source_prices array if it exists
      if (Array.isArray(product.source_prices)) {
        product.source_prices.forEach((item: SourcePriceItem) => {
          if (item.supplier_price !== null && item.supplier_price !== undefined) {
            const sourceId = item.supplier_id || item.integration_id;
            const sourceType = item.supplier_id ? 'competitor' : 'integration'; // Suppliers are treated as competitors in the UI
            if (sourceId && item.supplier_name) {
              source_prices[sourceId] = {
                price: item.supplier_price,
                source_type: sourceType,
                source_name: item.supplier_name
              };
            }
          }
        });
      }

      return {
        ...product,
        // Map brand_name from database to brand for frontend compatibility
        brand: product.brand_name || product.brand || null,
        competitor_prices,
        source_prices
      };
    });

    // Return paginated data and total count
    return NextResponse.json({
      data: transformedData || [], // Ensure data is always an array
      totalCount: count || 0, // Total count matching filters
    });
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      {
        error: `Internal Server Error: ${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
      },
      { status: 500 }
    );
  }
}

// POST handler for creating products has been moved to /api/products/create/route.ts