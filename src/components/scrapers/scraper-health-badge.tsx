"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import type { ScraperHealth } from "@/app/api/scrapers/[scraperId]/health/route";

interface ScraperHealthBadgeProps {
  scraperId: string;
}

export default function ScraperHealthBadge({ scraperId }: ScraperHealthBadgeProps) {
  const [health, setHealth] = useState<ScraperHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/scrapers/${scraperId}/health`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await res.json()) as ScraperHealth;
        if (!cancelled) {
          setHealth(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scraperId]);

  if (loading) {
    return (
      <span
        className="inline-block h-3 w-3 rounded-full bg-gray-200 animate-pulse"
        aria-label="Laddar hälsostatus"
      />
    );
  }

  if (!health) {
    return (
      <HelpCircle
        className="h-4 w-4 text-gray-400"
        aria-label="Hälsostatus okänd"
      />
    );
  }

  const tooltip = buildTooltip(health);

  switch (health.status) {
    case "critical":
      return (
        <span title={tooltip} className="inline-flex items-center">
          <AlertCircle className="h-4 w-4 text-red-600" aria-label="Kritisk" />
        </span>
      );
    case "warning":
      return (
        <span title={tooltip} className="inline-flex items-center">
          <AlertTriangle
            className="h-4 w-4 text-amber-500"
            aria-label="Varning"
          />
        </span>
      );
    case "ok":
      return (
        <span title={tooltip} className="inline-flex items-center">
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="OK" />
        </span>
      );
    default:
      return (
        <span title={tooltip} className="inline-flex items-center">
          <HelpCircle className="h-4 w-4 text-gray-400" aria-label="Okänd" />
        </span>
      );
  }
}

function buildTooltip(h: ScraperHealth): string {
  const lines: string[] = [h.reason_text];
  if (typeof h.last_run_count === "number") {
    lines.push(`Senaste körning: ${h.last_run_count} produkter`);
  }
  if (typeof h.baseline_median === "number" && h.baseline_median > 0) {
    lines.push(`Baseline (median av ${h.baseline_runs ?? 0} körningar): ${Math.round(h.baseline_median)}`);
  }
  if (typeof h.rejection_count_last_run === "number" && h.rejection_count_last_run > 0) {
    lines.push(`Avvisade rader: ${h.rejection_count_last_run}`);
  }
  if (typeof h.drop_rate === "number" && h.drop_rate > 0) {
    lines.push(`Drop-rate: ${(h.drop_rate * 100).toFixed(1)}%`);
  }
  return lines.join("\n");
}
