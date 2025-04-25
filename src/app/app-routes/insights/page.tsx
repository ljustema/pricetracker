import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { redirect } from 'next/navigation';
import InsightsComponent from '@/components/insights/InsightsComponent';

export const metadata = {
  title: 'Insights | PriceTracker',
  description: 'View insights about your products, competitors, and integrations',
};

export default async function InsightsPage() {
  // Get the authenticated user's session
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Insights</h1>
      <InsightsComponent />
    </div>
  );
}
