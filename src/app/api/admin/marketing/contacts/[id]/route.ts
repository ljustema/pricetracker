import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";

// PATCH /api/admin/marketing/contacts/[id] - Update contact status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['new', 'contacted', 'resolved'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: new, contacted, resolved' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Update contact status
    const { data, error } = await supabase
      .from('marketing_contacts')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error updating contact:', error);
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      contact: data
    });

  } catch (error) {
    console.error('Error updating marketing contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/admin/marketing/contacts/[id] - Get specific contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { id } = params;
    const supabase = createSupabaseAdminClient();

    const { data: contact, error } = await supabase
      .from('marketing_contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error fetching contact:', error);
      return NextResponse.json(
        { error: 'Failed to fetch contact' },
        { status: 500 }
      );
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ contact });

  } catch (error) {
    console.error('Error fetching marketing contact:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
