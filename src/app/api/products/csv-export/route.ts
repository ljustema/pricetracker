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
      p_our_products_with_competitor_prices: body.our_products_with_competitor_prices === true ? true : null,
      p_our_products_with_supplier_prices: body.our_products_with_supplier_prices === true ? true : null,
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

    // Note: our_wholesale_price is now included in get_products_filtered RPC function

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

      // Add source type filter based on checkboxes
      const sourceTypes = [];
      if (body.includeCompetitorFields === true) {
        sourceTypes.push('competitor');
      }
      if (body.includeSupplierFields === true) {
        sourceTypes.push('supplier');
      }

      // Only apply filter if at least one type is selected
      if (sourceTypes.length > 0) {
        query = query.in('source_type', sourceTypes);
      } else {
        // If no custom fields are selected, don't fetch any custom fields
        // Use a UUID that doesn't exist instead of -1
        query = query.eq('product_id', '00000000-0000-0000-0000-000000000000');
      }

      const { data: batchCustomFieldValues, error: customFieldError } = await query;

      if (customFieldError) {
        console.error('Error fetching custom field values for batch:', customFieldError);
        continue; // Continue with next batch even if one fails
      }

      // Process this batch's results
      if (batchCustomFieldValues) {
        batchCustomFieldValues.forEach((cfv: {
          product_id: string;
          custom_field_id: string;
          value: string;
          product_custom_fields: { field_name: string }[];
        }) => {
          if (!customFieldMap.has(cfv.product_id)) {
            customFieldMap.set(cfv.product_id, new Map());
          }
          // Handle the nested structure from the join
          const fieldName = (cfv.product_custom_fields as unknown as { field_name: string } | null)?.field_name;
          if (fieldName && cfv.value && cfv.value.trim() !== '') {
            customFieldMap.get(cfv.product_id)!.set(fieldName, cfv.value);
          }
        });
      }
    }

    // Fetch competitor and supplier prices and stock if needed
    const competitorPricesMap = new Map<string, Array<{
      competitor_id?: string;
      integration_id?: string;
      product_id: string;
      source_name: string;
      new_price: number;
      new_competitor_price?: number;
      new_our_retail_price?: number;
      created_at: string;
    }>>();
    const supplierPricesMap = new Map<string, Array<{
      supplier_id?: string;
      integration_id?: string;
      product_id: string;
      source_name: string;
      new_price: number;
      new_supplier_price?: number;
      new_supplier_recommended_price?: number;
      created_at: string;
    }>>();
    const competitorStockMap = new Map<string, Array<{
      competitor_id?: string;
      integration_id?: string;
      product_id: string;
      source_name: string;
      new_stock_quantity: number;
      current_stock_quantity?: number;
      created_at: string;
    }>>();
    const supplierStockMap = new Map<string, Array<{
      supplier_id?: string;
      integration_id?: string;
      product_id: string;
      source_name: string;
      supplier_name?: string;
      integration_name?: string;
      new_stock_quantity: number;
      created_at: string;
    }>>();

    if (body.includeCompetitorPrices || body.includeSupplierPrices || body.includeCompetitorStock || body.includeSupplierStock) {
      // Get competitor prices using batch function in smaller chunks to avoid 1000 record limit
      if (body.includeCompetitorPrices) {
        try {
          const pricesBatchSize = 500; // Smaller batch size to avoid hitting 1000 record limit
          for (let i = 0; i < productIds.length; i += pricesBatchSize) {
            const batchIds = productIds.slice(i, i + pricesBatchSize);

            // Use filtered function if competitor filter is applied, otherwise use regular function
            const competitorIds = rpcParams.p_competitor_ids;
            const { data: allCompetitorPrices, error: competitorError } = await supabase
              .rpc(competitorIds ? 'get_latest_competitor_prices_batch_filtered' : 'get_latest_competitor_prices_batch', {
                p_user_id: userId,
                p_product_ids: batchIds,
                ...(competitorIds && { p_competitor_ids: competitorIds })
              });

            if (competitorError) {
              console.error('Error fetching competitor prices for batch:', competitorError);
              continue;
            }

            if (allCompetitorPrices) {
              // Filter out our own integration prices - only include actual competitor prices
              const competitorPrices = allCompetitorPrices.filter((price: {
                competitor_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                new_price: number;
                created_at: string;
              }) =>
                price.competitor_id && !price.integration_id
              );

              console.log(`Fetched ${allCompetitorPrices.length} total price records, filtered to ${competitorPrices.length} competitor prices`);

              // Group by product_id
              competitorPrices.forEach((price: {
                competitor_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                new_price: number;
                created_at: string;
              }) => {
                if (!competitorPricesMap.has(price.product_id)) {
                  competitorPricesMap.set(price.product_id, []);
                }
                competitorPricesMap.get(price.product_id)!.push(price);
              });
            }
          }
          console.log(`Competitor prices grouped for ${competitorPricesMap.size} products`);
        } catch (error) {
          console.error('Error fetching competitor prices:', error);
        }
      }

      // Get supplier prices using batch function in smaller chunks to avoid 1000 record limit
      if (body.includeSupplierPrices) {
        try {
          const pricesBatchSize = 500; // Smaller batch size to avoid hitting 1000 record limit
          for (let i = 0; i < productIds.length; i += pricesBatchSize) {
            const batchIds = productIds.slice(i, i + pricesBatchSize);

            const { data: allSupplierPrices, error: supplierError } = await supabase
              .rpc('get_latest_supplier_prices_batch', {
                p_user_id: userId,
                p_product_ids: batchIds
              });

            if (supplierError) {
              console.error('Error fetching supplier prices for batch:', supplierError);
              continue;
            }

            if (allSupplierPrices) {
              // Filter out our own integration prices - only include actual supplier prices
              const supplierPrices = allSupplierPrices.filter((price: {
                supplier_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                new_price: number;
                created_at: string;
              }) =>
                price.supplier_id && !price.integration_id
              );

              console.log(`Fetched ${allSupplierPrices.length} total supplier price records, filtered to ${supplierPrices.length} supplier prices`);

              // Group by product_id
              supplierPrices.forEach((price: {
                supplier_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                new_price: number;
                created_at: string;
              }) => {
                if (!supplierPricesMap.has(price.product_id)) {
                  supplierPricesMap.set(price.product_id, []);
                }
                supplierPricesMap.get(price.product_id)!.push(price);
              });
            }
          }
          console.log(`Supplier prices grouped for ${supplierPricesMap.size} products`);
        } catch (error) {
          console.error('Error fetching supplier prices:', error);
        }
      }

      // Get competitor stock using batch function in smaller chunks to avoid 1000 record limit
      if (body.includeCompetitorStock) {
        try {
          const stockBatchSize = 500; // Smaller batch size to avoid hitting 1000 record limit
          for (let i = 0; i < productIds.length; i += stockBatchSize) {
            const batchIds = productIds.slice(i, i + stockBatchSize);

            const { data: allCompetitorStock, error: competitorStockError } = await supabase
              .rpc('get_latest_competitor_stock_batch', {
                p_user_id: userId,
                p_product_ids: batchIds
              });

            if (competitorStockError) {
              console.error('Error fetching competitor stock for batch:', competitorStockError);
              continue;
            }

            if (allCompetitorStock) {
              // Filter out our own integration stock - only include actual competitor stock
              const competitorStock = allCompetitorStock.filter((stock: {
                competitor_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                new_stock_quantity: number;
                current_stock_quantity?: number;
                created_at: string;
              }) =>
                stock.competitor_id && !stock.integration_id
              );

              console.log(`Fetched ${allCompetitorStock.length} total competitor stock records, filtered to ${competitorStock.length} competitor stock`);

              // Group by product_id
              competitorStock.forEach((stock: {
                competitor_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                new_stock_quantity: number;
                current_stock_quantity?: number;
                created_at: string;
              }) => {
                if (!competitorStockMap.has(stock.product_id)) {
                  competitorStockMap.set(stock.product_id, []);
                }
                competitorStockMap.get(stock.product_id)!.push(stock);
              });
            }
          }
          console.log(`Competitor stock grouped for ${competitorStockMap.size} products`);
        } catch (error) {
          console.error('Error fetching competitor stock:', error);
        }
      }

      // Get supplier stock using batch function in smaller chunks to avoid 1000 record limit
      if (body.includeSupplierStock) {
        try {
          const stockBatchSize = 500; // Smaller batch size to avoid hitting 1000 record limit
          for (let i = 0; i < productIds.length; i += stockBatchSize) {
            const batchIds = productIds.slice(i, i + stockBatchSize);

            const { data: allSupplierStock, error: supplierStockError } = await supabase
              .rpc('get_latest_supplier_stock_batch', {
                p_user_id: userId,
                p_product_ids: batchIds
              });

            if (supplierStockError) {
              console.error('Error fetching supplier stock for batch:', supplierStockError);
              continue;
            }

            if (allSupplierStock) {
              // Filter out our own integration stock - only include actual supplier stock
              const supplierStock = allSupplierStock.filter((stock: {
                supplier_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                supplier_name?: string;
                integration_name?: string;
                new_stock_quantity: number;
                created_at: string;
              }) =>
                stock.supplier_id && !stock.integration_id
              );

              console.log(`Fetched ${allSupplierStock.length} total supplier stock records, filtered to ${supplierStock.length} supplier stock`);

              // Group by product_id
              supplierStock.forEach((stock: {
                supplier_id?: string;
                integration_id?: string;
                product_id: string;
                source_name: string;
                supplier_name?: string;
                integration_name?: string;
                new_stock_quantity: number;
                created_at: string;
              }) => {
                if (!supplierStockMap.has(stock.product_id)) {
                  supplierStockMap.set(stock.product_id, []);
                }
                supplierStockMap.get(stock.product_id)!.push(stock);
              });
            }
          }
          console.log(`Supplier stock grouped for ${supplierStockMap.size} products`);
        } catch (error) {
          console.error('Error fetching supplier stock:', error);
        }
      }
    }

    // Define CSV headers - removed id, category, description as requested
    const headers = [
      "name",
      "sku",
      "ean",
      "brand",
      "image_url",
      "our_retail_price",
      "our_wholesale_price",
      "is_active",
      "created_at",
      "updated_at"
    ];

    // Add competitor price headers if any products have competitor prices
    const competitorPriceHeaders = new Set<string>();


    // Only add competitor price headers if competitor prices are requested
    if (body.includeCompetitorPrices) {
      // Use the competitorPricesMap to create headers instead of product.source_prices
      competitorPricesMap.forEach(prices => {
        prices.forEach(price => {
          const competitorName = price.source_name || 'Unknown_Competitor';
          const cleanName = competitorName.replace(/[^a-zA-Z0-9]/g, '_');
          competitorPriceHeaders.add(`competitor_price_${cleanName}`);
        });
      });
    }



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

    // Add supplier price headers if needed
    const supplierPriceHeaders = new Set<string>();
    if (body.includeSupplierPrices) {
      supplierPricesMap.forEach(prices => {
        prices.forEach(price => {
          const supplierName = price.source_name || 'Unknown_Supplier';
          const cleanName = supplierName.replace(/[^a-zA-Z0-9]/g, '_');
          supplierPriceHeaders.add(`supplier_price_${cleanName}`);
          supplierPriceHeaders.add(`supplier_recommended_price_${cleanName}`);
        });
      });
    }

    // Add competitor stock headers if needed - only for those with actual stock values
    const competitorStockHeaders = new Set<string>();
    if (body.includeCompetitorStock) {
      competitorStockMap.forEach(stocks => {
        stocks.forEach(stock => {
          // Only add header if stock has a valid quantity value
          if (stock.current_stock_quantity !== null && stock.current_stock_quantity !== undefined) {
            const competitorName = stock.source_name || 'Unknown_Competitor';
            const cleanName = competitorName.replace(/[^a-zA-Z0-9]/g, '_');
            competitorStockHeaders.add(`competitor_stock_${cleanName}`);
          }
        });
      });
    }

    // Add supplier stock headers if needed - only for those with actual stock values
    const supplierStockHeaders = new Set<string>();
    if (body.includeSupplierStock) {
      supplierStockMap.forEach(stocks => {
        stocks.forEach(stock => {
          // Only add header if stock has a valid quantity value
          if (stock.new_stock_quantity !== null && stock.new_stock_quantity !== undefined) {
            const supplierName = stock.supplier_name || stock.integration_name || 'Unknown_Supplier';
            const cleanName = supplierName.replace(/[^a-zA-Z0-9]/g, '_');
            supplierStockHeaders.add(`supplier_stock_${cleanName}`);
          }
        });
      });
    }

    // Combine all headers
    const allHeaders = [...headers, ...Array.from(competitorPriceHeaders), ...Array.from(supplierPriceHeaders), ...Array.from(competitorStockHeaders), ...Array.from(supplierStockHeaders), ...customFieldHeaders];

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
        const _competitorName = header.replace('competitor_price_', '').replace(/_/g, ' ');
        let price = '';

        // Use competitorPricesMap instead of product.source_prices
        const productCompetitorPrices = competitorPricesMap.get(product.id) || [];
        const matchingPrice = productCompetitorPrices.find(p => {
          const priceName = (p.source_name || 'Unknown Competitor').replace(/[^a-zA-Z0-9]/g, '_');
          return priceName === header.replace('competitor_price_', '');
        });

        if (matchingPrice?.new_competitor_price) {
          price = `"${String(matchingPrice.new_competitor_price).replace('.', ',')}"`;
        } else if (matchingPrice?.new_our_retail_price) {
          // Fallback to our retail price if competitor price is not available
          price = `"${String(matchingPrice.new_our_retail_price).replace('.', ',')}"`;
        }

        row.push(price);
      });

      // Add supplier prices
      supplierPriceHeaders.forEach(header => {
        let price = '';

        if (header.includes('supplier_price_')) {
          const productSupplierPrices = supplierPricesMap.get(product.id) || [];
          const matchingPrice = productSupplierPrices.find(p => {
            const priceName = (p.source_name || 'Unknown Supplier').replace(/[^a-zA-Z0-9]/g, '_');
            return priceName === header.replace('supplier_price_', '');
          });

          if (matchingPrice?.new_supplier_price) {
            price = `"${String(matchingPrice.new_supplier_price).replace('.', ',')}"`;
          }
        } else if (header.includes('supplier_recommended_price_')) {
          const productSupplierPrices = supplierPricesMap.get(product.id) || [];
          const matchingPrice = productSupplierPrices.find(p => {
            const priceName = (p.source_name || 'Unknown Supplier').replace(/[^a-zA-Z0-9]/g, '_');
            return priceName === header.replace('supplier_recommended_price_', '');
          });

          if (matchingPrice?.new_supplier_recommended_price) {
            price = `"${String(matchingPrice.new_supplier_recommended_price).replace('.', ',')}"`;
          }
        }

        row.push(price);
      });

      // Add competitor stock
      competitorStockHeaders.forEach(header => {
        const _competitorName = header.replace('competitor_stock_', '').replace(/_/g, ' ');
        let stock = '';

        // Use competitorStockMap
        const productCompetitorStock = competitorStockMap.get(product.id) || [];
        const matchingStock = productCompetitorStock.find(s => {
          const stockName = (s.source_name || 'Unknown Competitor').replace(/[^a-zA-Z0-9]/g, '_');
          return stockName === header.replace('competitor_stock_', '');
        });

        if (matchingStock?.current_stock_quantity !== null && matchingStock?.current_stock_quantity !== undefined) {
          stock = String(matchingStock.current_stock_quantity);
        }

        row.push(stock);
      });

      // Add supplier stock
      supplierStockHeaders.forEach(header => {
        let stock = '';

        const productSupplierStock = supplierStockMap.get(product.id) || [];
        const matchingStock = productSupplierStock.find(s => {
          const stockName = (s.supplier_name || s.integration_name || 'Unknown Supplier').replace(/[^a-zA-Z0-9]/g, '_');
          return stockName === header.replace('supplier_stock_', '');
        });

        if (matchingStock?.new_stock_quantity !== null && matchingStock?.new_stock_quantity !== undefined) {
          stock = String(matchingStock.new_stock_quantity);
        }

        row.push(stock);
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
