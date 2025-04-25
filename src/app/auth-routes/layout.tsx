import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current user from the session
  const session = await getServerSession(authOptions);
  
  // If user is already logged in, redirect to dashboard
  if (session?.user) {
    redirect("/app-routes/dashboard");
  }
  
  return (
    <div className="flex min-h-screen flex-col">
      {/* Simple header with logo */}
      <header className="bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
          <div className="flex">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="sr-only">PriceTracker</span>
              <span className="text-xl font-bold text-indigo-600">PriceTracker</span>
            </Link>
          </div>
          <div className="flex items-center gap-x-4">
            <Link href="/" className="text-sm font-semibold leading-6 text-gray-900">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow">{children}</main>

      {/* Simple footer */}
      <footer className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="mt-8 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-500">
              {new Date().getFullYear()} PriceTracker, Inc. All rights reserved.
            </p>
          </div>
          <div className="mt-8 md:mt-0">
            <div className="flex justify-center space-x-6">
              <Link href="/marketing-routes/privacy-policy" className="text-xs leading-5 text-gray-500 hover:text-gray-900">
                Privacy Policy
              </Link>
              <Link href="/marketing-routes/terms" className="text-xs leading-5 text-gray-500 hover:text-gray-900">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}