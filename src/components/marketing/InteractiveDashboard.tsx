'use client';

import React, { useState } from 'react';
import Image from 'next/image';

type Tab = 'dashboard' | 'competitors' | 'products';

interface InteractiveDashboardProps {
  className?: string;
}

export default function InteractiveDashboard({ className = '' }: InteractiveDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle tab changes with animation
  const handleTabChange = (tab: Tab) => {
    if (tab !== activeTab) {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTab(tab);
        setIsTransitioning(false);
      }, 200); // Match this with the CSS transition duration
    }
  };

  // Map of tab to screenshot
  const tabScreenshots = {
    dashboard: '/screenshots/dashboard_1.jpg',
    competitors: '/screenshots/competitors_1.jpg',
    products: '/screenshots/products_1.jpg',
  };

  // Map of tab to alt text
  const tabAltText = {
    dashboard: 'PriceTracker Dashboard',
    competitors: 'Competitor Management Interface',
    products: 'Product Management Interface',
  };

  return (
    <div className={`w-screen overflow-hidden rounded-tl-xl bg-gray-900 ${className}`}>
      {/* Tabs */}
      <div className="flex bg-gray-800/40 ring-1 ring-white/5">
        <div className="-mb-px flex text-sm font-medium leading-6 text-gray-400">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`px-4 py-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-b border-r border-b-white/20 border-r-white/10 bg-white/5 text-white'
                : 'border-r border-gray-600/10 hover:text-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleTabChange('competitors')}
            className={`px-4 py-2 transition-colors ${
              activeTab === 'competitors'
                ? 'border-b border-r border-b-white/20 border-r-white/10 bg-white/5 text-white'
                : 'border-r border-gray-600/10 hover:text-gray-300'
            }`}
          >
            Competitors
          </button>
          <button
            onClick={() => handleTabChange('products')}
            className={`px-4 py-2 transition-colors ${
              activeTab === 'products'
                ? 'border-b border-r border-b-white/20 border-r-white/10 bg-white/5 text-white'
                : 'border-r border-gray-600/10 hover:text-gray-300'
            }`}
          >
            Products
          </button>
        </div>
      </div>

      {/* Screenshot content */}
      <div className="px-6 pb-14 pt-6 relative">
        {/* Add a subtle animation for tab switching */}
        <div className={`relative transition-all duration-200 ease-in-out ${isTransitioning ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`}>
          <Image
            src={tabScreenshots[activeTab]}
            alt={tabAltText[activeTab]}
            className="rounded-lg shadow-md w-full"
            width={1200}
            height={800}
            priority
          />

          {/* Add a subtle overlay to indicate interactivity */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
        </div>

        {/* Add a small indicator to show this is interactive */}
        <div className="absolute bottom-4 right-4 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full opacity-70">
          Click tabs to explore
        </div>
      </div>
    </div>
  );
}
