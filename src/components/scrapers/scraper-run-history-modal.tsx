"use client"; // This component uses hooks and interacts with the browser

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"; // Assuming Shadcn UI Dialog
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Assuming Shadcn UI Table
import { Badge } from "@/components/ui/badge"; // Assuming Shadcn UI Badge
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting

// Define the structure of a scraper run object
interface ScraperRun {
  id: string;
  status: 'success' | 'failed' | 'running' | 'initializing' | string; // Allow other statuses
  started_at: string;
  completed_at?: string | null;
  product_count?: number | null;
  error_message?: string | null;
  execution_time_ms?: number | null;
  products_per_second?: number | null;
}

interface ScraperRunHistoryModalProps {
  scraperId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to format duration from milliseconds
function formatDuration(ms: number | null | undefined): string {
  if (ms === null || typeof ms === 'undefined') return 'N/A';
  if (ms < 1000) return `${ms} ms`;
  const seconds = (ms / 1000).toFixed(1);
  if (parseFloat(seconds) < 60) return `${seconds} s`;
  const minutes = Math.floor(parseFloat(seconds) / 60);
  const remainingSeconds = (parseFloat(seconds) % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
}

// Helper to format timestamp
function formatTimestamp(timestamp: string | null | undefined): string {
    if (!timestamp) return 'N/A';
    try {
        // Show relative time for recent runs, absolute for older ones
        const date = new Date(timestamp);
        const now = new Date();
        const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) {
            return `${formatDistanceToNow(date, { addSuffix: true })}`;
        }
        return date.toLocaleString();
    } catch (_e) { // Prefix unused variable with underscore
        return 'Invalid Date';
    }
}


export default function ScraperRunHistoryModal({
  scraperId,
  isOpen,
  onClose,
}: ScraperRunHistoryModalProps) {
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && scraperId) {
      const fetchRuns = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/scrapers/${scraperId}/run-history`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch runs: ${response.statusText}`);
          }
          const data: ScraperRun[] = await response.json();
          setRuns(data);
        } catch (err) {
          console.error("Error fetching scraper runs:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred");
          setRuns([]); // Clear previous runs on error
        } finally {
          setIsLoading(false);
        }
      };

      fetchRuns();
    } else {
      // Reset state when modal is closed or scraperId is null
      setRuns([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, scraperId]);

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'default'; // Greenish in default themes
      case 'failed':
        return 'destructive'; // Red
      case 'running':
        return 'secondary'; // Bluish/Grayish
      case 'initializing':
        return 'outline'; // Grayish outline
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px]"> {/* Wider modal */}
        <DialogHeader>
          <DialogTitle>Scraper Run History</DialogTitle>
          <DialogDescription>
            Showing recent runs for scraper {scraperId ? `ID: ${scraperId.substring(0, 8)}...` : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-2"> {/* Scrollable content */}
          {isLoading && <p className="text-center">Loading history...</p>}
          {error && <p className="text-center text-red-600">Error: {error}</p>}
          {!isLoading && !error && runs.length === 0 && (
            <p className="text-center text-gray-500">No run history found for this scraper.</p>
          )}
          {!isLoading && !error && runs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Products/sec</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs">{formatTimestamp(run.started_at)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(run.status)}>
                        {run.status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDuration(run.execution_time_ms)}</TableCell>
                    <TableCell>{run.product_count ?? 'N/A'}</TableCell>
                    <TableCell>
                      {typeof run.products_per_second === 'number'
                        ? run.products_per_second.toFixed(2)
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-red-500" title={run.error_message || ''}>
                      {run.error_message || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}