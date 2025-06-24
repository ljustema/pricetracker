import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { redirect } from 'next/navigation';
import { ensureUUID } from '@/lib/utils/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import InsightsComponent from '@/components/insights/InsightsComponent';

export const metadata = {
  title: 'Insights | PriceTracker',
  description: 'View insights about your products, competitors, and integrations',
};

export default async function InsightsPage() {
  // Get the authenticated user's session
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Convert the NextAuth user ID to a UUID
  const userId = ensureUUID(session.user.id);
  const supabase = createSupabaseAdminClient();

  let stockData = null;

  try {
    // Fetch stock data for the Stock Analysis tab
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id, name, website')
      .eq('user_id', userId)
      .order('name');

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

    const { data: stockStats } = await supabase
      .rpc('get_stock_summary_stats', {
        p_user_id: userId
      });

    stockData = {
      competitors: competitors || [],
      recentStockChanges: recentStockChanges || [],
      stockStats: stockStats || null
    };
  } catch (error) {
    console.error('Error loading stock data:', error);
    // Continue without stock data - the Stock Analysis tab will show an error message
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Insights</h1>
      <InsightsComponent stockData={stockData} />
    </div>
  );
}
