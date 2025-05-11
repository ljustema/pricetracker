"use client";

import { useState } from "react";
import { ShoppingCartIcon, CheckCircleIcon } from "lucide-react";

interface ProfessionalScraperFormProps {
  competitorId: string;
  onCancel: () => void;
}

export default function ProfessionalScraperForm({
  competitorId,
  onCancel,
}: ProfessionalScraperFormProps) {
  const [competitorName, setCompetitorName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    website: "",
    requirements: "",
    additionalInfo: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch competitor name when component mounts
  useState(() => {
    const fetchCompetitorName = async () => {
      try {
        if (!competitorId) {
          console.warn("No competitor ID provided");
          return;
        }

        const response = await fetch(`/api/competitors/${competitorId}`);
        if (response.ok) {
          const competitor = await response.json();
          if (competitor && competitor.name) {
            setCompetitorName(competitor.name);
            // Pre-fill the website field if available
            if (competitor.website) {
              setFormData(prev => ({ ...prev, website: competitor.website }));
            }
          } else {
            console.error("Competitor data missing name property", competitor);
            setCompetitorName("Unknown Competitor");
          }
        } else {
          const errorText = await response.text().catch(() => "No response body");
          console.error(`Failed to fetch competitor name: HTTP ${response.status}`, errorText);
          setCompetitorName("Unknown Competitor");
        }
      } catch (error) {
        console.error("Error fetching competitor name:", error);
        setCompetitorName("Unknown Competitor");
      }
    };

    fetchCompetitorName();
  }, [competitorId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // In a real implementation, you would send this data to your backend
      // For now, we'll simulate a successful submission
      
      // Example API call (commented out)
      /*
      const response = await fetch('/api/professional-scraper-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          competitorId,
          competitorName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit request');
      }
      */

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Set submitted state to show success message
      setIsSubmitted(true);
    } catch (err) {
      console.error("Error submitting professional scraper request:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900">Request Submitted</h2>
          <p className="mt-1 text-sm text-gray-500">
            Thank you for your interest in our Professional Scraper Service
          </p>
        </div>
        <div className="px-6 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-lg font-medium text-gray-900">Request Received</h3>
          <p className="mt-2 text-sm text-gray-500">
            We've received your request for a professional scraper for {competitorName}. Our team will review your requirements and contact you within 1-2 business days to discuss the next steps.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Return to Scrapers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">Professional Scraper Service</h2>
        <p className="mt-1 text-sm text-gray-500">
          Let our expert team build a custom scraper for your specific needs
        </p>
      </div>
      
      <div className="px-6 py-4">
        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-blue-800">
          <div className="flex">
            <ShoppingCartIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">Professional Service - €200</p>
              <p className="mt-1 text-sm">
                Our team will create a custom, high-quality scraper specifically for {competitorName}. This service includes:
              </p>
              <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                <li>Custom scraper development by our expert team</li>
                <li>Thorough testing and validation</li>
                <li>1 month of free maintenance and updates</li>
                <li>Documentation and support</li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700">
              Website to Scrape
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              required
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="requirements" className="block text-sm font-medium text-gray-700">
              Scraping Requirements
            </label>
            <textarea
              id="requirements"
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              rows={4}
              required
              placeholder="Describe what data you need scraped, any specific pages or sections, and any other requirements."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-700">
              Additional Information (Optional)
            </label>
            <textarea
              id="additionalInfo"
              name="additionalInfo"
              value={formData.additionalInfo}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional details that might help us understand your needs better."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
