"use client";

import { useState } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { Button } from "@/components/ui/button";

interface ActivateButtonProps {
  scraperId: string;
  isActive: boolean;
  onActivated?: () => void;
}

export default function ActivateButton({
  scraperId,
  isActive,
  onActivated,
}: ActivateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await ScraperClientService.activateScraper(scraperId);
      setSuccess(true);
      if (onActivated) onActivated();
    } catch (err) {
      setError((err as Error).message || "Failed to activate scraper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        variant={isActive ? "secondary" : "default"}
        size="sm"
        disabled={isActive || loading}
        onClick={handleActivate}
      >
        {loading ? "Activating..." : isActive ? "Active" : "Activate"}
      </Button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      {success && <div className="text-xs text-green-600 mt-1">Activated!</div>}
    </div>
  );
}
