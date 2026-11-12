export async function fetchAllCatalogRows(queryPage: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>, size = 1000): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += size) {
    const result = await queryPage(from, from + size - 1);
    if (result.error) throw new Error(`Catalog context query failed: ${result.error.message || 'unknown error'}`);
    const page = result.data || [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}
