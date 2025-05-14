import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import DashboardPreviewWrapper from "../components/marketing/DashboardPreviewWrapper";
import MobileMenu from "../components/layout/mobile-menu";

export const metadata: Metadata = {
  title: "PriceTracker | Monitor Competitor Prices",
  description: "Track and analyze competitor prices to stay competitive in the market",
};

// Landing page component logic including its header
function LandingPageContent() {
  return (
    <>
      {/* Marketing Header */}
      <header className="bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="sr-only">PriceTracker</span>
              <span className="text-xl font-bold text-indigo-600">PriceTracker</span>
            </Link>
          </div>
          <div className="hidden lg:flex lg:gap-x-12">
            <Link href="/marketing-routes/features" className="text-sm font-semibold leading-6 text-gray-900">
              Features
            </Link>
            <Link href="/marketing-routes/pricing" className="text-sm font-semibold leading-6 text-gray-900">
              Pricing
            </Link>
            <Link href="/marketing-routes/about" className="text-sm font-semibold leading-6 text-gray-900">
              About
            </Link>
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            <div className="flex items-center gap-x-4">
              <Link href="/auth-routes/login" className="text-sm font-semibold leading-6 text-gray-900">
                Log in
              </Link>
              <Link
                href="/auth-routes/register"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Sign up
              </Link>
            </div>
          </div>
          {/* Mobile menu */}
          <MobileMenu />
        </nav>
      </header>

      {/* Main Landing Page Content */}
      <div className="bg-white">
        {/* Hero section */}
        <div className="relative isolate overflow-hidden bg-gradient-to-b from-indigo-100/20">
          <div className="mx-auto max-w-7xl pb-24 pt-10 sm:pb-32 px-4 sm:px-6 lg:px-8 lg:py-20">
            {/* Text content - centered on all screen sizes */}
            <div className="mx-auto max-w-3xl text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                Monitor competitor prices automatically
              </h1>
              <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600">
                PriceTracker helps you stay competitive by automatically monitoring your competitors&apos; prices, alerting you to changes, and providing actionable insights.
              </p>
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-x-6">
                <Link
                  href="/auth-routes/register"
                  className="w-full sm:w-auto rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Get started for free
                </Link>
                <Link href="/marketing-routes/pricing" className="w-full sm:w-auto text-center sm:text-left text-sm font-semibold leading-6 text-gray-900">
                  View pricing <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* Dashboard preview - wider on desktop, contained on mobile */}
            <div className="mx-auto w-full max-w-[100%] sm:max-w-5xl mt-8 overflow-hidden">
              <div className="shadow-lg md:rounded-3xl">
                <div className="bg-indigo-500 [clip-path:inset(0)] md:[clip-path:inset(0_round_theme(borderRadius.3xl))]">
                  <div
                    className="absolute -inset-y-px left-1/2 -z-10 ml-10 w-[200%] skew-x-[-30deg] bg-indigo-100 opacity-20 ring-1 ring-inset ring-white md:ml-20 lg:ml-36"
                    aria-hidden="true"
                  />
                  <div className="relative px-2 sm:px-6 pt-8 sm:pt-10 md:px-10">
                    <div className="mx-auto md:mx-0">
                      <DashboardPreviewWrapper />
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
          <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-white sm:h-32" />
        </div>

        {/* Feature section */}
         <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-56 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-semibold leading-7 text-indigo-600">Monitor Smarter</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Everything you need to track competitor prices
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                PriceTracker provides a complete solution for monitoring competitor prices, analyzing trends, and making data-driven decisions.
              </p>
            </div>
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
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Screenshot showcase section */}
          <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-40 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-semibold leading-7 text-indigo-600">Powerful Features</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                See PriceTracker in action
              </p>
            </div>

            {/* Products screenshot */}
            <div className="mt-16 sm:mt-20">
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-2 lg:gap-x-8">
                <div className="relative group">
                  <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100 shadow-lg transition-all duration-300 group-hover:shadow-xl p-3">
                    <div className="p-3 bg-white rounded-xl h-full">
                      <Image
                        src="/screenshots/products_1.jpg"
                        alt="Products dashboard showing competitor prices"
                        className="w-full object-cover rounded-lg"
                        width={800}
                        height={450}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10"></div>
                  </div>
                  <div className="mt-5 px-2">
                    <h3 className="text-lg font-semibold leading-8 text-gray-900">
                      Product Management
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Track all your products and competitor prices in one place with powerful filtering and sorting options.
                    </p>
                  </div>
                </div>

                <div className="relative group">
                  <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100 shadow-lg transition-all duration-300 group-hover:shadow-xl p-3">
                    <div className="p-3 bg-white rounded-xl h-full">
                      <Image
                        src="/screenshots/insights_1.jpg"
                        alt="Analytics dashboard with pricing insights"
                        className="w-full object-cover rounded-lg"
                        width={800}
                        height={450}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10"></div>
                  </div>
                  <div className="mt-5 px-2">
                    <h3 className="text-lg font-semibold leading-8 text-gray-900">
                      Advanced Analytics
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Gain valuable insights with our comprehensive analytics dashboard showing price trends and market positioning.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* More screenshots */}
            <div className="mt-16">
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-2 lg:gap-x-8">
                <div className="relative group">
                  <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100 shadow-lg transition-all duration-300 group-hover:shadow-xl p-3">
                    <div className="p-3 bg-white rounded-xl h-full">
                      <Image
                        src="/screenshots/competitors_1.jpg"
                        alt="Competitor management interface"
                        className="w-full object-cover rounded-lg"
                        width={800}
                        height={450}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10"></div>
                  </div>
                  <div className="mt-5 px-2">
                    <h3 className="text-lg font-semibold leading-8 text-gray-900">
                      Competitor Management
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Easily add and manage competitors with our intuitive interface. Set up automated scrapers for each competitor.
                    </p>
                  </div>
                </div>

                <div className="relative group">
                  <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-gray-100 shadow-lg transition-all duration-300 group-hover:shadow-xl p-3">
                    <div className="p-3 bg-white rounded-xl h-full">
                      <Image
                        src="/screenshots/scrapers_1.jpg"
                        alt="Scraper configuration interface"
                        className="w-full object-cover rounded-lg"
                        width={800}
                        height={450}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10"></div>
                  </div>
                  <div className="mt-5 px-2">
                    <h3 className="text-lg font-semibold leading-8 text-gray-900">
                      Powerful Scraper Tools
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Configure and manage scrapers with our easy-to-use interface. Schedule automatic runs to keep your data fresh.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* CTA section */}
         <div className="mx-auto mt-32 max-w-7xl sm:mt-56">
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
                <Link href="/marketing-routes/pricing" className="text-sm font-semibold leading-6 text-white">
                  Learn more <span aria-hidden="true">→</span>
                </Link>
              </div>
              <svg
                viewBox="0 0 1024 1024"
                className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)]"
                aria-hidden="true"
              >
                <circle cx={512} cy={512} r={512} fill="url(#827591b1-ce8c-4110-b064-7cb85a0b1217)" fillOpacity="0.7" />
                <defs>
                  <radialGradient id="827591b1-ce8c-4110-b064-7cb85a0b1217">
                    <stop stopColor="#7775D6" />
                    <stop offset={1} stopColor="#E935C1" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
          </div>

        {/* Footer */}
         <footer className="mx-auto mt-32 max-w-7xl overflow-hidden px-6 pb-20 sm:mt-40 sm:pb-24 lg:px-8">
            <nav className="-mb-6 columns-2 sm:flex sm:justify-center sm:space-x-12" aria-label="Footer">
              <div className="pb-6">
                <Link href="/marketing-routes/pricing" className="text-sm leading-6 text-gray-600 hover:text-gray-900">
                  Pricing
                </Link>
              </div>
              <div className="pb-6">
                <Link href="/marketing-routes/features" className="text-sm leading-6 text-gray-600 hover:text-gray-900">
                  Features
                </Link>
              </div>
              <div className="pb-6">
                <Link href="/marketing-routes/about" className="text-sm leading-6 text-gray-600 hover:text-gray-900">
                  About
                </Link>
              </div>
              <div className="pb-6">
                <Link href="/privacy-policy" className="text-sm leading-6 text-gray-600 hover:text-gray-900">
                  Privacy Policy
                </Link>
              </div>
              <div className="pb-6">
                <Link href="/terms" className="text-sm leading-6 text-gray-600 hover:text-gray-900">
                  Terms of Service
                </Link>
              </div>
            </nav>
            <p className="mt-10 text-center text-xs leading-5 text-gray-500">
              {new Date().getFullYear()} PriceTracker, Inc. All rights reserved.
            </p>
          </footer>
      </div>
    </>
  );
}

// Main page component checks auth and renders content
export default async function Home() {
  // Check if the user is authenticated
  const session = await getServerSession(authOptions);

  // If authenticated, redirect to dashboard
  if (session?.user) {
    redirect("/app-routes/dashboard");
  }

  // Otherwise, render the marketing landing page content (which now includes the header)
  return <LandingPageContent />;
}
