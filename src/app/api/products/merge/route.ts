import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const { primaryId, duplicateId, fieldSelections } = await request.json();

    if (!primaryId || !duplicateId) {
      return NextResponse.json(
        { error: "Primary and duplicate product IDs are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify both products belong to the user
    const { data: products, error: verifyError } = await supabase
      .from("products")
      .select("id")
      .in("id", [primaryId, duplicateId])
      .eq("user_id", userId);

    if (verifyError || !products || products.length !== 2) {
      return NextResponse.json(
        { error: "Invalid product IDs or unauthorized access" },
        { status: 403 }
      );
    }

    // If field selections are provided, we need to handle them before merging
    if (fieldSelections && Object.keys(fieldSelections).length > 0) {
      // Get both products to apply field selections
      const { data: _primaryProduct, error: primaryError } = await supabase
        .from("products")
        .select("*")
        .eq("id", primaryId)
        .single();

      const { data: duplicateProduct, error: duplicateError } = await supabase
        .from("products")
        .select("*")
        .eq("id", duplicateId)
        .single();

      if (primaryError || duplicateError) {
        return NextResponse.json(
          { error: "Failed to fetch products for field selection" },
          { status: 500 }
        );
      }

      // Create an update object for the primary product
      const updateData: any = {};

      // Apply field selections
      for (const [field, selectedProductId] of Object.entries(fieldSelections)) {
        // If the selected product is the duplicate, use its value
        if (selectedProductId === duplicateId && duplicateProduct[field]) {
          updateData[field] = duplicateProduct[field];
        }
      }

      // Update the primary product with selected fields
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", primaryId);

        if (updateError) {
          return NextResponse.json(
            { error: "Failed to update primary product with selected fields" },
            { status: 500 }
          );
        }
      }
    }

    // Merge the products with improved error handling
    try {
      // Log the merge attempt
      console.log(`Attempting to merge products: primary=${primaryId}, duplicate=${duplicateId}`);

      // We'll check related records separately for each table
      try {
        // Check price_changes_competitors
        const { data: priceChanges, error: priceError } = await supabase
          .from('price_changes_competitors')
          .select('product_id')
          .in('product_id', [primaryId, duplicateId]);

        // Check temp_competitors_scraped_data
        const { data: scrapedProducts, error: scrapedError } = await supabase
          .from('temp_competitors_scraped_data')
          .select('product_id')
          .in('product_id', [primaryId, duplicateId]);

        // Check temp_integrations_scraped_data
        const { data: stagedProducts, error: stagedError } = await supabase
          .from('temp_integrations_scraped_data')
          .select('product_id')
          .in('product_id', [primaryId, duplicateId]);

        // Log the counts if available
        if (!priceError && !scrapedError && !stagedError) {
          console.log("Related records:", {
            price_changes_competitors: priceChanges?.length || 0,
            temp_competitors_scraped_data: scrapedProducts?.length || 0,
            temp_integrations_scraped_data: stagedProducts?.length || 0
          });
        }
      } catch (countError) {
        // Just log the error but continue with the merge
        console.error("Error checking related records:", countError);
      }

      // Call the merge function
      const { data: result, error: mergeError } = await supabase.rpc(
        "merge_products_api",
        {
          primary_id: primaryId,
          duplicate_id: duplicateId
        }
      );

      if (mergeError) {
        console.error("Error calling merge_products_api function:", mergeError);

        // Check if it's a timeout error
        if (mergeError.code === '57014' || mergeError.message?.includes('statement timeout')) {
          return NextResponse.json(
            {
              error: "Merge operation timed out",
              details: "The operation took too long to complete. Please try again or contact support if the issue persists.",
              code: mergeError.code
            },
            { status: 504 } // Gateway Timeout status
          );
        }

        // Check for foreign key constraint violations
        if (mergeError.code === '23503' || mergeError.message?.includes('foreign key constraint')) {
          return NextResponse.json(
            {
              error: "Foreign key constraint violation",
              details: "Cannot merge products because there are still references to the duplicate product. Please contact support for assistance.",
              code: mergeError.code
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            error: "Failed to merge products",
            details: mergeError.message,
            code: mergeError.code
          },
          { status: 500 }
        );
      }

      if (!result?.success) {
        console.error("Merge operation failed:", result?.message);
        return NextResponse.json(
          {
            error: "Failed to merge products",
            details: result?.message || "Unknown error"
          },
          { status: 500 }
        );
      }

      // If we get here, the merge was successful
      console.log("Merge successful:", JSON.stringify(result, null, 2));
      return NextResponse.json(result);
    } catch (error: any) {
      console.error("Exception during merge operation:", error);

      return NextResponse.json(
        {
          error: "Failed to merge products",
          details: error.message || "Unknown error"
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in merge API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
