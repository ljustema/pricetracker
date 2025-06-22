import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { redirect } from 'next/navigation';
import { ensureUUID } from '@/lib/utils/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import StockInsightsContent from './stock-insights-content';

export const metadata: Metadata = {
  title: 'Stock Insights | PriceTracker',
  description: 'Monitor competitor stock levels, sales velocity, and inventory analytics',
};

export default async function StockInsightsPage() {
  // Get the session
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Convert the NextAuth user ID to a UUID
  const userId = ensureUUID(session.user.id);
  const supabase = createSupabaseAdminClient();

  try {
    // Fetch competitors for filtering
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id, name, website')
      .eq('user_id', userId)
      .order('name');

    // Fetch recent stock changes for overview
    const { data: recentStockChanges } = await supabase
      .from('stock_changes_competitors')
      .select(`
        *,
        products(name, brand, sku),
        competitors(name)
      `)
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(50);

    // Get stock summary statistics
    const { data: stockStats } = await supabase
      .rpc('get_stock_summary_stats', {
        p_user_id: userId
      });

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Stock Insights</h1>
          <p className="mt-2 text-gray-600">
            Monitor competitor stock levels, track sales velocity, and analyze inventory trends
          </p>
        </div>

        <StockInsightsContent
          competitors={competitors || []}
          recentStockChanges={recentStockChanges || []}
          stockStats={stockStats || null}
        />
      </div>
    );
  } catch (error) {
    console.error('Error loading stock insights:', error);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Stock Insights</h1>
          <p className="mt-2 text-gray-600">
            Monitor competitor stock levels, track sales velocity, and analyze inventory trends
          </p>
        </div>

        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error Loading Stock Insights</p>
          <p>Unable to load stock data. Please try again later.</p>
        </div>
      </div>
    );
  }
}
