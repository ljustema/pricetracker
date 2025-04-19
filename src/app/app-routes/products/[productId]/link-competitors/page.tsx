"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface ScrapedProduct {
  id: string;
  competitor_id: string;
  product_id: string;
}

interface Competitor {
  id: string;
  name: string;
  website: string;
  notes?: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  brand?: string;
}

interface LinkCompetitorsPageProps {
  params: {
    productId: string;
  };
}

export default function LinkCompetitorsPage({ params }: LinkCompetitorsPageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  
  // Extract productId directly
  const productId = params.productId;

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user) return;

      try {
        // Fetch product details
        const productResponse = await fetch(`/api/products/${productId}`);
        
        if (!productResponse.ok) {
          throw new Error("Failed to fetch product");
        }
        
        const productData = await productResponse.json();
        setProduct(productData);

        // Fetch all competitors
        const competitorsResponse = await fetch('/api/competitors');
        
        if (!competitorsResponse.ok) {
          throw new Error("Failed to fetch competitors");
        }
        
        const competitorsData = await competitorsResponse.json();
        setCompetitors(competitorsData);

        // Fetch existing links (scraped products)
        const scrapedProductsResponse = await fetch(`/api/scraped-products?productId=${productId}`);
        
        if (scrapedProductsResponse.ok) {
          const scrapedProductsData = await scrapedProductsResponse.json();
          
          // Set selected competitors based on existing links
          const linkedCompetitorIds = scrapedProductsData
            .map((sp: ScrapedProduct) => sp.competitor_id)
            .filter(Boolean) as string[];
          // Remove duplicates
          setSelectedCompetitors([...new Set(linkedCompetitorIds)]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [session, productId]);

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to link competitors to products.
        </div>
      </div>
    );
  }

  const handleToggleCompetitor = (competitorId: string) => {
    setSelectedCompetitors((prev) => {
      if (prev.includes(competitorId)) {
        return prev.filter((id) => id !== competitorId);
      } else {
        return [...prev, competitorId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}/link-competitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorIds: selectedCompetitors,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link competitors to product');
      }

      // Redirect to the product details page
      router.push(`/products/${productId}`);
    } catch (err) {
      console.error("Error linking competitors:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Link Competitors to Product</h1>
        {product && (
          <p className="mt-2 text-gray-600">
            Select competitors to link to <span className="font-medium">{product.name}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {competitors.length > 0 ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-4 text-lg font-medium">Available Competitors</h3>
                
                <div className="space-y-3">
                  {competitors.map((competitor) => (
                    <div key={competitor.id} className="flex items-center">
                      <input
                        id={`competitor-${competitor.id}`}
                        type="checkbox"
                        checked={selectedCompetitors.includes(competitor.id)}
                        onChange={() => handleToggleCompetitor(competitor.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label
                        htmlFor={`competitor-${competitor.id}`}
                        className="ml-2 block text-sm text-gray-900"
                      >
                        {competitor.name}
                        {competitor.website && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({competitor.website})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="text-gray-500">
                No competitors found. Create competitors first.
              </p>
              <div className="mt-4">
                <Link
                  href="/competitors/new"
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Create Competitor
                </Link>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Link
              href={`/products/${productId}`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading || competitors.length === 0}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Links"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}