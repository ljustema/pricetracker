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
      await ScraperClientService.approveScraper(scraperId);
      setSuccess(true);
      if (onApproved) onApproved();
    } catch (err) {
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
