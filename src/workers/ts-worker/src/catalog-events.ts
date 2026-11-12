export async function handleCatalogEvent(
 value: any, enabled: boolean, scraperId: string, supabase: any
): Promise<boolean> {
  if (value?.type !== 'lampan_url_checks') return false;
  if (!enabled || !Array.isArray(value.urls) || value.urls.length > 100 || !value.urls.length) {
    throw new Error('Unexpected Lampan URL check event');
  }
  if (!value.urls.every((url: unknown) => typeof url === 'string' && /^https:\/\/lampan\.se\/p\/[^?#]+\/$/.test(url))) {
    throw new Error('Invalid Lampan URL check event');
  }
  const result = await supabase.rpc('record_competitor_url_checks', {
    p_scraper_id: scraperId, p_urls: [...new Set(value.urls)], p_checked_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(`Could not save Lampan discovery progress: ${result.error.message}`);
  return true;
}
