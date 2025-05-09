"use client";

import { useState } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { Button } from "@/components/ui/button";

interface ApproveButtonProps {
  scraperId: string;
  isApproved: boolean;
  onApproved?: () => void;
}

export default function ApproveButton({
  scraperId,
  isApproved,
  onApproved,
}: ApproveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      console.log(`Approving scraper ${scraperId}...`);
      await ScraperClientService.approveScraper(scraperId);
      console.log(`Scraper ${scraperId} approved successfully`);

      // Add a small delay to ensure the database has updated
      await new Promise(resolve => setTimeout(resolve, 500));

      setSuccess(true);
      if (onApproved) {
        console.log("Calling onApproved callback");
        onApproved();
      }
    } catch (err) {
      console.error("Error approving scraper:", err);
      setError((err as Error).message || "Failed to approve scraper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        variant={isApproved ? "secondary" : "default"}
        size="sm"
        disabled={isApproved || loading}
        onClick={handleApprove}
      >
        {loading ? "Approving..." : isApproved ? "Approved" : "Approve"}
      </Button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      {success && <div className="text-xs text-green-600 mt-1">Approved!</div>}
    </div>
  );
}
