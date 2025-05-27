import { NextRequest, NextResponse } from "next/server";
import { validateAdminApiAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/admin/professional-scraper-requests - List all professional scraper requests
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const supabase = createSupabaseAdminClient();

    // Build query
    let query = supabase
      .from('professional_scraper_requests')
      .select(`
        *,
        user_profiles!professional_scraper_requests_user_id_fkey (
          id,
          name,
          email
        ),
        competitors!professional_scraper_requests_competitor_id_fkey (
          id,
          name,
          website
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,website.ilike.%${search}%,requirements.ilike.%${search}%`);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('professional_scraper_requests')
      .select('*', { count: 'exact', head: true });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: requests, error } = await query;

    if (error) {
      console.error('Error fetching professional scraper requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      requests: requests || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count || 0,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Error in admin professional scraper requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/professional-scraper-requests - Update request status
export async function PUT(request: NextRequest) {
  try {
    // Validate admin access
    const adminUser = await validateAdminApiAccess();

    const body = await request.json();
    const { 
      requestId, 
      status, 
      quotedPrice, 
      estimatedDeliveryDays, 
      adminNotes 
    } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['submitted', 'reviewing', 'quoted', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get the current request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('professional_scraper_requests')
      .select(`
        *,
        user_profiles!professional_scraper_requests_user_id_fkey (
          id,
          name,
          email
        ),
        competitors!professional_scraper_requests_competitor_id_fkey (
          id,
          name
        )
      `)
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Update the request
    const updateData: any = {
      status,
      admin_notes: adminNotes || null
    };

    if (quotedPrice !== undefined) {
      updateData.quoted_price = quotedPrice;
    }

    if (estimatedDeliveryDays !== undefined) {
      updateData.estimated_delivery_days = estimatedDeliveryDays;
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('professional_scraper_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating professional scraper request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update request' },
        { status: 500 }
      );
    }

    // Create or update support conversation message
    try {
      // Find existing conversation for this request
      const { data: conversations } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('user_id', currentRequest.user_id)
        .eq('category', 'scraper_request')
        .ilike('subject', `%${currentRequest.competitors?.name || 'Competitor'}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        // Add status update message to existing conversation
        let statusMessage = `Professional scraper request status updated to: **${status}**`;
        
        if (quotedPrice) {
          statusMessage += `\n\n**Quote:** €${quotedPrice}`;
        }
        
        if (estimatedDeliveryDays) {
          statusMessage += `\n**Estimated Delivery:** ${estimatedDeliveryDays} days`;
        }
        
        if (adminNotes) {
          statusMessage += `\n\n**Notes:**\n${adminNotes}`;
        }

        await supabase
          .from('support_messages')
          .insert({
            conversation_id: conversations[0].id,
            sender_id: adminUser.id,
            sender_type: 'admin',
            message_content: statusMessage
          });

        // Update conversation status if request is completed
        if (status === 'completed' || status === 'cancelled') {
          await supabase
            .from('support_conversations')
            .update({ status: 'resolved' })
            .eq('id', conversations[0].id);
        }
      }
    } catch (conversationError) {
      console.error('Error updating conversation:', conversationError);
      // Don't fail the request if conversation update fails
    }

    // Send email notification to user about status change
    try {
      const { sendEmail } = await import("@/lib/services/email-service");
      
      let emailContent = `Hello ${currentRequest.user_profiles?.name || 'there'},

Your professional scraper request for ${currentRequest.competitors?.name || 'your competitor'} has been updated.

**New Status:** ${status}`;

      if (quotedPrice) {
        emailContent += `\n**Quote:** €${quotedPrice}`;
      }
      
      if (estimatedDeliveryDays) {
        emailContent += `\n**Estimated Delivery:** ${estimatedDeliveryDays} days`;
      }
      
      if (adminNotes) {
        emailContent += `\n\n**Additional Information:**\n${adminNotes}`;
      }

      emailContent += `\n\nYou can view the full details and continue the conversation by logging into your PriceTracker account.

Best regards,
The PriceTracker Team`;

      await sendEmail({
        to: currentRequest.user_profiles?.email || currentRequest.email,
        subject: `Professional Scraper Request Update - ${status}`,
        content: emailContent,
        fromName: 'PriceTracker Team'
      });
    } catch (emailError) {
      console.error('Error sending status update email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Request updated successfully',
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error updating professional scraper request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
