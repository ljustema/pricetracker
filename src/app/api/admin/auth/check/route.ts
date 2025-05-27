import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiAccess } from '@/lib/admin/auth';

// GET /api/admin/auth/check - Lightweight admin access check
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    await validateAdminApiAccess();

    return NextResponse.json({
      isAdmin: true,
      message: 'Admin access confirmed'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { isAdmin: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { isAdmin: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
