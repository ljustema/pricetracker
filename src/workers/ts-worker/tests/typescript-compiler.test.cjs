const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createRequire } = require('node:module');
const execute = promisify(execFile);
const workerRequire = createRequire(path.resolve(__dirname, '../package.json'));
const { compileTypeScriptScraper, cleanupCompilation } = require('../dist/typescript-compiler');

test('compiled scrapers use deployment-locked dependencies and preserve fetch imports', async () => {
  const server = http.createServer((req, res) => res.end('fixture'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let result;
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    result = await compileTypeScriptScraper(`
      import fetch from 'node-fetch';
      const value: number = 42;
      async function main(): Promise<void> {
        const text = await (await fetch(${JSON.stringify(url)})).text();
        const dynamicFetch = (await import('node-fetch')).default;
        console.log(JSON.stringify({ value, text, dynamicFetch: typeof dynamicFetch,
          crawlee: require.resolve('crawlee'), timeout: require.resolve('@apify/timeout') }));
      }
      main().catch(error => { console.error(error); process.exitCode = 1; });
    `);
    assert.equal(result.success, true, result.error);
    const { stdout } = await execute(process.execPath, [result.outputPath]);
    const output = JSON.parse(stdout);
    assert.equal(output.value, 42);
    assert.equal(output.text, 'fixture');
    assert.equal(output.dynamicFetch, 'function');
    assert.equal(output.crawlee, workerRequire.resolve('crawlee'));
    assert.equal(output.timeout, workerRequire.resolve('@apify/timeout'));
    const dependencyPath = output.crawlee;
    await cleanupCompilation(result.tempDir);
    await assert.rejects(fs.access(result.tempDir), { code: 'ENOENT' });
    await fs.access(dependencyPath); // Cleaning up a run must preserve the deployed dependencies.
  } finally {
    if (result?.tempDir) await cleanupCompilation(result.tempDir);
    await new Promise(resolve => server.close(resolve));
  }
});

test('a syntax error fails compilation and its temporary directory can be cleaned', async () => {
  const result = await compileTypeScriptScraper('const broken: = ;');
  try {
    assert.equal(result.success, false);
    assert.match(result.error, /Babel compilation failed/);
  } finally {
    if (result.tempDir) await cleanupCompilation(result.tempDir);
  }
});
