"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function EditCompetitorPage() {
  const router = useRouter();
  const params = useParams();
  const competitorId = params.competitorId as string;
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    notes: "",
  });

  useEffect(() => {
    // Fetch the competitor data
    const fetchCompetitor = async () => {
      try {
        const response = await fetch(`/api/competitors/${competitorId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch competitor");
        }
        const data = await response.json();
        setFormData({
          name: data.name || "",
          website: data.website || "",
          notes: data.notes || "",
        });
      } catch (err) {
        console.error("Error fetching competitor:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsFetching(false);
      }
    };

    if (competitorId && session?.user) {
      fetchCompetitor();
    }
  }, [competitorId, session]);

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You must be logged in to edit a competitor.
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Call the API route to update the competitor
      const response = await fetch(`/api/competitors/${competitorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update competitor');
      }

      // Redirect to the competitors page
      router.push("/app-routes/competitors");
    } catch (err) {
      console.error("Error updating competitor:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Competitor</h1>
        <p className="mt-2 text-gray-600">
          Update competitor information.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      {isFetching ? (
        <div className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Competitor Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium">
                Website URL
              </label>
              <input
                id="website"
                name="website"
                type="url"
                required
                value={formData.website}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Notes about the competitor"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Link
                href="/app-routes/competitors"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </Link>
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
      )}
    </div>
  );
}