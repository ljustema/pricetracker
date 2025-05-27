import { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/marketing/ContactForm";
import { NewsletterSignup } from "@/components/marketing/NewsletterSignup";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us | PriceTracker",
  description: "Get in touch with the PriceTracker team. We're here to help with your competitive pricing needs.",
};

export default function ContactPage() {
  return (
    <div className="bg-white">

      {/* Main content */}
      <div className="relative isolate">
        {/* Hero section */}
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Contact Our Team
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Have questions about PriceTracker? Need help with competitive pricing strategies?
              We're here to help you succeed.
            </p>
          </div>
        </div>

        {/* Contact section */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-3">
            {/* Contact information */}
            <div className="lg:col-span-1">
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                    Get in touch
                  </h2>
                  <p className="mt-4 text-lg leading-7 text-gray-600">
                    We'd love to hear from you. Send us a message and we'll respond as soon as possible.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start">
                    <Mail className="h-6 w-6 text-indigo-600 mt-1" />
                    <div className="ml-4">
                      <h3 className="text-base font-semibold text-gray-900">Email</h3>
                      <p className="text-gray-600">info@pricetracker.se</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Clock className="h-6 w-6 text-indigo-600 mt-1" />
                    <div className="ml-4">
                      <h3 className="text-base font-semibold text-gray-900">Response Time</h3>
                      <p className="text-gray-600">We typically respond within 24 hours</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <MapPin className="h-6 w-6 text-indigo-600 mt-1" />
                    <div className="ml-4">
                      <h3 className="text-base font-semibold text-gray-900">Location</h3>
                      <p className="text-gray-600">Sweden</p>
                    </div>
                  </div>
                </div>

                {/* Newsletter signup */}
                <div className="pt-8 border-t border-gray-200">
                  <NewsletterSignup
                    showTitle={true}
                    compact={true}
                  />
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="lg:col-span-2">
              <ContactForm showTitle={false} />
            </div>
          </div>
        </div>

        {/* FAQ section */}
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Quick answers to common questions about PriceTracker.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-4xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How does PriceTracker work?
                </h3>
                <p className="text-gray-600">
                  PriceTracker automatically monitors your competitors prices using advanced scraping technology.
                  You'll receive real-time alerts when prices change and can analyze trends over time.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-gray-600">
                  Yes! We offer a free plan that includes basic price monitoring for 1 competitor and up to 5000 products.
                  You can upgrade anytime to access more features and monitor more products.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How accurate is the price data?
                </h3>
                <p className="text-gray-600">
                  Our scraping technology is highly accurate and updates prices regularly.
                  We use multiple validation methods to ensure data quality and reliability.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Can you help set up custom scrapers?
                </h3>
                <p className="text-gray-600">
                  Absolutely! Our team can create custom scrapers for specific websites or complex requirements.
                  Contact us to discuss your needs and get a quote.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-8">
          <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-300">
              Join thousands of businesses using PriceTracker to stay competitive.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/auth-routes/register"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start free trial
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
