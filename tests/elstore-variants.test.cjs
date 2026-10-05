const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const cheerio = require('cheerio');

// Exercise the production scraper's parser and discovery callback without crawling.
const source = fs.readFileSync('scrapers/elstore.ts', 'utf8');
const ast = ts.createSourceFile('elstore.ts', source, ts.ScriptTarget.Latest, true);
let parser, handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'processApiProductData') parser = node.getText(ast);
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'requestHandler') handler = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(parser && handler);
const context = { variants: [], logProgress() {}, logError(message, error) { throw error || new Error(message); } };
vm.createContext(context);
vm.runInContext(ts.transpile(`${parser}\nconst discover = ${handler};`, { target: ts.ScriptTarget.ES2022 }), context);

const cases = [
  ['willow-boughs-skarmar-mineral-oval-william-morris', '305112-30-130', '7319503057347', [248.82, 326.82, 503.10]],
  ['matrix-skarmar-rund-flamingo', '255144-35-200', '7319502564464', [209.82, 233.22, 319.02, 389.22]],
];
for (const [slug, sku, ean, prices] of cases) {
  test(`${sku}: page EAN belongs only to its exact SKU; sibling prices stay separate`, async () => {
    const fixture = JSON.parse(fs.readFileSync(`tests/fixtures/elstore/${slug}.json`));
    context.apiData = fixture;
    context.variants = [];
    const html = `<div product-id="1" variant-id="${fixture.selected_variant.id}"></div><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku, gtin: ean, brand: { name: 'Hallbergs Belysning' } })}</script>`;
    context.discovery = { request: { url: `https://elstore.se/sv/products/${slug}` }, $: cheerio.load(html) };
    await vm.runInContext('discover(discovery)', context);
    const result = await vm.runInContext('processApiProductData(apiData, variants[0])', context);
    assert.deepEqual(Array.from(result, p => p.competitor_price), prices);
    assert.equal(result.find(p => p.sku === sku).ean, ean);
    assert.deepEqual(Array.from(result, p => p.ean), fixture.product.variants.map(v => v.primary_gtin));
    assert.equal(new Set(result.map(p => p.sku)).size, prices.length);
    // If API identifiers are absent, the page EAN still cannot leak to siblings.
    for (const v of fixture.product.variants) delete v.primary_gtin;
    const fallback = await vm.runInContext('processApiProductData(apiData, variants[0])', context);
    assert.equal(fallback.find(p => p.sku === sku).ean, ean);
    assert.ok(fallback.filter(p => p.sku !== sku).every(p => p.ean === null));
    // A genuine API EAN takes precedence over the page fallback.
    fixture.product.variants[0].gtin = '7319503057323';
    const withGtin = await vm.runInContext('processApiProductData(apiData, variants[0])', context);
    assert.equal(withGtin[0].ean, '7319503057323');
  });
}
test('missing page SKU cannot distribute a page EAN; SKU is never used as EAN', async () => {
  for (const data of [{ gtin: '7319503057347' }, { sku: '305112-30-130' }]) {
    context.variants = [];
    context.discovery = { request: { url: 'https://elstore.se/sv/products/example' }, $: cheerio.load(`<div product-id="1" variant-id="2"></div><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', ...data })}</script>`) };
    await vm.runInContext('discover(discovery)', context);
    context.apiData = { product: { variants: [{ sku: '305112-30-130', price: { formatted_price: '503,1 kr' } }] } };
    const result = await vm.runInContext('processApiProductData(apiData, variants[0])', context);
    assert.equal(result[0].ean, null);
  }
});

test('API EAN reused by different SKUs cannot merge their prices', async () => {
  context.variant = { product_id: '1', url: 'https://elstore.se', fallback_sku: 'A', fallback_ean: '7330024559318' };
  context.apiData = { product: { variants: [
    { sku: 'A', primary_gtin: '7330024559318', price: { formatted_price: '100 kr' } },
    { sku: 'B', primary_gtin: '7330024559318', price: { formatted_price: '200 kr' } },
  ] } };
  const result = await vm.runInContext('processApiProductData(apiData, variant)', context);
  assert.deepEqual(Array.from(result, p => p.ean), [null, null]);
  assert.deepEqual(Array.from(result, p => p.competitor_price), [100, 200]);
});
