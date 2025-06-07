import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Not Authorized - PriceTracker",
  description: "You don't have permission to access this page.",
};

export default function NotAuthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900">403</h1>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Access Denied</h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Not Authorized</CardTitle>
            <CardDescription>
              You don&apos;t have permission to access this page. This area is restricted to authorized administrators only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              <p>If you believe you should have access to this page, please contact your system administrator.</p>
            </div>
            
            <div className="flex flex-col space-y-2">
              <Button asChild className="w-full">
                <Link href="/app-routes/dashboard">
                  Return to Dashboard
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/app-routes/settings">
                  Account Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Need help? Contact support at{" "}
          <a href="mailto:support@pricetracker.se" className="text-indigo-600 hover:text-indigo-500">
            support@pricetracker.se
          </a>
        </p>
      </div>
    </div>
  );
}
