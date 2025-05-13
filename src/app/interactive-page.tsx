'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type Tab = 'dashboard' | 'competitors' | 'products';

export default function InteractiveLandingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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
    <div className="bg-white">
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-indigo-100/20">
        <div className="mx-auto max-w-7xl pb-24 pt-10 sm:pb-32 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:px-8 lg:py-40">
          <div className="px-6 lg:px-0 lg:pt-4">
            <div className="mx-auto max-w-2xl">
              <div className="max-w-lg">
                <h1 className="mt-10 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                  Monitor competitor prices automatically
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  PriceTracker helps you stay competitive by automatically monitoring your competitors&apos; prices, alerting you to changes, and providing actionable insights.
                </p>
                <div className="mt-10 flex items-center gap-x-6">
                  <Link
                    href="/auth/register"
                    className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Get started for free
                  </Link>
                  <Link href="/pricing" className="text-sm font-semibold leading-6 text-gray-900">
                    View pricing <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-20 sm:mt-24 md:mx-auto md:max-w-2xl lg:mx-0 lg:mt-0 lg:w-screen">
            <div
              className="absolute inset-y-0 right-1/2 -z-10 -mr-10 w-[200%] skew-x-[-30deg] bg-white shadow-xl shadow-indigo-600/10 ring-1 ring-indigo-50 md:-mr-20 lg:-mr-36"
              aria-hidden="true"
            />
            <div className="shadow-lg md:rounded-3xl">
              <div className="bg-indigo-500 [clip-path:inset(0)] md:[clip-path:inset(0_round_theme(borderRadius.3xl))]">
                <div
                  className="absolute -inset-y-px left-1/2 -z-10 ml-10 w-[200%] skew-x-[-30deg] bg-indigo-100 opacity-20 ring-1 ring-inset ring-white md:ml-20 lg:ml-36"
                  aria-hidden="true"
                />
                <div className="relative px-6 pt-8 sm:pt-16 md:pl-16 md:pr-0">
                  <div className="mx-auto max-w-2xl md:mx-0 md:max-w-none">
                    <div className="w-screen overflow-hidden rounded-tl-xl bg-gray-900">
                      {/* Tabs */}
                      <div className="flex bg-gray-800/40 ring-1 ring-white/5">
                        <div className="-mb-px flex text-sm font-medium leading-6 text-gray-400">
                          <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2 transition-colors ${
                              activeTab === 'dashboard'
                                ? 'border-b border-r border-b-white/20 border-r-white/10 bg-white/5 text-white'
                                : 'border-r border-gray-600/10 hover:text-gray-300'
                            }`}
                          >
                            Dashboard
                          </button>
                          <button
                            onClick={() => setActiveTab('competitors')}
                            className={`px-4 py-2 transition-colors ${
                              activeTab === 'competitors'
                                ? 'border-b border-r border-b-white/20 border-r-white/10 bg-white/5 text-white'
                                : 'border-r border-gray-600/10 hover:text-gray-300'
                            }`}
                          >
                            Competitors
                          </button>
                          <button
                            onClick={() => setActiveTab('products')}
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
                        <div className="relative transition-all duration-200 ease-in-out">
                          <img
                            src={tabScreenshots[activeTab]}
                            alt={tabAltText[activeTab]}
                            className="rounded-lg shadow-md w-full"
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
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10 md:rounded-3xl"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
