/**
 * Email service for sending transactional emails
 * Uses Resend API for reliable email delivery
 */

interface EmailOptions {
  to: string;
  subject: string;
  content: string;
  fromName?: string;
  fromEmail?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  const { to, subject, content, fromName = 'PriceTracker', fromEmail } = options;

  // Check if Resend API key is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, email sending disabled');
    throw new Error('Email service not configured');
  }

  // Default from email
  const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@pricetracker.se';
  const finalFromEmail = fromEmail || defaultFromEmail;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${finalFromEmail}>`,
        to: [to],
        subject,
        html: convertTextToHtml(content),
        text: content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Resend API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert plain text to basic HTML for better email formatting
 */
function convertTextToHtml(text: string): string {
  return text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p><\/p>/g, '<p>&nbsp;</p>');
}

/**
 * Send a welcome email to a new user
 */
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<EmailResponse> {
  const subject = 'Welcome to PriceTracker!';
  const content = `Hello ${userName},

Welcome to PriceTracker! We're excited to have you on board.

Your account is now active and you can start tracking competitor prices right away. Here's what you can do:

• Add your products and competitors
• Set up automated price monitoring
• Receive alerts when prices change
• Generate detailed reports

If you have any questions or need help getting started, feel free to reach out to our support team.

Best regards,
The PriceTracker Team

---
PriceTracker - Your Competitive Pricing Solution
https://www.pricetracker.se`;

  return sendEmail({
    to: userEmail,
    subject,
    content,
    fromName: 'PriceTracker Team',
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(userEmail: string, resetLink: string): Promise<EmailResponse> {
  const subject = 'Reset Your PriceTracker Password';
  const content = `Hello,

You requested to reset your password for your PriceTracker account.

Click the link below to reset your password:
${resetLink}

This link will expire in 24 hours for security reasons.

If you didn't request this password reset, please ignore this email.

Best regards,
The PriceTracker Team

---
PriceTracker - Your Competitive Pricing Solution
https://www.pricetracker.se`;

  return sendEmail({
    to: userEmail,
    subject,
    content,
    fromName: 'PriceTracker Security',
  });
}

/**
 * Send an account suspension notification
 */
export async function sendAccountSuspensionEmail(userEmail: string, userName: string, reason?: string): Promise<EmailResponse> {
  const subject = 'Important: Your PriceTracker Account Has Been Suspended';
  const content = `Hello ${userName},

We're writing to inform you that your PriceTracker account has been temporarily suspended.

${reason ? `Reason: ${reason}` : 'Please contact our support team for more information about the reason for this suspension.'}

To resolve this issue and reactivate your account, please contact our support team at support@pricetracker.se.

We apologize for any inconvenience this may cause.

Best regards,
The PriceTracker Team

---
PriceTracker - Your Competitive Pricing Solution
https://www.pricetracker.se`;

  return sendEmail({
    to: userEmail,
    subject,
    content,
    fromName: 'PriceTracker Support',
  });
}

/**
 * Send an account reactivation notification
 */
export async function sendAccountReactivationEmail(userEmail: string, userName: string): Promise<EmailResponse> {
  const subject = 'Your PriceTracker Account Has Been Reactivated';
  const content = `Hello ${userName},

Good news! Your PriceTracker account has been reactivated and you can now access all features again.

You can log in to your account and continue tracking competitor prices as usual.

Thank you for your patience during the suspension period.

Best regards,
The PriceTracker Team

---
PriceTracker - Your Competitive Pricing Solution
https://www.pricetracker.se`;

  return sendEmail({
    to: userEmail,
    subject,
    content,
    fromName: 'PriceTracker Support',
  });
}
