import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import crypto from 'crypto';
import { PriceChange as ServicePriceChange } from "@/lib/services/product-service";
import ClientProductPage from "./client-page";

// Removed unused type definitions

// Use the same interface as the service to ensure compatibility
type PriceChange = ServicePriceChange;

// Helper function to ensure user ID is a valid UUID (same as in API route)
function ensureUUID(id: string): string {
  // Check if the ID is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }

  // If not a UUID, create a deterministic UUID v5 from the ID
  // Using the DNS namespace as a base
  return crypto.createHash('md5').update(id).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

export const metadata: Metadata = {
  title: "Product Details | PriceTracker",
  description: "View product details and competitor prices",
};

interface ProductPageProps {
  params: {
    productId: string;
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  // Get the current user from the session
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/auth-routes/login");
  }

  // Get the product details from Supabase using the admin client to bypass RLS
  const supabase = createSupabaseAdminClient();

  // Convert the NextAuth user ID to a UUID (same as in API route)
  const userId = ensureUUID(session.user.id);

  // Get productId from params
  const productId = params.productId;

  // Check if productId is a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(productId)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Invalid product ID format. Please use a valid product ID.
        </div>
      </div>
    );
  }

  // Fetch the product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", userId)
    .single();

  if (productError) {
    console.error("Error fetching product:", productError);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          Error: {productError.message}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Product not found or you don&apos;t have permission to view it.
        </div>
      </div>
    );
  }

  // Import the product service
  const { getLatestCompetitorPrices: getLatestPrices, getProductPriceHistory } = await import('@/lib/services/product-service');

  // Fetch latest prices for this product from all sources
  let competitorPrices: PriceChange[] = [];
  try {
    competitorPrices = await getLatestPrices(userId, productId);
  } catch (error) {
    console.error("Error fetching latest prices:", error);
  }

  // Fetch price history for this product
  let priceHistory: PriceChange[] = [];
  try {
    priceHistory = await getProductPriceHistory(userId, productId, undefined, 20);
  } catch (error) {
    console.error("Error fetching price history:", error);
    // Continue with empty price history
  }

  return <ClientProductPage
    product={product}
    competitorPrices={competitorPrices}
    priceHistory={priceHistory}
  />;
}