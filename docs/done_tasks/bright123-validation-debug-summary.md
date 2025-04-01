# Summary of Debugging Steps for `bright123_scraper.py` Validation Timeout (2025-03-31)

**Goal:** Adapt `bright123_scraper.py` to conform to the PriceTracker server's batch processing template and pass validation (`pricetracker/src/app/api/scrapers/python/validate/route.ts`).

**Initial Problem:** When validating the adapted `bright123_scraper.py` via the server endpoint, the process timed out after 120 seconds. Logs showed the Python script was running far beyond the expected `MAX_BATCHES_TO_VALIDATE = 3` limit, indicating the server wasn't correctly detecting the batches from the script's `stdout` to trigger the early stop mechanism (`process.kill()`).

**Debugging Attempts:**

1.  **Delayed Imports:**
    *   **Hypothesis:** Top-level imports of required libraries (`aiohttp`, `selectolax`, etc.) in the Python script might cause the initial `metadata` check during validation to fail before libraries are installed.
    *   **Action:** Moved all imports of libraries listed in `get_metadata()["required_libraries"]` from the top level into the functions where they are actually used (`scrape`, `_async_scraper_logic`, helper functions).
    *   **Result:** The `python bright123_scraper.py metadata` command ran successfully locally. However, server validation still timed out, running past batch 3.

2.  **Python `stdout` Flushing (Attempt 1 - `sys.stdout.flush()`):**
    *   **Hypothesis:** Python's `stdout` might be buffered, preventing the Node.js validation process from receiving the JSON batch data immediately after it's printed.
    *   **Action:** Added `sys.stdout.flush()` immediately after `print(json.dumps(batch))` in the `if __name__ == "__main__":` block of `bright123_scraper.py`.
    *   **Result:** Server validation still timed out, running past batch 3. Logs looked similar.

3.  **Python `stdout` Flushing (Attempt 2 - `print(..., flush=True)`):**
    *   **Hypothesis:** Same as above, but using the built-in `flush` argument might be more reliable.
    *   **Action:** Replaced `print(json.dumps(batch)); sys.stdout.flush()` with `print(json.dumps(batch), flush=True)` in `bright123_scraper.py`.
    *   **Result:** Server validation still timed out, running past batch 3. Logs looked similar.

4.  **Node.js `stdout` Handler Robustness (Basic Check):**
    *   **Hypothesis:** The Node.js code reading `stdout` might be failing to parse lines if non-JSON text or partial lines are received.
    *   **Action:** Modified the `stdout.on('data', ...)` handler in `validate/route.ts` to add a basic check (`line.startsWith('[') && line.endsWith(']')`) before attempting `JSON.parse()`.
    *   **Result:** Server validation still timed out, running past batch 3. Logs looked similar.

5.  **Marker-Based Parsing:**
    *   **Hypothesis:** Relying on newline characters (`\n`) to split batches from the `stdout` stream is unreliable. Using explicit markers might allow Node.js to parse batches correctly even if data arrives in inconsistent chunks.
    *   **Action:**
        *   Modified `bright123_scraper.py` to print `__BATCH_START__\n{json_batch}\n__BATCH_END__` for each batch.
        *   Rewrote the `stdout.on('data', ...)` handler in `validate/route.ts` to buffer data and extract content between `__BATCH_START__` and `__BATCH_END__` markers before parsing.
    *   **Result:** Server validation still timed out, running past batch 3. Logs looked similar.

**Current Status:** Despite ensuring delayed imports, immediate flushing from Python, and implementing marker-based parsing in Node.js, the validation process timed out because the Node.js code fails to detect and count the first 3 batches from the Python script's `stdout` to trigger the `process.kill()` based on `MAX_BATCHES_TO_VALIDATE`. The underlying reason for the Node.js stream handler failing to parse the data correctly remained elusive.

**Further Debugging (2025-04-01):**

6.  **Simplify Python Output & Enhance Node.js Logging:**
    *   **Hypothesis:** Maybe *no* data is reaching Node.js stdout, or the parsing logic is still flawed.
    *   **Action:**
        *   Modified `bright123_scraper.py` to print simple `BATCH X` lines instead of JSON.
        *   Added detailed raw chunk logging to `stdout` and `stderr` handlers in `validate/route.ts`. Simplified the `stdout` handler to just look for `BATCH X`.
    *   **Result:** Logs confirmed `stderr` data was received, but **no `stdout` data** arrived in Node.js during the scrape phase.

7.  **Bypass Python Wrapper Script:**
    *   **Hypothesis:** The `wrapper.py` script (specifically `runpy.run_path`) might be interfering with `stdout` redirection for the complex async scraper.
    *   **Action:** Modified `validate/route.ts` to install libraries directly via `pip` and then execute `python script.py scrape` directly, bypassing the wrapper for the scrape command.
    *   **Result:** Still no `stdout` data received by Node.js. This ruled out the wrapper as the primary cause.

8.  **Move Python Print Location:**
    *   **Hypothesis:** The original Python script collected all batches via `asyncio.run()` and *then* printed them synchronously. Maybe `stdout` is only captured correctly *during* the initial synchronous execution phase, not after `asyncio.run()` completes within the spawned process.
    *   **Action:** Modified `bright123_scraper.py`'s `scrape()` function. Added a callback (`_batch_collector_callback`) that prints the `BATCH X` message *immediately* after a batch is collected by the async logic, before the `scrape()` generator yields. Removed the final print loop from `if __name__ == "__main__":`.
    *   **Result:** `stdout` data (`BATCH 1`, `BATCH 2`, etc.) started appearing in Node.js logs! However, the process still timed out.

9.  **Fix Node.js Handler Line Splitting:**
    *   **Hypothesis:** The Node.js `stdout` handler was splitting lines incorrectly.
    *   **Action:** Corrected `scrapeStdoutBuffer.split('\\n')` to `scrapeStdoutBuffer.split('\n')` and added `.trim()` to handle potential `\r` characters in `validate/route.ts`.
    *   **Result:** Node.js correctly detected `BATCH 1`, `BATCH 2`, `BATCH 3` and killed the process. Timeout resolved!

10. **Revert Debug Code:**
    *   **Hypothesis:** The core communication issue is fixed; now need to process real data.
    *   **Action:**
        *   Modified `bright123_scraper.py`'s callback to print the actual `json.dumps(batch)` instead of `BATCH X`.
        *   Modified `validate/route.ts`'s `stdout` handler to parse the incoming lines as JSON instead of looking for `BATCH X`.
    *   **Result:** Validation completed successfully, processing the first 3 batches of real product data without timeout.

**Final Conclusion:** The primary issue was that the Python script's `stdout` was not being captured correctly by the Node.js parent process when printing occurred *after* the main `asyncio.run()` call completed within the `if __name__ == "__main__":` block. Moving the print statement to occur within a callback *during* the async processing allowed `stdout` to be streamed correctly. A secondary issue was incorrect line splitting in the Node.js handler. Bypassing the wrapper script was not necessary for the final solution.