"use client";


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { exportProductsCSV } from "@/lib/services/product-client-service";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CSVExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportFilters: {
    brand?: string;
    category?: string;
    search?: string;
    isActive?: boolean;
    sourceId?: string | string[];
    hasPrice?: boolean;
    notOurProducts?: boolean;
    sortBy?: string;
    sortOrder?: string;
    price_lower_than_competitors?: boolean;
    price_higher_than_competitors?: boolean;
    in_stock_only?: boolean;
    our_products_with_competitor_prices?: boolean;
    our_products_with_supplier_prices?: boolean;
  };
  isExporting: boolean;
  setIsExporting: (isExporting: boolean) => void;
}

export default function CSVExportDialog({
  open,
  onOpenChange,
  exportFilters,
  isExporting,
  setIsExporting,
}: CSVExportDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  // State for custom field source filters
  const [includeCompetitorFields, setIncludeCompetitorFields] = useState(false);
  const [includeSupplierFields, setIncludeSupplierFields] = useState(false);
  // State for price filters
  const [includeCompetitorPrices, setIncludeCompetitorPrices] = useState(false);
  const [includeSupplierPrices, setIncludeSupplierPrices] = useState(false);
  // State for stock filters
  const [includeCompetitorStock, setIncludeCompetitorStock] = useState(false);
  const [includeSupplierStock, setIncludeSupplierStock] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = Object.entries(exportFilters).some(([key, value]) => {
    // Skip sort parameters as they're not really filters
    if (key === 'sortBy' || key === 'sortOrder') return false;
    return value !== undefined && value !== null && value !== '';
  });

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      await exportProductsCSV({
        ...exportFilters,
        includeCompetitorFields,
        includeSupplierFields,
        includeCompetitorPrices,
        includeSupplierPrices,
        includeCompetitorStock,
        includeSupplierStock
      });

      toast({
        title: "Export Successful",
        description: "Products have been exported to CSV successfully.",
      });

      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error("Error exporting products:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export products to CSV",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleApplyFilters = () => {
    // Navigate to products page with price_higher_than_competitors filter
    router.push("/app-routes/products?price_higher_than_competitors=true&sort=created_at&sortOrder=desc");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Products to CSV</DialogTitle>
          <DialogDescription>
            {hasActiveFilters
              ? "You are about to export products with the current filters applied."
              : "You are about to export all products. Consider applying filters first to get more specific data."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {!hasActiveFilters && (
            <div className="mb-4 p-4 bg-blue-50 text-blue-800 rounded-md">
              <p className="font-medium mb-2">Filter Suggestion</p>
              <p className="text-sm mb-2">
                You can filter products to get more specific data. For example:
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Products with prices higher than competitors</li>
                <li>Products with prices lower than competitors</li>
                <li>Products from a specific brand or category</li>
              </ul>
            </div>
          )}

          <p className="text-sm text-gray-600">
            {hasActiveFilters
              ? "The CSV will include only the products that match your current filters."
              : "Without filters, the CSV will include all your products, which might be a large file."}
          </p>
        </div>

        {/* Custom Fields and Prices Filter Options */}
        <div className="py-4 border-t">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Additional Data</h4>

          <div className="space-y-4">
            {/* Custom Fields Section */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Custom Fields</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="competitor-fields"
                    checked={includeCompetitorFields}
                    onCheckedChange={(checked) => setIncludeCompetitorFields(checked as boolean)}
                  />
                  <label
                    htmlFor="competitor-fields"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include competitor custom fields
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supplier-fields"
                    checked={includeSupplierFields}
                    onCheckedChange={(checked) => setIncludeSupplierFields(checked as boolean)}
                  />
                  <label
                    htmlFor="supplier-fields"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include supplier custom fields
                  </label>
                </div>
              </div>
            </div>

            {/* Prices Section */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Latest Prices</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="competitor-prices"
                    checked={includeCompetitorPrices}
                    onCheckedChange={(checked) => setIncludeCompetitorPrices(checked as boolean)}
                  />
                  <label
                    htmlFor="competitor-prices"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include competitor prices
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supplier-prices"
                    checked={includeSupplierPrices}
                    onCheckedChange={(checked) => setIncludeSupplierPrices(checked as boolean)}
                  />
                  <label
                    htmlFor="supplier-prices"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include supplier prices
                  </label>
                </div>
              </div>
            </div>

            {/* Stock Section */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Latest Stock</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="competitor-stock"
                    checked={includeCompetitorStock}
                    onCheckedChange={(checked) => setIncludeCompetitorStock(checked as boolean)}
                  />
                  <label
                    htmlFor="competitor-stock"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include competitor stock
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supplier-stock"
                    checked={includeSupplierStock}
                    onCheckedChange={(checked) => setIncludeSupplierStock(checked as boolean)}
                  />
                  <label
                    htmlFor="supplier-stock"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include supplier stock
                  </label>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            By default, only basic product information is included. Check the boxes above to include additional custom fields, latest prices, and stock quantities in your CSV export.
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {!hasActiveFilters && (
            <Button
              variant="secondary"
              onClick={handleApplyFilters}
              className="w-full"
            >
              Apply Price Filter
            </Button>
          )}
          <Button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? "Exporting..." : "Download CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
