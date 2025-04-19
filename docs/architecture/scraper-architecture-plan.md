# Simplifying Scraper Architecture Plan

**Goal:** Refactor the scraping architecture to simplify worker logic, improve robustness, and enhance maintainability by removing complex in-process sandboxing (`RestrictedPython`, `isolated-vm`) and executing scraper scripts as standardized command-line subprocesses.

## Rationale for Chosen Approach (Product-per-line stdout)

The primary goal of this refactor is to **simplify** the scraping architecture, addressing the complexity and reliability issues encountered with the previous sandboxed execution model. While alternative approaches were considered, the "product-per-line" standard for scraper script output was chosen for the following reasons:

*   **Maximum Scraper Simplicity:** This approach places the least burden on the individual scraper script. The script's core responsibility becomes finding product data and printing it as a single JSON line. This significantly lowers the barrier to writing, debugging, and maintaining scrapers, directly addressing the feedback that getting scrapers working was difficult.
*   **Worker Handles Batching:** Database insertion efficiency is still maintained, as the worker process will buffer the incoming product lines and perform batch inserts into the `scraped_products` table. This separates the scraping logic from the database interaction logic. (Note: The `record_price_change` trigger on `scraped_products` further simplifies the worker's task by handling product matching and price change recording automatically).
*   **Clear Progress Reporting:** The worker can provide granular progress updates to the user (e.g., "X products saved") based on the number of lines processed and saved. Scraper scripts can still report conceptual progress (e.g., "Processing page Y/Z") via stderr.
*   **Deferring Further Complexity (Batch-per-line & Crawlee):**
    *   **Batch-per-line:** While potentially faster for I/O-bound scrapers *if* the script implements internal parallelism, this adds complexity back into the scraper script itself (managing batches, potential concurrency). We prioritize simplification first; performance optimizations can be revisited later if needed.
    *   **Crawlee:** Integrating a large framework like Crawlee would significantly increase complexity, contradicting the primary goal. While powerful, it's best considered only if this simplified architecture proves insufficient for specific, advanced scraping challenges later on. Existing documentation suggests Crawlee might have been previously considered or attempted, potentially contributing to the complexity we aim to reduce now.

## Proposed Architecture

```mermaid
graph TD
    subgraph Frontend/API
        A[User triggers Scraper Run] --> B(Creates 'pending' job in scraper_runs table);
    end

    subgraph Worker Pool (Python/TypeScript/...)
        C{Worker Polls DB} -- Finds pending job --> D(Claims Job - Update status to 'running');
        D --> E{Fetches Scraper Script File/Content};
        E --> F[Executes Script as Subprocess via Standard CLI];
        F -- stdout (JSON results per product) --> G{Worker Parses Results};
        F -- stderr (Progress/Errors) --> H{Worker Parses Logs};
        G --> I(Saves Products to DB - Batched by Worker);
        H --> J(Updates Job Status/Logs in DB);
        I --> J;
        J -- Job completed/failed --> C;
        F -- Process exits/times out --> J;
    end

    subgraph Scraper Script (Executed as separate process)
        K[Script Starts] --> L(Parses CLI args --context);
        L --> M(Performs Scraping);
        M -- Prints one JSON object per product --> N((stdout));
        M -- Prints PROGRESS:/ERROR: messages --> O((stderr));
        M --> P[Script Exits];
    end

    style Frontend/API fill:#f9f,stroke:#333,stroke-width:2px
    style "Worker Pool (Python/TypeScript/...)" fill:#ccf,stroke:#333,stroke-width:2px
    style "Scraper Script (Executed as separate process)" fill:#cfc,stroke:#333,stroke-width:2px
```

## Detailed Plan

1.  **Define Standardized Scraper Command-Line Interface (CLI):**
    *   **`metadata` command:**
        *   Usage: `python <script_path> metadata` or `node <script_path> metadata`
        *   Output (stdout): A single JSON object containing scraper metadata (name, version, required libraries, etc.).
    *   **`scrape` command:**
        *   Usage: `python <script_path> scrape [--context='<json_string>']` or `node <script_path> scrape [--context='<json_string>']`
        *   `--context`: Optional argument passing runtime info (e.g., `user_id`, `competitor_id`, `is_test_run`, filter flags) as a JSON string.
        *   Output (stdout): **One JSON object per product, printed on a new line.**
            ```json
            {"name": "Product A", "price": 10.99, "sku": "SKU123", "brand": "BrandX"}
            {"name": "Product B", "price": 25.00, "ean": "1234567890123"}
            ```
        *   Output (stderr): Progress and error messages prefixed with `PROGRESS:` or `ERROR:`.
            ```
            PROGRESS: Starting scrape...
            ERROR: Failed to fetch URL...
            PROGRESS: Finished scraping. X products found.
            ```

2.  **Refactor Python Worker (`py-worker`):** ✅ **DONE**
    *   ✅ Remove `RestrictedPython` dependency and `execute_scraper_script`.
    *   ✅ Modify job claiming to fetch script content.
    *   ✅ Modify `process_job`:
        *   ✅ Save script content to a temporary file.
        *   ✅ Prepare context JSON for `--context`.
        *   ✅ Use `subprocess.Popen` to execute `python <temp_script_path> scrape --context='...'`.
        *   ✅ **stdout Handling:** Read line-by-line, parse JSON, collect products, batch insert into `scraped_products` table using `save_scraped_products`. (Note: The `save_scraped_products` function is simplified as the `record_price_change` DB trigger handles product matching and price change recording).
        *   ✅ **stderr Handling:** Read line-by-line, parse `PROGRESS:`/`ERROR:`, log using `log_event`.
        *   ✅ **Process Management:** Implement timeout and monitor exit code.
        *   ✅ **Status Update:** Update `scraper_runs` based on exit code and errors.

3.  **Refactor TypeScript Worker (`ts-worker`):** ✅ **DONE**
    *   ✅ Remove `isolated-vm` dependency and `executeScraperScript`.
    *   Improve job claiming atomicity (recommend using RPC). *(Note: Basic update logic kept for now, RPC recommended for future improvement)*
    *   ✅ Modify `fetchAndProcessJob`:
        *   ✅ Fetch script content, save to temporary `.js` file.
        *   ✅ Prepare context JSON for `--context`.
        *   ✅ Use `child_process.spawn` to execute `node <temp_script_path> scrape --context='...'`.
        *   ✅ **stdout Handling:** Read line-by-line, parse JSON, collect products, batch insert into `scraped_products` table using `saveScrapedProducts`. (Note: The `save_scraped_products` function is simplified as the `record_price_change` DB trigger handles product matching and price change recording).
        *   ✅ **stderr Handling:** Read line-by-line, parse `PROGRESS:`/`ERROR:`, log using `logStructured`.
        *   ✅ **Process Management:** Implement timeout and monitor exit code/signals.
        *   ✅ **Status Update:** Update `scraper_runs` based on exit code and errors.

4.  **Update Scraper Templates:** ✅ **DONE**
    *   **Python (`pricetracker/src/scraper_templates/python_template.py`):** ✅ **DONE**
        *   ✅ Add `argparse` for `--context`.
        *   ✅ Modify `scrape` function (or equivalent) to print one JSON object per product to `sys.stdout`.
        *   ✅ Use `print("PROGRESS: ...", file=sys.stderr)` and `print("ERROR: ...", file=sys.stderr)`.
        *   ✅ Remove internal batching logic (worker handles DB batching).
        *   ✅ Update `if __name__ == "__main__":` block for the new CLI.
    *   **TypeScript (`pricetracker/src/scraper_templates/typescript_template.ts`):** ✅ **DONE**
        *   ✅ Update to conform to the new CLI standard.
        *   ✅ Use `yargs` or `process.argv` for `--context`.
        *   ✅ Use `console.log()` for product JSON output (one per line).
        *   ✅ Use `console.error("PROGRESS: ...")` and `console.error("ERROR: ...")` for stderr.
        *   ✅ Remove internal batching logic (worker handles DB batching).

5.  **Database Schema & Triggers:** *(No changes made in this phase)*
    *   Confirm `scrapers` table stores full script content (e.g., `python_script`, `typescript_script`).
    *   Review indexing on `scraper_runs` (`status`, `scraper_type`).
    *   Leverage the existing `record_price_change` trigger on `scraped_products` insert to handle product matching and price change recording.
    *   Consider adding `append_log_to_scraper_run` and `claim_scraper_job` RPC functions to Supabase for atomicity if needed (especially for TS worker).

6.  **Dependency Cleanup:** ✅ **DONE**
    *   ✅ Remove `RestrictedPython` from `py-worker/requirements.txt`.
    *   ✅ Remove `isolated-vm` from `ts-worker/package.json` (Confirmed it wasn't listed).

7.  **Documentation & Task Tracking:** *(Remaining)*
    *   Update `pricetracker/README.md` explaining the new scraper creation/testing process.
    *   Update relevant documents in `pricetracker/docs/`.
    *   Update `TASK.md` with tasks derived from this plan and mark this refactor task.

## File Impact

This plan involves changes to the following files:

**Modified:**

*   `pricetracker/src/workers/py-worker/main.py`: ✅ **DONE** (Removed sandboxing, implemented subprocess execution, stdout/stderr parsing, DB batching).
*   `pricetracker/src/workers/py-worker/requirements.txt`: ✅ **DONE** (Removed `RestrictedPython`).
*   `pricetracker/src/workers/ts-worker/src/index.ts`: ✅ **DONE** (Removed `isolated-vm`, implemented subprocess execution, stdout/stderr parsing, DB batching).
*   `pricetracker/src/workers/ts-worker/package.json`: ✅ **DONE** (Confirmed `isolated-vm` not listed).
*   `pricetracker/src/scraper_templates/python_template.py`: ✅ **DONE** (Updated to new CLI standard).
*   `pricetracker/src/scraper_templates/typescript_template.ts`: ✅ **DONE** (Updated to new CLI standard).
*   `pricetracker/README.md`: *(Remaining)* Update documentation.
*   `pricetracker/docs/TASK.md`: *(Remaining)* Add specific implementation tasks and mark refactor task.
*   `pricetracker/Gemini 2_5_PRO_SIMPLIFYING_SCRAPER_ARCHITECTURE_PLAN.md`: ✅ **DONE** (This file updated).

**Created:**

*   *(None - Assuming existing templates are modified)*

**Potentially Deleted:**

*   Any files solely related to the old sandboxing mechanisms (`RestrictedPython` helpers, `isolated-vm` bootstrap scripts if separate) - *(Cleanup can be done manually if identified)*.
*   `pricetracker/public/pricetracker_scraper_template.py` - *(Can be deleted manually if confirmed unused)*.

**Database (Schema/Functions):** *(No changes made in this phase)*

*   **Reviewed:** `scrapers`, `scraper_runs`, `scraped_products` table definitions.
*   **Leveraged:** Existing `record_price_change` trigger.
*   **Modified/Created:** Consider adding Supabase RPC functions like `claim_scraper_job` and `append_log_to_scraper_run` for better atomicity and logging efficiency.
*   **Reviewed:** Indexing on `scraper_runs` table (`status`, `scraper_type`).