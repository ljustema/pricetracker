"use client";

import Link from "next/link";
import { useState } from "react";
import { UploadIcon, PlusIcon, GitMergeIcon, DownloadIcon } from "lucide-react";
import CSVUploadForm from "./csv-upload-form";
import CSVExportDialog from "./csv-export-dialog";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

export default function ProductsHeader() {
  const [showCSVUploadForm, setShowCSVUploadForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleCSVUploadSuccess = () => {
    setShowCSVUploadForm(false);
    // Refresh the page to show the new products
    window.location.reload();
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
              className="flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <GitMergeIcon className="h-4 w-4 mr-2" />
              Merge Duplicates
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