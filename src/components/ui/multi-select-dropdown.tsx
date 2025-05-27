"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  id: string;
  name: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options...",
  label,
  id
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggleOption = (optionId: string) => {
    const newSelectedValues = selectedValues.includes(optionId)
      ? selectedValues.filter(id => id !== optionId)
      : [...selectedValues, optionId];

    onChange(newSelectedValues);
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      // Deselect all
      onChange([]);
    } else {
      // Select all
      onChange(options.map(option => option.id));
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    } else if (selectedValues.length === 1) {
      const selectedOption = options.find(option => option.id === selectedValues[0]);
      return selectedOption?.name || placeholder;
    } else {
      return `${selectedValues.length} selected`;
    }
  };

  const isAllSelected = selectedValues.length === options.length && options.length > 0;
  const isIndeterminate = selectedValues.length > 0 && selectedValues.length < options.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          id={id}
          onClick={() => setIsOpen(!isOpen)}
          className="mt-1 block w-full rounded-md py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-left appearance-none bg-transparent border-transparent"
        >
          <span className="block truncate text-gray-900">
            {getDisplayText()}
          </span>
        </button>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className={`h-5 w-5 text-black transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {options.length > 1 && (
            <div className="border-b border-gray-200 px-3 py-2">
              <label className="flex items-center cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 text-left">
                  Select All
                </span>
              </label>
            </div>
          )}

          {options.map((option) => (
            <div key={option.id} className="px-3 py-2 hover:bg-gray-50">
              <label className="flex items-center cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.id)}
                  onChange={() => handleToggleOption(option.id)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900 text-left">
                  {option.name}
                </span>
              </label>
            </div>
          ))}

          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
