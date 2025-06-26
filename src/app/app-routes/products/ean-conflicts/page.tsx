'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ProductMatchReviewUI from '@/components/products/ProductMatchReviewUI';
import { Button } from '@/components/ui/button';

export default function EANConflictsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
            <h1 className="text-3xl font-bold">Review EAN Conflicts</h1>
          </div>
        </div>
        <p className="text-gray-600 mt-2">
          Review and resolve EAN conflicts that require manual approval before product matching.
        </p>
      </div>

      {/* EAN Conflicts Review Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <ProductMatchReviewUI 
          onReviewsUpdated={() => {
            // Optionally refresh or update any parent state
            // For now, the component handles its own state
          }}
        />
      </div>
    </div>
  );
}
