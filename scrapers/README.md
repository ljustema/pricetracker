# Database-backed scrapers

`elstore.ts` is the versioned source of the active **Elstore TypeScript Scraper 1**. The TypeScript worker loads `scrapers.typescript_script` from Supabase for each job; deploying the web application does not publish this file. Update the existing scraper's script when changing this source, checking that the stored version has not changed concurrently.

The September 12, 2026 fix reads each API variant's `primary_gtin`. HTML structured-data GTIN is a fallback only for its exact SKU, and a SKU is never interpreted as a GTIN. An EAN shared by different SKUs on the same page is omitted so matching can use SKU and brand. Prices and stock remain associated with the individual API variant.

Regression fixtures contain public product API fields captured on September 12, 2026. They cover the Willow Boughs Mineral and Matrix Flamingo size families. The tests execute the discovery callback and product parser from the actual scraper source.

```sh
node --test tests/elstore-variants.test.cjs
npx tsc --noEmit --skipLibCheck --esModuleInterop --target ES2020 --module commonjs --strict scrapers/elstore.ts
```

Current observations were re-fetched separately for products that received conflicting Elstore prices during the September 12 run. Corrections append verified prices rather than rewriting historical observations. Earlier Elstore price history can therefore still contain incorrect variant prices.

## September 26, 2026 operations fixes

`bright123.ts`, `stockholms-ljusbutik.ts`, and `lampan.ts` are also database-backed
sources. Changes were published to their existing `scrapers.typescript_script`
records with optimistic checks against the previously read script.

Bright123 and Stockholms Ljusbutik now skip products without either an EAN accepted
by the database's identifier checks or a nonempty brand and supplier SKU. This
check runs even when optional catalog/brand filters are disabled. It prevents
expected missing-identifier rows from generating rejection warnings without
changing matching rules or suppressing actual execution failures. Existing
rejection records expire from the daily report's 24-hour window normally.

Lampan's production worker received HTTP 403 for the sitemap and homepage, while
the same URLs worked from the web service. The scraper now uses concurrency 2
and a 300 requests/minute ceiling (previously 10 and 2000), aborts sitemap requests
after 30 seconds, and propagates exhausted discovery failures instead of exiting
successfully with an empty result. These code changes do not themselves remove
an existing IP block; worker recovery must be verified separately.

Validation:

```sh
node --test tests/scraper-identifiers.test.cjs
npx tsc --noEmit --skipLibCheck --esModuleInterop --target ES2020 --module commonjs scrapers/lampan.ts scrapers/stockholms-ljusbutik.ts
```

Bright123 retains four existing type-check errors involving Crawlee storage options
and unknown exception types; the same errors are present in the original stored
script. The worker transpiles scripts without full TypeScript type checking.

Production verification on 2026-09-26:

- Railway worker redeployment `ba9e8654-ad21-4e31-a93a-34585dfb0099`
  reached SUCCESS; sitemap returned HTTP 200 from the new worker.
- Lampan test `7eaf9eab-807b-4926-9b4c-06ff30a09096`: completed,
  20 requests succeeded, zero failed, 12 product rows saved.
- Bright123 test `4c31d362-8098-403f-ba1a-64e31183c950`: completed,
  20 product rows saved.
- Stockholms Ljusbutik test `8d7588f0-e14c-42f0-bc6f-4097ff3dff09`:
  completed, 14 product rows saved.
- No new rejection records during these checks. These were bounded test runs;
  the next scheduled full runs exercise the complete catalogs.
- Original database scripts are backed up under
  `~/.local/state/pricetracker/backups/scraper-fixes-20260926/`.

Later on September 26, the live full Lampan run was progressing without ERROR-level logs, but 300 requests/minute was unnecessarily slow for 15,060 URLs. At user request, adjusted the stored script to concurrency 4 and 600 requests/minute for subsequent runs. The running process retains its loaded 2/300 configuration and was left uninterrupted. No evidence established that the previous 2,000/minute ceiling caused the earlier IP-specific block.

## October 5, 2026 heap exhaustion

Bright123 and Norrmalms El failed around the default 2 GB Node heap limit.
The worker had Crawlee 3.16.0 and `@apify/timeout` 0.3.5 installed from its
lockfile, but the script compiler ran `npm install --no-package-lock` for every
job. This fetched Crawlee 3.18.1 and `@apify/timeout` 0.4.14 in the scraper's
temporary directory, bypassing the deployment lockfile.

A controlled Bright123 reproduction with the freshly installed dependencies
reached 1,411 MB heap after 500 products; its heap snapshot retained millions
of parsed HTML elements. Changing only `@apify/timeout` to the deployment's
0.3.5 version allowed the same 2,500-URL workload to finish without increasing
the 2 GB heap limit (2,496 products, sampled RSS below 600 MB).

The compiler now links each isolated temporary script directory to the worker's
`npm ci` dependencies and invokes its installed Babel CLI directly. No package
installation happens during a scraper run. This applies to all TypeScript
scrapers; database-backed scripts and their concurrency settings need no edits.
Regression tests execute a compiled script, check deployment dependency identity,
exercise static and dynamic fetch imports, and verify compilation cleanup.

```sh
cd src/workers/ts-worker
npm ci
npm test
```
