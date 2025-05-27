import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";

// POST /api/admin/communication/send-email - Send email to individual user
export async function POST(request: NextRequest) {
  try {
    // Validate admin access and get admin user
    const adminUser = await validateAdminApiAccess();

    const body = await request.json();
    const { recipientId, subject, content } = body;

    if (!recipientId || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientId, subject, content' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get recipient user details
    const { data: recipient, error: recipientError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .eq('id', recipientId)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    let status = 'sent';
    let errorMessage = null;

    try {
      // Send email using email service
      await sendEmail({
        to: recipient.email,
        subject,
        content,
        fromName: adminUser.name || 'PriceTracker Admin',
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      status = 'failed';
      errorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
    }

    // Log the communication
    const { error: logError } = await supabase
      .from('admin_communication_log')
      .insert({
        admin_user_id: adminUser.id,
        target_user_id: recipientId,
        communication_type: 'email',
        subject,
        message_content: content,
        status,
        error_message: errorMessage,
      });

    if (logError) {
      console.error('Error logging communication:', logError);
      // Don't fail the request if logging fails
    }

    if (status === 'failed') {
      return NextResponse.json(
        { error: 'Failed to send email', details: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      recipient: {
        name: recipient.name,
        email: recipient.email,
      },
    });
  } catch (error) {
    console.error('Error in send email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
