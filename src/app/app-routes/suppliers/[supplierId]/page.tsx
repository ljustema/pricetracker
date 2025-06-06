import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupplier, getSupplierPriceChanges } from "@/lib/services/supplier-service";
import { ArrowLeft, Edit, Globe, Mail, Phone, Building2, Plus } from "lucide-react";

interface SupplierDetailPageProps {
  params: Promise<{ supplierId: string }>;
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  // Check if the user is authenticated
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { supplierId } = await params;

  // Fetch supplier details
  let supplier;
  let priceChanges;
  try {
    supplier = await getSupplier(session.user.id, supplierId);
    if (!supplier) {
      redirect("/app-routes/suppliers");
    }
    priceChanges = await getSupplierPriceChanges(session.user.id, undefined, supplierId);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    redirect("/app-routes/suppliers");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/app-routes/suppliers"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Suppliers
          </Link>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{supplier.name}</h1>
              <p className="mt-2 text-gray-600">
                Supplier details and price history
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/app-routes/scrapers/new?supplierId=${supplier.id}`}
                className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Scraper
              </Link>
              <Link
                href={`/app-routes/suppliers/${supplier.id}/edit`}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <Edit className="h-5 w-5 mr-2" />
                Edit Supplier
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Supplier Information */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Supplier Information</h2>
              
              <div className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{supplier.name}</dd>
                </div>

                {supplier.website && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Website</dt>
                    <dd className="mt-1">
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        <Globe className="h-4 w-4 mr-1" />
                        {supplier.website}
                      </a>
                    </dd>
                  </div>
                )}

                {supplier.contact_email && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contact Email</dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${supplier.contact_email}`}
                        className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        {supplier.contact_email}
                      </a>
                    </dd>
                  </div>
                )}

                {supplier.contact_phone && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contact Phone</dt>
                    <dd className="mt-1">
                      <a
                        href={`tel:${supplier.contact_phone}`}
                        className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        {supplier.contact_phone}
                      </a>
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      supplier.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Sync Frequency</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{supplier.sync_frequency}</dd>
                </div>

                {supplier.last_sync_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Sync</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(supplier.last_sync_at).toLocaleDateString()}
                    </dd>
                  </div>
                )}

                {supplier.notes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900">{supplier.notes}</dd>
                  </div>
                )}
              </div>
            </div>

            {/* Automation Settings */}
            {(supplier.login_url || supplier.api_url || supplier.price_file_url) && (
              <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Automation Settings</h3>
                
                <div className="space-y-4">
                  {supplier.login_url && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Login URL</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-all">{supplier.login_url}</dd>
                    </div>
                  )}

                  {supplier.api_url && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">API URL</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-all">{supplier.api_url}</dd>
                    </div>
                  )}

                  {supplier.price_file_url && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Price File URL</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-all">{supplier.price_file_url}</dd>
                    </div>
                  )}

                  {supplier.login_username && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Login Username</dt>
                      <dd className="mt-1 text-sm text-gray-900">{supplier.login_username}</dd>
                    </div>
                  )}

                  {supplier.login_password && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Login Password</dt>
                      <dd className="mt-1 text-sm text-gray-900">••••••••</dd>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Price History */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Price Changes</h2>
              
              <Suspense fallback={<div>Loading price history...</div>}>
                <SupplierPriceHistory priceChanges={priceChanges} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SupplierPriceHistoryProps {
  priceChanges: any[];
}

function SupplierPriceHistory({ priceChanges }: SupplierPriceHistoryProps) {
  if (!priceChanges || priceChanges.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No price changes</h3>
        <p className="mt-1 text-sm text-gray-500">
          No price changes have been recorded for this supplier yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price Change
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {priceChanges.slice(0, 10).map((change) => (
              <tr key={change.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {change.products?.name || 'Unknown Product'}
                  </div>
                  {change.products?.sku && (
                    <div className="text-sm text-gray-500">SKU: {change.products.sku}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {change.old_price ? (
                      <>
                        {change.old_price} → {change.new_price} {change.currency_code}
                        {change.price_change_percentage && (
                          <span className={`ml-2 text-xs ${
                            change.price_change_percentage > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            ({change.price_change_percentage > 0 ? '+' : ''}{change.price_change_percentage.toFixed(1)}%)
                          </span>
                        )}
                      </>
                    ) : (
                      `${change.new_price} ${change.currency_code} (new)`
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(change.changed_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                    {change.change_source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {priceChanges.length > 10 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Showing 10 of {priceChanges.length} price changes
          </p>
        </div>
      )}
    </div>
  );
}
