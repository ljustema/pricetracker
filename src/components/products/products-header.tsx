"use client";

import Link from "next/link";
import { useState } from "react";
import { UploadIcon, PlusIcon } from "lucide-react";
import CSVUploadForm from "./csv-upload-form";

export default function ProductsHeader() {
  const [showCSVUploadForm, setShowCSVUploadForm] = useState(false);

  const handleCSVUploadSuccess = () => {
    setShowCSVUploadForm(false);
    // Refresh the page to show the new products
    window.location.reload();
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
              onClick={() => setShowCSVUploadForm(true)}
              className="flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              Upload CSV
            </button>
            <Link
              href="/app-routes/products/new"
              className="flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}