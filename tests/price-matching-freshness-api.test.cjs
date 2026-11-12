const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadRoute(rows = [], error = null) {
  const calls = [];
  const client = { rpc: async (name, params) => {
    calls.push({ name, params });
    if (name === 'validate_api_key') return { data: [{ is_valid: true, user_id: 'owner' }] };
    if (name === 'get_fresh_price_matching_export') {
      return error ? { error } : { data: rows.slice(params.p_offset, params.p_offset + params.p_limit) };
    }
    return { data: null };
  }};
  class NextResponse extends Response {
    static json(value, options) { return new Response(JSON.stringify(value), { ...options, headers: { 'content-type': 'application/json' } }); }
  }
  const source = fs.readFileSync('src/app/api/external/price-matching-csv/route.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, Headers, URL, console: { log() {}, error() {} }, require(name) {
    if (name === 'next/server') return { NextResponse };
    if (name === '@/lib/supabase/server') return { createSupabaseAdminClient: () => client };
    if (name === '@/lib/utils/uuid') return { ensureUUID: value => value };
    throw new Error(`Unexpected import: ${name}`);
  }};
  vm.runInNewContext(compiled, context);
  return { get: context.exports.GET, calls };
}
function request(query = '', authenticated = true) {
  return new Request(`https://example.test/api/external/price-matching-csv${query}`, { headers: authenticated ? { authorization: 'Bearer test-key' } : {} });
}
const product = {
  product_name: 'Fixture', product_sku: 'ABC', product_ean: '123', product_brand: 'Brand',
  our_price: 200, lowest_competitor_price: 150, competitor_count: 1,
  most_competitive_competitor_name: 'Competitor', competitor_price_verified_at: '2026-11-12T10:00:00+00:00',
};

test('both modes use only the freshness RPC and export acquisition time', async () => {
  for (const mode of ['priority', 'coverage']) {
    const route = loadRoute([product]);
    const response = await route.get(request(`?mode=${mode}`));
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.match(csv, /Competitor Price Verified At/);
    assert.match(csv, /"2026-11-12T10:00:00\+00:00"/);
    const calls = route.calls.filter(call => call.name === 'get_fresh_price_matching_export');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.p_mode, mode);
    assert.equal(route.calls.some(call => /get_priority_products|get_price_matching_coverage/.test(call.name)), false);
  }
});
test('all expired prices produce a valid empty CSV snapshot', async () => {
  const route = loadRoute();
  const response = await route.get(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-total-rows'), '0');
  assert.equal((await response.text()).split('\n').length, 1);
});
test('a missing migration fails closed without legacy fallback', async () => {
  const route = loadRoute([], { code: 'PGRST202' });
  const response = await route.get(request());
  assert.equal(response.status, 501);
  assert.match((await response.json()).error, /Fresh-price export/);
  assert.equal(route.calls.filter(call => call.name === 'get_fresh_price_matching_export').length, 1);
});
test('pagination preserves freshness RPC and mode for every batch', async () => {
  const route = loadRoute(Array.from({ length: 1001 }, (_, index) => ({ ...product, product_sku: String(index) })));
  const response = await route.get(request('?mode=coverage'));
  assert.equal(response.headers.get('x-total-rows'), '1001');
  const calls = route.calls.filter(call => call.name === 'get_fresh_price_matching_export');
  assert.deepEqual(calls.map(call => call.params.p_offset), [0, 1000]);
  assert.equal(calls.every(call => call.params.p_mode === 'coverage'), true);
});
test('unauthenticated requests remain unauthorized', async () => {
  const route = loadRoute([product]);
  assert.equal((await route.get(request('', false))).status, 401);
  assert.equal(route.calls.length, 0);
});
