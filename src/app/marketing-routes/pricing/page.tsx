import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { CheckIcon } from '@heroicons/react/24/solid';

export const metadata: Metadata = {
  title: 'Pricing | PriceTracker',
  description: 'Choose the right plan for your business to track competitor prices effectively',
};

const tiers = [
  {
    name: 'Free',
    id: 'tier-free',
    href: '/auth-routes/register',
    price: { monthly: '$0' },
    description: 'Get started with basic price tracking for small businesses.',
    features: [
      '1 competitor',
      '5,000 products max',
      'Basic analytics',
      'Manual scraping',
    ],
    cta: 'Get started for free',
    mostPopular: false,
  },
  {
    name: 'Pro',
    id: 'tier-pro',
    href: '/auth-routes/register?plan=pro',
    price: { monthly: '$49' },
    description: 'Ideal for growing businesses that need more advanced features.',
    features: [
      '5 competitors',
      '25,000 products max',
      'Advanced analytics',
      'Automated scraping',
      'Email alerts',
      '1 free custom scraper script',
    ],
    cta: 'Start free trial',
    mostPopular: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    href: '/auth-routes/register?plan=enterprise',
    price: { monthly: '$99' },
    description: 'Dedicated support and infrastructure for your company.',
    features: [
      '10 competitors',
      '50,000 products max',
      'Full analytics suite',
      'Priority support',
      'API access',
      'Custom integrations',
    ],
    cta: 'Start free trial',
    mostPopular: false,
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function PricingPage() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h1>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Pricing plans for businesses of all sizes
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Choose the right pricing plan for your business to effectively track and analyze competitor prices.
          </p>
        </div>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {tiers.map((tier, tierIdx) => (
            <div
              key={tier.id}
              className={classNames(
                tier.mostPopular ? 'lg:z-10 lg:rounded-b-none' : 'lg:mt-8',
                tierIdx === 0 ? 'lg:rounded-r-none' : '',
                tierIdx === tiers.length - 1 ? 'lg:rounded-l-none' : '',
                'flex flex-col justify-between rounded-3xl bg-white p-8 ring-1 ring-gray-200 xl:p-10'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h2
                    id={tier.id}
                    className={classNames(
                      tier.mostPopular ? 'text-indigo-600' : 'text-gray-900',
                      'text-lg font-semibold leading-8'
                    )}
                  >
                    {tier.name}
                  </h2>
                  {tier.mostPopular ? (
                    <p className="rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-semibold leading-5 text-indigo-600">
                      Most popular
                    </p>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-gray-600">{tier.description}</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-gray-900">{tier.price.monthly}</span>
                  <span className="text-sm font-semibold leading-6 text-gray-600">/month</span>
                </p>
                <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckIcon className="h-6 w-5 flex-none text-indigo-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={tier.href}
                aria-describedby={tier.id}
                className={classNames(
                  tier.mostPopular
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500'
                    : 'text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300',
                  'mt-8 block rounded-md py-2 px-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                )}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mx-auto max-w-7xl px-6 mt-32 lg:px-8">
        <div className="mx-auto max-w-4xl divide-y divide-gray-900/10">
          <h2 className="text-2xl font-bold leading-10 tracking-tight text-gray-900">Frequently asked questions</h2>
          <dl className="mt-10 space-y-6 divide-y divide-gray-900/10">
            <div className="pt-6">
              <dt className="text-lg font-semibold leading-7 text-gray-900">
                How does the competitor limit work?
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                The competitor limit refers to the number of distinct competitor websites you can track simultaneously. Each plan allows you to monitor a specific number of competitors across all your products.
              </dd>
            </div>
            <div className="pt-6">
              <dt className="text-lg font-semibold leading-7 text-gray-900">
                Can I upgrade or downgrade my plan later?
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                Yes, you can change your subscription plan at any time. When upgrading, you'll get immediate access to additional features. When downgrading, the changes will take effect at the end of your current billing cycle.
              </dd>
            </div>
            <div className="pt-6">
              <dt className="text-lg font-semibold leading-7 text-gray-900">
                What are custom scraper scripts?
              </dt>
              <dd className="mt-2 text-base leading-7 text-gray-600">
                Custom scraper scripts are specialized tools we develop for you to extract pricing data from specific competitor websites that may have complex structures or anti-scraping measures. Pro plans include one free custom script, while Enterprise plans include priority development for custom integrations.
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mx-auto mt-32 max-w-7xl sm:mt-40 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start tracking competitor prices today
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
            <Link href="/marketing-routes/features" className="text-sm font-semibold leading-6 text-white">
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
