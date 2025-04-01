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
    *   `products_scraped_count` (Integer)
    *   `error_message` (Text, nullable)
2.  The scraper execution process (whether an API route, background job, or serverless function) can be modified to record detailed run information.
3.  "Products per second" is calculated as `products_scraped_count / (execution_time_in_seconds)`.

**Plan:**

**1. Database Modifications:**

*   **Verify/Update `scraper_runs` Table:**
    *   Ensure the table exists and contains columns like `started_at`, `ended_at`, `status`, `products_scraped_count`, and `error_message`.
    *   **Add Calculated Fields (Recommended):** Add the following columns to `scraper_runs` to simplify queries and improve performance:
        *   `execution_time_ms` (BIGINT): To store the duration of the run in milliseconds.
        *   `products_per_second` (DECIMAL or FLOAT): To store the calculated metric for the run.
*   **Update `scrapers` Table (Optional):**
    *   Consider adding a `last_products_per_second` (DECIMAL or FLOAT) column to the `scrapers` table to easily display the latest performance metric on the main scraper list without complex joins for every page load.

**2. Backend Changes:**

*   **Enhance Scraper Execution Logic:**
    *   Modify the code that executes scrapers (e.g., in the `/api/scrapers/run` endpoint or background worker).
    *   Before starting a run: Record `started_at` and set `status` to 'running' in a new `scraper_runs` record.
    *   After a run completes (successfully or with failure):
        *   Record `ended_at`.
        *   Determine `status` ('success' or 'failed').
        *   Record `products_scraped_count` (count of products inserted during the run).
        *   Calculate `execution_time_ms` (`ended_at` - `started_at`).
        *   Calculate `products_per_second` (handle division by zero if execution time is very short or zero).
        *   Record `error_message` if the run failed.
        *   Update the corresponding `scraper_runs` record with these details.
        *   Update the main `scrapers` table: set `last_run`, `status`, `error_message`, `execution_time` (for the last run), and optionally `last_products_per_second`.
*   **Create New API Endpoint for Run History:**
    *   Implement `GET /api/scrapers/{scraperId}/runs`.
    *   This endpoint should fetch records from `scraper_runs` for the given `scraperId`, ordered by `started_at` descending.
    *   It should return an array of run objects containing: `id`, `started_at`, `status`, `execution_time_ms`, `products_scraped_count`, `products_per_second`, `error_message`.
    *   Implement proper authorization to ensure users can only access their own scraper history.
    *   Consider adding pagination parameters (e.g., `?page=1&limit=20`).
*   **Update Existing Scraper API Endpoints:**
    *   Modify `GET /api/scrapers` and `GET /api/scrapers/{scraperId}`.
    *   If the `last_products_per_second` column was added to `scrapers`, include this field in the response. Otherwise, you might need to perform a subquery or join to get the latest run's `products_per_second` value (which could impact performance if fetching many scrapers).

**3. Frontend Changes (React/Next.js):**

*   **Scraper List/Table Component (`ScrapersPage` or similar):**
    *   Fetch scraper data including the `last_products_per_second` (or calculate it from the latest run if not directly available).
    *   Add a column or display area in the table/list to show "Products/sec". Display "N/A" or "-" if no runs have completed yet. Format the number appropriately (e.g., 2 decimal places).
    *   Add a "History" button (e.g., an icon button) to each scraper row.
*   **Scraper Run History Component (e.g., `ScraperRunHistoryModal` or new page):**
    *   Create a new component to display the run history. A modal might be suitable for quick viewing.
    *   When the "History" button is clicked:
        *   Trigger fetching data from the new `/api/scrapers/{scraperId}/runs` endpoint for the selected scraper.
        *   Display a loading state while fetching.
        *   Show an error message if the fetch fails.
        *   Render the fetched runs in a table or list:
            *   **Run Started:** Format `started_at` timestamp.
            *   **Status:** Display `status` (e.g., with colored badges: green for success, red for failed).
            *   **Duration:** Format `execution_time_ms` into seconds or minutes/seconds.
            *   **Products Found:** Display `products_scraped_count`.
            *   **Products/sec:** Display `products_per_second` (formatted).
            *   **Error:** Show `error_message` if the status is 'failed'.
        *   Implement pagination controls if pagination was added to the API.

**Mermaid Diagram (Data Flow):**

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend API
    participant Scraper Executor
    participant Database

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
    Scraper Executor->>Database: UPDATE scraper_runs SET ended_at, status, products_scraped_count, execution_time_ms, products_per_second WHERE id = run_id
    Scraper Executor->>Database: UPDATE scrapers SET last_run, status, execution_time WHERE id = scraper_id