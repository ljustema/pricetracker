"use client";

import { useState } from "react";
import { ScraperClientService } from "@/lib/services/scraper-client-service";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const handleActivate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await ScraperClientService.activateScraper(scraperId);
      setSuccess(true);

      // Call the onActivated callback if provided
      if (onActivated) onActivated();

      // Check if we're on the main scrapers page and force a refresh if needed
      const currentPath = window.location.pathname;
      if (currentPath === '/app-routes/scrapers') {
        // Add a timestamp to force a fresh load of the page
        const timestamp = new Date().getTime();
        router.push(`/app-routes/scrapers?refresh=${timestamp}`);
      }
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
