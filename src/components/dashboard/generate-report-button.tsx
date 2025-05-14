"use client";

import { useState } from "react";
import { exportProductsCSV } from "@/lib/services/product-client-service";
import { useToast } from "@/components/ui/use-toast";

export default function GenerateReportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    try {
      setIsExporting(true);

      // Set the filter for products with higher prices than competitors
      const exportFilters = {
        price_higher_than_competitors: true,
        sortBy: 'created_at',
        sortOrder: 'desc',
      };

      await exportProductsCSV(exportFilters);

      toast({
        title: "Report Generated",
        description: "Products with higher prices than competitors have been exported to CSV.",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      onClick={handleGenerateReport}
      className="flex flex-col items-center rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md cursor-pointer"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-medium text-gray-900">Generate Report</h3>
      <p className="text-center text-sm text-gray-500">
        {isExporting ? "Generating..." : "Products with higher prices"}
      </p>
    </div>
  );
}
