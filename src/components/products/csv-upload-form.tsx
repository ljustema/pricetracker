"use client";

import { useState, useEffect } from "react";
import { UploadIcon, CheckCircleIcon, XCircleIcon, DownloadIcon } from "lucide-react";
import { uploadProductsCSV, uploadOwnProductsCSVViaIntegration } from "@/lib/services/product-client-service";
import { uploadSupplierProductsCSV } from "@/lib/services/supplier-client-service";
import Image from "next/image";

interface Competitor {
  id: string;
  name: string;
}

interface Integration {
  id: string;
  name: string;
  platform: string;
}

interface Supplier {
  id: string;
  name: string;
}

type ProductType = 'own' | 'competitor' | 'supplier';

interface CSVUploadFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CSVUploadForm({
  onSuccess,
  onCancel,
}: CSVUploadFormProps) {
  const [productType, setProductType] = useState<ProductType>('competitor');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    headers: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [delimiter, setDelimiter] = useState<',' | ';'>(',');
  const [_fieldMapping, _setFieldMapping] = useState<Record<string, string>>({});
  interface UploadResult {
    success: boolean;
    productsAdded: number;
    pricesUpdated: number;
    message: string;
  }

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Fetch competitors and integrations when component mounts
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

    const fetchIntegrations = async () => {
      try {
        const response = await fetch('/api/integrations');
        if (response.ok) {
          const data = await response.json();
          setIntegrations(data);
          if (data.length > 0) {
            setSelectedIntegrationId(data[0].id);
          }
        } else {
          console.error("Failed to fetch integrations");
        }
      } catch (error) {
        console.error("Error fetching integrations:", error);
      }
    };

    const fetchSuppliers = async () => {
      try {
        const response = await fetch('/api/suppliers');
        if (response.ok) {
          const data = await response.json();
          setSuppliers(data);
          if (data.length > 0) {
            setSelectedSupplierId(data[0].id);
          }
        } else {
          console.error("Failed to fetch suppliers");
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    fetchCompetitors();
    fetchIntegrations();
    fetchSuppliers();
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

  // Re-parse CSV when delimiter changes
  const handleDelimiterChange = (newDelimiter: ',' | ';') => {
    setDelimiter(newDelimiter);
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          previewCSV(content);
        }
      };
      reader.readAsText(uploadedFile);
    }
  };

  const parseCSVLine = (line: string, delimiter: ',' | ';' = ','): string[] => {
    const result: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Toggle quote state
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(currentField.trim());
        currentField = '';
      } else {
        // Add character to current field
        currentField += char;
      }
    }

    // Add the last field
    result.push(currentField.trim());

    // Remove quotes from quoted fields
    return result.map(field => {
      if (field.startsWith('"') && field.endsWith('"')) {
        return field.substring(1, field.length - 1);
      }
      return field;
    });
  };

  const previewCSV = (csvContent: string) => {
    // Split into lines and filter out empty lines
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      alert('CSV file is empty');
      return;
    }

    // Parse header row with selected delimiter
    const headers = parseCSVLine(lines[0], delimiter);

    // Check for required headers based on product type
    let requiredHeaders: string[];
    let missingHeaders: string[];

    if (productType === 'own') {
      // For own products, only name is required, but we should have either our_retail_price or our_wholesale_price
      requiredHeaders = ['name'];
      missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      // Check if we have at least one price field (support both old and new names)
      const hasOurPrice = headers.includes('our_price') || headers.includes('our_retail_price');
      const hasWholesalePrice = headers.includes('wholesale_price') || headers.includes('our_wholesale_price');

      if (missingHeaders.length > 0) {
        alert(`CSV file is missing required headers: ${missingHeaders.join(', ')}`);
        return;
      }

      if (!hasOurPrice && !hasWholesalePrice) {
        alert(`CSV file is missing required price headers: either 'our_retail_price' (or 'our_price') or 'our_wholesale_price' (or 'wholesale_price') is required for own products`);
        return;
      }
    } else if (productType === 'competitor') {
      // For competitor products, name and competitor_price are required
      requiredHeaders = ['name', 'competitor_price'];
      missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        alert(`CSV file is missing required headers: ${missingHeaders.join(', ')}`);
        return;
      }
    } else {
      // For supplier products, name and supplier_price are required
      requiredHeaders = ['name', 'supplier_price'];
      missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        alert(`CSV file is missing required headers: ${missingHeaders.join(', ')}`);
        return;
      }
    }

    // Parse data rows (limit to 5 for preview)
    const rows: Record<string, string>[] = [];
    const previewLimit = Math.min(lines.length - 1, 5);

    for (let i = 1; i <= previewLimit; i++) {
      const values = parseCSVLine(lines[i], delimiter);
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
      const templateUrl = `/api/products/csv-template-enhanced?type=${productType}`;
      window.open(templateUrl, '_blank');
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download template");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (productType === 'competitor' && !selectedCompetitorId) {
      alert("Please select a competitor");
      return;
    }

    if (productType === 'own' && !selectedIntegrationId) {
      alert("Please select an integration");
      return;
    }

    if (productType === 'supplier' && !selectedSupplierId) {
      alert("Please select a supplier");
      return;
    }

    if (!uploadedFile) {
      alert("Please upload a CSV file first");
      return;
    }

    setIsSubmitting(true);

    try {
      // Use appropriate upload method based on product type
      let result;
      if (productType === 'own') {
        result = await uploadOwnProductsCSVViaIntegration(selectedIntegrationId, uploadedFile, delimiter);
      } else if (productType === 'competitor') {
        result = await uploadProductsCSV(selectedCompetitorId, uploadedFile, delimiter);
      } else {
        result = await uploadSupplierProductsCSV(selectedSupplierId, uploadedFile, delimiter);
      }
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
        <h2 className="text-lg font-medium text-gray-900">Upload Products</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV file with products and prices
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
        {/* Product Type Selection */}
        <div>
          <label className="text-base font-medium text-gray-900">Product Type</label>
          <p className="text-sm leading-5 text-gray-500">Choose what type of products you're uploading</p>
          <fieldset className="mt-4">
            <legend className="sr-only">Product type</legend>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  id="own-products"
                  name="product-type"
                  type="radio"
                  checked={productType === 'own'}
                  onChange={() => setProductType('own')}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="own-products" className="ml-3 block text-sm font-medium text-gray-700">
                  Our Products
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="competitor-products"
                  name="product-type"
                  type="radio"
                  checked={productType === 'competitor'}
                  onChange={() => setProductType('competitor')}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="competitor-products" className="ml-3 block text-sm font-medium text-gray-700">
                  Competitor Products
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="supplier-products"
                  name="product-type"
                  type="radio"
                  checked={productType === 'supplier'}
                  onChange={() => setProductType('supplier')}
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="supplier-products" className="ml-3 block text-sm font-medium text-gray-700">
                  Supplier Products
                </label>
              </div>
            </div>
          </fieldset>
          <p className="mt-2 text-sm text-gray-500">
            {productType === 'own'
              ? 'Upload your own products with pricing information (our_price, wholesale_price)'
              : productType === 'competitor'
              ? 'Upload competitor products for price comparison'
              : 'Upload supplier products for sourcing and procurement'
            }
          </p>
        </div>

        {/* CSV Configuration */}
        <div className="space-y-4">
          <div>
            <label className="text-base font-medium text-gray-900">CSV Configuration</label>
            <p className="text-sm leading-5 text-gray-500">Configure how your CSV file should be parsed</p>

            {/* Delimiter Selection */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Field Delimiter</label>
              <div className="mt-2 space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="delimiter"
                    value=","
                    checked={delimiter === ','}
                    onChange={(e) => handleDelimiterChange(e.target.value as ',' | ';')}
                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Comma (,)</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="delimiter"
                    value=";"
                    checked={delimiter === ';'}
                    onChange={(e) => handleDelimiterChange(e.target.value as ',' | ';')}
                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Semicolon (;)</span>
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Choose the character that separates fields in your CSV file
              </p>
            </div>

            {/* Field Requirements */}
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Required Fields for {productType === 'own' ? 'Own Products' : productType === 'competitor' ? 'Competitor Products' : 'Supplier Products'}</h4>
              <div className="text-xs text-blue-800 space-y-1">
                {productType === 'own' ? (
                  <>
                    <div><strong>Required:</strong> name</div>
                    <div><strong>Price fields (at least one):</strong> our_retail_price, our_wholesale_price</div>
                    <div><strong>Optional:</strong> currency_code, sku, brand, ean, image_url, url, category, description</div>
                  </>
                ) : productType === 'competitor' ? (
                  <>
                    <div><strong>Required:</strong> name, competitor_price</div>
                    <div><strong>Optional:</strong> currency_code, sku, brand, ean, image_url, url</div>
                  </>
                ) : (
                  <>
                    <div><strong>Required:</strong> name, supplier_price</div>
                    <div><strong>Optional:</strong> supplier_recommended_price, currency_code, sku, brand, ean, image_url, url, minimum_order_quantity, lead_time_days</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
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
            {/* Competitor Selection - Only show for competitor products */}
            {productType === 'competitor' && (
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
            )}

            {/* Integration Selection - Only show for own products */}
            {productType === 'own' && (
              <div>
                <label htmlFor="integration" className="block text-sm font-medium text-gray-700">
                  Integration
                </label>
                <select
                  id="integration"
                  value={selectedIntegrationId}
                  onChange={(e) => setSelectedIntegrationId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Select an integration</option>
                  {integrations.map((integration) => (
                    <option key={integration.id} value={integration.id}>
                      {integration.name} ({integration.platform})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose which integration this CSV upload belongs to. This helps organize your products and track price history.
                </p>
              </div>
            )}

            {/* Supplier Selection - Only show for supplier products */}
            {productType === 'supplier' && (
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
                  Supplier
                </label>
                <select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose which supplier this CSV upload belongs to. This helps track supplier pricing and sourcing.
                </p>
              </div>
            )}

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
                                  src={`/api/proxy-image?url=${encodeURIComponent(row['image_url'])}`}
                                  alt="Product"
                                  width={40}
                                  height={40}
                                  className="max-h-10 max-w-10 object-contain"
                                  unoptimized // Skip Next.js image optimization for external images
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
                  {productType === 'own' ? (
                    <>
                      Required columns: name<br />
                      Optional columns: our_retail_price, our_wholesale_price, currency_code, sku, brand, ean, image_url, url, category, description<br />
                      <span className="text-gray-400">Note: old field names (our_price, wholesale_price) are still supported</span>
                    </>
                  ) : productType === 'competitor' ? (
                    <>
                      Required columns: name, competitor_price<br />
                      Optional columns: currency_code, sku, brand, ean, image_url, url
                    </>
                  ) : (
                    <>
                      Required columns: name, supplier_price<br />
                      Optional columns: supplier_recommended_price, currency_code, sku, brand, ean, image_url, url, minimum_order_quantity, lead_time_days
                    </>
                  )}
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
              disabled={isSubmitting || !uploadedFile || (productType === 'competitor' && !selectedCompetitorId) || (productType === 'own' && !selectedIntegrationId) || (productType === 'supplier' && !selectedSupplierId)}
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