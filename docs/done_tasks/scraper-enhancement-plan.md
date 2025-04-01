# Plan: Scraper Performance Metrics and Run History

**Goal:** Enhance the scraper interface by displaying performance metrics (Products/sec) and providing a detailed history of past scraper runs.

**Assumptions:**

1.  A `scraper_runs` table exists with at least the following relevant columns:
    *   `id` (PK)
    *   `scraper_id` (FK to `scrapers`)
    *   `user_id` (FK to `auth.users`)
    *   `started_at` (Timestamp)
    *   `ended_at` (Timestamp)
    *   `status` (Text: e.g., 'success', 'failed', 'running')
    *   `product_count` (Integer, existing)
    *   `error_message` (Text, nullable)
2.  The scraper execution process (whether an API route, background job, or serverless function) can be modified to record detailed run information.
3.  "Products per second" is calculated as `products_scraped_count / (execution_time_in_seconds)`.

**Plan:**

**1. Database Modifications:**

*   **Verify/Update `scraper_runs` Table:**
    *   Verify the table exists and contains `started_at`, `completed_at`, `status`, `product_count`, and `error_message`.
    *   **Add Calculated Fields:** Add the following columns to `scraper_runs`:
        *   `execution_time_ms` (BIGINT): To store the duration (`completed_at` - `started_at`) in milliseconds.
        *   `products_per_second` (DECIMAL(10, 2)): To store the calculated metric (`product_count` / execution time in seconds).
*   **Update `scrapers` Table (Optional):**
    *   Add a `last_products_per_second` (DECIMAL(10, 2)) column to the `scrapers` table to easily display the latest performance metric on the main scraper list.

**2. Backend Changes:**

*   **Enhance Scraper Execution Logic:**
    *   Modify the `runScraperInternal` method within `ScraperExecutionService`.
    *   Before starting a run: Record `started_at` and set `status` to 'running' in a new `scraper_runs` record.
    *   After a run completes (successfully or with failure):
        *   Record `ended_at`.
        *   Determine `status` ('success' or 'failed').
        *   Use the existing `product_count`.
        *   Calculate `execution_time_ms` (`completed_at` - `started_at`).
        *   Calculate `products_per_second` (handle division by zero if execution time is very short or zero).
        *   Record `error_message` if the run failed.
        *   Update the corresponding `scraper_runs` record with these details.
        *   Update the main `scrapers` table: set `last_run`, `status`, `error_message`, `execution_time`, and `last_products_per_second` (on success).
*   **Create New API Endpoint for Run History:**
    *   Implement `GET /api/scrapers/{scraperId}/runs`.
    *   This endpoint should fetch records from `scraper_runs` for the given `scraperId`, ordered by `started_at` descending.
    *   It should return an array of run objects containing: `id`, `started_at`, `completed_at`, `status`, `execution_time_ms`, `product_count`, `products_per_second`, `error_message`.
    *   Implement proper authorization to ensure users can only access their own scraper history.
    *   Add a limit (e.g., 50 runs). Pagination can be added later if needed.
*   **Create API Route for Scraper List:**
    *   Implement `GET /api/scrapers/list` to fetch scrapers and their associated competitor data server-side, avoiding server-only imports in the client component.
    *   This route returns an array of scraper objects, each including the `last_products_per_second` and nested `competitor` details.

**3. Frontend Changes (React/Next.js):**

*   **Scraper List/Table Component (`src/app/(app)/scrapers/page.tsx`):**
    *   Convert to a Client Component (`"use client";`).
    *   Fetch combined scraper and competitor data from `/api/scrapers/list` using `useEffect` and `fetch`.
    *   Add a "Products / sec" column header (split onto two lines).
    *   Display `last_products_per_second` (formatted to 2 decimal places, or "N/A").
    *   Add a "History" button using Shadcn `Button`.
    *   Add state management (`useState`) to control the history modal's visibility and selected scraper ID.
    *   Style action buttons using Shadcn `Button` with smaller padding (`px-1.5 py-0.5`, `text-xs`) to conserve space.
    *   Split "Run Test" button text onto two lines.
    *   Wrap the `<table>` in `<div className="overflow-x-auto">` to handle potential overflow.
    *   Fix hydration errors by ensuring no whitespace between `<tbody>` and the map function.
*   **Scraper Run History Component (`src/components/scrapers/scraper-run-history-modal.tsx`):**
*   **Scraper Run History Component (e.g., `ScraperRunHistoryModal` or new page):**
    *   Create a new Client Component using Shadcn `Dialog`, `Table`, `Badge`, `Button`.
    *   When the "History" button is clicked:
        *   Trigger fetching data from the new `/api/scrapers/{scraperId}/runs` endpoint for the selected scraper.
        *   Display a loading state while fetching.
        *   Show an error message if the fetch fails.
        *   Render the fetched runs in a table or list:
            *   **Run Started:** Format `started_at` timestamp.
            *   **Status:** Display `status` (e.g., with colored badges: green for success, red for failed).
            *   **Duration:** Format `execution_time_ms` into seconds or minutes/seconds.
            *   **Products Found:** Display `product_count`.
            *   **Products/sec:** Display `products_per_second` (formatted).
            *   **Error:** Show `error_message` if the status is 'failed'.
        *   Use `date-fns` for relative time formatting.

**Mermaid Diagram (Data Flow):**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend API
    participant Scraper Executor
    participant Database

    User->>Frontend: Clicks "History" on Scraper X
    User->>Frontend: Navigates to /scrapers page
    Frontend->>Backend API: GET /api/scrapers/list (fetches scrapers + competitors)
    Backend API-->>Frontend: Sends scraper list data
    Frontend->>User: Renders scraper table

    User->>Frontend: Clicks "History" on Scraper X
    Frontend->>Backend API: GET /api/scrapers/X/runs
    Backend API->>Database: SELECT * FROM scraper_runs WHERE scraper_id = X ORDER BY started_at DESC
    Database-->>Backend API: Returns list of runs
    Backend API-->>Frontend: Sends run history data (JSON)
    Frontend->>User: Displays History Modal/Page with run details

    Note over Scraper Executor, Database: Scraper Execution Flow
    Scraper Executor->>Database: INSERT INTO scraper_runs (scraper_id, started_at, status='running')
    Scraper Executor->>Scraper Executor: Executes scraping logic...
    Scraper Executor->>Database: Records scraped products (INSERT INTO scraped_products)
    Scraper Executor->>Database: UPDATE scraper_runs SET completed_at, status, product_count, execution_time_ms, products_per_second WHERE id = run_id
    Scraper Executor->>Database: UPDATE scrapers SET last_run, status, execution_time, last_products_per_second WHERE id = scraper_id