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
    // Same brand and SKU where at least one has EAN and others don't
    const automaticMergeGroups = duplicateGroups.filter((group) => {
      if (group.products.length < 2 || group.products.length > 10) return false;

      // All products must have same brand and SKU (using fuzzy SKU matching)
      const firstProduct = group.products[0];
      const allSameBrand = group.products.every(product =>
        product.brand && firstProduct.brand &&
        product.brand.toLowerCase().trim() === firstProduct.brand.toLowerCase().trim()
      );

      // Use fuzzy SKU matching - normalize SKUs to ignore punctuation and spacing
      const normalizeSkuForComparison = (sku: string) => {
        if (!sku) return '';
        // Remove all non-alphanumeric characters and convert to uppercase
        return sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      };

      const firstProductNormalizedSku = normalizeSkuForComparison(firstProduct.sku || '');
      const allSameSku = group.products.every(product => {
        if (!product.sku || !firstProduct.sku) return false;
        const normalizedSku = normalizeSkuForComparison(product.sku);
        return normalizedSku === firstProductNormalizedSku;
      });

      if (!allSameBrand || !allSameSku) return false;

      // Allow automatic merge in two scenarios:
      // 1. At least one has EAN and at least one doesn't (original logic)
      // 2. All products have same brand+SKU (even if none have EAN)
      const productsWithEan = group.products.filter(p => p.ean && p.ean.trim() !== '');
      const productsWithoutEan = group.products.filter(p => !p.ean || p.ean.trim() === '');

      // Scenario 1: Mixed EAN status (original logic)
      const mixedEanStatus = productsWithEan.length >= 1 && productsWithoutEan.length >= 1;

      // Scenario 2: All have same brand+SKU (already verified above)
      const sameBrandSku = allSameBrand && allSameSku;

      return mixedEanStatus || sameBrandSku;
    });

    let mergedCount = 0;
    let errorCount = 0;
    const details: Array<{ group: string; success: boolean; error?: string; primary?: string; duplicate?: string }> = [];

    // Process each automatic merge group
    for (const group of automaticMergeGroups) {
      try {
        // Separate products with and without EANs
        const productsWithEan = group.products.filter(p => p.ean && p.ean.trim() !== '');
        const _productsWithoutEan = group.products.filter(p => !p.ean || p.ean.trim() === '');

        // Select primary product (prefer product with EAN, or first product if multiple have EANs)
        const primaryProduct = productsWithEan.length > 0 ? productsWithEan[0] : group.products[0];

        // Get all products to merge into primary (all others)
        const duplicateProducts = group.products.filter(p => p.product_id !== primaryProduct.product_id);

        let groupMergedCount = 0;
        let groupErrorCount = 0;
        const groupErrors: string[] = [];

        // Merge each duplicate into the primary
        for (const duplicateProduct of duplicateProducts) {
          const { data: result, error: mergeError } = await supabase.rpc(
            "merge_products_api",
            {
              primary_id: primaryProduct.product_id,
              duplicate_id: duplicateProduct.product_id
            }
          );

          if (mergeError) {
            console.error(`Error merging products in group ${group.group_id}:`, mergeError);
            groupErrorCount++;
            groupErrors.push(`${duplicateProduct.name}: ${mergeError.message}`);
          } else if (!result?.success) {
            console.error(`Merge operation failed for group ${group.group_id}:`, result?.message);
            groupErrorCount++;
            groupErrors.push(`${duplicateProduct.name}: ${result?.message || "Unknown error"}`);
          } else {
            groupMergedCount++;
          }
        }

        // Update overall counters
        if (groupErrorCount === 0) {
          mergedCount++;
          details.push({
            group: group.match_reason,
            success: true,
            primary: primaryProduct.name,
            duplicate: duplicateProducts.map(p => p.name).join(', ')
          });
        } else if (groupMergedCount === 0) {
          // All merges failed
          errorCount++;
          details.push({
            group: group.match_reason,
            success: false,
            error: groupErrors.join('; '),
            primary: primaryProduct.name,
            duplicate: duplicateProducts.map(p => p.name).join(', ')
          });
        } else {
          // Partial success
          mergedCount++;
          details.push({
            group: group.match_reason,
            success: true,
            primary: primaryProduct.name,
            duplicate: duplicateProducts.map(p => p.name).join(', '),
            error: `Partial success: ${groupErrors.join('; ')}`
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
