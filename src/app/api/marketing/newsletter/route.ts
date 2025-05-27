import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Disposable email domains to block
const DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'getnada.com', 'maildrop.cc'
];

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (real) {
    return real;
  }

  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 1; // 1 submission per minute per IP

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

function validateNewsletterData(data: { email?: string; name?: string }): { isValid: boolean; error?: string } {
  const { email, name } = data;

  // Required fields
  if (!email) {
    return { isValid: false, error: "Email is required" };
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Invalid email address" };
  }

  // Check for disposable email
  if (isDisposableEmail(email)) {
    return { isValid: false, error: "Disposable email addresses are not allowed" };
  }

  // Length validations
  if (name && name.length > 100) {
    return { isValid: false, error: "Name must be less than 100 characters" };
  }

  return { isValid: true };
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // Rate limiting check
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: "Please wait before subscribing again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, name } = body;

    // Validate input data
    const validation = validateNewsletterData({ email, name });
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Create Supabase admin client (needed to bypass RLS for public newsletter signup)
    const supabase = createSupabaseAdminClient();

    // Check if email already exists
    const { data: existingSubscription } = await supabase
      .from('newsletter_subscriptions')
      .select('id, is_active, unsubscribed_at')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (existingSubscription) {
      if (existingSubscription.is_active) {
        return NextResponse.json(
          { error: "This email is already subscribed to our newsletter" },
          { status: 400 }
        );
      } else {
        // Reactivate subscription
        const { error: updateError } = await supabase
          .from('newsletter_subscriptions')
          .update({
            is_active: true,
            unsubscribed_at: null,
            subscribed_at: new Date().toISOString(),
            name: name?.trim() || null
          })
          .eq('id', existingSubscription.id);

        if (updateError) {
          console.error('Database error reactivating subscription:', updateError);
          return NextResponse.json(
            { error: "Failed to reactivate subscription" },
            { status: 500 }
          );
        }
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('newsletter_subscriptions')
        .insert({
          email: email.trim().toLowerCase(),
          name: name?.trim() || null,
          is_active: true
        });

      if (insertError) {
        console.error('Database error creating subscription:', insertError);
        return NextResponse.json(
          { error: "Failed to create subscription" },
          { status: 500 }
        );
      }
    }

    // Send confirmation email to user
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to PriceTracker Newsletter!',
        content: `Hi${name ? ` ${name}` : ''},

Thank you for subscribing to the PriceTracker newsletter! You'll now receive:

• Weekly pricing insights and market trends
• Product updates and new features
• Tips for competitive pricing strategies
• Industry analysis and reports

We respect your privacy and will never share your email address. You can unsubscribe at any time by clicking the unsubscribe link in any of our emails.

Best regards,
The PriceTracker Team

Unsubscribe: ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pricetracker.se'}/unsubscribe?email=${encodeURIComponent(email)}
Privacy Policy: ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pricetracker.se'}/privacy-policy`
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Send notification to admin team
    try {
      await sendEmail({
        to: 'info@pricetracker.se',
        subject: 'New Newsletter Subscription',
        content: `New Newsletter Subscription

Email: ${email}
Name: ${name || 'Not provided'}
Subscribed: ${new Date().toLocaleString()}
IP Address: ${clientIP}
Status: ${existingSubscription ? 'Reactivated' : 'New'}

This is an automated notification from PriceTracker newsletter signup.`
      });
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Successfully subscribed to newsletter",
      isReactivation: !!existingSubscription
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle unsubscribe requests
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Update subscription to inactive
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email', email.toLowerCase());

    if (error) {
      console.error('Database error unsubscribing:', error);
      return NextResponse.json(
        { error: "Failed to unsubscribe" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully unsubscribed from newsletter"
    });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
