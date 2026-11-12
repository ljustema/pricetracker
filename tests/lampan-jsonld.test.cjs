const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const cheerio = require('cheerio');
const source = fs.readFileSync('scrapers/lampan.ts', 'utf8');
const ast = ts.createSourceFile('lampan.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set(['isValidEAN', 'sanitizeEAN', 'extractStructuredProduct', 'extractProductData', 'extractLampanFaktaFields', 'extractStockData', 'parseStockDate']);
const snippets = ast.statements.filter(n =>
  (ts.isFunctionDeclaration(n) && names.has(n.name?.text)) ||
  (ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'CONFIG'))
).map(n => n.getText(ast));
const context = { URL, logProgress() {}, logError() {} };
vm.createContext(context);
vm.runInContext(ts.transpile(snippets.join('\n')), context);
const url = 'https://lampan.se/p/carmino-o38/';
const product = { '@type': 'Product', url, name: 'Carmino ?38 taklampa', brand: { name: 'Lucide' }, gtin13: '5411212771568', sku: '77492/07/55', offers: [{ url, price: '709', priceCurrency: 'SEK' }] };
function page(json, prefix = '') {
  return cheerio.load(`${prefix}<h1 class="product-title">Carmino ?38 taklampa</h1><div class="js-price-field"><meta itemprop="price" content="709"></div><script type="application/ld+json">${JSON.stringify(json)}</script>`);
}
test('Lampan: extracts identifiers from the actual ItemPage.mainEntity layout', async () => {
  const result = await context.extractProductData(page([{ '@type': 'ItemPage', mainEntity: product }]), url);
  assert.ok(result);
  assert.equal(result.brand, 'Lucide');
  assert.equal(result.ean, '5411212771568');
  assert.equal(result.sku, '77492/07/55');
  assert.equal(result.competitor_price, 709);
});
test('Lampan: selects the matching product in a graph, not another product', async () => {
  const result = await context.extractProductData(page({ '@graph': [{ ...product, url: 'https://lampan.se/p/other/', brand: 'Wrong' }, { ...product, '@type': ['Thing', 'Product'] }] }), url);
  assert.equal(result.brand, 'Lucide');
  assert.equal(result.ean, '5411212771568');
});
test('Lampan: invalid EAN is omitted and existing HTML identifiers are preserved', async () => {
  const invalid = await context.extractProductData(page({ ...product, gtin13: '0000000000000' }), url);
  assert.equal(invalid.ean, null);
  assert.equal(invalid.brand, 'Lucide');
  const html = '<div id="produktdata"><meta itemprop="brand" content="Existing"><meta itemprop="gtin13" content="7319503057347"></div><span itemprop="sku">Existing-SKU</span>';
  const result = await context.extractProductData(page(product, html), url);
  assert.equal(result.brand, 'Existing');
  assert.equal(result.ean, '7319503057347');
  assert.equal(result.sku, 'Existing-SKU');
});
test('Lampan: malformed JSON-LD does not prevent later valid scripts from being read', async () => {
  const $ = page(product, '<script type="application/ld+json">{broken</script>');
  assert.equal((await context.extractProductData($, url)).brand, 'Lucide');
});
test('Lampan: does not use a different product or related product identifiers', async () => {
  for (const json of [{ ...product, url: 'https://lampan.se/p/other/' }, { '@type': 'ItemPage', related: product }]) {
    const result = await context.extractProductData(page(json), url);
    assert.equal(result.brand, null);
    assert.equal(result.ean, null);
  }
});
module.exports = { extract: (html, pageUrl) => context.extractProductData(cheerio.load(html), pageUrl) };

test('Lampan: current JSON-LD offer overrides undiscounted JavaScript price', async () => {
  const $ = page(product);
  $('.js-price-field').remove();
  $('body').append('<script>var productData = {"combinations":[{"price":749,"articleNumber":"77492/07/55"}]};</script>');
  const result = await context.extractProductData($, url);
  assert.equal(result.competitor_price, 709);
  assert.equal(result.currency_code, 'SEK');
});
test('Lampan: does not apply an offer belonging to a different product', async () => {
  const result = await context.extractProductData(page({ ...product, offers: [{ url: 'https://lampan.se/p/other/', price: '1' }] }), url);
  assert.equal(result.competitor_price, 709);
});
