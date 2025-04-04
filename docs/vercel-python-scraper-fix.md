# Fixing Python Scraper Execution on Vercel

## Problem

Python-based scrapers were executing successfully in the local development environment (running via `npm run dev`) but failed when deployed to Vercel.

The error logs on Vercel indicated that the Python interpreter (`python`, `python3`, `py`) could not be found:

```
Error: No Python interpreter found. Please ensure Python is installed and available in PATH.
...
/bin/sh: line 1: py: command not found
/bin/sh: line 1: python: command not found
/bin/sh: line 1: python3: command not found
```

This occurred because the Next.js API route (`/api/scrapers/[scraperId]/run`) responsible for initiating the scraper run executes within Vercel's default Node.js serverless function environment. This environment does not include a Python installation by default. The `ScraperExecutionService` was attempting to use Node.js's `child_process` to spawn a Python process, which failed in this environment.

## Initial Incorrect Attempt

An initial attempt was made to modify `vercel.json` to assign the `@vercel/python` runtime directly to the Next.js API route pattern (`api/scrapers/*/run`).

```json
  "functions": {
    "api/scrapers/*/run": {
      "runtime": "@vercel/python",
      "memory": 1024
    }
  }
```

This approach failed during deployment because it incorrectly tried to force a Python runtime onto a function handler written in TypeScript/JavaScript and managed by the Next.js framework.

## Solution Implemented

The correct approach involved separating the Node.js API logic from the Python execution logic, utilizing Vercel's native support for multiple runtimes:

1.  **Reverted `vercel.json`:** The incorrect `functions` configuration was removed, restoring the standard Next.js framework configuration.
2.  **Created Python Serverless Function:**
    *   A new file, `pricetracker/api/execute_scraper.py`, was created.
    *   This file defines a standard Python HTTP handler (`class handler(BaseHTTPRequestHandler):`). Vercel automatically detects files in the `/api` directory (at the project root) and deploys them as serverless functions using the appropriate runtime (Python in this case).
    *   This Python function receives the scraper script content, run ID, and required libraries via a POST request body.
    *   It uses `sys.executable` (pointing to the Python interpreter provided by the Vercel runtime) and `subprocess` to:
        *   Install the required Python libraries (from `requirements.txt` and script-specific metadata) using `pip`.
        *   Execute the received scraper script content within a temporary directory.
    *   It returns a JSON response indicating success or failure, along with the number of products counted (as reported by the script's stdout).
3.  **Modified Node.js `ScraperExecutionService`:**
    *   The `runScraperInternal` and `runScraperTestInternal` methods in `pricetracker/src/lib/services/scraper-execution-service.ts` were refactored.
    *   The code responsible for finding the Python executable, writing the script to a temporary file, installing dependencies via `pip`, and using Node.js `child_process.spawn` was removed.
    *   Instead, these methods now:
        *   Fetch the scraper details (script content, required libraries) from Supabase.
        *   Construct the absolute URL for the new Python endpoint (`/api/execute_scraper`), considering the Vercel environment (`process.env.VERCEL_URL`) or localhost for development.
        *   Make an asynchronous `fetch` POST request to the `/api/execute_scraper` endpoint, sending the `run_id`, `script_content`, and `requirements` in the JSON body.
        *   Handle the JSON response from the Python endpoint to determine the success or failure of the execution and update the database (scraper status, run record) and progress cache accordingly.
4.  **Updated `requirements.txt`:** Ensured `lxml` was added to `pricetracker/requirements.txt`, as it was identified as a necessary dependency during local testing but was missing from the file.

## Outcome

This refactoring delegates the Python-specific tasks (dependency installation, script execution) to a dedicated Vercel Python Serverless Function, which runs in an environment where Python *is* available. The Node.js part of the application now simply orchestrates the process by calling this dedicated Python endpoint via HTTP. This aligns with Vercel's recommended architecture for polyglot applications and resolves the "Python not found" error during deployment.