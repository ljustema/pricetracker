import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | PriceTracker',
  description: 'Learn about PriceTracker and our mission to help businesses stay competitive',
};

export default function AboutPage() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">About PriceTracker</h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            PriceTracker was founded with a simple mission: to help businesses of all sizes stay competitive in an increasingly dynamic market.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:mx-0 lg:mt-10 lg:max-w-none lg:grid-cols-12">
          <div className="relative lg:order-last lg:col-span-5">
            <figure className="border-l border-indigo-600 pl-8">
              <blockquote className="text-xl font-semibold leading-8 tracking-tight text-gray-900">
                <p>
                  "PriceTracker has transformed how we approach pricing strategy. We're now able to respond to market changes in real-time and stay ahead of our competitors."
                </p>
              </blockquote>
              <figcaption className="mt-8 flex gap-x-4">
                <div className="text-sm leading-6">
                  <div className="font-semibold text-gray-900">Sarah Johnson</div>
                  <div className="text-gray-600">CEO at TechRetail</div>
                </div>
              </figcaption>
            </figure>
          </div>
          <div className="lg:col-span-7">
            <div className="text-base leading-7 text-gray-700">
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Our Story</h2>
              <div className="max-w-xl">
                <p className="mt-6">
                  In today's fast-paced e-commerce landscape, pricing is more dynamic than ever. Competitors can change their prices multiple times per day, and staying competitive requires constant vigilance.
                </p>
                <p className="mt-8">
                  We built PriceTracker after experiencing this challenge firsthand. As e-commerce store owners, we struggled to keep track of our competitors' prices manually. We needed a solution that could automatically monitor competitor prices, alert us to changes, and provide actionable insights.
                </p>
                <p className="mt-8">
                  When we couldn't find a solution that met our needs at an affordable price point, we decided to build it ourselves. PriceTracker was born out of this necessity, and we've been refining it based on real-world feedback ever since.
                </p>
                <h2 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">Our Mission</h2>
                <p className="mt-6">
                  Our mission is to democratize access to competitive pricing intelligence. We believe that businesses of all sizes should have access to the tools they need to stay competitive in the market.
                </p>
                <p className="mt-8">
                  We're committed to building a platform that is:
                </p>
                <ul className="mt-4 list-disc pl-8 space-y-2">
                  <li><strong>Easy to use:</strong> No technical expertise required</li>
                  <li><strong>Affordable:</strong> Pricing plans for businesses of all sizes</li>
                  <li><strong>Powerful:</strong> Enterprise-grade features at a fraction of the cost</li>
                  <li><strong>Reliable:</strong> Accurate data you can trust for making business decisions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* Team section */}
        <div className="mx-auto mt-32 max-w-7xl">
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our Team</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              We're a small but dedicated team of e-commerce experts, developers, and data scientists passionate about helping businesses succeed.
            </p>
          </div>
          <ul role="list" className="mx-auto mt-20 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <li>
              <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex-auto">
                  <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">Alex Chen</h3>
                  <p className="text-base leading-7 text-gray-600">Founder & CEO</p>
                  <p className="mt-4 text-sm leading-6 text-gray-600">Former e-commerce store owner with a passion for data-driven decision making.</p>
                </div>
              </div>
            </li>
            <li>
              <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex-auto">
                  <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">Maria Rodriguez</h3>
                  <p className="text-base leading-7 text-gray-600">CTO</p>
                  <p className="mt-4 text-sm leading-6 text-gray-600">Web scraping expert with 10+ years of experience in data extraction technologies.</p>
                </div>
              </div>
            </li>
            <li>
              <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex-auto">
                  <h3 className="text-lg font-semibold leading-8 tracking-tight text-gray-900">David Kim</h3>
                  <p className="text-base leading-7 text-gray-600">Head of Customer Success</p>
                  <p className="mt-4 text-sm leading-6 text-gray-600">Dedicated to ensuring our customers get the most value from PriceTracker.</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
        
        {/* CTA section */}
        <div className="mx-auto mt-32 max-w-7xl sm:mt-40">
          <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Join us on our mission
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
              Start tracking competitor prices today and make data-driven pricing decisions.
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
