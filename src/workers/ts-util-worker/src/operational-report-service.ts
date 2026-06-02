import { createHash } from 'crypto';

type SupabaseClient = any;
type ReportMode = 'disabled' | 'daily' | 'issues_only';

interface ReportSettings {
  user_id: string;
  operational_report_email: string | null;
  operational_report_mode: ReportMode;
}

interface Issue {
  category: string;
  name: string;
  detail: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_MS = 30 * 60 * 60 * 1000;
const STUCK_MS = 2 * 60 * 60 * 1000;
const DAILY_REPORT_UTC_HOUR = 6;

export class OperationalReportService {
  private isRunning = false;

  constructor(private readonly supabase: SupabaseClient) {}

  async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('user_id, operational_report_email, operational_report_mode')
        .neq('operational_report_mode', 'disabled')
        .not('operational_report_email', 'is', null);
      if (error) throw new Error(`Failed to load report settings: ${error.message}`);
      for (const settings of (data || []) as ReportSettings[]) await this.processUser(settings);
    } catch (error) {
      console.error('[OperationalReports] Report check failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processUser(settings: ReportSettings): Promise<void> {
    if (!settings.operational_report_email) return;
    const summary = await this.buildSummary(settings.user_id);
    const now = new Date();
    const reportDate = now.toISOString().slice(0, 10);

    if (settings.operational_report_mode === 'daily' && now.getUTCHours() >= DAILY_REPORT_UTC_HOUR) {
      await this.deliver(settings, 'daily', reportDate, '', summary);
    }
    if (settings.operational_report_mode === 'issues_only' && summary.issues.length > 0) {
      const signature = createHash('sha256')
        .update(summary.issues.map(issue => `${issue.category}:${issue.name}:${issue.detail}`).sort().join('|'))
        .digest('hex');
      await this.deliver(settings, 'issues', reportDate, signature, summary);
    }
  }

  private async buildSummary(userId: string) {
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const [scrapersResult, scraperRunsResult, integrationsResult, integrationRunsResult] = await Promise.all([
      this.supabase.from('scrapers').select('id, name, last_run').eq('user_id', userId).eq('is_active', true),
      this.supabase.from('scraper_runs').select('scraper_id, status, error_message, created_at').eq('user_id', userId).gte('created_at', since),
      this.supabase.from('integrations').select('id, name, last_sync_at').eq('user_id', userId).eq('is_active', true),
      this.supabase.from('integration_runs').select('integration_id, status, error_message, created_at').eq('user_id', userId).gte('created_at', since),
    ]);
    for (const result of [scrapersResult, scraperRunsResult, integrationsResult, integrationRunsResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const scrapers = scrapersResult.data || [];
    const scraperRuns = scraperRunsResult.data || [];
    const integrations = integrationsResult.data || [];
    const integrationRuns = integrationRunsResult.data || [];
    const issues: Issue[] = [];
    const now = Date.now();

    for (const item of scrapers) {
      if (!item.last_run || now - new Date(item.last_run).getTime() > OVERDUE_MS) {
        issues.push({ category: 'Scraper not running', name: item.name, detail: this.describeLastRun(item.last_run) });
      }
    }
    for (const run of scraperRuns) {
      const name = this.lookupName(scrapers, run.scraper_id);
      if (run.status === 'failed') issues.push({ category: 'Scraper failed', name, detail: run.error_message || 'Unknown error' });
      else if (['pending', 'initializing', 'running'].includes(run.status) && now - new Date(run.created_at).getTime() > STUCK_MS) {
        issues.push({ category: 'Scraper job stuck', name, detail: `Status: ${run.status}` });
      }
    }
    for (const item of integrations) {
      if (!item.last_sync_at || now - new Date(item.last_sync_at).getTime() > OVERDUE_MS) {
        issues.push({ category: 'Integration not running', name: item.name, detail: this.describeLastRun(item.last_sync_at) });
      }
    }
    for (const run of integrationRuns) {
      const name = this.lookupName(integrations, run.integration_id);
      if (run.status === 'failed') issues.push({ category: 'Integration failed', name, detail: run.error_message || 'Unknown error' });
      else if (['pending', 'initializing', 'running', 'processing'].includes(run.status) && now - new Date(run.created_at).getTime() > STUCK_MS) {
        issues.push({ category: 'Integration job stuck', name, detail: `Status: ${run.status}` });
      }
    }
    return { scrapers, scraperRuns, integrations, integrationRuns, issues };
  }

  private async deliver(settings: ReportSettings, reportType: 'daily' | 'issues', reportDate: string, signature: string, summary: Awaited<ReturnType<OperationalReportService['buildSummary']>>): Promise<void> {
    const { data, error } = await this.supabase.from('operational_report_deliveries').insert({
      user_id: settings.user_id, report_type: reportType, report_date: reportDate,
      issue_signature: signature, recipient_email: settings.operational_report_email, status: 'pending',
    }).select('id').single();
    let deliveryId = data?.id;
    if (error) {
      if (error.code === '23505') {
        let existingQuery = this.supabase.from('operational_report_deliveries')
          .select('id, status')
          .eq('user_id', settings.user_id)
          .eq('report_type', reportType);
        existingQuery = reportType === 'daily'
          ? existingQuery.eq('report_date', reportDate)
          : existingQuery.eq('issue_signature', signature);
        const { data: existing, error: existingError } = await existingQuery.maybeSingle();
        if (existingError) throw new Error(`Failed to load report delivery: ${existingError.message}`);
        if (!existing || existing.status !== 'failed') return;
        deliveryId = existing.id;
        await this.supabase.from('operational_report_deliveries').update({
          status: 'pending', error_message: null,
        }).eq('id', deliveryId);
      } else {
        throw new Error(`Failed to create report delivery: ${error.message}`);
      }
    }

    const result = await this.sendEmail(
      settings.operational_report_email!,
      reportType === 'issues' ? 'PriceTracker warning: scraper or integration issue' : 'PriceTracker daily operations report',
      this.renderReport(summary, reportType)
    );
    await this.supabase.from('operational_report_deliveries').update({
      status: result.ok ? 'sent' : 'failed', sent_at: result.ok ? new Date().toISOString() : null, error_message: result.error || null,
    }).eq('id', deliveryId);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not configured for the utility worker' };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `PriceTracker <${process.env.RESEND_FROM_EMAIL || 'noreply@pricetracker.se'}>`, to: [to], subject, html }),
      });
      return response.ok ? { ok: true } : { ok: false, error: `Resend returned ${response.status}: ${await response.text()}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private renderReport(summary: Awaited<ReturnType<OperationalReportService['buildSummary']>>, type: 'daily' | 'issues'): string {
    const issues = summary.issues.length
      ? `<h2>Warnings</h2><ul>${summary.issues.map(issue => `<li><strong>${this.escape(issue.category)}:</strong> ${this.escape(issue.name)} - ${this.escape(issue.detail)}</li>`).join('')}</ul>`
      : '<p>No scraper or integration issues detected.</p>';
    return `<h1>${type === 'issues' ? 'PriceTracker operations warning' : 'PriceTracker daily operations report'}</h1>
      <p>Summary for the last 24 hours:</p><ul>
      <li>Active scrapers: ${summary.scrapers.length}</li><li>Completed scraper runs: ${summary.scraperRuns.filter((run: { status: string }) => run.status === 'completed').length}</li>
      <li>Active integrations: ${summary.integrations.length}</li><li>Completed integration runs: ${summary.integrationRuns.filter((run: { status: string }) => run.status === 'completed').length}</li>
      </ul>${issues}`;
  }

  private lookupName(items: Array<{ id: string; name: string }>, id: string): string {
    return items.find(item => item.id === id)?.name || id;
  }
  private describeLastRun(value: string | null): string {
    return value ? `Last successful run: ${new Date(value).toISOString()}` : 'No successful run recorded';
  }
  private escape(value: string): string {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  }
}
