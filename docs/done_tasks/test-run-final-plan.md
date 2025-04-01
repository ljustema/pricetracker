# Final Plan: Simplify and Align Scraper Testing & Running

## 1. Core Concepts & Goals

Based on refined requirements, the testing and running flows will be simplified and aligned:

*   **Goal:** Consolidate validation logic for both creating and editing scrapers.
*   **Goal:** Use a consistent asynchronous UI pattern with progress polling for both "Test Runs" and "Full Runs".

**Defined Flows:**

1.  **Validation (Create/Edit Scraper):**
    *   **Purpose:** Check script syntax, structure, fetch sample data (first few batches) for manual review *before* saving.
    *   **Database:** **NO** DB inserts.
    *   **API:** Uses `/api/scrapers/python/validate`.

2.  **Test Run (From List View):**
    *   **Purpose:** Quick check if an *existing, approved* scraper runs and inserts data correctly.
    *   **Database:** **YES**, inserts **only the first batch**.
    *   **API:** Uses `/api/scrapers/[scraperId]/test-run` (new async implementation).
    *   **UI:** Asynchronous, shows progress via polling.

3.  **Full Run (Manual Trigger):**
    *   **Purpose:** Execute the scraper completely.
    *   **Database:** **YES**, inserts **all batches**.
    *   **API:** Uses `/api/scrapers/[scraperId]/run`.
    *   **UI:** Asynchronous, shows progress via polling.

## 2. Implementation Plan

**A. Consolidate Validation Flow (Create & Edit):**

*   **Backend (`/api/scrapers/python/validate`):** Keep as is.
*   **Backend (`/api/scrapers/[scraperId]/test`):** **Delete** this route file.
*   **Backend Service (`ScraperExecutionService`):** **Delete** `runScraperTest` method.
*   **Frontend Service (`ScraperClientService`):** **Delete** `testScraper` method.
*   **Frontend UI (Editing - `scraper-manager.tsx`, `python-scraper-form.tsx` etc.):**
    *   Remove `handleTestScraper` from `ScraperManager`.
    *   Ensure the edit form uses the same validation UI/logic as the create form.
    *   Add a "Validate Script" button to the edit form calling `ScraperClientService.validatePythonScraper`.
    *   Display validation results (modal/inline) before allowing "Save Changes".
*   **Frontend UI (`ScraperList`):** Remove `onTestScraper` prop and "Test" button.
*   **Frontend UI (`ScraperTestPanel`):** **Delete** this component file.

**B. Implement Consistent Async UI & Backend for Runs:**

*   **Backend Service (`ScraperExecutionService`):**
    *   Implement `startScraperTestRun(scraperId)`: Returns `{ runId }`, calls `runScraperTestInternal` async.
    *   Implement `runScraperTestInternal(scraperId, runId)`: Uses `spawn`, runs `scrape`, processes/inserts **first batch only**, kills process, updates progress/DB.
*   **Backend (`/api/scrapers/[scraperId]/test-run`):** Rewrite to call `startScraperTestRun` and return `{ runId }` (Status 202).
*   **Backend (`/api/scrapers/[scraperId]/run`):** Keep as is.
*   **Backend (`/api/scrapers/[scraperId]/run/[runId]/status`):** Keep as is.
*   **Frontend Service (`ScraperClientService`):**
    *   **Delete** `runScraperTest` method.
    *   Add `startTestRun(scraperId)` method calling the updated `/test-run` API.
    *   Keep `runScraper` method (for full run).
*   **Frontend UI (`ScraperList`):**
    *   Add "Test Run" button (for approved scrapers).
    *   "Test Run" button calls `startTestRun`, gets `runId`, shows progress component.
    *   "Run Now" button calls `runScraper`, gets `runId`, shows the *same* progress component.

## 3. Files to Modify/Create:**

1.  `pricetracker/src/lib/services/scraper-execution-service.ts` (Modify)
2.  `pricetracker/src/app/api/scrapers/[scraperId]/test-run/route.ts` (Rewrite)
3.  `pricetracker/src/lib/services/scraper-client-service.ts` (Modify)
4.  `pricetracker/src/components/scrapers/scraper-manager.tsx` (Modify)
5.  `pricetracker/src/components/scrapers/scraper-list.tsx` (Modify)
6.  `pricetracker/src/components/scrapers/python-scraper-form.tsx` (or relevant edit form) (Modify)

## 4. Files/Components to Delete:**

1.  `pricetracker/src/app/api/scrapers/[scraperId]/test/route.ts`
2.  `pricetracker/src/components/scrapers/ScraperTestPanel.tsx`

## 5. Final User Experience:**

*   **Creating:** Fill form -> Click "Validate Script" -> Review sample data -> Approve sample data -> Click "Create Scraper".
*   **Editing:** Click "Edit" -> Modify form -> Click "Validate Script" -> Review sample data ->  Approve sample data -> Click "Save Changes".
*   **Testing Run:** Click "Test Run" on list -> See progress indicator -> Finishes quickly (~30s) -> Status updated, first batch in DB.
*   **Full Run:** Click "Run Now" on list -> See progress indicator -> Finishes when done -> Status updated, all batches in DB.


All above is done.
Now I do test steps and comment:

Step1 - Create New Scraper
Works perfect.
Logg:
 ✓ Compiled /competitors in 470ms (1209 modules)
 GET /competitors 200 in 1022ms
 ○ Compiling /competitors/[competitorId]/scrapers/new ...
 ✓ Compiled /competitors/[competitorId]/scrapers/new in 2.5s (1412 modules)
 GET /competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308/scrapers/new 200 in 3769ms
 GET /api/auth/session 200 in 36ms
 GET /api/auth/session 200 in 14ms
 ✓ Compiled /api/competitors/[competitorId] in 415ms (1414 modules)
 GET /api/competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308 200 in 1824ms
 GET /api/competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308 200 in 80ms
 ○ Compiling /api/scrapers/python/validate ...
 ✓ Compiled /api/scrapers/python/validate in 521ms (1416 modules)
Reached maximum batches (3) for validation, stopping process
 POST /api/scrapers/python/validate 200 in 24626ms
 ○ Compiling /api/scrapers/python ...
 ✓ Compiled /api/scrapers/python in 697ms (1406 modules)
 POST /api/scrapers/python 200 in 2341ms
 ○ Compiling /competitors/[competitorId]/scrapers ...
 ✓ Compiled /competitors/[competitorId]/scrapers in 1504ms (1458 modules)
 GET /competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308/scrapers 200 in 3211ms
 GET /competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308/scrapers 200 in 159ms
 ✓ Compiled /competitors in 279ms (982 modules)
 GET /competitors 200 in 531ms
 GET /competitors 200 in 115ms

Step2
Edit Scraper
Not same UI as Create New Scraper need to fix
This should be same funtion and UI as Create New Scraper only changing To Edit Scraper and Update Scraper instead of create, should also run Validate script and need to approve before be able to click Update Scraper.

Logg:
 POST /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/test 500 in 2593ms
 GET /scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/edit 200 in 83ms
 ✓ Compiled /api/scrapers/[scraperId] in 352ms (962 modules)
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 837ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 85ms
Error testing scraper: TypeError: _lib_services_scraper_execution_service__WEBPACK_IMPORTED_MODULE_1__.ScraperExecutionService.runScraperTest is not a function
    at POST (src\app\api\scrapers\[scraperId]\test\route.ts:23:54)
  21 |
  22 |     // Test the scraper using the newer implementation that bypasses RLS
> 23 |     const testResults = await ScraperExecutionService.runScraperTest(scraperId);
     |                                                      ^
  24 |
  25 |     return NextResponse.json(testResults);
  26 |   } catch (error) {
 POST /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/test 500 in 105ms
 GET /scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/edit 200 in 88ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 144ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 62ms
 PUT /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 240ms
 GET /scrapers 200 in 155ms

Step3
Run Test
Should be same UI as Full Run. Dont know if it is beacause i cant run it.
Logg:
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 69ms
 GET /scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/test-run 200 in 34ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 171ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 65ms
 Console Error


Error: _lib_services_scraper_client_service__WEBPACK_IMPORTED_MODULE_3__.ScraperClientService.runScraperTest is not a function

src\app\(app)\scrapers\[scraperId]\test-run\page.tsx (90:49) @ runScraperTest


  88 |     
  89 |     try {
> 90 |       const result = await ScraperClientService.runScraperTest(scraperId);
     |                                                 ^
  91 |       setResults(result);
  92 |     } catch (err) {
  93 |       console.error("Error running scraper test:", err);
Call Stack
12

Show 9 ignore-listed frame(s)
runScraperTest
src\app\(app)\scrapers\[scraperId]\test-run\page.tsx (90:49)
button
<anonymous> (0:0)
TestRunScraperPage
src\app\(app)\scrapers\[scraperId]\test-run\page.tsx (161:11)


Step4
Full Run
NOt working
Logg:
 ○ Compiling /scrapers/[scraperId]/run ...
 ✓ Compiled /scrapers/[scraperId]/run in 1259ms (1468 modules)
 GET /scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/run 200 in 2691ms
 GET /scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/run 200 in 83ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 211ms
 GET /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e 200 in 69ms
 ○ Compiling /api/scrapers/[scraperId]/run ...
 ✓ Compiled /api/scrapers/[scraperId]/run in 578ms (1456 modules)
 GET /scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/run 200 in 316ms
 POST /api/scrapers/458bc0a5-291a-46f7-8c5f-22c42b53842e/run 202 in 2135ms
 Unhandled Runtime Error


Error: Cannot read properties of undefined (reading 'length')

src\app\(app)\scrapers\[scraperId]\run\page.tsx (197:40) @ RunScraperPage


  195 |           <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">
  196 |             <p className="font-medium">{results.message}</p>
> 197 |             <p>Found {results.products.length} products</p>
      |                                        ^
  198 |           </div>
  199 |           
  200 |           <div className="overflow-hidden rounded-lg border border-gray-200">
Call Stack
2

Show 1 ignore-listed frame(s)
RunScraperPage
src\app\(app)\scrapers\[scraperId]\run\page.tsx (197:40)

Fixes made after testing:
I've completed all the necessary changes to implement the plan. Here's a summary of what I've done:

Modified scraper-execution-service.ts:

Removed the old runScraperTest method
Added new startScraperTestRun method that returns a runId for progress tracking
Added new runScraperTestInternal method that processes only the first batch of products
Updated scraper-service.ts:

Replaced the runScraperTest method with startScraperTestRun method
Rewritten test-run route.ts:

Updated to use the new startScraperTestRun method
Returns a 202 Accepted status with the runId for polling
Modified scraper-client-service.ts:

Removed the testScraper method
Removed the runScraperTest method
Added new startTestRun method that calls the updated test-run API
Modified scraper-manager.tsx:

Removed the handleTestScraper method
Removed the ScraperTestPanel import
Updated the renderStep function to handle the 'test' case gracefully
Modified scraper-list.tsx:

Added state for tracking test runs and full runs
Added methods for handling test runs and full runs
Added "Test Run" button for approved scrapers
Added "Run Now" button for full scraper runs
Added progress components for both test runs and full runs
Updated test-run page.tsx:

Rewrote to use the new startTestRun method
Added ScraperRunProgress component to show progress
Implemented handleRunComplete callback
Updated run page.tsx:

Rewrote to use the new asynchronous approach
Added ScraperRunProgress component to show progress
Fixed the error with results.products.length
Updated edit page.tsx:

Updated to use the PythonScraperForm component for Python scrapers
Added a note about using the validation process
Deleted files:

Deleted the test route.ts file
Deleted the ScraperTestPanel.tsx component
These changes implement a consistent asynchronous UI pattern with progress polling for both "Test Runs" and "Full Runs" as specified in the plan. The validation flow for creating and editing scrapers has been consolidated, and the test panel has been removed in favor of inline progress tracking.


Task Completed
I've successfully implemented the plan to simplify and align scraper testing and running flows. The key changes include:

Consolidated Validation Flow:

Removed the separate test endpoint and components
Updated the edit page to use the same PythonScraperForm component as the create flow
Ensured both create and edit forms use the same validation logic
Implemented Consistent Async UI for Runs:

Added new startScraperTestRun method in the execution service
Created a new implementation of runScraperTestInternal that only processes the first batch
Updated the test-run route to use the new asynchronous approach
Modified the client service to support the new flow
Updated UI Components:

Removed the ScraperTestPanel component
Added "Test Run" and "Run Now" buttons to the scraper list
Implemented progress tracking for both test runs and full runs
Used the same ScraperRunProgress component for both types of runs
Fixed Error Handling:

Updated the test-run and run pages to properly handle errors
Improved the user experience with clear error messages and loading states
Deleted Unnecessary Files:

Removed the test route file
Removed the ScraperTestPanel component
The new implementation provides a more consistent user experience with asynchronous progress tracking for both test runs and full runs, while simplifying the codebase by consolidating validation logic and removing redundant components.

I am testing it again:

Step1 - Create New Scraper
Works perfect.

Step2
Edit Scraper
Looks good but it does not show the current python code in the code box. it should get it from db scrapers.python_script
I tried to copy in same code and click Create Scraper and it created a new scraper. The buttons should be renamed to Update scraper and funtion accordingly.

Step3
Run Test
I get an error:
Test Run Progress
Error
Run not found or expired
Console Error


Error: Run not found or expired

src\lib\services\scraper-client-service.ts (353:15) @ ScraperClientService.getScraperRunStatus


  351 |       if (!response.ok) {
  352 |         const error = await response.json();
> 353 |         throw new Error(error.error || 'Failed to get scraper run status');
      |               ^
  354 |       }
  355 |       
  356 |       return response.json();
Call Stack
2

ScraperClientService.getScraperRunStatus
src\lib\services\scraper-client-service.ts (353:15)
async ScraperRunProgress.useCallback[fetchStatus]
src\components\scrapers\scraper-run-progress.tsx (62:22)
○ Compiling /api/competitors/[competitorId] ...
 ✓ Compiled /api/competitors/[competitorId] in 853ms (989 modules)
 GET /api/competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308 200 in 1041ms
 GET /api/competitors/cb7b8b2a-8d9c-4670-8525-533d2a66f308 200 in 104ms
 ○ Compiling /scrapers/[scraperId]/test-run ...
 ✓ Compiled /scrapers/[scraperId]/test-run in 1010ms (1489 modules)
 GET /scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/test-run 200 in 2485ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2 200 in 370ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2 200 in 84ms
 ○ Compiling /api/scrapers/[scraperId]/test-run ...
 ✓ Compiled /api/scrapers/[scraperId]/test-run in 542ms (1491 modules)
 GET /scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/test-run 200 in 264ms
 POST /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/test-run 202 in 2438ms
 ○ Compiling /api/scrapers/[scraperId]/run/[runId]/status ...
 ✓ Compiled /api/scrapers/[scraperId]/run/[runId]/status in 713ms (1493 modules)
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 2185ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 55ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 103ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 34ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 40ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 23ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 20ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 16ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 27ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/ae840122-f82b-4f3d-b4ca-7aeb89e9bf53/status 404 in 22ms

 Tried with the first scraper and it worked but with some error:
 Test Run Progress
Error
Failed to fetch

Test Results
Test run completed successfully with 20 products

Note: The test results have been stored in the database and will be used for product matching and price change detection.

and after test is finished the console continouesely prints:
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/c0988d38-8875-4619-a108-220e0f679555/status 200 in 50ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/c0988d38-8875-4619-a108-220e0f679555/status 200 in 49ms
 GET /api/scrapers/66146122-2450-4c8b-9aac-d2ad3aeab7b2/run/c0988d38-8875-4619-a108-220e0f679555/status 200 in 35ms

 Needed to kill server.

 Step4
Full Run
Not testes yet. need to fix the other error first.