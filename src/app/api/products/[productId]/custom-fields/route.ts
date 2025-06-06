import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/products/[productId]/custom-fields - Get custom field values for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await params;
    const supabase = createSupabaseAdminClient();

    // First verify the product belongs to the user
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('user_id', session.user.id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Get custom field values with field definitions
    const { data: customFieldValues, error } = await supabase
      .from('product_custom_field_values')
      .select(`
        id,
        value,
        custom_field_id,
        user_custom_fields (
          id,
          field_name,
          field_type,
          is_required,
          default_value,
          validation_rules
        )
      `)
      .eq('product_id', productId);

    if (error) {
      console.error('Error fetching custom field values:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom field values' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customFieldValues });
  } catch (error) {
    console.error('Error in product custom fields GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[productId]/custom-fields - Update custom field values for a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await params;
    const body = await request.json();
    const { customFieldValues } = body;

    if (!Array.isArray(customFieldValues)) {
      return NextResponse.json(
        { error: 'customFieldValues must be an array' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // First verify the product belongs to the user
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('user_id', session.user.id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Verify all custom fields belong to the user
    const customFieldIds = customFieldValues.map(cfv => cfv.custom_field_id);
    if (customFieldIds.length > 0) {
      const { data: userFields, error: fieldsError } = await supabase
        .from('user_custom_fields')
        .select('id')
        .eq('user_id', session.user.id)
        .in('id', customFieldIds);

      if (fieldsError || userFields.length !== customFieldIds.length) {
        return NextResponse.json(
          { error: 'One or more custom fields do not belong to the user' },
          { status: 403 }
        );
      }
    }

    // Delete existing custom field values for this product
    const { error: deleteError } = await supabase
      .from('product_custom_field_values')
      .delete()
      .eq('product_id', productId);

    if (deleteError) {
      console.error('Error deleting existing custom field values:', deleteError);
      return NextResponse.json(
        { error: 'Failed to update custom field values' },
        { status: 500 }
      );
    }

    // Insert new custom field values (only non-empty values)
    const valuesToInsert = customFieldValues
      .filter(cfv => cfv.value !== null && cfv.value !== undefined && cfv.value !== '')
      .map(cfv => ({
        product_id: productId,
        custom_field_id: cfv.custom_field_id,
        value: String(cfv.value),
      }));

    if (valuesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('product_custom_field_values')
        .insert(valuesToInsert);

      if (insertError) {
        console.error('Error inserting custom field values:', insertError);
        return NextResponse.json(
          { error: 'Failed to update custom field values' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: 'Custom field values updated successfully' });
  } catch (error) {
    console.error('Error in product custom fields PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
