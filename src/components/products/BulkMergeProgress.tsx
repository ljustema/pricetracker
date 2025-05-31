"use client";

import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface BulkMergeProgressProps {
  isVisible: boolean;
  totalGroups: number;
  processedGroups: number;
  successCount: number;
  errorCount: number;
  currentGroup?: string;
}

export function BulkMergeProgress({
  isVisible,
  totalGroups,
  processedGroups,
  successCount,
  errorCount,
  currentGroup
}: BulkMergeProgressProps) {
  if (!isVisible) return null;

  const progressPercentage = totalGroups > 0 ? (processedGroups / totalGroups) * 100 : 0;

  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-blue-900">Bulk Merge Progress</h3>
          <div className="text-sm text-blue-700">
            {processedGroups} of {totalGroups} groups processed
          </div>
        </div>

        <Progress value={progressPercentage} className="h-2" />

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{successCount} successful</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <XCircle className="h-4 w-4" />
                <span>{errorCount} errors</span>
              </div>
            )}
          </div>
          
          {currentGroup && (
            <div className="flex items-center gap-1 text-blue-600">
              <Clock className="h-4 w-4" />
              <span>Processing: {currentGroup}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
