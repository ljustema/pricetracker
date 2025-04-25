"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ViewToggleProps {
  defaultView?: "table" | "cards";
}

export default function ViewToggle({ defaultView = "cards" }: ViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Safely get the initial view from searchParams
  const initialView = useMemo(() => {
    try {
      return (searchParams.get("view") as "table" | "cards") || defaultView;
    } catch (error) {
      console.error('Error accessing searchParams for initial view:', error);
      return defaultView;
    }
  }, [searchParams, defaultView]);

  const [view, setView] = useState<"table" | "cards">(initialView);

  // Update URL when view changes, but only if it's different from the current URL parameter
  useEffect(() => {
    // # Reason: Only update if the view state doesn't match what's in the URL.
    let currentViewParam: "table" | "cards";
    try {
      currentViewParam = searchParams.get("view") as "table" | "cards" || defaultView;
    } catch (error) {
      console.error('Error accessing searchParams:', error);
      currentViewParam = defaultView;
    }

    if (view !== currentViewParam) {
      // # Reason: Construct a new URLSearchParams object based on the current searchParams from the hook.
      // Avoids synchronously accessing .entries() directly in the effect.
      const params = new URLSearchParams(searchParams.toString());

      // # Reason: Set or delete the 'view' parameter based on the new view state.
      if (view !== defaultView) {
        params.set("view", view);
      } else {
        params.delete("view");
      }

      // # Reason: Construct the new URL and push it using the router.
      const queryString = params.toString();
      const url = queryString ? `?${queryString}` : "";

      // Use scroll: false to prevent page jumping
      router.push(`/app-routes/products${url}`, { scroll: false });
    }
    // # Reason: Dependencies for this effect are the local 'view' state, the defaultView prop,
    // the searchParams object from the hook (stable across renders within Suspense), and the router instance.
  }, [view, defaultView, searchParams, router]);

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500">View:</span>
      <div className="flex rounded-md shadow-sm">
        <button
          type="button"
          className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium ${
            view === "cards"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
          onClick={() => setView("cards")}
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          Cards
        </button>
        <button
          type="button"
          className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium ${
            view === "table"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
          onClick={() => setView("table")}
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Table
        </button>
      </div>
    </div>
  );
}