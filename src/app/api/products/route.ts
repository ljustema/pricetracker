import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';

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

    // Check if the user exists in the auth.users table
    const { data: authUser, error: authUserError } = await supabase
      .from("auth.users")
      .select("id")
      .eq("id", userId)
      .single();

    // If the user doesn't exist in auth.users, create one
    if (!authUser || authUserError) {
      console.log("User not found in auth.users, creating one...");

      try {
        // Directly insert into auth.users
        const { error: insertError } = await supabase
          .from("auth.users")
          .insert({
            id: userId,
            email: session.user.email || "",
            raw_user_meta_data: { name: session.user.name || "" },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("Error inserting into auth.users:", insertError);

          // Check if insertError.message exists before trying to use it
          if (!insertError.message || !insertError.message.includes('duplicate key')) {
            return NextResponse.json(
              { error: "Failed to create user in auth.users: " + JSON.stringify(insertError) },
              { status: 500 }
            );
          }
        }

        // Also ensure the user exists in next_auth.users
        const { data: nextAuthUser, error: nextAuthUserError } = await supabase
          .from("next_auth.users")
          .select("id")
          .eq("id", userId)
          .single();

        if (!nextAuthUser || nextAuthUserError) {
          const { error: nextAuthInsertError } = await supabase
            .from("next_auth.users")
            .insert({
              id: userId,
              name: session.user.name || "",
              email: session.user.email || "",
              "emailVerified": new Date().toISOString(),
              image: session.user.image || ""
            });

          if (nextAuthInsertError && nextAuthInsertError.message && !nextAuthInsertError.message.includes('duplicate key')) {
            console.error("Error inserting into next_auth.users:", nextAuthInsertError);
          }
        }

        // Also ensure the user has a profile
        const { data: userProfile, error: userProfileError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", userId)
          .single();

        if (!userProfile || userProfileError) {
          const { error: profileInsertError } = await supabase
            .from("user_profiles")
            .insert({
              id: userId,
              name: session.user.name || "",
              avatar_url: session.user.image || ""
            });

          if (profileInsertError && profileInsertError.message && !profileInsertError.message.includes('duplicate key')) {
            console.error("Error inserting into user_profiles:", profileInsertError);
          }
        }
      } catch (error) {
        console.error("Error in user creation process:", error);
        return NextResponse.json(
          { error: "Failed to create user: " + (error instanceof Error ? error.message : String(error)) },
          { status: 500 }
        );
      }
    }

    // --- Start: Product Fetching Logic using RPC ---

    const body = await request.json(); // Read parameters from request body

    // Prepare parameters for the RPC call, converting types as needed
    const rpcParams = {
      p_user_id: userId,
      p_page: parseInt(body.page || "1", 10),
      p_page_size: parseInt(body.pageSize || "12", 10),
      p_sort_by: body.sortBy || "created_at",
      p_sort_order: body.sortOrder || "desc",
      p_brand: body.brand || null, // Pass brand ID from the brands table
      p_category: body.category || null, // Pass null if empty/undefined
      p_search: body.search || null, // Pass null if empty/undefined
      // Convert isActive: Frontend sends 'true' or undefined (for active) or false (for inactive)
      // Function expects true (active), false (inactive), or null (don't filter)
      p_is_active: body.isActive === 'true' ? true : (body.isActive === false ? false : null),
      p_competitor_id: body.sourceId || body.competitor || null, // Use sourceId if available, fall back to competitor
      // Convert has_price: Frontend sends true or undefined
      // Function expects true or null
      p_has_price: body.has_price === true ? true : null,
      // Add new price comparison filters
      p_price_lower_than_competitors: body.price_lower_than_competitors === true ? true : null,
      p_price_higher_than_competitors: body.price_higher_than_competitors === true ? true : null
    };

    // Try to execute the RPC call, but fall back to a direct query if it fails
    try {
      const { data: rpcResult, error } = await supabase.rpc('get_products_filtered', rpcParams);

      if (error) {
        console.error("Error calling get_products_filtered RPC:", error);
        throw error;
      }

      // The RPC function returns a JSON object like { "data": [], "totalCount": 0 }
      // Extract data and count from the result
      const data = rpcResult?.data || [];
      const count = rpcResult?.totalCount || 0;

      // Return paginated data and total count
      return NextResponse.json({
        data: data || [], // Ensure data is always an array
        totalCount: count || 0, // Total count matching filters
      });
    } catch (rpcError) {
      console.error("Falling back to direct query due to RPC error:", rpcError);

      // Fall back to a direct query
      let query = supabase
        .from("products")
        .select("*", { count: 'exact' })
        .eq("user_id", userId);

      // Apply filters
      if (rpcParams.p_brand) {
        try {
          const brandUuid = rpcParams.p_brand;
          query = query.eq("brand_id", brandUuid);
        } catch (e) {
          console.error("Error parsing brand UUID:", e);
        }
      }

      if (rpcParams.p_category && rpcParams.p_category !== '') {
        query = query.eq("category", rpcParams.p_category);
      }

      if (rpcParams.p_search && rpcParams.p_search !== '') {
        query = query.or(`name.ilike.%${rpcParams.p_search}%,sku.ilike.%${rpcParams.p_search}%,ean.ilike.%${rpcParams.p_search}%`);
      }

      if (rpcParams.p_is_active !== null) {
        query = query.eq("is_active", rpcParams.p_is_active);
      }

      if (rpcParams.p_has_price === true) {
        query = query.not("our_price", "is", null);
      }

      // Handle competitor filtering in the fallback query
      if (rpcParams.p_competitor_id) {
        try {
          // First, get all product IDs that have price changes for this competitor
          // We'll use a more efficient approach with pagination to avoid URL size limitations
          const { data: productIds, error: productIdsError } = await supabase
            .from("price_changes")
            .select("product_id")
            .eq("user_id", userId)
            .eq("competitor_id", rpcParams.p_competitor_id);

          if (productIdsError) {
            console.error("Error fetching product IDs for competitor:", productIdsError);
            throw new Error(`Error fetching product IDs: ${productIdsError.message}`);
          }

          if (productIds && productIds.length > 0) {
            // Instead of using .in() with all IDs (which can cause URL too large errors),
            // we'll use a more efficient approach with a temporary table or batched queries

            // For small result sets, we can still use .in() safely
            if (productIds.length <= 100) {
              const ids = productIds.map(item => item.product_id);
              query = query.in("id", ids);
            } else {
              // For larger result sets, we'll use a different approach
              // We'll create a temporary table with the IDs and join against it

              // First, create batches of IDs to process
              const batchSize = 100;
              const batches = [];
              for (let i = 0; i < productIds.length; i += batchSize) {
                batches.push(productIds.slice(i, i + batchSize));
              }

              // Process each batch
              let foundProducts = false;
              for (const batch of batches) {
                const ids = batch.map(item => item.product_id);
                const { data: batchProducts, error: batchError } = await supabase
                  .from("products")
                  .select("id")
                  .eq("user_id", userId)
                  .in("id", ids)
                  .limit(1);

                if (batchError) {
                  console.error("Error processing batch:", batchError);
                  continue;
                }

                if (batchProducts && batchProducts.length > 0) {
                  foundProducts = true;
                  break;
                }
              }

              if (!foundProducts) {
                // If no products found for this competitor, return empty result
                query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // This will return no results
              }

              // Since we can't efficiently filter with all IDs in the URL,
              // we'll modify our approach to use a simpler query and then filter in memory
              // This is not ideal for large datasets but will work as a fallback

              // Get all products for this user (we'll filter them later)
              const { data: allProducts, error: allProductsError } = await query;

              if (allProductsError) {
                console.error("Error fetching all products:", allProductsError);
                throw new Error(`Error fetching all products: ${allProductsError.message}`);
              }

              // Filter products to only those with IDs in our list
              const productIdSet = new Set(productIds.map(item => item.product_id));
              const filteredProducts = allProducts.filter(product => productIdSet.has(product.id));

              // Sort the filtered products consistently
              filteredProducts.sort((a, b) => {
                // First sort by the specified sort field
                const sortField = rpcParams.p_sort_by || 'created_at';
                const sortOrder = rpcParams.p_sort_order === 'asc' ? 1 : -1;

                // Compare the primary sort field
                if (a[sortField] < b[sortField]) return -1 * sortOrder;
                if (a[sortField] > b[sortField]) return 1 * sortOrder;

                // If primary sort field is equal, sort by id as secondary sort
                return a.id.localeCompare(b.id);
              });

              // Calculate pagination
              const start = (rpcParams.p_page - 1) * rpcParams.p_page_size;
              const end = start + rpcParams.p_page_size;

              // Return the paginated results
              return NextResponse.json({
                data: filteredProducts.slice(start, end),
                totalCount: filteredProducts.length
              });
            }
          } else {
            // If no products found for this competitor, return empty result
            query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // This will return no results
          }
        } catch (e) {
          console.error("Error handling competitor filter:", e);
          throw new Error(`Error handling competitor filter: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Apply sorting and pagination
      // Add id as a secondary sort to ensure consistent ordering
      query = query
        .order(rpcParams.p_sort_by, { ascending: rpcParams.p_sort_order === 'asc' })
        .order('id', { ascending: true }) // Add secondary sort by id to ensure consistent ordering
        .range(
          (rpcParams.p_page - 1) * rpcParams.p_page_size,
          rpcParams.p_page * rpcParams.p_page_size - 1
        );

      const { data: products, error: productsError, count } = await query;

      if (productsError) {
        console.error("Error in fallback query:", productsError);
        return NextResponse.json(
          {
            error: "Database error: " + productsError.message,
            details: productsError
          },
          { status: 500 }
        );
      }

      // Fetch competitor prices for these products
      const productIds = products?.map(p => p.id) || [];

      // Fetch all competitors for this user
      const { data: competitors, error: competitorsError } = await supabase
        .from("competitors")
        .select("id, name, website")
        .eq("user_id", userId);

      if (competitorsError) {
        console.error("Error fetching competitors:", competitorsError);
      }

      // Get latest competitor prices using a CTE to get only the most recent price for each product/competitor pair
      let competitorPrices;
      const { data: competitorPricesData, error: competitorError } = await supabase
        .from("price_changes")
        .select(`
          id,
          product_id,
          competitor_id,
          new_price,
          changed_at,
          competitors(name)
        `)
        .in("product_id", productIds)
        .eq("user_id", userId)
        .not("competitor_id", "is", null) // Ensure competitor_id is not null
        .order("changed_at", { ascending: false });



      if (competitorError) {
        console.error("Error fetching competitor prices:", competitorError);
        competitorPrices = [];
      } else {
        competitorPrices = competitorPricesData;
      }

      // Get latest integration prices
      let integrationPrices;
      const { data: integrationPricesData, error: integrationError } = await supabase
        .from("price_changes")
        .select(`
          id,
          product_id,
          integration_id,
          new_price,
          changed_at,
          integrations(name)
        `)
        .in("product_id", productIds)
        .eq("user_id", userId)
        .not("integration_id", "is", null) // Ensure integration_id is not null
        .order("changed_at", { ascending: false });

      if (integrationError) {
        console.error("Error fetching integration prices:", integrationError);
        integrationPrices = [];
      } else {
        integrationPrices = integrationPricesData;
      }



      // Initialize maps for all products
      const competitorPricesMap = new Map();
      const sourcePricesMap = new Map();

      // Initialize maps for all products first
      products?.forEach(product => {
        competitorPricesMap.set(product.id, {});
        sourcePricesMap.set(product.id, {});
      });

      // Process competitor prices
      if (competitorPrices && competitorPrices.length > 0) {

        // Group competitor prices by product_id and competitor_id to get only the latest price
        const latestCompetitorPrices = new Map();

        competitorPrices.forEach(price => {
          const key = `${price.product_id}_${price.competitor_id}`;
          if (!latestCompetitorPrices.has(key) ||
              new Date(price.changed_at) > new Date(latestCompetitorPrices.get(key).changed_at)) {
            latestCompetitorPrices.set(key, price);
          }
        });



        // Add the latest competitor prices to both maps
        latestCompetitorPrices.forEach(price => {
          if (price.competitor_id && price.product_id) {
            // Convert competitor_id to string to ensure it matches the string IDs in the UI
            const competitorIdStr = String(price.competitor_id);

            // Find the matching competitor in the competitors array
            const matchingCompetitor = competitors?.find(c => c.id === price.competitor_id);

            // Add to competitor_prices map using both the original ID and the string ID
            competitorPricesMap.get(price.product_id)[competitorIdStr] = price.new_price;

            // If we found a matching competitor, also add using the competitor ID from the array
            if (matchingCompetitor) {
              competitorPricesMap.get(price.product_id)[matchingCompetitor.id] = price.new_price;
            }

            // Add to source_prices map using both the original ID and the string ID
            sourcePricesMap.get(price.product_id)[competitorIdStr] = {
              price: price.new_price,
              source_type: 'competitor',
              source_name: price.competitors?.name || 'Unknown'
            };

            // If we found a matching competitor, also add using the competitor ID from the array
            if (matchingCompetitor) {
              sourcePricesMap.get(price.product_id)[matchingCompetitor.id] = {
                price: price.new_price,
                source_type: 'competitor',
                source_name: price.competitors?.name || matchingCompetitor.name || 'Unknown'
              };
            }
          }
        });

      }

      // Process integration prices
      if (integrationPrices && integrationPrices.length > 0) {

        // Group integration prices by product_id and integration_id to get only the latest price
        const latestIntegrationPrices = new Map();

        integrationPrices.forEach(price => {
          const key = `${price.product_id}_${price.integration_id}`;
          if (!latestIntegrationPrices.has(key) ||
              new Date(price.changed_at) > new Date(latestIntegrationPrices.get(key).changed_at)) {
            latestIntegrationPrices.set(key, price);
          }
        });



        // Add the latest integration prices to both maps
        latestIntegrationPrices.forEach(price => {
          if (price.integration_id && price.product_id) {
            // Convert integration_id to string to ensure it matches the string IDs in the UI
            const integrationIdStr = String(price.integration_id);

            // Find the matching competitor in the competitors array (integrations are treated as competitors in the UI)
            const matchingCompetitor = competitors?.find(c => c.id === price.integration_id);

            // Add to source_prices map using both the original ID and the string ID
            sourcePricesMap.get(price.product_id)[integrationIdStr] = {
              price: price.new_price,
              source_type: 'integration',
              source_name: price.integrations?.name || 'Unknown'
            };

            // If we found a matching competitor, also add using the competitor ID from the array
            if (matchingCompetitor) {
              sourcePricesMap.get(price.product_id)[matchingCompetitor.id] = {
                price: price.new_price,
                source_type: 'integration',
                source_name: price.integrations?.name || matchingCompetitor.name || 'Unknown'
              };
            }

            // Also add to competitor_prices map to ensure they show up in the table
            competitorPricesMap.get(price.product_id)[integrationIdStr] = price.new_price;

            // If we found a matching competitor, also add using the competitor ID from the array
            if (matchingCompetitor) {
              competitorPricesMap.get(price.product_id)[matchingCompetitor.id] = price.new_price;
            }
          }
        });

      }

      // Add competitor_prices and source_prices to each product
      const productsWithPrices = products?.map(product => {
        const productWithPrices = {
          ...product,
          competitor_prices: competitorPricesMap.get(product.id) || {},
          source_prices: sourcePricesMap.get(product.id) || {}
        };

        // Log the first product's prices
        if (product.id === products[0]?.id) {
          console.log("First product with prices:", {
            id: productWithPrices.id,
            name: productWithPrices.name,
            competitor_prices: productWithPrices.competitor_prices,
            source_prices: productWithPrices.source_prices
          });

          // Check if the competitor IDs match the keys in the competitor_prices object
          if (competitors && competitors.length > 0) {
            const competitorPricesKeys = Object.keys(productWithPrices.competitor_prices);
            const competitorIds = competitors.map(c => c.id);
            const competitorIdsStr = competitors.map(c => String(c.id));

            console.log("Final competitor ID comparison:", {
              competitorPricesKeys,
              competitorIds,
              competitorIdsStr,
              keysMatchIds: competitorIds.some(id => competitorPricesKeys.includes(id)),
              keysMatchIdsStr: competitorIdsStr.some(id => competitorPricesKeys.includes(id))
            });
          }
        }

        return productWithPrices;
      }) || [];



      // Log the final response with more details
      console.log("Final response:", {
        totalCount: count || 0,
        productsCount: productsWithPrices.length,
        firstProductHasCompetitorPrices: productsWithPrices.length > 0 ?
          Object.keys(productsWithPrices[0].competitor_prices || {}).length > 0 : false,
        firstProductHasSourcePrices: productsWithPrices.length > 0 ?
          Object.keys(productsWithPrices[0].source_prices || {}).length > 0 : false,
        firstProductCompetitorPricesKeys: productsWithPrices.length > 0 ?
          Object.keys(productsWithPrices[0].competitor_prices || {}) : [],
        firstProductSourcePricesKeys: productsWithPrices.length > 0 ?
          Object.keys(productsWithPrices[0].source_prices || {}) : [],
        competitorIds: competitors?.map(c => c.id) || []
      });

      // Check if the competitor IDs match the keys in the competitor_prices object
      if (productsWithPrices.length > 0 && competitors && competitors.length > 0) {
        const firstProductCompetitorPricesKeys = Object.keys(productsWithPrices[0].competitor_prices || {});
        const competitorIds = competitors.map(c => c.id);
        const competitorIdsStr = competitors.map(c => String(c.id));

        console.log("Competitor ID comparison:", {
          firstProductCompetitorPricesKeys,
          competitorIds,
          competitorIdsStr,
          keysMatchIds: competitorIds.some(id => firstProductCompetitorPricesKeys.includes(id)),
          keysMatchIdsStr: competitorIdsStr.some(id => firstProductCompetitorPricesKeys.includes(id))
        });
      }

      return NextResponse.json({
        data: productsWithPrices,
        totalCount: count || 0,
      });
    }

    // This code has been moved inside the try block
    // --- End: Modified Product Fetching Logic ---
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