import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { BrandService } from '@/lib/services/brand-service';

// Helper function to ensure user ID is a valid UUID
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID v5 from the ID
  // Using the DNS namespace as a base
  return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

// GET handler to fetch a specific product
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
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

    // Extract productId from params - await it as required by Next.js 15
    const { productId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID format" },
        { status: 400 }
      );
    }

    // Fetch the product
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// PUT handler to update a specific product
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
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

    // Get the request body
    const body = await request.json();

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

    // Extract productId from params - await it as required by Next.js 15
    const { productId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID format" },
        { status: 400 }
      );
    }

    // Check if the product exists and belongs to the user
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("id, brand, brand_id")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingProduct) {
      return NextResponse.json(
        { error: "Product not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    // Handle brand association
    let brandId = existingProduct.brand_id; // Preserve existing brand_id by default

    // If brand_id is explicitly provided in the request, use it
    if (body.brand_id) {
      brandId = body.brand_id;
    }
    // If brand_id is not provided but brand name is, and it's different from the existing one
    else if (body.brand !== existingProduct.brand) {
      if (body.brand) {
        const brandService = new BrandService();
        try {
          // Find or create the brand and get its ID
          const brand = await brandService.findOrCreateBrandByName(userId, body.brand);
          if (brand?.id) {
            brandId = brand.id;
          } else {
            console.warn(`Could not find or create brand for name "${body.brand}" during product update.`);
          }
        } catch (brandError) {
          console.error(`Error processing brand "${body.brand}" during product update:`, brandError);
        }
      } else {
        // If brand is explicitly set to empty or null, clear the brand_id as well
        brandId = null;
      }
    }

    // Update the product
    const { data, error } = await supabase
      .from("products")
      .update({
        name: body.name,
        sku: body.sku || null,
        ean: body.ean || null,
        brand: body.brand || null,
        brand_id: brandId, // Set the brand_id from the brand service
        category: body.category || null,
        description: body.description || null,
        image_url: body.image_url || null,
        url: body.url || null, // Add URL field
        our_retail_price: body.our_retail_price || body.our_price || null, // Support both old and new field names
        our_wholesale_price: body.our_wholesale_price || body.wholesale_price || null, // Support both old and new field names
        is_active: body.is_active !== undefined ? body.is_active : true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Error updating product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a specific product
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
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

    // Extract productId from params - await it as required by Next.js
    const { productId } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID format" },
        { status: 400 }
      );
    }

    // Check if the product exists and belongs to the user
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingProduct) {
      return NextResponse.json(
        { error: "Product not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    // First, check if there are price_changes_competitors referencing this product
    const { count: priceChangesCount, error: countError } = await supabase
      .from("price_changes_competitors")
      .select("id", { count: 'exact', head: true })
      .eq("product_id", productId);

    if (countError) {
      console.error("Error checking price_changes_competitors references:", countError);
      return NextResponse.json(
        { error: "Error checking price_changes_competitors references" },
        { status: 500 }
      );
    }

    // Check if there are product_custom_field_values referencing this product
    const { count: customFieldValuesCount, error: customFieldCountError } = await supabase
      .from("product_custom_field_values")
      .select("id", { count: 'exact', head: true })
      .eq("product_id", productId);

    if (customFieldCountError) {
      console.error("Error checking product_custom_field_values references:", customFieldCountError);
      return NextResponse.json(
        { error: "Error checking product_custom_field_values references" },
        { status: 500 }
      );
    }

    // Check if there are temp_competitors_scraped_data referencing this product
    const { count: tempCompetitorsCount, error: tempCompetitorsCountError } = await supabase
      .from("temp_competitors_scraped_data")
      .select("id", { count: 'exact', head: true })
      .eq("product_id", productId);

    if (tempCompetitorsCountError) {
      console.error("Error checking temp_competitors_scraped_data references:", tempCompetitorsCountError);
      return NextResponse.json(
        { error: "Error checking temp_competitors_scraped_data references" },
        { status: 500 }
      );
    }

    // Check if there are products_dismissed_duplicates referencing this product
    const { count: dismissedDuplicatesCount, error: dismissedDuplicatesCountError } = await supabase
      .from("products_dismissed_duplicates")
      .select("id", { count: 'exact', head: true })
      .or(`product_id_1.eq.${productId},product_id_2.eq.${productId}`);

    if (dismissedDuplicatesCountError) {
      console.error("Error checking products_dismissed_duplicates references:", dismissedDuplicatesCountError);
      return NextResponse.json(
        { error: "Error checking products_dismissed_duplicates references" },
        { status: 500 }
      );
    }

    // Note: temp_integrations_scraped_data table doesn't have a product_id column
    // so we don't need to check for references there

    // Delete ALL price_changes_competitors records for this product (both competitor and integration price changes)
    if (priceChangesCount && priceChangesCount > 0) {
      const { error: deleteChangesError } = await supabase
        .from("price_changes_competitors")
        .delete()
        .eq("product_id", productId);

      if (deleteChangesError) {
        console.error("Error deleting price_changes_competitors:", deleteChangesError);
        return NextResponse.json(
          { error: `Cannot delete product: it has ${priceChangesCount} price change records. Please try again or contact support.` },
          { status: 409 }
        );
      }

      console.log(`Deleted ${priceChangesCount} price_changes_competitors records for product ${productId}`);
    }

    // Delete ALL product_custom_field_values records for this product
    if (customFieldValuesCount && customFieldValuesCount > 0) {
      const { error: deleteCustomFieldValuesError } = await supabase
        .from("product_custom_field_values")
        .delete()
        .eq("product_id", productId);

      if (deleteCustomFieldValuesError) {
        console.error("Error deleting product_custom_field_values:", deleteCustomFieldValuesError);
        return NextResponse.json(
          { error: `Cannot delete product: it has ${customFieldValuesCount} custom field value records. Please try again or contact support.` },
          { status: 409 }
        );
      }

      console.log(`Deleted ${customFieldValuesCount} product_custom_field_values records for product ${productId}`);
    }

    // Delete ALL temp_competitors_scraped_data records for this product
    if (tempCompetitorsCount && tempCompetitorsCount > 0) {
      const { error: deleteTempCompetitorsError } = await supabase
        .from("temp_competitors_scraped_data")
        .delete()
        .eq("product_id", productId);

      if (deleteTempCompetitorsError) {
        console.error("Error deleting temp_competitors_scraped_data:", deleteTempCompetitorsError);
        return NextResponse.json(
          { error: `Cannot delete product: it has ${tempCompetitorsCount} temp competitor records. Please try again or contact support.` },
          { status: 409 }
        );
      }

      console.log(`Deleted ${tempCompetitorsCount} temp_competitors_scraped_data records for product ${productId}`);
    }

    // Delete ALL products_dismissed_duplicates records for this product
    if (dismissedDuplicatesCount && dismissedDuplicatesCount > 0) {
      const { error: deleteDismissedDuplicatesError } = await supabase
        .from("products_dismissed_duplicates")
        .delete()
        .or(`product_id_1.eq.${productId},product_id_2.eq.${productId}`);

      if (deleteDismissedDuplicatesError) {
        console.error("Error deleting products_dismissed_duplicates:", deleteDismissedDuplicatesError);
        return NextResponse.json(
          { error: `Cannot delete product: it has ${dismissedDuplicatesCount} dismissed duplicate records. Please try again or contact support.` },
          { status: 409 }
        );
      }

      console.log(`Deleted ${dismissedDuplicatesCount} products_dismissed_duplicates records for product ${productId}`);
    }

    // temp_integrations_scraped_data doesn't have product_id column, so no cleanup needed

    // Now delete the product
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in products API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}