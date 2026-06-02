import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/custom-fields/[id] - Get a specific custom field
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

    const { data: customField, error } = await supabase
      .from('product_custom_fields')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Custom field not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching custom field:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom field' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customField });
  } catch (error) {
    console.error('Error in custom field GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/custom-fields/[id] - Update a custom field
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
    const { field_name, field_type, is_required, default_value, validation_rules } = body;

    // Validate required fields
    if (!field_name || !field_type) {
      return NextResponse.json(
        { error: 'field_name and field_type are required' },
        { status: 400 }
      );
    }

    // Validate field_type
    const validTypes = ['text', 'number', 'boolean', 'url', 'date'];
    if (!validTypes.includes(field_type)) {
      return NextResponse.json(
        { error: `field_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate field_name format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field_name)) {
      return NextResponse.json(
        { error: 'field_name must start with a letter and contain only letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if the custom field exists and belongs to the user
    const { data: existingField } = await supabase
      .from('product_custom_fields')
      .select('id, field_name')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!existingField) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      );
    }

    // Check if field name already exists for this user (excluding current field)
    if (field_name !== existingField.field_name) {
      const { data: duplicateField } = await supabase
        .from('product_custom_fields')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('field_name', field_name)
        .neq('id', id)
        .single();

      if (duplicateField) {
        return NextResponse.json(
          { error: 'A custom field with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update the custom field
    const { data: customField, error } = await supabase
      .from('product_custom_fields')
      .update({
        field_name,
        field_type,
        is_required: is_required || false,
        default_value: default_value || null,
        validation_rules: validation_rules || null,
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating custom field:', error);
      return NextResponse.json(
        { error: 'Failed to update custom field' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customField });
  } catch (error) {
    console.error('Error in custom field PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/custom-fields/[id] - Delete a custom field
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

    // Check if the custom field exists and belongs to the user
    const { data: existingField } = await supabase
      .from('product_custom_fields')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!existingField) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      );
    }

    // Delete all product custom field values for this field first
    const { error: valuesError } = await supabase
      .from('product_custom_field_values')
      .delete()
      .eq('custom_field_id', id);

    if (valuesError) {
      console.error('Error deleting custom field values:', valuesError);
      return NextResponse.json(
        { error: 'Failed to delete custom field values' },
        { status: 500 }
      );
    }

    // Delete the custom field
    const { error } = await supabase
      .from('product_custom_fields')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error deleting custom field:', error);
      return NextResponse.json(
        { error: 'Failed to delete custom field' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Error in custom field DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
