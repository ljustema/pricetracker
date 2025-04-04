import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link"; // Import Link
import { getServerSession } from "next-auth"; // Import getServerSession
import { authOptions } from "@/lib/auth/options"; // Import authOptions (using @ alias)
import "./globals.css";

// Import the AuthProvider
import AuthProvider from "@/components/providers/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PriceTracker | Monitor Competitor Prices",
  description: "Track and analyze competitor prices to stay competitive in the market",
  keywords: ["price tracking", "competitor analysis", "price monitoring", "ecommerce"],
};

// Make the layout async to fetch session
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch session on the server
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Conditionally render Marketing Header if user is NOT logged in */}
        {!session && (
          <header className="bg-white">
            <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
              <div className="flex lg:flex-1">
                {/* Link points to root */}
                <Link href="/" className="-m-1.5 p-1.5">
                  <span className="sr-only">PriceTracker</span>
                  <span className="text-xl font-bold text-indigo-600">PriceTracker</span>
                </Link>
              </div>
              <div className="hidden lg:flex lg:gap-x-12">
                 {/* Links point to canonical marketing routes */}
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
                {/* Show Login/Sign up if no session */}
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
              {/* Mobile menu button */}
              <div className="flex lg:hidden">
                <button
                  type="button"
                  className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
                  // Add onClick handler later if mobile menu is implemented
                >
                  <span className="sr-only">Open main menu</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              </div>
            </nav>
          </header>
        )}
        {/* AuthProvider wraps the main content */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
