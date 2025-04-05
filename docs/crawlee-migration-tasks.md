# Task List: Crawlee Migration

This task list is based on the plan outlined in `crawlee-migration-plan.md`.

## Phase 1: Direct Execution Migration

### 1. Setup & Dependencies
- [x] Install Crawlee: `npm install crawlee`
- [x] Install Playwright (or Puppeteer): `npm install playwright` (and `puppeteer` for compatibility)
- [x] Install necessary types: `npm install @types/node` (if not already present)
- [x] Configure `tsconfig.json` if needed for Crawlee types/features. (Verified no changes needed initially)

### 2. Proof of Concept (POC - Direct Execution)
- [x] Select representative Python scraper(s) for POC. (Selected NorrmalmsEl)
- [x] Rewrite selected scraper(s) in TypeScript using Crawlee (`src/lib/scrapers/norrmalmsel-crawler.ts`).
- [x] Modify `ScraperExecutionService` methods (`runScraperTestInternal`, `runScraperInternal`) to instantiate and run the new TS crawler(s) directly **(Note: Currently runs imported file, not DB script)**.
- [x] Implement basic data retrieval (`crawler.getData()`/`getDataset()`) and logging in the service. (Done via `Dataset.pushData` and return)
- [x] **Adapt Validation Logic:** Modify `/api/scrapers/python/validate/route.ts` to handle `crawlee` type and implement limited execution preview. (Done for NorrmalmsEl POC)
- [x] Test POC thoroughly locally. (Validation successful, found products, fixed initial DB/run registration issues, local full test run successful 2025-04-05 after fixing storage/DB timeout issues)
- [ ] Deploy POC to Vercel preview/staging.
- [ ] Test POC on Vercel, monitoring logs for performance, memory, and **execution time** against limits.
- [ ] **Decision Point:** Based on Vercel testing, determine if Phase 2 (Vercel Queues) is necessary.

### 3. Refactor `ScraperExecutionService` (Direct Execution)
- [x] Fully remove the `fetch` call to `/api/execute_scraper`.
- [x] Solidify Crawlee instantiation and `crawler.run()` integration in service methods **(POC uses direct import)**.
- [x] Implement robust data handling (retrieve from Dataset).
- [x] Adapt and integrate `processBatch` logic for Crawlee data (including batch inserts).
- [x] Implement progress reporting callback mechanism between scraper and service.
- [ ] Update progress tracking (initial approach: in-memory cache + DB). # Still needs refinement for scaling & UI display
- [x] Implement consistent logging within the service.
- [ ] **Refactor Crawlee Execution:** Modify `runScraperInternal` to dynamically execute the `typescript_script` content from the database for `crawlee` type scrapers, instead of using the hardcoded import. This is needed for UI editing to work.

### 4. Incremental Migration
- [ ] Rewrite remaining Python scrapers as Crawlee/TypeScript scrapers.
    - [ ] Scraper 1: ...
    - [ ] Scraper 2: ...
    - [ ] (Add more as needed)
- [ ] Store new scrapers appropriately (`src/lib/scrapers/` - **Note:** Decide if final code lives here or only in DB).
- [ ] Update `scraper_type` or add a new field in the `scrapers` table.
- [ ] Ensure `ScraperExecutionService` loads/runs scrapers dynamically **(Requires the refactor mentioned in Phase 3)**.
- [ ] **Implementation Considerations (Apply during rewrite):**
    - [ ] Implement Incremental Scraping logic where feasible.
    - [ ] Implement Caching strategies (e.g., request queue persistence - *Note: MemoryStorage used for POC, review if persistence needed later*).
    - [ ] Refine Proxy Strategy per site.
    - [ ] Ensure robust Monitoring & Debugging logs in each scraper.
    - [x] Implement "Test Run" feature (e.g., `maxRequestsPerCrawl`) for Crawlee scrapers.

## Key Files Involved (POC Stage)

This section lists the main files modified or created for the Crawlee POC.

-   **Scraper Implementation:**
    -   `pricetracker/src/lib/scrapers/norrmalmsel-crawler.ts`: The actual Crawlee scraper logic for the NorrmalmsEl site. Includes parsing, progress callback hooks, and memory storage configuration.
-   **Execution Orchestration:**
    -   `pricetracker/src/lib/services/scraper-execution-service.ts`: Contains the core logic for initiating scraper runs (`runScraper`), handling the asynchronous execution (`runScraperInternal`), processing results (`processBatch`), managing progress updates (`handleProgressUpdate`, `progressCache`), and updating the database.
-   **API Endpoints:**
    -   `pricetracker/src/app/api/scrapers/[scraperId]/run/route.ts`: API route triggered by the UI to start a scraper run. Calls `ScraperExecutionService.runScraper`.
    -   `pricetracker/src/app/api/scrapers/[scraperId]/run/[runId]/status/route.ts`: API route polled by the UI to get the current status and progress of a run. Reads from `ScraperExecutionService.progressCache`.
    -   `pricetracker/src/app/api/scrapers/python/validate/route.ts`: (Modified) Adapted to handle validation/preview for `crawlee` type scrapers alongside Python ones.
-   **Types:**
    -   `pricetracker/src/lib/services/scraper-types.ts`: Defines shared types like `ScrapedProductData`, `ScraperConfig`, etc.
-   **UI (Example):**
    -   `pricetracker/src/app/app-routes/scrapers/[scraperId]/run/page.tsx`: Frontend page component responsible for triggering the run and displaying progress by polling the status endpoint.

## Phase 2: Implement Vercel Queues (Conditional - Only if Phase 1 testing shows necessity)

- [ ] **Trigger:** Confirm decision based on Phase 1 POC results.
- [ ] Install Vercel Queue SDK: `npm install @vercel/kv @vercel/queue`
- [ ] Configure Vercel KV (if chosen for progress tracking).
- [ ] Define Queue instance (`lib/queues/scraper-queue.ts`).
- [ ] Create Queue Handler API route (`src/app/api/queues/scraper-handler/route.ts`).
- [ ] Move Crawlee execution logic into the Queue Handler.
- [ ] Modify trigger API route (`/api/scrapers/[scraperId]/run`) to enqueue jobs.
- [ ] Refactor progress tracking (remove in-memory cache, use KV or DB).
- [ ] Update status API endpoint to read from new progress source.
- [ ] Update UI components to fetch/display status correctly.
- [ ] Test queue system thoroughly.

## Cleanup (After successful migration - Phase 1 or Phase 2)

- [ ] Delete `pricetracker/api/execute_scraper.py`.
- [ ] Remove Python runtime configurations from `vercel.json`.
- [ ] Remove Python from `requirements.txt`.
- [ ] Remove old Python script files/backups.
- [ ] Clear `python_script` and `typescript_script` columns in `scrapers` table for migrated scrapers (if executing from files).

## Documentation & Final Tasks

- [ ] Update `README.md` with final architecture.
- [ ] Update any other relevant internal documentation.
- [ ] Mark this task list as complete in `TASK.md` (or link to it).
- [x] Add any newly discovered tasks to `TASK.md` under "Discovered During Work". (UI improvements documented in `docs/future/ui-run-scraper-improvements.md`)
- [x] Document Crawlee storage debugging steps (`docs/crawlee-storage-debug-log.md`).
- [x] Add "Key Files Involved" section to this document.