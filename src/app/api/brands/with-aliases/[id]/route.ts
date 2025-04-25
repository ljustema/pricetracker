import { NextResponse, NextRequest } from 'next/server';
import { BrandService } from '@/lib/services/brand-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export async function GET(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    // Extract the ID from the URL directly
    const id = request.nextUrl.pathname.split('/').pop();

    if (!id) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    const brandService = new BrandService();
    const brandWithAliases = await brandService.getBrandWithAliases(userId, id);

    if (!brandWithAliases) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    return NextResponse.json(brandWithAliases);
  } catch (error: unknown) {
    console.error('Error fetching brand with aliases:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    if (errorMessage === 'User not authenticated.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch brand with aliases', details: errorMessage }, { status: 500 });
  }
}
