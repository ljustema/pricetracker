import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";

// Rate limiting helper
async function checkRateLimit(ip: string, endpoint: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const windowStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  // Check existing attempts in the last hour
  const { data: attempts, error } = await supabase
    .from('rate_limit_log')
    .select('attempts')
    .eq('ip_address', ip)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString())
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Rate limit check error:', error);
    return false; // Allow on error to avoid blocking legitimate users
  }

  if (attempts && attempts.attempts >= 3) {
    return false; // Rate limited
  }

  // Log this attempt
  if (attempts) {
    // Update existing record
    await supabase
      .from('rate_limit_log')
      .update({ attempts: attempts.attempts + 1 })
      .eq('ip_address', ip)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString());
  } else {
    // Create new record
    await supabase
      .from('rate_limit_log')
      .insert({
        ip_address: ip,
        endpoint,
        attempts: 1,
        window_start: new Date().toISOString()
      });
  }

  return true;
}

// Spam detection helper
function isSpamContent(message: string): boolean {
  const spamKeywords = [
    'crypto', 'bitcoin', 'loan', 'casino', 'viagra', 'seo services',
    'make money', 'get rich', 'investment opportunity', 'click here',
    'limited time', 'act now', 'free money', 'guaranteed'
  ];

  const suspiciousPatterns = [
    /https?:\/\/[^\s]+/gi, // Multiple URLs
    /(.)\1{10,}/gi, // Repeated characters
    /[A-Z]{20,}/gi, // Excessive caps
    /\b\d{10,}\b/gi, // Long numbers (phone numbers, etc.)
  ];

  const lowerMessage = message.toLowerCase();

  // Check for spam keywords
  const hasSpamKeywords = spamKeywords.some(keyword => lowerMessage.includes(keyword));

  // Check for suspicious patterns
  const hasSuspiciousPatterns = suspiciousPatterns.some(pattern => pattern.test(message));

  // Check for excessive URLs
  const urlMatches = message.match(/https?:\/\/[^\s]+/gi);
  const hasExcessiveUrls = Boolean(urlMatches && urlMatches.length > 2);

  return hasSpamKeywords || hasSuspiciousPatterns || hasExcessiveUrls;
}

// POST /api/professional-scraper-request - Submit professional scraper request
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';

    // Check rate limit
    const isAllowed = await checkRateLimit(ip, 'professional-scraper-request');
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      competitorId,
      competitorName,
      name,
      email,
      website,
      requirements,
      additionalInfo,
      honeypot // Honeypot field for spam detection
    } = body;

    // Check honeypot field
    if (honeypot && honeypot.trim() !== '') {
      console.log('Honeypot triggered, likely spam submission');
      return NextResponse.json(
        { error: 'Invalid submission' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!competitorId || !name || !email || !website || !requirements) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate website URL
    try {
      new URL(website);
    } catch {
      return NextResponse.json(
        { error: 'Invalid website URL' },
        { status: 400 }
      );
    }

    // Check for spam content
    const fullMessage = `${requirements} ${additionalInfo || ''}`;
    if (isSpamContent(fullMessage)) {
      console.log('Spam content detected in professional scraper request');
      return NextResponse.json(
        { error: 'Message content not allowed' },
        { status: 400 }
      );
    }

    // Validate message length
    if (requirements.length < 10 || requirements.length > 2000) {
      return NextResponse.json(
        { error: 'Requirements must be between 10 and 2000 characters' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Create professional scraper request
    const { data: scraperRequest, error: requestError } = await supabase
      .from('professional_scraper_requests')
      .insert({
        user_id: session.user.id,
        competitor_id: competitorId,
        name,
        email,
        website,
        requirements,
        additional_info: additionalInfo || null,
        status: 'submitted'
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating scraper request:', requestError);
      return NextResponse.json(
        { error: 'Failed to submit request' },
        { status: 500 }
      );
    }

    // Create support conversation for this request
    const subject = `Professional Scraper Request - ${competitorName || 'Competitor'}`;
    const conversationMessage = `Professional scraper service request submitted:

**Competitor:** ${competitorName || 'Unknown'}
**Website:** ${website}
**Contact:** ${name} (${email})

**Requirements:**
${requirements}

${additionalInfo ? `**Additional Information:**\n${additionalInfo}` : ''}

**Request ID:** ${scraperRequest.id}
**Status:** Submitted`;

    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .insert({
        user_id: session.user.id,
        subject,
        category: 'scraper_request',
        priority: 'medium',
        status: 'open'
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      // Don't fail the request if conversation creation fails
    } else {
      // Add initial message to conversation
      await supabase
        .from('support_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: session.user.id,
          sender_type: 'user',
          message_content: conversationMessage
        });
    }

    // Send email notification to admin
    try {
      await sendEmail({
        to: 'admin@info.pricetracker.se', // Replace with actual admin email
        subject: `New Professional Scraper Request - ${competitorName || 'Competitor'}`,
        content: `A new professional scraper request has been submitted:

Customer: ${name} (${email})
Competitor: ${competitorName || 'Unknown'}
Website: ${website}

Requirements:
${requirements}

${additionalInfo ? `Additional Information:\n${additionalInfo}` : ''}

Request ID: ${scraperRequest.id}
Conversation ID: ${conversation?.id || 'N/A'}

Please review and respond via the admin panel.`,
        fromName: 'PriceTracker System'
      });
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Professional scraper request submitted successfully',
      requestId: scraperRequest.id,
      conversationId: conversation?.id
    });

  } catch (error) {
    console.error('Error in professional scraper request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
