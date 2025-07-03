"use client";

import { useState } from "react";
import { ValidationProduct, ValidationLog } from "@/lib/services/scraper-types";
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface AiScraperValidationProps {
  scraperId: string;
  onValidationConfirmed: () => void;
  onCancel: () => void;
}

export default function AiScraperValidation({
  scraperId,
  onValidationConfirmed,
  onCancel,
}: AiScraperValidationProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [products, setProducts] = useState<ValidationProduct[]>([]);
  const [logs, setLogs] = useState<ValidationLog[]>([]);

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationError(null);
    
    try {
      // Fetch the scraper script
      const response = await fetch(`/api/scrapers/${scraperId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch scraper');
      }
      
      const scraper = await response.json();
      if (!scraper.typescript_script) {
        throw new Error('No TypeScript script found for this scraper');
      }
      
      // Validate the script
      const validateResponse = await fetch('/api/scrapers/validate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scraper_type: 'typescript',
          scriptContent: scraper.typescript_script,
        }),
      });
      
      const validationResult = await validateResponse.json();
      
      if (!validateResponse.ok || !validationResult.valid) {
        setValidationError(validationResult.error || 'Validation failed');
        setProducts(validationResult.products || []);
        setLogs(validationResult.logs || []);
        return;
      }
      
      // Validation successful
      setProducts(validationResult.products || []);
      setLogs(validationResult.logs || []);
      setIsValidated(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Unknown error during validation');
    } finally {
      setIsValidating(false);
    }
  };

  // Format price with currency code
  const formatPrice = (price: number | null | undefined, currencyCode: string = 'SEK') => {
    if (price === null || price === undefined) return 'N/A';

    try {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: currencyCode,
      }).format(price);
    } catch (_e) {
      return `${price} ${currencyCode}`;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">Validate AI-Generated Scraper</h2>
        <p className="mt-1 text-sm text-gray-500">
          Validate the scraper to ensure it can extract product data correctly
        </p>
      </div>
      
      <div className="px-6 py-4 space-y-6">
        {!isValidated && !isValidating && !validationError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Validation Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Before you can run this scraper, you need to validate it to ensure it can extract product data correctly.
                    Click the "Validate" button below to start the validation process.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {isValidating && (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="mt-2 text-sm text-gray-500">Validating scraper...</p>
          </div>
        )}
        
        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Validation Failed</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{validationError}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {isValidated && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Validation Successful</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    The scraper has been validated successfully. You can now run a test to see how it performs on the full website.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {products.length > 0 && (
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-2">Sample Products</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      EAN
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.slice(0, 5).map((product, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(product.competitor_price, product.currency_code)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.brand || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.sku || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.ean || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length > 5 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Showing 5 of {products.length} products
                </p>
              )}
            </div>
          </div>
        )}
        
        {logs.length > 0 && (
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-2">Validation Logs</h3>
            <div className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-auto max-h-60 font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className={`mb-1 ${
                  log.lvl === 'ERROR' ? 'text-red-400' :
                  log.lvl === 'WARN' ? 'text-yellow-400' :
                  log.lvl === 'INFO' ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  [{log.ts.split('T')[1].split('.')[0]}] [{log.lvl}] [{log.phase}] {log.msg}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          
          {!isValidated && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isValidating ? "Validating..." : "Validate"}
            </button>
          )}
          
          {isValidated && (
            <button
              type="button"
              onClick={onValidationConfirmed}
              className="rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Confirm & Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
