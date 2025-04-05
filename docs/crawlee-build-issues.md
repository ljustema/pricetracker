# Tracking: Crawlee Build/Runtime Issues in Next.js

This document tracks attempts to resolve issues encountered when running Crawlee scrapers within the Next.js environment, specifically related to build outputs and runtime file access.

**Initial Problem:** Crawlee fails during execution (validation or full run) with an error: `ENOENT: no such file or directory, open '.../.next/server/vendor-chunks/data_files/headers-order.json'`. This file is required by `header-generator`, a dependency used by Crawlee for generating browser headers.

## Attempt 1: Install `puppeteer`

*   **Hypothesis:** The error originated from `@crawlee/puppeteer`, even though `CheerioCrawler` was used. Installing `puppeteer` might satisfy an implicit dependency resolution path.
*   **Action:** Ran `npm install puppeteer`.
*   **Result:** Build error persisted.

## Attempt 2: `experimental.outputFileTracingIncludes`

*   **Hypothesis:** Next.js file tracing wasn't including the necessary `header-generator/data_files`.
*   **Action:** Added `experimental.outputFileTracingIncludes` to `next.config.ts` targeting the data files.
*   **Result:** Caused a `next.config.ts` validation error. The warning indicated the option moved to the top level (`outputFileTracingIncludes`).

## Attempt 3: Top-level `outputFileTracingIncludes`

*   **Hypothesis:** Correctly placing `outputFileTracingIncludes` at the top level of `next.config.ts` would fix the tracing.
*   **Action:** Moved `outputFileTracingIncludes` to the top level in `next.config.ts`. Fixed syntax errors related to placement.
*   **Result:** The `headers-order.json` ENOENT error persisted during validation runtime. `outputFileTracingIncludes` did not seem to resolve the issue.

## Attempt 4: `copy-webpack-plugin`

*   **Hypothesis:** Explicitly copying the `header-generator/data_files` during the server build using `copy-webpack-plugin` would make the files available at runtime.
*   **Action:** Installed `copy-webpack-plugin`. Modified `next.config.ts` to use the plugin to copy `node_modules/header-generator/data_files` to `.next/server/`. Removed `outputFileTracingIncludes`.
*   **Result:** The `headers-order.json` ENOENT error persisted during validation runtime. Copying to `.next/server/` did not resolve the issue.

## Attempt 5: `copy-webpack-plugin` (Mimic node_modules)

*   **Hypothesis:** Copying `header-generator/data_files` to a path mimicking the `node_modules` structure within the build output (`.next/server/node_modules/header-generator/data_files/`) might allow `got-scraping` to find it via relative paths.
*   **Action:** Updated the `to` path in the `copy-webpack-plugin` configuration in `next.config.ts`.
*   **Result:** The `headers-order.json` ENOENT error *still* persisted during validation runtime. This suggests the issue might be deeper than just file copying, potentially related to how `got-scraping` resolves paths within the bundled server environment or how Next.js handles these specific dependencies.

## Attempt 6: Mark Packages as External

*   **Hypothesis:** Preventing Next.js from bundling `got-scraping` and `header-generator` might allow them to resolve their internal file paths correctly from `node_modules`.
*   **Action:** Added `got-scraping` and `header-generator` to `serverExternalPackages` in `next.config.ts`. Removed `copy-webpack-plugin` config.
*   **Result:** **Success!** The `headers-order.json` ENOENT error was resolved. The validation run proceeded but initially found 0 products due to a low `maxRequestsPerCrawl` limit.

## Attempt 7: Increase Validation Request Limit

*   **Hypothesis:** The validation run wasn't processing enough pages to find products.
*   **Action:** Increased `maxRequestsPerCrawl` within the validation logic in `/api/scrapers/python/validate/route.ts` from 15 to 50, then to 200.
*   **Result:** **Success!** With `maxRequestsPerCrawl: 200`, the validation run successfully found and returned sample products.

---

**(Build/Runtime Issue Resolved)**