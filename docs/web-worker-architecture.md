# Web Service + Worker Service Architecture for Scraper Execution

## Problem

Previously, scraper tasks (especially long-running Crawlee scrapers) were initiated and executed directly within the Next.js API route handler (`/api/scrapers/[scraperId]/run`). This meant the scraper ran synchronously within the same process as the main web server (`next start`).

On platforms like Railway, web services are expected to be responsive to health checks and incoming requests. When a long scraper task blocked the main process, Railway would detect it as unresponsive and terminate the entire container (`SIGTERM`). This killed the scraper mid-run, resulting in incomplete scrapes and errors like "0 products found".

## Solution: Decoupling with a Worker Service

To resolve this, we separated the web application logic from the background scraper execution using a standard Web Service + Worker Service pattern:

1.  **Web Service (Next.js App):**
    *   Handles the user interface and API requests.
    *   When the `/api/scrapers/[scraperId]/run` endpoint is called, it **no longer runs the scraper directly**.
    *   Instead, it quickly creates a record in the `scraper_runs` database table with a `status` of `'pending'` and immediately returns a `202 Accepted` response with the `runId`.
    *   This service runs on Railway using the standard `npm start` command.

2.  **Worker Service (Background Task Runner):**
    *   A **separate service** deployed on Railway, running independently from the Web Service.
    *   It runs a dedicated script (`src/worker.ts`, compiled to `dist/worker.js`).
    *   This script continuously polls the `scraper_runs` table for jobs with `status = 'pending'`.
    *   When it finds a pending job, it claims it (updates status to `'running'`) and then executes the actual scraper logic by calling `ScraperExecutionService.runScraperInternal`.
    *   Since it runs in a separate container, it doesn't block the Web Service and won't be terminated due to web health check timeouts.
    *   This service runs on Railway using the custom `npm run start:worker` command.

## Code Changes Summary

1.  **`src/lib/services/scraper-execution-service.ts`:**
    *   Modified `runScraper` method: Removed the asynchronous call to `runScraperInternal`. It now only creates the initial `scraper_runs` record with `status: 'pending'`.
    *   Made `runScraperInternal` method `public static` so the worker script can call it.

2.  **`src/worker.ts` (New File):**
    *   Contains the main loop for the Worker Service.
    *   Uses `createSupabaseAdminClient` to connect to the database.
    *   Periodically queries for pending jobs (`SELECT ... WHERE status = 'pending'`).
    *   Claims a job by updating its status to `'running'`.
    *   Calls `ScraperExecutionService.runScraperInternal` to execute the claimed job.
    *   Includes basic logging and error handling.

3.  **`tsconfig.worker.json` (New File):**
    *   A dedicated TypeScript configuration file for building the worker script.
    *   Extends the main `tsconfig.json` to inherit necessary settings (like `paths`, `target`, `esModuleInterop`).
    *   Overrides specific options for a Node.js environment (`module: CommonJS`, `noEmit: false`, `outDir: ./dist`).

4.  **`package.json`:**
    *   Added `tsc-alias` as a dev dependency to resolve path aliases in compiled JavaScript.
    *   Modified the `build` script:
        *   Renamed original build to `build:next`.
        *   Added `build:worker`: `tsc --project tsconfig.worker.json ; tsc-alias -p tsconfig.worker.json` (compiles worker using its tsconfig, then resolves aliases).
        *   Updated main `build` script to run both: `npm run build:next ; npm run build:worker`.
    *   Added `start:worker` script: `node dist/worker.js` (runs the compiled worker script).

5.  **`package-lock.json`:**
    *   Updated locally via `npm install` to include `tsc-alias` and its dependencies, then committed.

## Railway Configuration

*   **Existing Service (Web Service):**
    *   Type: Web Service
    *   Repository: Your Git repo
    *   Build Command: (Railway default, likely `npm run build`)
    *   Start Command: `npm start`
*   **New Service (Worker Service):**
    *   Type: Worker Service (or similar non-web type)
    *   Repository: Your Git repo (same as Web Service)
    *   Build Command: (Railway default, likely `npm run build`)
    *   Start Command: `npm run start:worker`

## Current Status

The build process now successfully compiles both the Next.js app and the worker script. However, test runs are still failing. Further investigation is needed based on the runtime logs/errors from the Worker Service during a test run.