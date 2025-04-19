"use client";

import { useState } from "react";
import { CodeIcon, BrainCircuitIcon } from "lucide-react";

interface ScraperTypeSelectorProps {
  onSelect: (type: 'ai' | 'python' | 'typescript') => void;
} // Updated to support Python and TypeScript scraper types explicitly

export default function ScraperTypeSelector({ onSelect }: ScraperTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<'ai' | 'python' | 'typescript'>('ai'); // Updated to support Python and TypeScript

  const handleContinue = () => {
    onSelect(selectedType);
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-medium text-gray-900">Select Scraper Type</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose the type of scraper you want to create
        </p>
      </div>
      <div className="px-6 py-4">
        <div className="space-y-4">
          <div 
            className={`flex items-start space-x-4 p-4 border rounded-lg cursor-pointer ${
              selectedType === 'ai' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedType('ai')}
          >
            <input
              type="radio"
              id="ai"
              name="scraperType"
              value="ai"
              checked={selectedType === 'ai'}
              onChange={() => setSelectedType('ai')}
              className="h-4 w-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <BrainCircuitIcon className="h-5 w-5 mr-2 text-indigo-600" />
                <label htmlFor="ai" className="font-medium text-gray-900">AI-Generated Scraper (Coming soon)</label>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Let our AI analyze the website and generate a scraper for you. Best for simple product listings.
              </p>
            </div>
          </div>

          <div 
            className={`flex items-start space-x-4 p-4 border rounded-lg cursor-pointer ${
              selectedType === 'python' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedType('python')}
          >
            <input
              type="radio"
              id="python"
              name="scraperType"
              value="python"
              checked={selectedType === 'python'}
              onChange={() => setSelectedType('python')}
              className="h-4 w-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <CodeIcon className="h-5 w-5 mr-2 text-indigo-600" />
                <label htmlFor="python" className="font-medium text-gray-900">Custom Python Scraper</label>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Upload or write your own Python scraper for maximum flexibility. Best for complex websites.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start space-x-4 p-4 border rounded-lg cursor-pointer ${
              selectedType === 'typescript' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedType('typescript')}
          >
            <input
              type="radio"
              id="typescript"
              name="scraperType"
              value="typescript"
              checked={selectedType === 'typescript'}
              onChange={() => setSelectedType('typescript')}
              className="h-4 w-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <CodeIcon className="h-5 w-5 mr-2 text-indigo-600" />
                <label htmlFor="typescript" className="font-medium text-gray-900">Custom TypeScript Scraper</label>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Upload or write your own TypeScript scraper. Best for sites suited to browser automation or Crawlee.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}