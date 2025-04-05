# Plan: Migrating Python Scrapers to Crawlee (JavaScript/TypeScript)

## 1. Introduction

**Problem:** The current architecture uses Python scripts for web scraping, executed via a Vercel serverless function (`api/execute_scraper.py`) invoked by the Next.js backend (`ScraperExecutionService`). This setup has proven difficult to deploy and maintain reliably on Vercel due to challenges with Python environment setup, dependency installation within the serverless function, execution timeouts, and resource limitations.

**Proposed Solution:** Migrate all Python-based web scrapers to use Crawlee, a JavaScript/TypeScript web scraping library. This aims to:
*   Unify the tech stack to JavaScript/TypeScript, simplifying development and deployment on Vercel.
*   Leverage Crawlee's features for robust scraping (anti-blocking, proxy management, browser automation).
*   Eliminate the complexities of running Python within the Vercel Node.js runtime.

## 2. Current System Analysis

*   **Execution Flow:**
    1.  `ScraperExecutionService` (TypeScript) receives a request to run a scraper.
    2.  It fetches the scraper's Python code and required libraries from the database.
    3.  It calls the `/api/execute_scraper` Vercel serverless function (Python).
    4.  The Python function installs dependencies using `pip` in a temporary environment.
    5.  It executes the provided Python scraper script using `subprocess.Popen`.
    6.  The Python script *should* ideally stream JSON batches of `ScrapedProductData` to stdout.
    7.  The Python function captures stdout/stderr, counts products reported by the script, and returns a status (success/failure) and the `product_count` to the `ScraperExecutionService`.
    8.  `ScraperExecutionService` updates the database run record with the status and count.
*   **Limitations:**
    *   **Deployment Complexity:** Managing Python dependencies and execution within Vercel's Node.js environment is fragile.
    *   **Vercel Constraints:** Serverless function timeouts (standard plans: 10s-60s) and resource limits (memory, CPU) can easily be exceeded by dependency installs or long-running scrapes. The current 4-hour script timeout and 5-minute pip timeout in `execute_scraper.py` are unlikely to be fully respected by Vercel itself.
    *   **Data Handling:** The current `ScraperExecutionService` **does not process the actual scraped product data** returned by the Python script. It only records the `product_count` reported back by the Python endpoint. The `processBatch` function exists but isn't used in this flow.
    *   **Error Proneness:** Dependency conflicts, timeouts, and resource exhaustion lead to unreliable execution.

## 3. Crawlee Overview

Crawlee is a modern web scraping and browser automation library for JavaScript/TypeScript (and Python). Key features relevant to this migration include:
*   **Unified API:** Provides consistent APIs for different crawling strategies (HTTP requests with Cheerio, headless browsers with Playwright/Puppeteer).
*   **Anti-Blocking:** Built-in fingerprinting, header generation, and proxy management features to avoid being blocked.
*   **Browser Automation:** Integrates seamlessly with Playwright and Puppeteer for JavaScript-heavy sites.
*   **Resource Management:** Includes auto-scaling capabilities to adapt concurrency based on system resources (though Vercel's environment is the primary constraint here).
*   **Storage & Queuing:** Built-in mechanisms for managing request queues and storing results (Datasets).
*   **TypeScript Support:** First-class TypeScript support aligns with the existing Next.js project.

## 4. Proposed Architecture

*   **Scraper Implementation:** Python scrapers will be rewritten as TypeScript classes/functions using Crawlee. They will likely utilize `PlaywrightCrawler` or `CheerioCrawler` depending on site complexity.
*   **Service Integration:** `ScraperExecutionService` will be refactored:
    *   Remove the `fetch` call to `/api/execute_scraper`.
    *   Instantiate and run Crawlee crawlers directly within `runScraperInternal` and `runScraperTestInternal` methods.
    *   Scraper logic (within the Crawlee `requestHandler`) will use `pushData()` to collect `ScrapedProductData`.
    *   After `crawler.run()` completes, the service will retrieve the results using `crawler.getData()` or `crawler.getDataset()`.
    *   The existing `processBatch` logic (or a refined version) will be invoked with the data retrieved from the Crawlee dataset to perform product matching and database insertion.
*   **Execution Model (Phased Approach):**
    *   **Phase 1: Direct Execution (Default):** Run Crawlee directly within the existing async methods of `ScraperExecutionService` (e.g., triggered by API routes). This is the simplest integration path and will be implemented first. The POC testing on Vercel is critical to determine if this approach meets performance and execution time requirements.
    *   **Phase 2: Vercel Queues (Conditional):** If Phase 1 testing reveals significant issues with Vercel function timeouts or resource limits for common scraping tasks, implement Vercel Queues. This involves:
        *   An API route to enqueue scraper jobs.
        *   A dedicated Vercel Function (Queue Handler) to dequeue jobs and execute the Crawlee scraper.
        *   Refactoring progress tracking (e.g., using Vercel KV or more frequent DB updates instead of the in-memory cache).
*   **Data Flow Diagram:**

    ```mermaid
    sequenceDiagram
        participant Client as Next.js Frontend
        participant Service as ScraperExecutionService (TS)
        participant Crawler as Crawlee Instance (TS)
        participant DB as Supabase

        Client->>Service: Start Scraper Run (scraperId)
        Service->>DB: Create/Update Run Record (initializing)
        Service->>Service: Instantiate Crawlee Crawler (with scraper config)
        Service->>Crawler: crawler.run()
        activate Crawler
        Crawler->>Target Website: Fetch page
        Crawler->>Crawler: Process page (requestHandler)
        Crawler->>Crawler: pushData(productData)
        Crawler->>Crawler: enqueueLinks()
        Crawler-->>Service: Run completes
        deactivate Crawler
        Service->>Crawler: Get Dataset (results)
        Service->>Service: Process Scraped Data (map, match using processBatch logic)
        Service->>DB: Insert/Update Scraped Products
        Service->>DB: Update Run Record (success/failed, stats)
        Service-->>Client: Return Run ID (or status update via polling)

    ```

## 5. Migration Steps

1.  **Setup & Dependencies:**
    *   Install Crawlee and necessary browser drivers/types: `npm install crawlee playwright @types/node` (or `puppeteer`).
    *   Configure `tsconfig.json` if needed for Crawlee types or features.
2.  **Phase 1 - Proof of Concept (POC - Direct Execution):**
    *   Select a representative existing Python scraper (consider one simple, one potentially complex/long-running if possible).
    *   Rewrite it in TypeScript using Crawlee (e.g., `pricetracker/src/lib/scrapers/example-crawler.ts`). Use `CheerioCrawler` or `PlaywrightCrawler` as appropriate.
    *   Modify `ScraperExecutionService` methods (`runScraperTestInternal`, `runScraperInternal`) to instantiate and run this new TS crawler directly (Phase 1 approach).
    *   Implement basic data retrieval using `crawler.getData()` or `crawler.getDataset()` after the run and log the results.
    *   Test thoroughly locally.
    *   **Crucially:** Deploy to Vercel preview/staging and test execution under realistic conditions. Monitor logs closely for performance, memory usage, and **execution time** against Vercel's function limits (e.g., 10s-60s depending on plan). This testing determines if Phase 2 (Vercel Queues) is necessary.
    *   **POC Implementation Notes:**
        *   *Storage:* Explicitly configured `MemoryStorage({ persistStorage: false })` for `RequestQueue` and `Dataset` in the scraper (`norrmalmsel-crawler.ts`) to resolve local filesystem permission errors (`EPERM`/`ENOENT`). This prevents disk writes but means state is not persisted across process restarts.
        *   *Monitoring:* Ensure basic but effective logging within the POC scraper and service.
        *   *Proxies:* Test with Crawlee's basic proxy configuration if applicable to the target site.
3.  **Phase 1 - Refactor `ScraperExecutionService` (Direct Execution):**
    *   Based on POC success, fully remove the call to the Python endpoint `/api/execute_scraper`.
    *   Solidify the integration of Crawlee instantiation and `crawler.run()` into `runScraperInternal` and `runScraperTestInternal` for direct execution.
    *   Implement robust data handling: Retrieve data from the Crawlee `Dataset` after the run.
    *   Adapt and integrate the `processBatch` logic to process the retrieved Crawlee data, ensuring product matching and database insertion work correctly.
    *   Update progress tracking (initially using the existing `ProgressData` cache and database `scraper_runs` table) based on Crawlee run completion status and retrieved data.
    *   **Adapt Validation:** Modify the scraper validation logic (likely in `/api/scrapers/python/validate/route.ts`) to recognize Crawlee scrapers, skip Python-specific checks, and implement a limited execution preview for Crawlee scrapers.
4.  **Phase 1 - Incremental Migration:**
    *   Rewrite the remaining Python scrapers as Crawlee/TypeScript scrapers one by one.
    *   Store the new TypeScript scraper logic appropriately (e.g., in `src/lib/scrapers/`).
    *   Update the `scraper_type` (or add a new field) in the `scrapers` table to indicate they are now Crawlee-based.
    *   Ensure the `ScraperExecutionService` dynamically loads and runs the correct scraper based on its type/configuration.
    *   **Metadata/URL Handling:** Note that the current creation/validation flow uses placeholder metadata for Crawlee scrapers. The `target_url` saved to the database might be empty initially. Decide later whether to add a URL input field back to the form or implement dynamic metadata extraction from TS code.
    *   **Implementation Considerations:**
        *   *Incremental Scraping:* Design scrapers to be efficient, ideally scraping only new/updated data where possible (e.g., checking last modified dates, comparing against previously scraped data).
        *   *Caching:* Explore Crawlee's request queue persistence to avoid re-processing URLs within a run. Consider simple content caching strategies if beneficial.
        *   *Proxy Strategy:* Refine proxy usage (e.g., session pools via `ProxyConfiguration`) as needed for different sites.
        *   *Monitoring & Debugging:* Implement consistent logging (`log.info`, `log.debug`, `log.error`) within all scrapers and the service for easier troubleshooting.
5.  **Phase 2 - Implement Vercel Queues (Conditional):**
    *   **Trigger:** If POC testing (Step 2) indicates Vercel limits are frequently hit, proceed with this phase.
    *   **Implementation:** Follow the steps outlined in `docs/future/vercel-queues-migration.md`, adapting them to execute Crawlee scrapers within the Queue Handler instead of Python scripts. This includes:
        *   Setting up `@vercel/queue`.
        *   Creating the Queue Handler API route.
        *   Moving Crawlee execution logic to the handler.
        *   Modifying the trigger API route to enqueue jobs.
        *   Refactoring progress tracking (e.g., using Vercel KV or DB updates instead of the in-memory cache).
6.  **Cleanup:**
    *   Delete the `pricetracker/api/execute_scraper.py` file and its associated API route.
    *   Remove Python runtime configurations from `vercel.json` if any exist.
    *   Remove Python from `requirements.txt` if it's no longer needed for any other purpose.
    *   Remove old Python script files and backups (`scraper-backup/`) once migration is verified.
7.  **Documentation & Tasks:**
    *   Update `README.md` to reflect the final scraping architecture (Phase 1 or Phase 2).
    *   Update any internal documentation related to scraper development or execution.
    *   Mark relevant tasks as completed in `TASK.md` and add any new sub-tasks discovered.

## 6. Risks & Considerations

*   **Rewrite Effort:** Porting Python logic (especially complex parsing or browser interactions) to Crawlee/TypeScript will take time.
*   **Vercel Execution Limits:** This is the primary risk. Standard Vercel function timeouts (10s-60s) might be insufficient for many scraping tasks, especially those requiring browser rendering. The POC step is critical to assess feasibility. Upgrading the Vercel plan might be necessary for longer timeouts.
*   **Resource Consumption:** Headless browsers (Playwright) are memory and CPU intensive. Monitor resource usage on Vercel.
*   **Learning Curve:** The team needs to become familiar with Crawlee's API and best practices.
*   **Anti-Scraping Measures:** While Crawlee helps, complex websites may still require advanced techniques (proxy providers like Bright Data, residential IPs, CAPTCHA solving integrations, careful request timing).
*   **Error Handling:** Implement comprehensive error handling within Crawlee's `requestHandler` and `failedRequestHandler`, as well as in the `ScraperExecutionService` orchestration logic.

## 7. Alternatives (Fallback if Phased Approach Fails)

If both the direct execution (Phase 1) and the Vercel Queues approach (Phase 2) prove insufficient on Vercel (e.g., due to fundamental resource constraints even with queues, or excessive costs):
1.  **Apify Platform:** Leverage Apify's platform to run Crawlee scrapers (Actors). The Next.js app would trigger Actor runs via the Apify API and fetch results. This offloads execution and infrastructure management.
2.  **Dedicated Scraping Infrastructure:** Deploy scrapers to a separate server (e.g., Docker container on AWS EC2, Google Cloud Run, DigitalOcean) and trigger them via an API from the Next.js app.
3.  **Third-Party Scraping APIs:** Use services like ScrapingBee, ZenRows, ScraperAPI, etc., which provide an API endpoint that handles the actual scraping execution and infrastructure.

## 8. Conclusion

Migrating from the current Python-on-Vercel execution model to a native Crawlee/TypeScript approach offers a promising path towards a more stable, maintainable, and deployable scraping system within the Vercel ecosystem. We will adopt a **phased approach**: first attempting direct execution within standard Vercel functions, and implementing Vercel Queues (Phase 2) only if necessitated by performance or timeout limitations discovered during testing. The POC phase is crucial for validating the direct execution approach and informing the decision on Phase 2.

## 9. Next Steps

1.  Review and approve this updated phased plan.
2.  Proceed with the Phase 1 "Setup & Dependencies" and "Proof of Concept (POC)" steps, focusing on direct execution.
3.  Evaluate POC results, particularly performance and execution time on Vercel, to determine if Phase 2 (Vercel Queues) is required.
4.  Based on POC findings, proceed with either Phase 1 full migration or initiate Phase 2 implementation before completing the migration. If both phases seem problematic on Vercel, consider the alternatives from Section 7.