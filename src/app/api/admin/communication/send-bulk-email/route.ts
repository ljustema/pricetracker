import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";

// POST /api/admin/communication/send-bulk-email - Send email to multiple users
export async function POST(request: NextRequest) {
  try {
    // Validate admin access and get admin user
    const adminUser = await validateAdminApiAccess();

    const body = await request.json();
    const { userIds, subject, content } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, content' },
        { status: 400 }
      );
    }

    if (userIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot send to more than 100 users at once' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get all recipient users
    const { data: recipients, error: recipientsError } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', userIds);

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError);
      return NextResponse.json(
        { error: 'Failed to fetch recipients' },
        { status: 500 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients found' },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const communicationLogs = [];

    // Send emails to each recipient
    for (const recipient of recipients) {
      let status = 'sent';
      let errorMessage = null;

      try {
        // Personalize content
        const personalizedContent = content
          .replace(/\{\{name\}\}/g, recipient.name || 'User')
          .replace(/\{\{email\}\}/g, recipient.email);

        // Send email
        await sendEmail({
          to: recipient.email,
          subject,
          content: personalizedContent,
          fromName: adminUser.name || 'PriceTracker Admin',
        });

        successCount++;
      } catch (emailError) {
        console.error(`Error sending email to ${recipient.email}:`, emailError);
        status = 'failed';
        errorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
        failureCount++;
      }

      // Prepare communication log entry
      communicationLogs.push({
        admin_user_id: adminUser.id,
        target_user_id: recipient.id,
        communication_type: 'email',
        subject,
        message_content: content,
        status,
        error_message: errorMessage,
      });

      // Add small delay to avoid overwhelming the email service
      if (recipients.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Log all communications in batch
    const { error: logError } = await supabase
      .from('admin_communication_log')
      .insert(communicationLogs);

    if (logError) {
      console.error('Error logging communications:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Bulk email completed`,
      successCount,
      failureCount,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error('Error in bulk email send:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
