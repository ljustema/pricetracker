# Crawlee Storage Debugging Log (2025-04-05)

This document tracks the steps taken to resolve persistent filesystem access errors (`EPERM` and `ENOENT`) when running the Crawlee-based `norrmalmsel-crawler.ts` locally, despite attempts to configure memory-only storage.

## Initial Problem

- **Symptom:** Scraper run completed successfully, but failed immediately after with `EPERM: operation not permitted, mkdir 'C:\...\pricetracker\storage\request_queues\default\....json.lock'`. Later changed to `ENOENT` errors during crawler initialization (`AutoscaledPool: isTaskReadyFunction failed`).
- **Diagnosis:** Filesystem permission/access issue preventing Crawlee components from writing state/lock files to the default `./storage` directory, even when `MemoryStorage` was intended.

## Debugging Attempts & Results

1.  **Delete `./storage` Directory:**
    *   **Action:** Manually deleted the `pricetracker/storage` directory.
    *   **Hypothesis:** Crawlee might recreate the directory with correct permissions.
    *   **Result:** Failed. Error changed slightly (`EPERM` -> `ENOENT`) but still occurred during the run.

2.  **Disable Session Persistence:**
    *   **Action:** Added `sessionPoolOptions: { persistStateKeyValueStoreId: undefined }` to `CheerioCrawler` options.
    *   **Hypothesis:** Prevent the SessionPool from writing state to disk.
    *   **Result:** Failed. Filesystem error persisted.

3.  **Force Memory Storage via Env Var:**
    *   **Action:** Temporarily set `process.env.CRAWLEE_STORAGE_DIR = ':memory:'` in `scraper-execution-service.ts`.
    *   **Hypothesis:** Force all Crawlee components to use memory storage globally.
    *   **Result:** Failed. Caused `EINVAL` error as `:memory:` was misinterpreted as a Windows path.

4.  **Force Memory Storage via `Configuration` Object:**
    *   **Action:** Created `new Configuration({ storageClient: new MemoryStorage() })` and passed `config` to `CheerioCrawler` constructor.
    *   **Hypothesis:** Correctly configure the crawler instance via its configuration.
    *   **Result:** Failed. `ENOENT` error persisted.

5.  **Explicit `MemoryStorage` for Queue/Dataset (Attempt 1):**
    *   **Action:** Instantiated `MemoryStorage` and passed `storageClient` explicitly to `RequestQueue.open()` and `Dataset.open()`.
    *   **Hypothesis:** Standard documented way to ensure specific components use memory storage.
    *   **Result:** Failed. `ENOENT` error persisted, originating from `AutoscaledPool`.

6.  **Explicit `MemoryStorage` with `persistStorage: false` (Successful Fix):**
    *   **Action:** Consulted `MemoryStorageOptions` documentation. Realized `MemoryStorage` defaults to *also* persisting to disk (`persistStorage: true`). Instantiated `MemoryStorage` with the correct option: `new MemoryStorage({ persistStorage: false })`. Passed this `storageClient` instance explicitly to `RequestQueue.open()` and `Dataset.open()`. Used the `dataset` instance for `pushData`/`getData`.
    *   **Hypothesis:** Disabling the default disk persistence for `MemoryStorage` would prevent all filesystem access attempts.
    *   **Result:** **Success!** The `ENOENT` error was resolved, and the scraper run completed successfully.

## Final Status & Solution

- The root cause was that `MemoryStorage` by default still attempts to mirror data to the filesystem (`persistStorage: true`).
- **Solution:** Explicitly instantiate `MemoryStorage` with `persistStorage: false` and pass this `storageClient` instance to `RequestQueue.open()` and `Dataset.open()`. Use the opened `dataset` instance for data operations.

```typescript
// In norrmalmsel-crawler.ts

import { MemoryStorage } from '@crawlee/memory-storage';
// ...

// --- Explicitly configure and use MemoryStorage with persistence disabled ---
const storageClient = new MemoryStorage({ persistStorage: false }); // Disable disk persistence
log.info(`Using MemoryStorage explicitly with persistStorage=false.`);
// ---

// ...

// Initialize Crawlee components with explicit storage client
const requestQueue = await RequestQueue.open(undefined, { storageClient }); // Pass storageClient
const dataset = await Dataset.open(undefined, { storageClient }); // Pass storageClient
await requestQueue.addRequest({ url: BRAND_URL, label: LABELS.BRAND_LIST });

// ...

// Inside requestHandler for PRODUCT_DETAIL:
await dataset.pushData(productData); // Use the dataset INSTANCE

// ...

// After crawler.run():
const results = await dataset.getData(); // Use the dataset INSTANCE
```

- The persistent Next.js API route error (`params should be awaited`) was resolved by restarting the Next.js development server, indicating a likely caching or build issue within Next.js itself.