import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/custom-fields/values - Get custom field values for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('field_id');

    const supabase = createSupabaseAdminClient();

    // Build the query
    let query = supabase
      .from('product_custom_field_values')
      .select(`
        id,
        value,
        custom_field_id,
        product_id,
        source_type,
        source_id,
        last_updated_by,
        confidence_score,
        created_by_source,
        created_at,
        updated_at,
        product_custom_fields!inner (
          id,
          field_name,
          field_type,
          is_required,
          default_value,
          validation_rules,
          user_id
        )
      `)
      .eq('product_custom_fields.user_id', session.user.id);

    // If field_id is provided, filter by that specific field
    if (fieldId) {
      query = query.eq('custom_field_id', fieldId);
    }

    // Execute the query
    const { data: customFieldValues, error } = await query
      .order('created_at', { ascending: false })
      .limit(fieldId ? 5000 : 1000); // Higher limit for specific field, lower for all fields

    if (error) {
      console.error('Error fetching custom field values:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom field values' },
        { status: 500 }
      );
    }

    if (!customFieldValues || customFieldValues.length === 0) {
      return NextResponse.json({ customFieldValues: [] });
    }

    // Get unique product IDs from the custom field values
    const uniqueProductIds = [...new Set(customFieldValues.map(v => v.product_id))];

    // Get product information in batches to avoid URI too large error
    const batchSize = 100;
    const allProducts = [];

    for (let i = 0; i < uniqueProductIds.length; i += batchSize) {
      const batchIds = uniqueProductIds.slice(i, i + batchSize);

      const { data: batchProducts, error: batchError } = await supabase
        .from('products')
        .select('id, name, sku, brand')
        .in('id', batchIds)
        .eq('user_id', session.user.id); // Ensure products belong to user

      if (batchError) {
        console.error('Error fetching batch products:', batchError);
        continue; // Continue with other batches
      }

      if (batchProducts) {
        allProducts.push(...batchProducts);
      }
    }

    // Create a map of products for easy lookup
    const productsMap = new Map(allProducts.map(p => [p.id, p]));

    // Merge product information with custom field values
    const enrichedCustomFieldValues = customFieldValues
      .map(value => ({
        ...value,
        products: productsMap.get(value.product_id) || null
      }))
      .filter(value => value.products !== null); // Only include values for products that belong to the user

    return NextResponse.json({ customFieldValues: enrichedCustomFieldValues });
  } catch (error) {
    console.error('Error in custom field values GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
