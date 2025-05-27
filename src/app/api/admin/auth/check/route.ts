import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/admin/auth';

// GET /api/admin/auth/check - Check admin status without throwing errors for non-admins
// This endpoint is now primarily for server-side validation and debugging
export async function GET(request: NextRequest) {
  try {
    // Check admin access without throwing errors
    const adminUser = await checkAdminAccess();

    if (adminUser) {
      return NextResponse.json({
        isAdmin: true,
        adminRole: adminUser.adminRole,
        message: 'Admin access confirmed'
      });
    } else {
      // Return 200 with isAdmin: false instead of 403 for non-admins
      return NextResponse.json({
        isAdmin: false,
        message: 'User is not an admin'
      });
    }

  } catch (error) {
    console.error('Error in admin auth check:', error);
    return NextResponse.json(
      { isAdmin: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
