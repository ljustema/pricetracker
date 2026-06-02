import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { getLatestCompetitorStockBatch } from '@/lib/services/product-service';
import { ensureUUID } from '@/lib/utils/uuid';

export async function POST(request: NextRequest) {
  try {
    // Get the session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const { productIds } = await request.json();

    if (!productIds || !Array.isArray(productIds)) {
      return NextResponse.json(
        { error: 'Product IDs array is required' },
        { status: 400 }
      );
    }

    // Convert the NextAuth user ID to a UUID
    const userId = ensureUUID(session.user.id);

    // Fetch stock data for the products
    const stockData = await getLatestCompetitorStockBatch(userId, productIds);

    return NextResponse.json(stockData);
  } catch (error) {
    console.error('Error fetching batch stock data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}
