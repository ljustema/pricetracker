import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureUUID } from "@/lib/utils";

export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Get potential duplicates with minimal timeout for ultra-large datasets
    // Set a very short statement timeout
    await supabase.rpc('set_statement_timeout', { p_milliseconds: 5000 });

    const { data, error } = await supabase.rpc(
      "find_potential_duplicates",
      {
        p_user_id: userId,
        p_limit: 25  // Very small limit for minimal performance impact
      },
      { count: 'exact', head: false } // Request exact count
    );

    if (error) {
      console.error("Error finding potential duplicates:", error);
      
      // Handle timeout errors specifically
      if (error.code === '57014') {
        return NextResponse.json(
          {
            error: "The duplicate detection query timed out. Try again later or contact support if this persists.",
            details: "The database query took too long to complete. This usually happens when there are too many products to compare.",
            code: error.code
          },
          { status: 504 } // Gateway Timeout status is more appropriate for timeouts
        );
      }
      
      return NextResponse.json(
        {
          error: "Failed to find potential duplicates",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Group duplicates by group_id
    // Define the product type based on the database function return type
    interface ProductItem {
      product_id: string;
      group_id: string;
      match_reason: string;
      name: string;
      sku: string | null;
      ean: string | null;
      brand: string | null;
      brand_id: string | null;
      [key: string]: unknown; // For any additional properties
    }

    interface DuplicateGroup {
      group_id: string;
      match_reason: string;
      products: ProductItem[];
    }

    interface GroupedDuplicates {
      [key: string]: DuplicateGroup;
    }

    const groupedDuplicates = data.reduce((acc: GroupedDuplicates, product: ProductItem) => {
      const key = product.group_id;

      if (!acc[key]) {
        acc[key] = {
          group_id: product.group_id,
          match_reason: product.match_reason,
          products: []
        };
      }
      acc[key].products.push(product);
      return acc;
    }, {});

    return NextResponse.json(Object.values(groupedDuplicates));
  } catch (error) {
    console.error("Error in duplicates API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
