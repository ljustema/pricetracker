import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils/uuid";

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
      p_is_active: body.isActive === 'true' ? true : (body.isActive === false ? false : null),
      p_competitor_ids: (() => {
        // Handle multiple competitor IDs - now using array parameter
        const competitorIds = body.sourceId;
        if (Array.isArray(competitorIds)) {
          return competitorIds.length > 0 ? competitorIds : null;
        }
        return competitorIds ? [competitorIds] : null;
      })(),
      p_has_price: body.hasPrice !== undefined ? body.hasPrice : null,
      p_price_lower_than_competitors: body.price_lower_than_competitors || null,
      p_price_higher_than_competitors: body.price_higher_than_competitors || null,
    };

    // Fetch all products using pagination
    let allProducts: any[] = [];
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

    // Use all collected products for the CSV
    const data = allProducts;

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



    // Combine all headers
    const allHeaders = [...headers, ...Array.from(competitorPriceHeaders)];

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
        product.our_price ? `"${String(product.our_price).replace('.', ',')}"` : '',
        product.wholesale_price ? `"${String(product.wholesale_price).replace('.', ',')}"` : '',
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
