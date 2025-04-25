import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { headers } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
// Removed ReadonlyURLSearchParams import, no longer needed here
import ProductsClientWrapper from "./products-client-wrapper"; // Import the new client wrapper

// Keep metadata export in the actual page file
export const metadata: Metadata = {
  title: "Products | PriceTracker",
  description: "Manage your products and track competitor prices",
};

// Define the props structure for the page component
interface ProductsPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

// This is the main Server Component for the page route
export default async function ProductsPage(props: ProductsPageProps) {
  // # Reason: Await searchParams as it is a Promise in Server Components.
  // Safely extract and process searchParams after awaiting.
  const searchParams = (await props.searchParams) || {};
  // Get the current user from the session
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/auth-routes/login");
  }

  console.log("Server-side session user ID:", session.user.id);

  // --- Server-Side Data Fetching ---
  const supabase = createSupabaseAdminClient();

  // 1. Fetch Competitors - Use hardcoded user ID for testing
  // const { data: competitorsData, error: competitorError } = await supabase
  //   .from('competitors')
  //   .select('*') // Select all fields to match Competitor type
  //   .eq('user_id', session.user.id)
  //   .order('name');

  const { data: competitorsData, error: competitorError } = await supabase
    .from('competitors')
    .select('*') // Select all fields to match Competitor type
    .eq('user_id', '4529fe61-c0e8-4af8-b934-d0cc73506212')
    .order('name');

  if (competitorError) {
    console.error("Error fetching competitors:", competitorError.message);
  } else {
    console.log("Fetched competitors:", competitorsData?.length || 0);
    if (competitorsData && competitorsData.length > 0) {
      console.log("First competitor:", competitorsData[0]);
    }
  }

  // 2. Fetch Brands from the brands table - Use hardcoded user ID for testing
  const { data: brandData, error: brandError } = await supabase
      .from('brands')
      .select('name, id')
      .eq('user_id', '4529fe61-c0e8-4af8-b934-d0cc73506212')
      .eq('is_active', true)
      .order('name');
  if (brandError) {
    console.error("Error fetching brands:", brandError.message);
  } else {
    console.log("Fetched brands:", brandData?.length || 0);
  }
  const brands = (brandData || []).map(item => ({ name: item.name, id: item.id }));

  // 3. Get Cookie Header
  const requestHeaders = await headers(); // Added await back - it IS needed in Server Components
  const cookieHeader = requestHeaders.get('cookie');

  // 4. No need to prepare URLSearchParams object here anymore.
  // We will pass the raw searchParams object directly.
  // --- End Server-Side Data Fetching ---

  // Render the Client Wrapper, passing down all necessary data
  return (
    <ProductsClientWrapper
      initialCompetitors={competitorsData || []}
      initialBrands={brands}
      cookieHeader={cookieHeader}
      searchParams={searchParams} // Pass the original plain object
    />
  );
}