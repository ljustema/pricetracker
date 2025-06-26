import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/custom-fields/values/[id] - Get a specific custom field value
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: customFieldValue, error } = await supabase
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
        product_custom_fields (
          id,
          field_name,
          field_type,
          is_required,
          default_value,
          validation_rules
        )
      `)
      .eq('id', id)
      .single();

    if (error || !customFieldValue) {
      return NextResponse.json(
        { error: 'Custom field value not found' },
        { status: 404 }
      );
    }

    // Get product information and verify ownership
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, sku, brand, user_id')
      .eq('id', customFieldValue.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Verify the product belongs to the user
    if (product.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Add product info to the response
    const enrichedCustomFieldValue = {
      ...customFieldValue,
      products: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        brand: product.brand
      }
    };

    return NextResponse.json({ customFieldValue: enrichedCustomFieldValue });
  } catch (error) {
    console.error('Error in custom field value GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/custom-fields/values/[id] - Update a custom field value
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { value } = body;

    if (value === undefined) {
      return NextResponse.json(
        { error: 'value is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // First verify the custom field value exists and belongs to the user
    const { data: existingValue, error: fetchError } = await supabase
      .from('product_custom_field_values')
      .select(`
        id,
        products (
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existingValue) {
      return NextResponse.json(
        { error: 'Custom field value not found' },
        { status: 404 }
      );
    }

    if ((existingValue.products as unknown as { user_id: string })?.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update the custom field value
    const { data: updatedValue, error } = await supabase
      .from('product_custom_field_values')
      .update({
        value: String(value),
        last_updated_by: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
        product_custom_fields (
          id,
          field_name,
          field_type,
          is_required,
          default_value,
          validation_rules
        )
      `)
      .single();

    if (error) {
      console.error('Error updating custom field value:', error);
      return NextResponse.json(
        { error: 'Failed to update custom field value' },
        { status: 500 }
      );
    }

    // Get updated product information
    const { data: updatedProduct, error: productError } = await supabase
      .from('products')
      .select('id, name, sku, brand')
      .eq('id', updatedValue.product_id)
      .single();

    if (productError) {
      console.error('Error fetching updated product:', productError);
      return NextResponse.json(
        { error: 'Failed to fetch updated product' },
        { status: 500 }
      );
    }

    // Add product info to the response
    const enrichedUpdatedValue = {
      ...updatedValue,
      products: updatedProduct
    };

    return NextResponse.json({ customFieldValue: enrichedUpdatedValue });
  } catch (error) {
    console.error('Error in custom field value PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/custom-fields/values/[id] - Delete a custom field value
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // First verify the custom field value exists and belongs to the user
    const { data: existingValue, error: fetchError } = await supabase
      .from('product_custom_field_values')
      .select(`
        id,
        products (
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existingValue) {
      return NextResponse.json(
        { error: 'Custom field value not found' },
        { status: 404 }
      );
    }

    if ((existingValue.products as unknown as { user_id: string })?.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete the custom field value
    const { error } = await supabase
      .from('product_custom_field_values')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting custom field value:', error);
      return NextResponse.json(
        { error: 'Failed to delete custom field value' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Custom field value deleted successfully' });
  } catch (error) {
    console.error('Error in custom field value DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
