"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import ProductCustomFields from "@/components/products/ProductCustomFields";

interface Brand {
  id: string;
  name: string;
}

// No longer need the props interface since we're using useParams hook
export default function ProductEditPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    ean: "",
    brand: "",
    brand_id: "", // Add brand_id field to track the associated brand
    category: "",
    description: "",
    image_url: "",
    our_url: "", // Renamed from url
    our_retail_price: "", // Renamed from our_price
    our_wholesale_price: "", // Renamed from wholesale_price
    is_active: true,
  });

  // Using useParams hook to get the productId from the URL
  // This fixes the warning: "A param property was accessed directly... should be unwrapped with React.use()"
  const routeParams = useParams();
  const productId = routeParams.productId as string;

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user) return;

      try {
        // Fetch product and brands in parallel
        const [productResponse, brandsResponse] = await Promise.all([
          fetch(`/api/products/${productId}`),
          fetch('/api/brands?isActive=true')
        ]);

        if (!productResponse.ok) {
          throw new Error("Failed to fetch product");
        }

        if (!brandsResponse.ok) {
          throw new Error("Failed to fetch brands");
        }

        const product = await productResponse.json();
        const brandsData = await brandsResponse.json();

        // Sort brands alphabetically
        const sortedBrands = brandsData.sort((a: Brand, b: Brand) =>
          a.name.localeCompare(b.name)
        );

        // Check if the product's brand exists in our brands list
        const productBrandExists = product.brand_id && sortedBrands.some((b: Brand) => b.id === product.brand_id);

        // If the product has a brand name but no matching brand_id in our list,
        // we need to add a temporary entry for it
        if (product.brand && !productBrandExists) {
          // Add the current brand to the list if it's not already there
          sortedBrands.push({
            id: product.brand_id || 'temp-brand-id',
            name: product.brand
          });

          // Re-sort the brands
          sortedBrands.sort((a: Brand, b: Brand) => a.name.localeCompare(b.name));
        }

        setBrands(sortedBrands);

        setFormData({
          name: product.name || "",
          sku: product.sku || "",
          ean: product.ean || "",
          brand: product.brand || "",
          brand_id: product.brand_id || "", // Include the brand_id from the product
          category: product.category || "",
          description: product.description || "",
          image_url: product.image_url || "",
          our_url: product.our_url || "", // Include the our_url from the product
          our_retail_price: product.our_retail_price ? product.our_retail_price.toString() : "",
          our_wholesale_price: product.our_wholesale_price ? product.our_wholesale_price.toString() : "",
          is_active: product.is_active !== undefined ? product.is_active : true,
        });
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [session, productId]);

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to edit a product.
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

  const handleCustomFieldChange = (values: Record<string, string>) => {
    setCustomFieldValues(values);
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
        // Make sure we're sending both brand and brand_id
        brand: formData.brand,
        brand_id: formData.brand_id,
      };

      // Call the API route to update the product
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product');
      }

      // Save custom fields if there are any
      if (Object.keys(customFieldValues).length > 0) {
        const customFieldValuesToSave = Object.entries(customFieldValues).map(([fieldId, value]) => ({
          custom_field_id: fieldId,
          value: value.trim(),
        }));

        const customFieldsResponse = await fetch(`/api/products/${productId}/custom-fields`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customFieldValues: customFieldValuesToSave }),
        });

        if (!customFieldsResponse.ok) {
          console.error('Failed to save custom fields, but product was updated');
          // Don't throw error here, as the main product was saved successfully
        }
      }

      // Redirect back to the product detail page
      router.push(`/app-routes/products/${productId}`);
    } catch (err) {
      console.error("Error updating product:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading product...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="mt-2 text-gray-600">
          Update your product information.
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
              <select
                id="brand"
                name="brand_id"
                value={formData.brand_id || ""}
                onChange={(e) => {
                  const selectedBrandId = e.target.value;
                  const selectedBrand = brands.find((b: Brand) => b.id === selectedBrandId);

                  setFormData(prev => ({
                    ...prev,
                    brand_id: selectedBrandId,
                    brand: selectedBrand ? selectedBrand.name : ""
                  }));
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select a brand</option>
                {brands.map((brand: Brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>

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
              <label htmlFor="our_url" className="block text-sm font-medium">
                Product URL
              </label>
              <input
                id="our_url"
                name="our_url"
                type="text"
                value={formData.our_url}
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

          {/* Custom Fields Section */}
          <div className="border-t border-gray-200 pt-6">
            <ProductCustomFields
              productId={productId}
              alwaysEditable={true}
              onValuesChange={handleCustomFieldChange}
            />
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
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}