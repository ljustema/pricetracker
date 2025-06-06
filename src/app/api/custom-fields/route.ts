import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/custom-fields - Get all custom fields for the authenticated user
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: customFields, error } = await supabase
      .from('user_custom_fields')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching custom fields:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom fields' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customFields });
  } catch (error) {
    console.error('Error in custom fields GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/custom-fields - Create a new custom field
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Validate field_name format (alphanumeric and underscores only)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field_name)) {
      return NextResponse.json(
        { error: 'field_name must start with a letter and contain only letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if field name already exists for this user
    const { data: existingField } = await supabase
      .from('user_custom_fields')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('field_name', field_name)
      .single();

    if (existingField) {
      return NextResponse.json(
        { error: 'A custom field with this name already exists' },
        { status: 409 }
      );
    }

    // Create the custom field
    const { data: customField, error } = await supabase
      .from('user_custom_fields')
      .insert({
        user_id: session.user.id,
        field_name,
        field_type,
        is_required: is_required || false,
        default_value: default_value || null,
        validation_rules: validation_rules || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating custom field:', error);
      return NextResponse.json(
        { error: 'Failed to create custom field' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customField }, { status: 201 });
  } catch (error) {
    console.error('Error in custom fields POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
