"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface PaginationSizeSelectorProps {
  currentSize: number;
  onSizeChange: (newSize: number) => void;
}

export default function PaginationSizeSelector({ currentSize, onSizeChange }: PaginationSizeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sizeOptions = [16, 32, 64];

  const handleSizeChange = (newSize: number) => {
    // Validate the new size
    if (!sizeOptions.includes(newSize)) {
      console.warn(`Invalid page size: ${newSize}. Using default 16.`);
      newSize = 16;
    }

    // Update URL parameters
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when changing page size
    params.set("page", "1");

    // Set the new page size (only if different from default)
    if (newSize !== 16) {
      params.set("itemsPerPage", newSize.toString());
    } else {
      params.delete("itemsPerPage");
    }

    // Update URL
    const queryString = params.toString();
    const url = queryString ? `?${queryString}` : "";
    router.push(`/app-routes/products${url}`, { scroll: false });

    // Call the callback to update parent state
    onSizeChange(newSize);
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-700">Show:</span>
      <select
        value={currentSize}
        onChange={(e) => handleSizeChange(parseInt(e.target.value, 10))}
        className="rounded-md border-gray-300 py-1 pl-2 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
      >
        {sizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-700">per page</span>
    </div>
  );
}
