# Future UI Improvements for Scraper Run Progress

This document outlines potential improvements for the scraper run progress UI to provide more detailed and accurate feedback to the user.

## Current Implementation Files

The current progress reporting involves these main files:

-   **Scraper (`pricetracker/src/lib/scrapers/norrmalmsel-crawler.ts`):**
    -   Counts processed products.
    -   Invokes an `onProgress` callback periodically (e.g., every 100 products).
-   **Execution Service (`pricetracker/src/lib/services/scraper-execution-service.ts`):**
    -   Defines the `onProgress` callback (`handleProgressUpdate`).
    -   Updates an in-memory cache (`progressCache`) with status, counts, batch numbers, timestamps, and summary messages.
    -   Updates the `scraper_runs` database table with similar progress information asynchronously.
-   **Status API Route (`pricetracker/src/app/api/scrapers/[scraperId]/run/[runId]/status/route.ts`):**
    -   Reads progress data primarily from the `progressCache`.
    -   (Potentially falls back to DB if cache entry is missing, though not explicitly shown in current code).
-   **Frontend Component (e.g., inside `pricetracker/src/app/app-routes/scrapers/[scraperId]/run/page.tsx` or similar):**
    -   Polls the status API route.
    -   Displays the progress bar, product count, batch count, and messages based on the API response.

## Proposed Improvements

1.  **Terminal-like Log Output:**
    *   **Goal:** Display a stream of key log messages or batch summaries directly in the UI, similar to a terminal window.
    *   **Implementation Idea:**
        *   Modify the `ProgressData` interface in `scraper-execution-service.ts` to store a *list* of recent summary messages (e.g., `progressSummaries: string[]`) instead of just the latest one in `progressMessages`.
        *   The `handleProgressUpdate` callback would push new summaries into this list (potentially capping the list size).
        *   The status API endpoint would return this list.
        *   The frontend component would render these messages, perhaps in a scrollable text area.

2.  **More Accurate Progress Bar:**
    *   **Goal:** Base the progress bar percentage on a more accurate estimate of the total work required.
    *   **Challenge:** The total number of products isn't known until the end. Different scrapers discover product URLs differently (sitemaps, category scraping, brand pages, APIs).
    *   **Implementation Ideas:**
        *   **Two-Phase Approach:**
            *   **Phase 1 (Link Discovery):** The scraper first focuses on collecting all unique product URLs (from sitemaps, categories, etc.). During this phase, the UI could show "Discovering product links... Found X URLs".
            *   **Phase 2 (Product Scraping):** Once discovery is complete, the scraper reports the *total number of unique product URLs* found. This count can be used to set the `totalBatches` accurately (total URLs / batch size). The progress bar then reflects `currentBatch / totalBatches` as products are processed.
        *   **Refactor Scraper:** Modify individual scrapers (`norrmalmsel-crawler.ts` and future ones) to implement this two-phase logic if feasible for the target site structure. The `runNorrmalmselScraper` function signature might need adjustment to report the total count after discovery.
        *   **Update Service/UI:** The execution service and UI would need to handle this two-phase state (e.g., "Discovering", "Scraping") and use the reported total URL count for the progress bar calculation in the second phase.

3.  **Display Key Stats:**
    *   **Goal:** Show important metrics like elapsed time and products/second clearly in the UI summary area.
    *   **Implementation:** Ensure the status API returns `executionTime` and `productsPerSecond` from the `ProgressData`, and the frontend component displays them. (This seems partially implemented but could be made more prominent).

These improvements would require coordinated changes across the scraper logic, execution service, status API, and frontend components.