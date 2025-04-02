import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import LandingPage from "./marketing-routes/page";

export default async function Home() {
  // Check if the user is authenticated
  const session = await getServerSession(authOptions);
  
  // If authenticated, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }
  
  // Otherwise, render the marketing landing page
  return <LandingPage />;
}
