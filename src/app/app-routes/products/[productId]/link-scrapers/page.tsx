"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface ScrapedProduct {
  id: string;
  scraper_id: string;
  product_id: string;
}

interface Scraper {
  id: string;
  name: string;
  competitor_id: string;
  url: string;
  is_active: boolean;
}

interface Competitor {
  id: string;
  name: string;
  website: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  brand?: string;
}

export default function LinkScrapersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedScrapers, setSelectedScrapers] = useState<string[]>([]);

  // Use the useParams hook to get the productId from the URL
  const routeParams = useParams();
  const productId = routeParams.productId as string;

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

        // Fetch all scrapers
        const scrapersResponse = await fetch('/api/scrapers');

        if (!scrapersResponse.ok) {
          throw new Error("Failed to fetch scrapers");
        }

        const scrapersData = await scrapersResponse.json();
        setScrapers(scrapersData);

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

          // Set selected scrapers based on existing links
          const linkedScraperIds = scrapedProductsData.map((sp: ScrapedProduct) => sp.scraper_id);
          setSelectedScrapers(linkedScraperIds);
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
          You must be logged in to link scrapers to products.
        </div>
      </div>
    );
  }

  const handleToggleScraper = (scraperId: string) => {
    setSelectedScrapers((prev) => {
      if (prev.includes(scraperId)) {
        return prev.filter((id) => id !== scraperId);
      } else {
        return [...prev, scraperId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // This is a placeholder for the actual API call
      // In a real implementation, you would create an API endpoint to handle linking scrapers to products
      const response = await fetch(`/api/products/${productId}/link-scrapers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scraperIds: selectedScrapers,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link scrapers to product');
      }

      // Redirect to the product details page
      router.push(`/products/${productId}`);
    } catch (err) {
      console.error("Error linking scrapers:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");

      // Since we don't have the actual API endpoint yet, we'll simulate success
      // Remove this in the real implementation
      setTimeout(() => {
        router.push(`/products/${productId}`);
      }, 1000);
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
        <h1 className="text-3xl font-bold">Link Scrapers to Product</h1>
        {product && (
          <p className="mt-2 text-gray-600">
            Select scrapers to link to <span className="font-medium">{product.name}</span>
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
              {competitors.map((competitor) => {
                const competitorScrapers = scrapers.filter(
                  (scraper) => scraper.competitor_id === competitor.id
                );

                if (competitorScrapers.length === 0) return null;

                return (
                  <div key={competitor.id} className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-4 text-lg font-medium">{competitor.name}</h3>

                    <div className="space-y-3">
                      {competitorScrapers.map((scraper) => (
                        <div key={scraper.id} className="flex items-center">
                          <input
                            id={`scraper-${scraper.id}`}
                            type="checkbox"
                            checked={selectedScrapers.includes(scraper.id)}
                            onChange={() => handleToggleScraper(scraper.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label
                            htmlFor={`scraper-${scraper.id}`}
                            className="ml-2 block text-sm text-gray-900"
                          >
                            {scraper.name}
                            <span className="ml-2 text-xs text-gray-500">
                              ({scraper.url})
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="text-gray-500">
                No scrapers found. Create scrapers for your competitors first.
              </p>
              <div className="mt-4">
                <Link
                  href="/scrapers/new"
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Create Scraper
                </Link>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || scrapers.length === 0}
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