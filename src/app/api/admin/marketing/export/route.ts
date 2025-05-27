import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";

// GET /api/admin/marketing/export - Export marketing data as CSV
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'contacts' or 'subscribers'

    if (!type || !['contacts', 'subscribers'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "contacts" or "subscribers"' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    if (type === 'contacts') {
      // Export marketing contacts
      const { data: contacts, error } = await supabase
        .from('marketing_contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error fetching contacts for export:', error);
        return NextResponse.json(
          { error: 'Failed to fetch contacts' },
          { status: 500 }
        );
      }

      // Generate CSV
      const csvHeaders = [
        'ID',
        'Name',
        'Email',
        'Company',
        'Contact Type',
        'Status',
        'Message',
        'Created At'
      ];

      const csvRows = contacts?.map(contact => [
        contact.id,
        contact.name,
        contact.email,
        contact.company || '',
        contact.contact_type,
        contact.status,
        `"${contact.message.replace(/"/g, '""')}"`, // Escape quotes in message
        new Date(contact.created_at).toISOString()
      ]) || [];

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="marketing_contacts_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });

    } else if (type === 'subscribers') {
      // Export newsletter subscribers
      const { data: subscribers, error } = await supabase
        .from('newsletter_subscriptions')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (error) {
        console.error('Database error fetching subscribers for export:', error);
        return NextResponse.json(
          { error: 'Failed to fetch subscribers' },
          { status: 500 }
        );
      }

      // Generate CSV
      const csvHeaders = [
        'ID',
        'Email',
        'Name',
        'Is Active',
        'Subscribed At',
        'Unsubscribed At'
      ];

      const csvRows = subscribers?.map(subscriber => [
        subscriber.id,
        subscriber.email,
        subscriber.name || '',
        subscriber.is_active ? 'Yes' : 'No',
        new Date(subscriber.subscribed_at).toISOString(),
        subscriber.unsubscribed_at ? new Date(subscriber.unsubscribed_at).toISOString() : ''
      ]) || [];

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid export type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error exporting marketing data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
