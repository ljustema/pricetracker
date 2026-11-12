const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Configuration } = require('crawlee');

test('Bright123 uses a real memory-only storage client for Crawlee', async () => {
  const source = fs.readFileSync('scrapers/bright123.ts', 'utf8');
  const ast = ts.createSourceFile('bright123.ts', source, ts.ScriptTarget.Latest, true);
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'configureCrawleeStorage') declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(declaration);
  const compiled = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { Configuration, logProgress() {}, console };
  Configuration.resetGlobalState();
  try {
    vm.runInNewContext(compiled, context);
    const config = context.configureCrawleeStorage();
    const client = config.getStorageClient();
    assert.equal(config.get('persistStorage'), false);
    assert.equal(client.persistStorage, false);
    assert.equal(Configuration.getGlobalConfig().getStorageClient(), client);
    const queue = await client.requestQueues().getOrCreate('bright123-memory-only-regression');
    const stored = await client.requestQueue(queue.id).addRequest({ url: 'https://example.test/', uniqueKey: 'fixture' });
    const loaded = await client.requestQueue(queue.id).getRequest(stored.requestId);
    assert.equal(loaded.url, 'https://example.test/');
  } finally {
    Configuration.resetGlobalState();
  }
});
