"use client";

import { useState } from "react";
import { ScraperConfig } from "@/lib/services/scraper-service";

interface Competitor {
  id: string;
  name: string;
  website: string;
}

interface ScraperFormProps {
  initialData?: Partial<ScraperConfig>;
  competitorId?: string;
  competitors?: Competitor[];
  onSubmit: (data: Partial<ScraperConfig>) => Promise<void>;
  onCancel: () => void;
  onTest?: (data: Partial<ScraperConfig>) => Promise<void>;
  onGenerateWithAI?: (url: string) => Promise<void>;
}

export default function ScraperForm({
  initialData,
  competitorId,
  competitors = [],
  onSubmit,
  onCancel,
  onTest,
  onGenerateWithAI,
}: ScraperFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  // Determine the scraper type from initialData or default to "ai"
  const defaultScraperType = initialData?.scraper_type || "ai";
  
  const [formData, setFormData] = useState<Partial<ScraperConfig>>(
    initialData || {
      competitor_id: competitorId || (competitors.length > 0 ? competitors[0].id : ""),
      name: "",
      url: "",
      scraper_type: defaultScraperType,
      selectors: {
        product: "",
        name: "",
        price: "",
        image: "",
        sku: "",
        brand: "",
      },
      python_script: "",
      schedule: {
        frequency: "daily",
        time: "02:00",
      },
      is_active: false,
    }
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const type = (e.target as HTMLInputElement).type;
    
    if (name.includes(".")) {
      // Handle nested properties (e.g., selectors.product)
      const [parent, child] = name.split(".");
      setFormData((prev: Partial<ScraperConfig>) => {
        // Ensure the parent property exists and is an object
        const parentObj = (prev[parent as keyof typeof prev] as Record<string, unknown>) || {};
        
        return {
          ...prev,
          [parent]: {
            ...parentObj,
            [child]: type === "checkbox"
              ? (e.target as HTMLInputElement).checked
              : value,
          },
        };
      });
    } else {
      // Handle top-level properties
      setFormData((prev: Partial<ScraperConfig>) => ({
        ...prev,
        [name]: type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Error submitting scraper form:", error);
      // Handle error (e.g., show toast notification)
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    
    setIsLoading(true);
    try {
      await onTest(formData);
    } catch (error) {
      console.error("Error testing scraper:", error);
      // Handle error (e.g., show toast notification)
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!onGenerateWithAI || !formData.url) return;
    
    setIsLoading(true);
    try {
      await onGenerateWithAI(formData.url);
    } catch (error) {
      console.error("Error generating scraper with AI:", error);
      // Handle error (e.g., show toast notification)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Scraper Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            placeholder="My Competitor Scraper"
          />
        </div>

        <div>
          <label htmlFor="scraper_type" className="block text-sm font-medium">
            Scraper Type
          </label>
          <select
            id="scraper_type"
            name="scraper_type"
            value={formData.scraper_type || "ai"}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            <option value="ai">AI Scraper</option>
            <option value="python">Python Scraper</option>
            <option value="csv">CSV Scraper</option>
          </select>
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium">
            Website URL
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              id="url"
              name="url"
              type="url"
              required
              value={formData.url || ""}
              onChange={handleChange}
              className="block w-full flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="https://example.com/products"
            />
            {onGenerateWithAI && formData.scraper_type === "ai" && (
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isLoading || !formData.url}
                className="ml-3 inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Generate with AI
              </button>
            )}
          </div>
        </div>

        {/* AI Scraper Fields */}
        {formData.scraper_type === "ai" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="selectors.product" className="block text-sm font-medium">
                Product Selector
              </label>
              <input
                id="selectors.product"
                name="selectors.product"
                type="text"
                value={formData.selectors?.product || ""}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder=".product-item"
              />
            </div>

            <div>
              <label htmlFor="selectors.name" className="block text-sm font-medium">
                Name Selector
              </label>
              <input
                id="selectors.name"
                name="selectors.name"
                type="text"
                value={formData.selectors?.name || ""}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder=".product-name"
              />
            </div>

            <div>
              <label htmlFor="selectors.price" className="block text-sm font-medium">
                Price Selector
              </label>
              <input
                id="selectors.price"
                name="selectors.price"
                type="text"
                value={formData.selectors?.price || ""}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder=".product-price"
              />
            </div>

            <div>
              <label htmlFor="selectors.image" className="block text-sm font-medium">
                Image Selector
              </label>
              <input
                id="selectors.image"
                name="selectors.image"
                type="text"
                value={formData.selectors?.image || ""}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder=".product-image img"
              />
            </div>

            <div>
              <label htmlFor="selectors.sku" className="block text-sm font-medium">
                SKU Selector
              </label>
              <input
                id="selectors.sku"
                name="selectors.sku"
                type="text"
                value={formData.selectors?.sku || ""}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder=".product-sku"
              />
            </div>

            <div>
              <label htmlFor="selectors.brand" className="block text-sm font-medium">
                Brand Selector
              </label>
              <input
                id="selectors.brand"
                name="selectors.brand"
                type="text"
                value={formData.selectors?.brand || ""}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder=".product-brand"
              />
            </div>
          </div>
        )}

        {/* Python Scraper Fields */}
        {formData.scraper_type === "python" && (
          <div>
            <label htmlFor="python_script" className="block text-sm font-medium">
              Python Script
            </label>
            <div className="mt-1">
              <textarea
                id="python_script"
                name="python_script"
                rows={15}
                value={formData.python_script || ""}
                onChange={handleChange}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm font-mono"
                placeholder={`# Your Python scraper code here
def get_metadata():
    return {
        'name': 'Python Scraper',
        'description': 'A Python scraper',
        'version': '1.0.0',
        'author': 'Your Name',
        'target_url': 'https://example.com',
        'required_libraries': ['requests', 'beautifulsoup4']
    }

def scrape():
    """
    Main scraping function. Implement your scraping logic here.
    
    IMPORTANT: For large datasets, consider using memory-efficient techniques:
    1. Use generators or yield statements for processing large lists
    2. Process data in chunks rather than loading everything into memory
    3. Avoid excessive debug print statements that increase output size
    """
    # Your scraping logic here
    return [
        {
            'name': 'Product Name',
            'price': 99.99,
            'currency': 'USD',
            'image_url': 'https://example.com/image.jpg',
            'sku': 'SKU123',
            'brand': 'Brand Name',
            'ean': '1234567890123',
            'url': 'https://example.com/product'
        }
    ]

def test():
    """
    Test function that will be called when validating the scraper.
    
    IMPORTANT:
    1. This function must return a JSON array of products
    2. Limit the number of products returned (10 is recommended)
    3. Do not print debug information directly to stdout
    4. Avoid excessive logging that could exceed buffer limits
    5. Handle exceptions gracefully
    """
    try:
        # Get products from the main scrape function
        all_products = scrape()
        
        # Return only the first 10 products for validation
        return all_products[:10]  # Must return a JSON-serializable array
    except Exception as e:
        import sys
        # Log errors to stderr instead of stdout
        print(f'Error in test function: {str(e)}', file=sys.stderr)
        return []
`}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Your Python script must include get_metadata(), scrape(), and test() functions.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="schedule.frequency" className="block text-sm font-medium">
              Frequency
            </label>
            <select
              id="schedule.frequency"
              name="schedule.frequency"
              value={formData.schedule?.frequency || "daily"}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label htmlFor="schedule.time" className="block text-sm font-medium">
              Time (24h format)
            </label>
            <input
              id="schedule.time"
              name="schedule.time"
              type="time"
              value={formData.schedule?.time || "02:00"}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            checked={formData.is_active || false}
            onChange={handleChange}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="is_active" className="ml-2 block text-sm">
            Activate scraper (will run on schedule)
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        
        {onTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={isLoading}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Test Scraper
          </button>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {initialData?.id ? "Update" : "Create"} Scraper
        </button>
      </div>
    </form>
  );
}