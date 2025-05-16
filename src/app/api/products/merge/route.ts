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
      const { data: primaryProduct, error: primaryError } = await supabase
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

    // Merge the products with timeout handling
    try {
      // Set a client-side timeout that's longer than the server-side one
      const mergePromise = supabase.rpc(
        "merge_products_api",
        {
          primary_id: primaryId,
          duplicate_id: duplicateId
        }
      );

      // Add a timeout of 3 minutes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Client timeout: Operation took too long")), 180000);
      });

      // Race the merge operation against the timeout
      const { data: result, error: mergeError } = await Promise.race([
        mergePromise,
        timeoutPromise
      ]) as any;

      if (mergeError) {
        console.error("Error calling merge_products_api function:", mergeError);

        // Check if it's a timeout error
        if (mergeError.code === '57014' || mergeError.message?.includes('statement timeout')) {
          return NextResponse.json(
            {
              error: "Merge operation timed out",
              details: "The products have too many related records to merge in one operation. Please contact support for assistance.",
              code: mergeError.code
            },
            { status: 504 } // Gateway Timeout status
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
      return NextResponse.json(result);
    } catch (error: any) {
      console.error("Exception during merge operation:", error);

      // Handle client-side timeout
      if (error.message?.includes('timeout')) {
        return NextResponse.json(
          {
            error: "Merge operation timed out",
            details: "The operation took too long to complete. The products may have too many related records to merge in one operation."
          },
          { status: 504 } // Gateway Timeout status
        );
      }

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
