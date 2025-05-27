import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Spam detection keywords
const SPAM_KEYWORDS = [
  'crypto', 'bitcoin', 'loan', 'casino', 'viagra', 'seo services',
  'make money', 'get rich', 'investment opportunity', 'guaranteed profit',
  'click here', 'limited time', 'act now', 'free money'
];

// Suspicious patterns
const SUSPICIOUS_PATTERNS = [
  /https?:\/\/[^\s]+/gi, // Multiple URLs
  /(.)\1{10,}/gi, // Repeated characters
  /[A-Z]{20,}/gi, // Excessive caps
  /\b\d{10,}\b/gi, // Long numbers (phone/spam)
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
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 3; // 3 submissions per hour per IP

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

function isSpamContent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Check for spam keywords
  const hasSpamKeywords = SPAM_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword.toLowerCase())
  );

  // Check for suspicious patterns
  const hasSuspiciousPatterns = SUSPICIOUS_PATTERNS.some(pattern =>
    pattern.test(message)
  );

  return hasSpamKeywords || hasSuspiciousPatterns;
}

function validateContactData(data: {
  name?: string;
  email?: string;
  company?: string;
  contactType?: string;
  message?: string;
}): { isValid: boolean; error?: string } {
  const { name, email, company, contactType, message } = data;

  // Required fields
  if (!name || !email || !message) {
    return { isValid: false, error: "Name, email, and message are required" };
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Invalid email address" };
  }

  // Length validations
  if (name.length < 2 || name.length > 100) {
    return { isValid: false, error: "Name must be between 2 and 100 characters" };
  }

  if (message.length < 10 || message.length > 2000) {
    return { isValid: false, error: "Message must be between 10 and 2000 characters" };
  }

  if (company && company.length > 100) {
    return { isValid: false, error: "Company name must be less than 100 characters" };
  }

  // Contact type validation
  const validContactTypes = ['general', 'sales', 'support', 'partnership'];
  if (contactType && !validContactTypes.includes(contactType)) {
    return { isValid: false, error: "Invalid contact type" };
  }

  return { isValid: true };
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // Rate limiting check
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: "Too many contact submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, company, contactType = 'general', message } = body;

    // Validate input data
    const validation = validateContactData({ name, email, company, contactType, message });
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Spam detection
    if (isSpamContent(message)) {
      console.log(`Spam detected from IP ${clientIP}: ${message.substring(0, 100)}...`);
      return NextResponse.json(
        { error: "Message flagged as spam. Please contact us directly if this is an error." },
        { status: 400 }
      );
    }

    // Create Supabase admin client (needed to bypass RLS for public contact form)
    const supabase = createSupabaseAdminClient();

    // Insert contact submission into database
    const { data: contactData, error: dbError } = await supabase
      .from('marketing_contacts')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        company: company?.trim() || null,
        contact_type: contactType,
        message: message.trim(),
        status: 'new'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: "Failed to save contact submission" },
        { status: 500 }
      );
    }

    // Send email notification to admin team
    try {
      await sendEmail({
        to: 'info@pricetracker.se',
        subject: `New Contact Form Submission - ${contactType.charAt(0).toUpperCase() + contactType.slice(1)}`,
        content: `New Contact Form Submission

Name: ${name}
Email: ${email}
Company: ${company || 'Not provided'}
Contact Type: ${contactType}

Message:
${message}

Submitted: ${new Date().toLocaleString()}
IP Address: ${clientIP}

This is an automated notification from PriceTracker contact form.`
      });
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Send confirmation email to user
    try {
      await sendEmail({
        to: email,
        subject: 'Thank you for contacting PriceTracker',
        content: `Hi ${name},

We've received your message and will get back to you within 24 hours.

Your message:
${message}

If you have any urgent questions, you can also reach us directly at info@pricetracker.se

Best regards,
The PriceTracker Team

This is an automated confirmation email.`
      });
    } catch (emailError) {
      console.error('Failed to send user confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Contact form submitted successfully",
      id: contactData.id
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
