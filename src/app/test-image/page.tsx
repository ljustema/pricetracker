'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function TestImagePage() {
  const [imageUrl, setImageUrl] = useState('https://lampan.se/images/normal/eu10274-1bk_1.jpg.webp');
  const [proxyLogs, setProxyLogs] = useState('');
  const [imageError, setImageError] = useState('');

  const testProxyDirectly = async () => {
    try {
      setProxyLogs('Testing proxy API directly...');
      const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
      
      if (response.ok) {
        const blob = await response.blob();
        setProxyLogs(`Success! Image fetched: ${blob.size} bytes, type: ${blob.type}`);
      } else {
        const errorText = await response.text();
        setProxyLogs(`Error: ${response.status} ${response.statusText}\n${errorText}`);
      }
    } catch (error) {
      setProxyLogs(`Fetch error: ${error}`);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Image Proxy Test</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Image URL to test:
          </label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="Enter image URL"
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={testProxyDirectly}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Proxy API Directly
          </button>
        </div>

        {proxyLogs && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Proxy API Test Results:</h3>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {proxyLogs}
            </pre>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-2">Image Display Test:</h3>
          <div className="border border-gray-300 p-4 rounded">
            {imageUrl && (
              <Image
                src={`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`}
                alt="Test image"
                width={400}
                height={300}
                className="max-w-full h-auto"
                unoptimized
                onError={(e) => {
                  console.error('Image load error:', e);
                  setImageError('Failed to load image through proxy');
                }}
                onLoad={() => {
                  setImageError('');
                }}
              />
            )}
            {imageError && (
              <div className="text-red-500 mt-2">{imageError}</div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Direct Image Test (bypass proxy):</h3>
          <div className="border border-gray-300 p-4 rounded">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt="Direct test image"
                width={400}
                height={300}
                className="max-w-full h-auto"
                unoptimized
                onError={(e) => {
                  console.error('Direct image load error:', e);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
