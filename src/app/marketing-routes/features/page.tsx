import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features | PriceTracker',
  description: 'Explore the powerful features of PriceTracker for monitoring competitor prices',
};

export default function FeaturesPage() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Hero section */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-base font-semibold leading-7 text-indigo-600">Features</h1>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Everything you need to stay competitive
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            PriceTracker offers a comprehensive suite of tools to monitor competitor prices, analyze market trends, and make data-driven pricing decisions.
          </p>
        </div>

        {/* Main features section */}
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <svg className="h-5 w-5 flex-none text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
                </svg>
                Automated Scraping
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Our AI-powered scraping technology automatically extracts pricing data from competitor websites on a schedule you define.
                </p>
                <p className="mt-4">
                  • Schedule scraping jobs to run daily, weekly, or monthly<br />
                  • Support for complex websites with dynamic content<br />
                  • AI-assisted scraper creation for new competitors
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <svg className="h-5 w-5 flex-none text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                Real-time Alerts
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Receive instant notifications when competitors change their prices, so you can react quickly to market changes.
                </p>
                <p className="mt-4">
                  • Email alerts for price changes<br />
                  • Customizable thresholds for notifications<br />
                  • Daily and weekly price change summaries
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <svg className="h-5 w-5 flex-none text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                </svg>
                Trend Analysis
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Visualize pricing trends over time with interactive charts and reports to identify patterns and opportunities.
                </p>
                <p className="mt-4">
                  • Historical price tracking<br />
                  • Competitor price comparison charts<br />
                  • Market positioning analysis
                </p>
              </dd>
            </div>
          </dl>
        </div>

        {/* Feature showcase with screenshots */}
        <div className="mt-32 sm:mt-40">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-semibold leading-7 text-indigo-600">Powerful Dashboard</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Comprehensive overview of your pricing landscape
              </p>
            </div>
            <div className="mt-16 sm:mt-20 lg:mt-24">
              <div className="relative overflow-hidden rounded-xl bg-gray-900 shadow-xl">
                <img
                  src="/screenshots/dashboard_1.jpg"
                  alt="PriceTracker Dashboard"
                  className="w-full"
                />
              </div>
              <div className="mt-8 text-center text-lg text-gray-600">
                The dashboard gives you a complete overview of your competitors, products, and recent price changes.
              </div>
            </div>
          </div>
        </div>

        {/* Product management section */}
        <div className="mt-32 sm:mt-40">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
              <div className="lg:pr-8 lg:pt-4">
                <div className="lg:max-w-lg">
                  <h2 className="text-base font-semibold leading-7 text-indigo-600">Product Management</h2>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                    Track all your products in one place
                  </p>
                  <p className="mt-6 text-lg leading-8 text-gray-600">
                    Easily manage your product catalog and monitor competitor prices for each item.
                  </p>
                  <dl className="mt-10 max-w-xl space-y-8 text-base leading-7 text-gray-600 lg:max-w-none">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mr-3">
                        <svg className="h-5 w-5 text-indigo-600 mt-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-900 inline">Bulk import.</dt>
                        <dd className="inline"> Import products in bulk from CSV files or connect directly to your e-commerce platform.</dd>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mr-3">
                        <svg className="h-5 w-5 text-indigo-600 mt-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-900 inline">Advanced filtering.</dt>
                        <dd className="inline"> Filter products by brand, category, price range, and more to focus on what matters.</dd>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mr-3">
                        <svg className="h-5 w-5 text-indigo-600 mt-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-900 inline">Price comparison.</dt>
                        <dd className="inline"> See how your prices compare to competitors at a glance with visual indicators.</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl bg-gray-50 shadow-xl">
                <img
                  src="/screenshots/products_1.jpg"
                  alt="Product management interface"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="mx-auto mt-32 max-w-7xl sm:mt-40">
          <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to start tracking competitor prices?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
              Join thousands of businesses that use PriceTracker to stay competitive in the market.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/auth-routes/register"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started for free
              </Link>
              <Link href="/marketing-routes/pricing" className="text-sm font-semibold leading-6 text-white">
                View pricing <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
