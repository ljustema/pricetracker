# Plan: Migrating Scraper Execution to Vercel Queues

**Goal:** Improve the scalability and reliability of the web scraping functionality by migrating scraper execution from direct `child_process.spawn` within API routes to Vercel Queues.

**Current Architecture:**
- API routes (e.g., `/api/scrapers/[scraperId]/run`) trigger scraper execution.
- `ScraperExecutionService` uses `child_process.spawn` to run Python scripts directly within the Vercel serverless function environment.
- Progress is tracked in-memory (`ScraperExecutionService.progressCache`) and updated in the `scraper_runs` database table.

**Proposed Architecture with Vercel Queues:**
```mermaid
graph TD
    subgraph Vercel Environment
        A[User Browser] --> B(Next.js Frontend)
        B --> C{API Route (/api/scrapers/.../run)}
        C -- Enqueue Job --> D[Vercel Queue]
        D -- Delivers Job --> E(Queue Handler - Vercel Function)
        E -- Executes --> F[Python Scraper (child_process)]
        F -- Scraped Data --> E
        E -- Update Status/Data --> G[Supabase DB]
        E -- Update Progress (Optional) --> H[Progress Cache/Store]
        C -.-> G # Initial Run Record Creation
        B --> I{API Route (/api/scrapers/.../status)}
        I --> G # Fetch Status from DB
        I --> H # Fetch Progress from Cache
    end

    subgraph External
        G
        H
    end
```

**Key Changes:**

1.  **Enqueueing Jobs:** The API route (`/api/scrapers/[scraperId]/run`) will no longer directly spawn the Python process. Instead, it will:
    *   Create the initial `scraper_runs` record in Supabase with status 'queued'.
    *   Enqueue a job onto a Vercel Queue, passing necessary information like `scraperId` and `runId`.
2.  **Queue Handler:** A new Vercel Function will be created to handle jobs from the queue. This function will:
    *   Receive the job payload (`scraperId`, `runId`).
    *   Update the `scraper_runs` status to 'running'.
    *   Fetch the scraper configuration (Python script, etc.).
    *   Execute the Python script using `child_process.spawn` (similar to the current `runScraperInternal` logic, but running within the dedicated Queue handler environment).
    *   Process the output (stdout for data batches, stderr for progress).
    *   Update the `scraper_runs` table with results (success/failure, product count, error messages, completion time).
    *   Optionally, update a progress tracking mechanism (see below).
3.  **Progress Tracking:** The current in-memory `progressCache` in `ScraperExecutionService` will not work reliably across different serverless function invocations (API routes vs. Queue handlers). Options:
    *   **Database Updates:** Update the `scraper_runs` table more frequently with progress details (e.g., current batch, messages). This is simpler but might increase database load.
    *   **External Cache:** Use an external cache like Vercel KV or Redis to store real-time progress accessible by both the status API and the queue handler. This is more scalable for real-time updates.
    *   **Simplified Status:** Rely solely on the `scraper_runs` table status ('queued', 'running', 'success', 'failed') and final results, removing fine-grained batch progress from the UI during the run.
4.  **Status Endpoint:** The API route for checking run status (`/api/scrapers/[scraperId]/run/[runId]/status`) will primarily fetch the status and results from the `scraper_runs` table in Supabase and potentially the external progress cache if implemented.

**Implementation Steps:**

1.  **Install Vercel Queue SDK:**
    ```bash
    npm install @vercel/kv @vercel/queue
    ```
2.  **Configure Vercel KV (if using for progress):** Set up Vercel KV store via the Vercel dashboard and add necessary environment variables.
3.  **Define Queue:** Create a queue instance using `@vercel/queue`.
    ```typescript
    // e.g., in lib/queues/scraper-queue.ts
    import { Queue } from '@vercel/queue';

    export interface ScraperJobPayload {
      scraperId: string;
      runId: string;
    }

    export const scraperQueue = Queue<ScraperJobPayload>('scraper-execution-queue');
    ```
4.  **Create Queue Handler Function:**
    *   Create a new API route (e.g., `src/app/api/queues/scraper-handler/route.ts`).
    *   Import the `scraperQueue` and define the handler function using `scraperQueue.handler(...)`.
    *   Move the core Python execution logic (from `runScraperInternal`) into this handler.
    *   Adapt logic to update Supabase and potentially Vercel KV for progress.
    *   Ensure robust error handling.
5.  **Modify Trigger API Route:**
    *   Update the `/api/scrapers/[scraperId]/run/route.ts` POST handler.
    *   Remove the call to `ScraperExecutionService.runScraper`.
    *   Add logic to create the initial `scraper_runs` record.
    *   Enqueue the job using `await scraperQueue.enqueue({ scraperId, runId });`.
6.  **Refactor Progress Tracking:**
    *   Remove the in-memory `progressCache` from `ScraperExecutionService`.
    *   Decide on the new progress tracking strategy (Database, KV, or simplified).
    *   Update the Queue Handler to write progress/status updates accordingly.
    *   Update the status API endpoint (`/api/scrapers/[scraperId]/run/[runId]/status/route.ts`) to read status/progress from the chosen source (Supabase DB / Vercel KV).
7.  **Update UI:** Modify frontend components (e.g., `ScraperRunProgress`, `ScraperManager`) to fetch status from the updated API endpoint and display information appropriately based on the chosen progress tracking detail level.
8.  **Testing:** Thoroughly test the enqueueing, execution, status updates, and error handling. Test with different scraper types and potential failure scenarios.
9.  **Deployment:** Deploy to Vercel. Ensure Queue and KV (if used) are correctly configured in the Vercel project settings.

**Benefits:**

*   **Improved Scalability:** Decouples scraper execution from web requests, leveraging Vercel's dedicated infrastructure for background jobs.
*   **Increased Reliability:** Less prone to timeouts or resource exhaustion affecting the main application. Vercel Queues offer retry mechanisms.
*   **Better Resource Management:** Prevents long-running scrapes from consuming resources needed for handling user requests.

**Considerations:**

*   **Cost:** Vercel Queues and KV have associated costs based on usage.
*   **Complexity:** Introduces asynchronous processing and potentially an external cache, adding some complexity compared to the direct execution model.
*   **Cold Starts:** Queue handler functions might experience cold starts, potentially adding latency to the beginning of a scrape job.
*   **Progress Visibility:** Real-time, fine-grained progress tracking requires careful implementation (e.g., using Vercel KV).

This plan provides a roadmap for enhancing the application's scraping capabilities for better scalability.