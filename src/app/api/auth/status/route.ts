import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// GET /api/auth/status - Get current user authentication and authorization status
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({
        isAuthenticated: false,
        isAdmin: false,
        user: null
      });
    }

    return NextResponse.json({
      isAuthenticated: true,
      isAdmin: session.user.isAdmin || false,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        adminRole: session.user.adminRole || null,
        isSuspended: session.user.isSuspended || false
      }
    });

  } catch (error) {
    console.error('Error in auth status check:', error);
    return NextResponse.json(
      { 
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
