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
        our_price: body.our_price || null,
        wholesale_price: body.wholesale_price || null,
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
  context: { params: { productId: string } }
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

    // First, check if there are price_changes referencing this product
    const { count: priceChangesCount, error: countError } = await supabase
      .from("price_changes")
      .select("id", { count: 'exact', head: true })
      .eq("product_id", productId);

    if (countError) {
      console.error("Error checking price_changes references:", countError);
      return NextResponse.json(
        { error: "Error checking price_changes references" },
        { status: 500 }
      );
    }

    // Check if there are temp_integrations_scraped_data referencing this product
    const { count: stagedProductsCount, error: stagedCountError } = await supabase
      .from("temp_integrations_scraped_data")
      .select("id", { count: 'exact', head: true })
      .eq("product_id", productId);

    if (stagedCountError) {
      console.error("Error checking temp_integrations_scraped_data references:", stagedCountError);
      return NextResponse.json(
        { error: "Error checking temp_integrations_scraped_data references" },
        { status: 500 }
      );
    }

    // Delete price_changes records if they exist
    if (priceChangesCount && priceChangesCount > 0) {
      const { error: deleteChangesError } = await supabase
        .from("price_changes")
        .delete()
        .eq("product_id", productId);

      if (deleteChangesError) {
        console.error("Error deleting price_changes:", deleteChangesError);
        return NextResponse.json(
          { error: `Cannot delete product: it has ${priceChangesCount} price change records. Please try again or contact support.` },
          { status: 409 }
        );
      }

      console.log(`Deleted ${priceChangesCount} price_changes records for product ${productId}`);
    }

    // Delete temp_integrations_scraped_data records if they exist
    if (stagedProductsCount && stagedProductsCount > 0) {
      const { error: deleteStagedError } = await supabase
        .from("temp_integrations_scraped_data")
        .delete()
        .eq("product_id", productId);

      if (deleteStagedError) {
        console.error("Error deleting temp_integrations_scraped_data:", deleteStagedError);
        return NextResponse.json(
          { error: `Cannot delete product: it has ${stagedProductsCount} temp integration product records. Please try again or contact support.` },
          { status: 409 }
        );
      }

      console.log(`Deleted ${stagedProductsCount} temp_integrations_scraped_data records for product ${productId}`);
    }

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