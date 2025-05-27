import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import SupportDashboard from "@/components/support/SupportDashboard";

export const metadata: Metadata = {
  title: "Support - PriceTracker",
  description: "Get help and support for your PriceTracker account",
};

export default async function SupportPage() {
  // Check if user is authenticated
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/app-routes/support");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SupportDashboard user={session.user} />
    </div>
  );
}
