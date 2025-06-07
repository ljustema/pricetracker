import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSuppliers } from "@/lib/services/supplier-service";
import { Plus, Building2, Globe, Phone, Mail } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  website?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  is_active: boolean;
  sync_frequency?: string;
}

export default async function SuppliersPage() {
  // Check if the user is authenticated
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Fetch suppliers for the current user
  let suppliers;
  try {
    suppliers = await getSuppliers(session.user.id);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    suppliers = [];
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
              <p className="mt-2 text-gray-600">
                Manage your suppliers and track their pricing
              </p>
            </div>
            <Link
              href="/app-routes/suppliers/new"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Supplier
            </Link>
          </div>
        </div>

        {/* Suppliers Grid */}
        <Suspense fallback={<div>Loading suppliers...</div>}>
          <SuppliersGrid suppliers={suppliers} />
        </Suspense>
      </div>
    </div>
  );
}

interface SuppliersGridProps {
  suppliers: Supplier[];
}

function SuppliersGrid({ suppliers }: SuppliersGridProps) {
  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No suppliers</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating your first supplier.
        </p>
        <div className="mt-6">
          <Link
            href="/app-routes/suppliers/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Supplier
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {suppliers.map((supplier) => (
        <div
          key={supplier.id}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{supplier.name}</h2>
            <div className="flex space-x-2">
              <Link
                href={`/app-routes/suppliers/${supplier.id}/edit`}
                className="rounded-md bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Edit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {supplier.website && (
              <div className="flex items-center text-sm text-gray-600">
                <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 truncate"
                >
                  {supplier.website}
                </a>
              </div>
            )}

            {supplier.contact_email && (
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                <a
                  href={`mailto:${supplier.contact_email}`}
                  className="hover:text-indigo-600 truncate"
                >
                  {supplier.contact_email}
                </a>
              </div>
            )}

            {supplier.contact_phone && (
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                <a
                  href={`tel:${supplier.contact_phone}`}
                  className="hover:text-indigo-600"
                >
                  {supplier.contact_phone}
                </a>
              </div>
            )}

            {supplier.notes && (
              <div className="text-sm text-gray-600">
                <p className="line-clamp-2">{supplier.notes}</p>
              </div>
            )}

            {/* Status and sync info */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="flex items-center">
                <div
                  className={`h-2 w-2 rounded-full mr-2 ${
                    supplier.is_active ? 'bg-green-400' : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-gray-500">
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {supplier.sync_frequency && (
                <span className="text-xs text-gray-500 capitalize">
                  Sync: {supplier.sync_frequency}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex space-x-2">
            <Link
              href={`/app-routes/suppliers/${supplier.id}`}
              className="flex-1 rounded-md bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              View Details
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
