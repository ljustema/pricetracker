'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Simple SVG icons
const IntegrationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const CompetitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const ProductIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const BrandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

// Define types for integration and competitor stats
interface IntegrationStat {
  id: string;
  name: string;
  platform: string;
  totalProducts: number;
  uniqueProducts: number;
}

interface CompetitorStat {
  id: string;
  name: string;
  totalProducts: number;
  uniqueProducts: number;
}

interface IntegrationCompetitorStats {
  totalProducts: number;
  integrations: IntegrationStat[];
  competitors: CompetitorStat[];
}

const InsightsComponent: React.FC = () => {
  const [stats, setStats] = useState<IntegrationCompetitorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch integration and competitor stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/brands/integration-competitor-stats');
        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching integration and competitor stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">Loading insights...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  if (!stats) {
    return <div className="text-center py-8">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Total Products</h3>
              <p className="text-3xl font-bold text-indigo-600">{stats.totalProducts.toLocaleString()}</p>
            </div>
            <div className="bg-indigo-50 p-2 rounded-full">
              <ProductIcon />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Integrations</h3>
              <p className="text-3xl font-bold text-indigo-600">{stats.integrations.length}</p>
            </div>
            <div className="bg-indigo-50 p-2 rounded-full">
              <IntegrationIcon />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Competitors</h3>
              <p className="text-3xl font-bold text-indigo-600">{stats.competitors.length}</p>
            </div>
            <div className="bg-indigo-50 p-2 rounded-full">
              <CompetitorIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
          <Link 
            href="/app-routes/integrations" 
            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Manage Integrations →
          </Link>
        </div>
        
        {stats.integrations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No integrations configured yet.</p>
            <Link 
              href="/app-routes/integrations" 
              className="mt-2 inline-block text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Set up your first integration
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.integrations.map((integration) => (
              <div 
                key={integration.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900">{integration.name}</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                    {integration.platform}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Products:</span>
                    <span className="font-medium">{integration.totalProducts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unique Products:</span>
                    <span className="font-medium">{integration.uniqueProducts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unique Product %:</span>
                    <span className="font-medium">
                      {integration.totalProducts > 0 
                        ? `${Math.round((integration.uniqueProducts / integration.totalProducts) * 100)}%` 
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Competitors Section */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Competitors</h2>
          <Link 
            href="/app-routes/competitors" 
            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Manage Competitors →
          </Link>
        </div>
        
        {stats.competitors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No competitors configured yet.</p>
            <Link 
              href="/app-routes/competitors" 
              className="mt-2 inline-block text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Add your first competitor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.competitors
              .sort((a, b) => b.totalProducts - a.totalProducts)
              .map((competitor) => (
                <div 
                  key={competitor.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-medium text-gray-900 mb-2">{competitor.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Products:</span>
                      <span className="font-medium">{competitor.totalProducts.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Unique Products:</span>
                      <span className="font-medium">{competitor.uniqueProducts.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Unique Product %:</span>
                      <span className="font-medium">
                        {competitor.totalProducts > 0 
                          ? `${Math.round((competitor.uniqueProducts / competitor.totalProducts) * 100)}%` 
                          : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsComponent;
