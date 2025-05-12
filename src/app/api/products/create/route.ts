import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
// Removed unused import: import { createClient } from '@supabase/supabase-js';
import { ensureUUID } from '@/lib/utils/uuid';
import { BrandService } from "@/lib/services/brand-service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

    // Get the request body
    const body = await request.json();

    // Create a Supabase admin client to bypass RLS
    const supabase = createSupabaseAdminClient();

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    // Handle brand standardization if brand text is provided
    let brandId = null;
    if (body.brand) {
      const brandService = new BrandService();
      try {
        // Find or create the brand and get its ID
        const brand = await brandService.findOrCreateBrandByName(userId, body.brand);
        if (brand?.id) {
          brandId = brand.id;
        } else {
          console.warn(`Could not find or create brand for name "${body.brand}" during product creation.`);
        }
      } catch (brandError) {
        console.error(`Error processing brand "${body.brand}" during product creation:`, brandError);
      }
    }

    // Insert the new product
    const { data, error } = await supabase
      .from("products")
      .insert({
        user_id: userId,
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
      })
      .select();

    if (error) {
      console.error("Error creating product:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in products/create API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
