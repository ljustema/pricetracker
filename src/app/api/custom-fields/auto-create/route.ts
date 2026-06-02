import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// GET /api/custom-fields/auto-create - Check if auto-creation is enabled
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // Check user settings for auto-create preference
    const { data: userSettings, error } = await supabase
      .from('user_settings')
      .select('auto_create_custom_fields')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    // Default to true if no setting exists
    const autoCreateEnabled = userSettings?.auto_create_custom_fields ?? true;

    return NextResponse.json({ 
      autoCreateEnabled,
      description: 'When enabled, custom fields will be automatically created from scraped data that contains unknown fields'
    });
  } catch (error) {
    console.error('Error in auto-create GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/custom-fields/auto-create - Enable/disable auto-creation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean value' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Update or insert user setting
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.id,
        auto_create_custom_fields: enabled,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error updating user settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      autoCreateEnabled: enabled,
      message: `Auto-creation of custom fields ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error in auto-create POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
