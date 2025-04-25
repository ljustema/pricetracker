"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  id: string;
  name: string;
  endpoint: string;
  onDelete?: () => void;
}

export default function DeleteButton({
  id,
  name,
  endpoint,
  onDelete,
}: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!window.confirm(`Delete Confirmation\n\nAre you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }
    try {
      setIsDeleting(true);
      const response = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Failed to delete ${name}`);

      // Call the onDelete callback if provided
      if (onDelete) onDelete();

      // Refresh the router to update the UI
      router.refresh();

      // If we're deleting a product, redirect to the products page with a cache-busting parameter
      if (endpoint === '/api/products') {
        // Add a timestamp to force a fresh load of the page
        const timestamp = new Date().getTime();
        router.push(`/app-routes/products?refresh=${timestamp}`);
      }
    } catch (error) {
      alert(`Failed to delete ${name}. Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="rounded-md bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      aria-label="Delete"
      disabled={isDeleting}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}