import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { getProductsWithPrices, type ProductWithPrices } from "@/lib/services/product-service";
import ProductCard from "@/components/products/product-card";
import ProductsTable from "@/components/products/products-table";
import ProductsHeader from "@/components/products/products-header";
import Pagination from "@/components/ui/pagination";
// Use absolute paths to avoid TypeScript errors
import ProductsFilter from "@/app/(app)/products/products-filter";
import ViewToggle from "@/app/(app)/products/view-toggle";

export const metadata: Metadata = {
  title: "Products | PriceTracker",
  description: "Manage your products and track competitor prices",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Get the current user from the session
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login");
  }
  
  // Extract searchParams values to avoid async access issues
  const params = await searchParams;
  const search = params.search as string | undefined;
  const brand = params.brand as string | undefined;
  const competitor = params.competitor as string | undefined;
  const inactive = params.inactive as string | undefined;
  const hasPrice = params.has_price as string | undefined;
  const sort = (params.sort as string) || 'name';
  const view = (params.view as "table" | "cards") || "cards";
  
  // Pagination parameters
  const page = parseInt(params.page as string || '1', 10);
  const itemsPerPage = 12; // Number of items per page
  
  // Get the user's products with competitor prices
  let products: ProductWithPrices[] = [];
  let error: string | null = null;
  
  // Define variables for competitors and brands
  let competitors: { id: string; name: string }[] = [];
  let brands: string[] = [];
  
  // Variable to store total count for pagination
  let totalProductCount = 0;
  
  try {
    // Fetch all products without any limit
    const allProducts = await getProductsWithPrices(session.user.id);
    
    // Get all competitors for the table view
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseAdminClient();
    const { data: competitorsData } = await supabase
      .from('competitors')
      .select('id, name')
      .eq('user_id', session.user.id)
      .order('name');
    
    // Store competitors data
    competitors = competitorsData || [];
    
    // Extract unique brands for filters
    brands = Array.from(new Set(allProducts.map(p => p.brand).filter(Boolean) as string[]));
    
    // Create a filtered copy of products
    let filteredProducts = [...allProducts];
    
    // Apply search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.sku?.toLowerCase().includes(searchTerm) ||
        p.ean?.toLowerCase().includes(searchTerm) ||
        p.brand?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply brand filter
    if (brand) {
      filteredProducts = filteredProducts.filter(p => p.brand === brand);
    }
    
    // Apply competitor filter
    if (competitor) {
      const competitorId = competitor;
      filteredProducts = filteredProducts.filter(p =>
        p.competitor_prices?.some(cp => cp.competitor_id === competitorId)
      );
    }
    
    // Apply active/inactive filter
    if (inactive !== 'true') {
      filteredProducts = filteredProducts.filter(p => p.is_active);
    }
    
    // Apply has price filter
    if (hasPrice === 'true') {
      filteredProducts = filteredProducts.filter(p => p.our_price !== null && p.our_price !== undefined);
    }
    
    // Apply sorting
    const sortBy = sort;
    
    switch (sortBy) {
      case 'name':
        filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        filteredProducts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default:
        filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Store the total count before pagination
    totalProductCount = filteredProducts.length;
    
    // Apply pagination
    const startIndex = (page - 1) * itemsPerPage;
    products = filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  } catch (err) {
    console.error("Error fetching products:", err);
    error = err instanceof Error ? err.message : "An unknown error occurred";
  }
  
  // Calculate total number of products (before pagination)
  const totalProducts = totalProductCount;
  
  return (
    <div className="container mx-auto px-4 py-8">
      <ProductsHeader />
      
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Filter and sort controls */}
      {totalProducts > 0 && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{(page - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(page * itemsPerPage, totalProducts)}
              </span>{" "}
              of <span className="font-medium">{totalProducts}</span> results
            </p>
            <ViewToggle defaultView={view} />
          </div>
          
          <ProductsFilter
            brands={brands}
            competitors={competitors || []}
          />
        </div>
      )}
      
      {products && products.length > 0 ? (
        <>
          {/* Show either table or card view based on the view parameter */}
          {view === 'table' ? (
            <ProductsTable
              products={products}
              competitors={competitors || []}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          
          {/* Pagination */}
          <Pagination
            totalItems={totalProducts}
            itemsPerPage={itemsPerPage}
            currentPage={page}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No products
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first product or uploading a CSV file.
          </p>
        </div>
      )}
    </div>
  );
}