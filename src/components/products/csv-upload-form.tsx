"use client";

import { useState, useEffect } from "react";
import { UploadIcon, CheckCircleIcon, XCircleIcon, DownloadIcon } from "lucide-react";
import { uploadProductsCSV } from "@/lib/services/product-client-service";
import Image from "next/image";

interface Competitor {
  id: string;
  name: string;
}

interface CSVUploadFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CSVUploadForm({
  onSuccess,
  onCancel,
}: CSVUploadFormProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  interface UploadResult {
    success: boolean;
    productsAdded: number;
    pricesUpdated: number;
    message: string;
  }
  
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Fetch competitors when component mounts
  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        const response = await fetch('/api/competitors');
        if (response.ok) {
          const data = await response.json();
          setCompetitors(data);
          if (data.length > 0) {
            setSelectedCompetitorId(data[0].id);
          }
        } else {
          console.error("Failed to fetch competitors");
        }
      } catch (error) {
        console.error("Error fetching competitors:", error);
      }
    };

    fetchCompetitors();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    // Read the file content for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const content = event.target.result as string;
        previewCSV(content);
      }
    };
    reader.readAsText(file);
  };

  const previewCSV = (csvContent: string) => {
    // Simple CSV parser for preview
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      alert('CSV file is empty');
      return;
    }
    
    // Parse header row
    const headers = lines[0].split(',').map(header => header.trim());
    
    // Check for required headers
    const requiredHeaders = ['name', 'price'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      alert(`CSV file is missing required headers: ${missingHeaders.join(', ')}`);
      return;
    }
    
    // Parse data rows (limit to 5 for preview)
    const rows: Record<string, string>[] = [];
    const previewLimit = Math.min(lines.length - 1, 5);
    
    for (let i = 1; i <= previewLimit; i++) {
      const values = lines[i].split(',').map(value => value.trim());
      if (values.length !== headers.length) {
        alert(`Row ${i+1} has ${values.length} fields, expected ${headers.length}`);
        return;
      }
      
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
    
    setCsvPreview({ headers, rows });
  };

  const handleDownloadTemplate = async () => {
    try {
      const templateUrl = '/api/products/csv-template';
      window.open(templateUrl, '_blank');
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download template");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompetitorId) {
      alert("Please select a competitor");
      return;
    }

    if (!uploadedFile) {
      alert("Please upload a CSV file first");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await uploadProductsCSV(selectedCompetitorId, uploadedFile);
      setUploadResult(result as UploadResult);
      
      // Only call onSuccess if we actually succeeded
      if (result.success) {
        setTimeout(() => {
          onSuccess();
        }, 3000); // Show success message for 3 seconds before closing
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      alert(error instanceof Error ? error.message : "Failed to upload CSV");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">Upload Product Prices</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV file with product prices for a specific competitor
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
        {uploadResult ? (
          <div className={`p-4 rounded-md ${uploadResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex">
              {uploadResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
              )}
              <div>
                <h3 className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {uploadResult.success ? 'Upload Successful' : 'Upload Failed'}
                </h3>
                <div className="mt-2 text-sm text-gray-700">
                  <p>{uploadResult.message}</p>
                  {uploadResult.success && (
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>New products added: {uploadResult.productsAdded}</li>
                      <li>Prices updated: {uploadResult.pricesUpdated}</li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="competitor" className="block text-sm font-medium text-gray-700">
                Competitor
              </label>
              <select
                id="competitor"
                value={selectedCompetitorId}
                onChange={(e) => setSelectedCompetitorId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select a competitor</option>
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                CSV File
              </label>
              <div className="mt-1 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download Template
                </button>
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
                >
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Upload CSV
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
              {uploadedFile && (
                <p className="mt-2 text-sm text-gray-500">
                  Uploaded: {uploadedFile.name}
                </p>
              )}
            </div>

            {/* CSV Preview Section */}
            {csvPreview && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV Preview (first 5 rows)
                </label>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Image
                        </th>
                        {csvPreview.headers.map((header, index) => (
                          <th
                            key={index}
                            scope="col"
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {csvPreview.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {/* Image column first */}
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {row['image_url'] ? (
                              <div className="h-10 w-10 flex items-center justify-center">
                                <Image
                                  src={row['image_url']}
                                  alt="Product"
                                  width={40}
                                  height={40}
                                  className="max-h-10 max-w-10 object-contain"
                                  onError={(e) => {
                                    // Replace broken image with placeholder
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2248%22%20height%3D%2248%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23ccc%22%3E%3Cpath%20d%3D%22M0%200h24v24H0V0z%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M19%205v14H5V5h14m0-2H5c-1.1%200-2%20.9-2%202v14c0%201.1.9%202%202%202h14c1.1%200%202-.9%202-2V5c0-1.1-.9-2-2-2zm-4.86%208.86l-3%203.87L9%2013.14%206%2017h12l-3.86-5.14z%22%2F%3E%3C%2Fsvg%3E';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-10"></div>
                            )}
                          </td>
                          {/* Other columns */}
                          {csvPreview.headers.map((header, colIndex) => (
                            <td key={`${rowIndex}-${colIndex}`} className="px-3 py-2 whitespace-nowrap text-xs">
                              {row[header]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Required columns: name, price<br />
                  Optional columns: currency, sku, brand, ean, image_url, url
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          {!uploadResult && (
            <button
              type="submit"
              disabled={isSubmitting || !uploadedFile || !selectedCompetitorId}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? "Uploading..." : "Upload Products"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}