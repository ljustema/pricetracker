"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { SupplierClientService } from "@/lib/services/supplier-client-service";
import { Supplier } from "@/lib/services/supplier-service";

interface EditSupplierPageProps {
  params: Promise<{ supplierId: string }>;
}

export default function EditSupplierPage({ params }: EditSupplierPageProps) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    contact_email: "",
    contact_phone: "",
    logo_url: "",
    notes: "",
    login_username: "",
    login_password: "",
    api_key: "",
    api_url: "",
    login_url: "",
    price_file_url: "",
    sync_frequency: "weekly" as const,
    is_active: true,
  });

  // Resolve params and load supplier data
  useEffect(() => {
    const loadSupplier = async () => {
      try {
        const resolvedParams = await params;
        setSupplierId(resolvedParams.supplierId);
        
        const supplier = await SupplierClientService.getSupplier(resolvedParams.supplierId);
        setFormData({
          name: supplier.name,
          website: supplier.website || "",
          contact_email: supplier.contact_email || "",
          contact_phone: supplier.contact_phone || "",
          logo_url: supplier.logo_url || "",
          notes: supplier.notes || "",
          login_username: supplier.login_username || "",
          login_password: supplier.login_password || "",
          api_key: supplier.api_key || "",
          api_url: supplier.api_url || "",
          login_url: supplier.login_url || "",
          price_file_url: supplier.price_file_url || "",
          sync_frequency: supplier.sync_frequency || "weekly",
          is_active: supplier.is_active,
        });
      } catch (error) {
        console.error("Error loading supplier:", error);
        router.push("/app-routes/suppliers");
      } finally {
        setIsLoading(false);
      }
    };

    loadSupplier();
  }, [params, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await SupplierClientService.updateSupplier(supplierId, formData);
      router.push(`/app-routes/suppliers/${supplierId}`);
    } catch (error) {
      console.error("Error updating supplier:", error);
      alert(error instanceof Error ? error.message : "Failed to update supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this supplier? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);

    try {
      await SupplierClientService.deleteSupplier(supplierId);
      router.push("/app-routes/suppliers");
    } catch (error) {
      console.error("Error deleting supplier:", error);
      alert(error instanceof Error ? error.message : "Failed to delete supplier");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading supplier...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/app-routes/suppliers/${supplierId}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Supplier
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Edit Supplier</h1>
          <p className="mt-2 text-gray-600">
            Update supplier information and settings
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    id="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    id="contact_email"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="contact@supplier.com"
                  />
                </div>

                <div>
                  <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  name="notes"
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Additional notes about this supplier..."
                />
              </div>
            </div>

            {/* Automation Settings */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Automation Settings</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="sync_frequency" className="block text-sm font-medium text-gray-700">
                    Sync Frequency
                  </label>
                  <select
                    name="sync_frequency"
                    id="sync_frequency"
                    value={formData.sync_frequency}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active supplier
                  </label>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="login_url" className="block text-sm font-medium text-gray-700">
                    Login URL
                  </label>
                  <input
                    type="url"
                    name="login_url"
                    id="login_url"
                    value={formData.login_url}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="https://supplier.com/login"
                  />
                </div>

                <div>
                  <label htmlFor="price_file_url" className="block text-sm font-medium text-gray-700">
                    Price File URL
                  </label>
                  <input
                    type="url"
                    name="price_file_url"
                    id="price_file_url"
                    value={formData.price_file_url}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="https://supplier.com/prices.csv"
                  />
                </div>

                <div>
                  <label htmlFor="api_url" className="block text-sm font-medium text-gray-700">
                    API URL
                  </label>
                  <input
                    type="url"
                    name="api_url"
                    id="api_url"
                    value={formData.api_url}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="https://api.supplier.com/v1"
                  />
                </div>

                <div>
                  <label htmlFor="api_key" className="block text-sm font-medium text-gray-700">
                    API Key
                  </label>
                  <input
                    type="password"
                    name="api_key"
                    id="api_key"
                    value={formData.api_key}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter API key"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="login_username" className="block text-sm font-medium text-gray-700">
                    Login Username
                  </label>
                  <input
                    type="text"
                    name="login_username"
                    id="login_username"
                    value={formData.login_username}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter login username"
                  />
                </div>

                <div>
                  <label htmlFor="login_password" className="block text-sm font-medium text-gray-700">
                    Login Password
                  </label>
                  <input
                    type="password"
                    name="login_password"
                    id="login_password"
                    value={formData.login_password}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter login password"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete Supplier"}
              </button>

              <div className="flex space-x-3">
                <Link
                  href={`/app-routes/suppliers/${supplierId}`}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
