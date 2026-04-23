import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface UnhealthyScraper {
  scraper_id: string;
  scraper_name: string;
  competitor_id: string;
  competitor_name: string;
  user_id: string;
  user_email: string | null;
  status: "warning" | "critical";
  reason_code: string;
  reason_text: string;
  last_run_at: string | null;
  last_run_count: number | null;
  baseline_median: number | null;
  drop_rate: number | null;
  rejection_count_last_run: number | null;
}

export default async function ScraperHealthWidget() {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("admin_list_unhealthy_scrapers");
  if (error) {
    console.error("admin_list_unhealthy_scrapers error:", error);
  }

  const rows = (data ?? []) as UnhealthyScraper[];
  const criticalCount = rows.filter((r) => r.status === "critical").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
            Scraper Health
          </span>
          {rows.length > 0 ? (
            <span className="text-sm font-normal text-gray-600">
              {criticalCount > 0 && (
                <span className="mr-3 inline-flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-red-600"></span>
                  {criticalCount} kritiska
                </span>
              )}
              {warningCount > 0 && (
                <span className="inline-flex items-center">
                  <span className="mr-1 h-2 w-2 rounded-full bg-amber-500"></span>
                  {warningCount} varningar
                </span>
              )}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex items-center text-sm text-gray-600">
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
            Alla aktiva scrapers är friska
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Scraper</th>
                  <th className="px-2 py-2 text-left">Ägare</th>
                  <th className="px-2 py-2 text-left">Orsak</th>
                  <th className="px-2 py-2 text-right">Senaste</th>
                  <th className="px-2 py-2 text-right">Baseline</th>
                  <th className="px-2 py-2 text-right">Drop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.scraper_id}>
                    <td className="px-2 py-2">
                      {r.status === "critical" ? (
                        <span className="inline-flex items-center text-red-700">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Kritisk
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Varning
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/app-routes/scrapers/${r.scraper_id}/edit`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {r.competitor_name}
                      </Link>
                      <div className="text-xs text-gray-500">{r.scraper_name}</div>
                    </td>
                    <td className="px-2 py-2 text-gray-600">
                      {r.user_email ?? r.user_id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-2 text-gray-700">{r.reason_text}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.last_run_count ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-500">
                      {r.baseline_median != null
                        ? Math.round(Number(r.baseline_median))
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.drop_rate != null && Number(r.drop_rate) > 0
                        ? `${(Number(r.drop_rate) * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
