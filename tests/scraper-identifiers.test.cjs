const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
for (const name of ['bright123', 'stockholms-ljusbutik']) {
  const source = fs.readFileSync(`scrapers/${name}.ts`, 'utf8');
  const ast = ts.createSourceFile('scraper.ts', source, ts.ScriptTarget.Latest, true);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && ['hasMatchingIdentifiers', 'productPassesFilters'].includes(node.name?.text)) functions.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const ctx = { CONFIG: { FILTERING: { ENABLED: false } } };
  vm.createContext(ctx);
  vm.runInContext(ts.transpile(functions.join('\n')), ctx);
  test(`${name}: skip unmatchable products even when optional filters are disabled`, () => {
    for (const p of [{ name: 'G9 ring' }, { brand: 'Texa Design', sku: '-', ean: '-' }, { brand: 'Flos', sku: null }, { ean: '0000000000000' }, { ean: '123' }]) {
      assert.equal(ctx.productPassesFilters(p, {}), false);
    }
    for (const p of [{ ean: '7319503057347' }, { ean: '12345678' }, { brand: 'Flos', sku: 'F1080009', ean: '-' }]) {
      assert.equal(ctx.productPassesFilters(p, {}), true);
    }
  });
}

const lampan = fs.readFileSync('scrapers/lampan.ts', 'utf8');
const lampanAst = ts.createSourceFile('lampan.ts', lampan, ts.ScriptTarget.Latest, true);
const sitemapFunction = lampanAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'fetchSitemapUrls').getText(lampanAst);
test('Lampan: sitemap failure rejects instead of reporting a successful empty run', async () => {
  let requests = 0;
  const ctx = { AbortSignal, fetch: async () => { requests++; return { ok: false, status: 403, statusText: 'Forbidden' }; }, logProgress() {}, logError() {}, setTimeout: f => f() };
  vm.createContext(ctx);
  vm.runInContext(ts.transpile(sitemapFunction), ctx);
  await assert.rejects(ctx.fetchSitemapUrls('https://lampan.se/sitemap.xml'), /403 Forbidden/);
  assert.equal(requests, 5);
});
