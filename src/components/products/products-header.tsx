"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { UploadIcon, PlusIcon, GitMergeIcon, DownloadIcon } from "lucide-react";
import CSVUploadForm from "./csv-upload-form";
import CSVExportDialog from "./csv-export-dialog";
import { useSearchParams } from "next/navigation";
export default function ProductsHeader() {
  const [showCSVUploadForm, setShowCSVUploadForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [counts, setCounts] = useState({ duplicates: 0 });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const searchParams = useSearchParams();

  // Function to fetch counts
  const fetchCounts = async () => {
    try {
      const response = await fetch('/api/products/counts');
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  // Fetch counts for notification badges
  useEffect(() => {
    fetchCounts();

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);

    // Listen for custom events to refresh counts immediately
    const handleRefreshCounts = () => {
      fetchCounts();
    };

    window.addEventListener('refreshProductCounts', handleRefreshCounts);

    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshProductCounts', handleRefreshCounts);
    };
  }, []);

  const handleCSVUploadSuccess = () => {
    setShowCSVUploadForm(false);
    // Refresh the page to show the new products
    window.location.reload();
  };

  // Function to refresh counts (can be called from child components)
  const _refreshCounts = async () => {
    try {
      const response = await fetch('/api/products/counts');
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (error) {
      console.error('Error refreshing counts:', error);
    }
  };

  // Get filter parameters from URL search params
  const exportFilters = {
    brand: searchParams.get('brand') || undefined,
    category: searchParams.get('category') || undefined,
    search: searchParams.get('search') || undefined,
    isActive: searchParams.get('inactive') !== 'true',
    sourceId: (() => {
      // Handle multiple competitor IDs - pass all selected competitor IDs for CSV export
      const competitorParam = searchParams.get('competitor');
      if (competitorParam) {
        const competitorIds = competitorParam.split(',').filter(Boolean);
        return competitorIds.length > 0 ? competitorIds : undefined;
      }
      return undefined;
    })(),
    hasPrice: searchParams.get('has_price') === 'true',
    sortBy: searchParams.get('sort') || 'created_at',
    sortOrder: searchParams.get('sortOrder') || 'desc',
    price_lower_than_competitors: searchParams.get('price_lower_than_competitors') === 'true',
    price_higher_than_competitors: searchParams.get('price_higher_than_competitors') === 'true',
  };

  return (
    <div className="mb-8">
      {showCSVUploadForm ? (
        <CSVUploadForm
          onSuccess={handleCSVUploadSuccess}
          onCancel={() => setShowCSVUploadForm(false)}
        />
      ) : (
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Products</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowExportDialog(true)}
              disabled={isExporting}
              className="flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Download CSV"}
            </button>
            <button
              onClick={() => setShowCSVUploadForm(true)}
              className="flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              Upload CSV
            </button>

            <Link
              href="/app-routes/products/duplicates"
              className="flex items-center relative rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <GitMergeIcon className="h-4 w-4 mr-2" />
              Merge Duplicates
              {!isLoadingCounts && counts.duplicates > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {counts.duplicates}
                </span>
              )}
            </Link>
            <Link
              href="/app-routes/products/new"
              className="flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </div>

          {/* CSV Export Dialog */}
          <CSVExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            exportFilters={exportFilters}
            isExporting={isExporting}
            setIsExporting={setIsExporting}
          />
        </div>
      )}
    </div>
  );
}