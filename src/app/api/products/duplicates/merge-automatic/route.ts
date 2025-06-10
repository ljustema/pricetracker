import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ensureUUID } from '@/lib/utils';

interface Product {
  product_id: string;
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  brand_id: string | null;
}

interface DuplicateGroup {
  group_id: string;
  match_reason: string;
  products: Product[];
}

export async function POST(_request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ensureUUID(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Get potential duplicates
    const { data: duplicatesData, error: duplicatesError } = await supabase.rpc(
      "find_potential_duplicates",
      {
        p_user_id: userId,
        p_limit: 1000  // Higher limit for automatic processing
      }
    );

    if (duplicatesError) {
      console.error("Error fetching duplicates:", duplicatesError);
      return NextResponse.json(
        { error: "Failed to fetch duplicates" },
        { status: 500 }
      );
    }

    if (!duplicatesData || duplicatesData.length === 0) {
      return NextResponse.json({
        message: "No duplicates found to merge automatically",
        mergedCount: 0,
        errorCount: 0,
        details: []
      });
    }

    // Group duplicates by group_id
    const groupedDuplicates = duplicatesData.reduce((acc: Record<string, DuplicateGroup>, product: Product & { group_id: string; match_reason: string }) => {
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

    const duplicateGroups = Object.values(groupedDuplicates) as DuplicateGroup[];

    // Filter groups that are very likely the same product:
    // Same brand and SKU where one has EAN and the other doesn't
    const automaticMergeGroups = duplicateGroups.filter((group) => {
      if (group.products.length !== 2) return false;
      
      const [product1, product2] = group.products;
      
      // Both must have same brand and SKU
      const sameBrand = product1.brand && product2.brand && 
                       product1.brand.toLowerCase().trim() === product2.brand.toLowerCase().trim();
      const sameSku = product1.sku && product2.sku && 
                     product1.sku.toLowerCase().trim() === product2.sku.toLowerCase().trim();
      
      if (!sameBrand || !sameSku) return false;
      
      // One must have EAN and the other must not
      const hasEanPattern = (product1.ean && !product2.ean) || (!product1.ean && product2.ean);
      
      return hasEanPattern;
    });

    let mergedCount = 0;
    let errorCount = 0;
    const details: Array<{ group: string; success: boolean; error?: string; primary?: string; duplicate?: string }> = [];

    // Process each automatic merge group
    for (const group of automaticMergeGroups) {
      try {
        const [product1, product2] = group.products;
        
        // Product with EAN becomes primary, product without EAN becomes duplicate
        const primaryProduct = product1.ean ? product1 : product2;
        const duplicateProduct = product1.ean ? product2 : product1;

        // Call the merge function
        const { data: result, error: mergeError } = await supabase.rpc(
          "merge_products_api",
          {
            primary_id: primaryProduct.product_id,
            duplicate_id: duplicateProduct.product_id
          }
        );

        if (mergeError) {
          console.error(`Error merging products in group ${group.group_id}:`, mergeError);
          errorCount++;
          details.push({
            group: group.match_reason,
            success: false,
            error: mergeError.message,
            primary: primaryProduct.name,
            duplicate: duplicateProduct.name
          });
        } else if (!result?.success) {
          console.error(`Merge operation failed for group ${group.group_id}:`, result?.message);
          errorCount++;
          details.push({
            group: group.match_reason,
            success: false,
            error: result?.message || "Unknown error",
            primary: primaryProduct.name,
            duplicate: duplicateProduct.name
          });
        } else {
          mergedCount++;
          details.push({
            group: group.match_reason,
            success: true,
            primary: primaryProduct.name,
            duplicate: duplicateProduct.name
          });
        }
      } catch (err) {
        console.error(`Error processing group ${group.group_id}:`, err);
        errorCount++;
        details.push({
          group: group.match_reason,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    return NextResponse.json({
      message: `Automatic merge completed: ${mergedCount} successful merges, ${errorCount} errors`,
      mergedCount,
      errorCount,
      totalEligibleGroups: automaticMergeGroups.length,
      details
    });

  } catch (error) {
    console.error("Error in automatic merge API route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
