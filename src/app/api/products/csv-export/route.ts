import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils/uuid";

interface ProductForExport {
  id: string;
  name: string;
  sku: string;
  ean: string;
  brand: string;
  brand_name?: string; // Add brand_name property from database
  image_url: string;
  our_retail_price: number | null;
  our_wholesale_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  source_prices?: Record<string, { price: number }>;
}

export async function POST(request: NextRequest) {
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

    // Parse the request body to get filter parameters
    const body = await request.json();

    // Get the user ID
    const userId = ensureUUID(session.user.id);

    // Create a Supabase client
    const supabase = createSupabaseAdminClient();

    // Prepare parameters for the RPC call, converting types as needed
    const rpcParams = {
      p_user_id: userId,
      p_page: 1, // Start from first page
      p_page_size: 1000, // Get a large number of products
      p_sort_by: body.sortBy || "created_at",
      p_sort_order: body.sortOrder || "desc",
      p_brand: body.brand || null,
      p_category: body.category || null,
      p_search: body.search || null,
      p_is_active: body.isActive === true ? true : (body.isActive === false ? false : null),
      p_competitor_ids: (() => {
        // Handle multiple competitor IDs - now using array parameter
        const competitorIds = body.sourceId;
        if (Array.isArray(competitorIds)) {
          return competitorIds.length > 0 ? competitorIds : null;
        }
        return competitorIds ? [competitorIds] : null;
      })(),
      p_has_price: (() => {
        // Handle price filter logic to match database function expectations
        if (body.notOurProducts === true) {
          return null; // When filtering for "not our products", p_has_price should be null
        }
        if (body.hasPrice === true) {
          return true; // When filtering for "our products", p_has_price should be true
        }
        return null; // Default case - no price filter
      })(),
      p_not_our_products: (() => {
        // Handle not our products filter logic
        if (body.hasPrice === true) {
          return null; // When filtering for "our products", p_not_our_products should be null
        }
        if (body.notOurProducts === true) {
          return true; // When filtering for "not our products", p_not_our_products should be true
        }
        return null; // Default case - no filter
      })(),
      p_price_lower_than_competitors: body.price_lower_than_competitors || null,
      p_price_higher_than_competitors: body.price_higher_than_competitors || null,
      p_in_stock_only: body.in_stock_only === true ? true : null, // Add missing parameter
      p_supplier_ids: (() => {
        const supplierIds = body.supplierId;
        if (Array.isArray(supplierIds)) {
          return supplierIds.length > 0 ? supplierIds : null;
        }
        return supplierIds ? [supplierIds] : null;
      })(),
    };

    // Fetch all products using pagination
    let allProducts: ProductForExport[] = [];
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 1000; // Maximum page size

    do {
      // Update page number in parameters
      rpcParams.p_page = currentPage;
      rpcParams.p_page_size = pageSize;

      // Call the RPC function to get filtered products for this page
      const { data: rpcResult, error } = await supabase.rpc(
        'get_products_filtered',
        rpcParams
      );

      if (error) {
        console.error(`Error fetching products for CSV export (page ${currentPage}):`, error);
        return NextResponse.json(
          { error: `Failed to fetch products: ${error.message}` },
          { status: 500 }
        );
      }

      // The RPC function returns a JSON object like { "data": [], "totalCount": 0 }
      const pageData = rpcResult?.data || [];
      const totalCount = rpcResult?.totalCount || 0;

      // Add this page's products to our collection
      allProducts = [...allProducts, ...pageData];

      // Calculate total pages
      totalPages = Math.ceil(totalCount / pageSize);

      // Move to next page
      currentPage++;

    } while (currentPage <= totalPages);

    // Use all collected products for the CSV and map brand_name to brand
    const data = allProducts.map(product => ({
      ...product,
      // Map brand_name from database to brand for CSV compatibility
      brand: product.brand_name || product.brand || null
    }));

    // Get all competitors for this user to include their names in the CSV
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('user_id', userId);

    const competitorMap = new Map();
    if (competitors) {
      competitors.forEach(comp => {
        competitorMap.set(comp.id, comp.name);
      });
    }

    // Get custom fields for this user
    const { error: customFieldsError } = await supabase
      .from('product_custom_fields')
      .select('id, field_name')
      .eq('user_id', userId)
      .order('field_name');

    if (customFieldsError) {
      console.error('Error fetching custom fields:', customFieldsError);
    }

    // Get custom field values for all products
    const productIds = data.map(p => p.id);

    // Fetch custom field values in batches to avoid "414 Request-URI Too Large" error
    const customFieldMap = new Map();
    const batchSize = 100; // Process 100 product IDs at a time

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batchIds = productIds.slice(i, i + batchSize);

      let query = supabase
        .from('product_custom_field_values')
        .select(`
          product_id,
          custom_field_id,
          value,
          product_custom_fields (
            field_name
          )
        `)
        .in('product_id', batchIds)
        .not('value', 'is', null) // Only get records with actual values
        .neq('value', ''); // Exclude empty strings

      // Add source type filter if requested
      if (body.supplierFieldsOnly === true) {
        query = query.eq('source_type', 'supplier');
      }

      const { data: batchCustomFieldValues, error: customFieldError } = await query;

      if (customFieldError) {
        console.error('Error fetching custom field values for batch:', customFieldError);
        continue; // Continue with next batch even if one fails
      }

      // Process this batch's results
      if (batchCustomFieldValues) {
        batchCustomFieldValues.forEach(cfv => {
          if (!customFieldMap.has(cfv.product_id)) {
            customFieldMap.set(cfv.product_id, new Map());
          }
          // Handle the nested structure from the join
          const fieldName = (cfv.product_custom_fields as unknown as { field_name: string } | null)?.field_name;
          if (fieldName && cfv.value && cfv.value.trim() !== '') {
            customFieldMap.get(cfv.product_id).set(fieldName, cfv.value);
          }
        });
      }
    }

    // Define CSV headers - removed id, category, description as requested
    const headers = [
      "name",
      "sku",
      "ean",
      "brand",
      "image_url",
      "our_price",
      "wholesale_price",
      "is_active",
      "created_at",
      "updated_at"
    ];

    // Add competitor price headers if any products have competitor prices
    const competitorPriceHeaders = new Set<string>();

    // Get our own integration ID to filter it out
    const { data: ourIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_our_store', true)
      .maybeSingle();

    const ourIntegrationId = ourIntegration?.id;


    data.forEach(product => {
      if (product.source_prices) {
        Object.keys(product.source_prices).forEach(sourceId => {
          // Skip our own integration
          if (sourceId === ourIntegrationId) {
            return;
          }

          // Only include if we have a name for this competitor
          const sourceName = competitorMap.get(sourceId);
          if (sourceName) {
            competitorPriceHeaders.add(`competitor_price_${sourceName}`);
          }
        });
      }
    });



    // Add custom field headers - only include fields that have values in the current result set
    const customFieldHeaders: string[] = [];
    const usedCustomFields = new Set<string>();

    // Collect all custom field names that have values in the current products
    customFieldMap.forEach(productFields => {
      productFields.forEach((value: string, fieldName: string) => {
        if (value && value.trim() !== '') {
          usedCustomFields.add(fieldName);
        }
      });
    });

    // Convert to sorted array for consistent column order
    customFieldHeaders.push(...Array.from(usedCustomFields).sort());

    // Combine all headers
    const allHeaders = [...headers, ...Array.from(competitorPriceHeaders), ...customFieldHeaders];

    // Build the CSV content
    let csvContent = allHeaders.join(",") + "\n";

    // Add product rows
    data.forEach(product => {
      const row = [
        escapeCsvValue(product.name),
        escapeCsvValue(product.sku),
        escapeCsvValue(product.ean),
        escapeCsvValue(product.brand),
        escapeCsvValue(product.image_url),
        product.our_retail_price ? `"${String(product.our_retail_price).replace('.', ',')}"` : '',
        product.our_wholesale_price ? `"${String(product.our_wholesale_price).replace('.', ',')}"` : '',
        product.is_active,
        product.created_at,
        product.updated_at
      ];

      // Add competitor prices
      competitorPriceHeaders.forEach(header => {
        const headerName = header.replace('competitor_price_', '');
        let price = '';

        if (product.source_prices) {
          // Find the competitor ID that matches this header name
          // Convert Map to array of entries and find the matching entry
          const matchingEntry = Array.from(competitorMap.entries()).find(
            ([_, name]) => name === headerName
          );

          const matchingSourceId = matchingEntry ? matchingEntry[0] : undefined;



          if (matchingSourceId && product.source_prices[matchingSourceId]) {
            const priceValue = product.source_prices[matchingSourceId].price;
            price = priceValue ? `"${String(priceValue).replace('.', ',')}"` : '';
          }
        }

        row.push(price);
      });

      // Add custom field values
      customFieldHeaders.forEach(fieldName => {
        const productCustomFields = customFieldMap.get(product.id);
        const value = productCustomFields ? productCustomFields.get(fieldName) : '';
        row.push(escapeCsvValue(value));
      });

      csvContent += row.join(",") + "\n";
    });

    // Set the response headers for a CSV file download
    const headers_response = new Headers();
    headers_response.set("Content-Type", "text/csv");

    // Create a simple filename with the date
    const today = new Date().toISOString().split("T")[0];
    headers_response.set("Content-Disposition", `attachment; filename=products_${today}.csv`);

    return new NextResponse(csvContent, {
      status: 200,
      headers: headers_response
    });
  } catch (error) {
    console.error("Error generating products CSV:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Helper function to escape CSV values
function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains commas, quotes, or newlines, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Double up any quotes within the value
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
