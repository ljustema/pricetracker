import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import MobileMenu from "../../components/layout/mobile-menu";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current user from the session
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
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
            {session?.user ? (
              <Link href="/app-routes/dashboard" className="text-sm font-semibold leading-6 text-gray-900">
                Dashboard <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : (
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
            )}
          </div>
          {/* Mobile menu */}
          <MobileMenu isAuthenticated={!!session?.user} />
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-grow">{children}</main>
    </div>
  );
}