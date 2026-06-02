"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function NewProductPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    ean: "",
    brand: "",
    category: "",
    description: "",
    image_url: "",
    url: "", // Add URL field
    our_retail_price: "",
    our_wholesale_price: "",
    is_active: true,
  });

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to add a product.
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Prepare the data for submission
      const productData = {
        ...formData,
        our_retail_price: formData.our_retail_price ? parseFloat(formData.our_retail_price) : null,
        our_wholesale_price: formData.our_wholesale_price ? parseFloat(formData.our_wholesale_price) : null,
      };

      // Call the API route to create a new product
      const response = await fetch('/api/products/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      // Redirect to the products page
      router.push("/app-routes/products");
    } catch (err) {
      console.error("Error adding product:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Add New Product</h1>
        <p className="mt-2 text-gray-600">
          Add a product to track competitor prices.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Product Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Product Name"
              />
            </div>

            <div>
              <label htmlFor="sku" className="block text-sm font-medium">
                SKU
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                value={formData.sku}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="SKU123"
              />
            </div>

            <div>
              <label htmlFor="ean" className="block text-sm font-medium">
                EAN/UPC
              </label>
              <input
                id="ean"
                name="ean"
                type="text"
                value={formData.ean}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="1234567890123"
              />
            </div>

            <div>
              <label htmlFor="brand" className="block text-sm font-medium">
                Brand
              </label>
              <input
                id="brand"
                name="brand"
                type="text"
                value={formData.brand}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Brand Name"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium">
                Category
              </label>
              <input
                id="category"
                name="category"
                type="text"
                value={formData.category}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Electronics, Clothing, etc."
              />
            </div>

            <div>
              <label htmlFor="image_url" className="block text-sm font-medium">
                Image URL
              </label>
              <input
                id="image_url"
                name="image_url"
                type="text"
                value={formData.image_url}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="https://example.com/image.jpg or //example.com/image.jpg"
              />
            </div>

            <div>
              <label htmlFor="url" className="block text-sm font-medium">
                Product URL
              </label>
              <input
                id="url"
                name="url"
                type="text"
                value={formData.url}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="https://example.com/product"
              />
            </div>

            <div>
              <label htmlFor="our_retail_price" className="block text-sm font-medium">
                Our Retail Price
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  id="our_retail_price"
                  name="our_retail_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.our_retail_price}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 pl-7 pr-12 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="our_wholesale_price" className="block text-sm font-medium">
                Our Wholesale Price
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  id="our_wholesale_price"
                  name="our_wholesale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.our_wholesale_price}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 pl-7 pr-12 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="Product description"
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
              Active
            </label>
          </div>

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
              disabled={isLoading}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}