# Summary of Fixes for Products Page Database Integration (April 2, 2025)

This document summarizes the steps taken to address the performance issues and errors related to the Products page (`/products`).

## 1. Initial Problem

- **Inefficient Data Loading:** The page fetched all products (up to Supabase's limit) at once, regardless of pagination settings.
- **Incorrect Total Count:** The "Showing X to Y of Z results" text displayed an inaccurate total count, not reflecting the actual number of products matching the filters.

## 2. Core Fix: Server-Side Processing

- **Modified API Route (`src/app/api/products/route.ts`):**
    - Updated the `GET` handler to accept query parameters for pagination (`page`, `pageSize`), filtering (`brand`, `category`, `search`, `isActive`), and sorting (`sortBy`, `sortOrder`).
    - Implemented Supabase query logic to perform filtering and sorting directly in the database.
    - Used Supabase's `.range()` method for pagination.
    - Added a separate query using `.select('*', { count: 'exact', head: true })` to get the accurate total count of products matching the filters.
    - The API now returns an object `{ data: Product[], totalCount: number }`.
- **Modified Frontend Page (`src/app/(app)/products/page.tsx`):**
    - Removed the previous client-side logic that fetched all products and then filtered/sorted/paginated them in the browser.
    - Added a `fetch` call to the updated `/api/products` endpoint.
    - Passed the relevant `searchParams` (page, filters, sort options) from the page URL to the API request.
    - Updated the component to use the `data` array (paginated products) and `totalCount` returned by the API.
    - Updated the results text (`Showing X to Y of Z results`) and the `Pagination` component to use the `totalCount` from the API.
    - Added a separate database query to fetch distinct `brands` for the filter dropdown, rather than deriving them from all products.

## 3. Subsequent Error Fixes

- **API Unauthorized (401 Error):**
    - **Issue:** The `fetch` call from the `ProductsPage` server component to the `/api/products` route was failing because it didn't include authentication details.
    - **Fix:** Imported `headers` from `next/headers` in `products/page.tsx` and added the `Cookie` header from the incoming request to the `fetch` call, ensuring the API route could authenticate the user session.
- **Scrapers Page Hydration Error:**
    - **Issue:** A React hydration error occurred on `/scrapers` due to whitespace between `</thead>` and `<tbody>` tags in `scrapers/page.tsx`.
    - **Fix:** Adjusted the JSX in `scrapers/page.tsx` to place the `<tbody>` tag on a new line immediately after `</thead>`, removing the problematic whitespace.
- **`searchParams` Dynamic API Usage Errors:**
    - **Issue:** Next.js reported errors indicating that properties of the `searchParams` prop were being accessed in a potentially dynamic way before being awaited or properly handled.
    - **Attempt 1:** Assigned `searchParams` to a local variable first, then accessed properties from the variable. This did *not* resolve the errors.
    - **Attempt 2:** Modified `products/page.tsx` to remove intermediate variables for search parameters. Instead, accessed `searchParams` properties (e.g., `searchParams.page`) directly only where they were needed (inside `apiUrl.searchParams.set()` calls and prop assignments like `currentPage`). This also did *not* resolve the errors.
    - **Fix (Attempt 3):** Modified `products/page.tsx` again to define all variables derived from `searchParams` (like `page`, `view`, `brandFilter`, etc.) at the top level of the component function scope, right after the session check. Then, used these defined variables throughout the component, including in the API call setup and JSX rendering. This aims to provide a clearer structure for Next.js's static analysis. This also did *not* resolve the errors.
    - **Fix (Attempt 4):** Modified `products/page.tsx` to remove the upfront variable definitions derived from `searchParams`. Instead, accessed `searchParams` properties directly only where they were needed (e.g., constructing the API URL, passing props to `Pagination` and `ViewToggle`), applying default values at the point of use. This also did *not* resolve the errors.
    - **Fix (Attempt 5 - Suspense Boundary):**
        - Created a new async component `src/app/(app)/products/products-content.tsx`.
        - Moved the primary data fetching logic (competitors, brands, API call for products) and rendering logic (filters, results text, view toggle, product list/table, pagination) from `ProductsPage` into `ProductsContent`.
        - Modified `ProductsContent` to accept the `searchParams` *promise* and `session` object as props.
        - Inside `ProductsContent`, `await searchParams` and `await headers()` before using their properties.
        - Refactored `ProductsPage` to:
            - Keep the session check and redirect logic.
            - Render the static `<ProductsHeader />`.
            - Wrap `<ProductsContent />` within `<Suspense fallback={...}>`.
            - Pass the `searchParams` promise and `session` object as props to `<ProductsContent />`.
        - Updated the TypeScript type annotation for `searchParams` in `ProductsPage` to `Promise<{...}>` to match the runtime behavior and child prop type.
- **Filter/Sort Functionality:**
   - **Issue:** After fixing the `searchParams` errors, filters (competitor, search, inactive) and sorting were not being applied correctly. The API calls were missing the relevant query parameters.
   - **Fix:** Modified `src/app/(app)/products/products-filter.tsx`:
       - Changed sort dropdown option values to combine field and order (e.g., "name-asc", "created_at-desc").
       - Updated the initial state for sorting to use the combined value and match the API default ("created_at-desc").
       - Corrected the `useEffect` hook to parse the combined sort value and set both `sort` and `sortOrder` parameters in the URLSearchParams.
       - Ensured all selected filters (competitor, search, inactive) were correctly added to the URLSearchParams.
   - **Issue:** The "Competitor" and "Only Products with Price" filters were still not working because the API route wasn't handling the corresponding query parameters (`competitor`, `has_price`).
   - **Fix:**
       - Modified `src/app/api/products/route.ts` to:
           - Read the `competitor` and `has_price` query parameters.
           - Add a Supabase subquery to filter products based on the `competitor` ID by checking for entries in `price_changes` (Corrected table name).
           - Add a Supabase filter (`.not("our_price", "is", null)`) when `has_price=true`.
       - Updated the label text in `src/app/(app)/products/products-filter.tsx` from "Only Products with Price" to "Only show products with our price".
   - **Issue:** The `competitor` and `has_price` filters were still not working because the `ProductsContent` component wasn't reading these parameters from the awaited `searchParams` and adding them to the API request URL.
   - **Fix:** Modified `src/app/(app)/products/products-content.tsx` to read `competitor` and `has_price` from `searchParams` and add them to the `apiUrl` if present.
- **API Request URI Too Large (414) / Unauthorized (401):**
    - **Issue:** Removing the full cookie forwarding (to fix 414) caused 401 errors because the internal API call from `ProductsContent` lacked authentication. Forwarding the full cookie caused 414 errors.
    - **Fix:** Modified `ProductsContent` to:
        - Re-import `headers` from `next/headers`.
        - Read the incoming `cookie` header.
        - Parse the cookie string to extract *only* the specific session token cookie (identified as `PriceTracker.session-token` from logs).
        - Include *only* this specific session token cookie in the `Cookie` header of the internal `fetch` request to `/api/products`.
- **JSX Parsing Errors:**
    - **Issue:** Errors occurred due to misplaced comments within JSX prop sections (e.g., inside `<ProductsTable ...>` and `<Pagination ...>`).
    - **Fix:** Removed the incorrectly placed inline comments from `products/page.tsx`.
- **API Request URI Too Large (414) - Revisited:**
    - **Issue:** Even after forwarding only the essential session cookie, the API call from `ProductsContent` could still fail with a 414 error when many filters (especially competitor and search) were applied simultaneously. This is because all parameters were being sent in the URL via a GET request, exceeding the server's URL length limit.
    - **Fix:**
        - Modified the API route (`src/app/api/products/route.ts`) to handle `POST` requests for fetching products instead of `GET`. Parameters are now read from the request body (`await request.json()`). The original `POST` handler for *creating* products was renamed to `CREATE_PRODUCT` to avoid conflict (a TODO was added to move this to a dedicated route later).
        - Modified the frontend component (`src/app/(app)/products/products-content.tsx`) to:
            - Send the `fetch` request using `method: 'POST'`.
            - Construct a JSON `payload` object containing all filter, sort, and pagination parameters.
            - Send the `payload` in the request `body` (`JSON.stringify(payload)`).
            - Set the `Content-Type` header to `application/json`.
            - Remove the logic that appended parameters to the URL's search string.
            - Added `"use client";` directive to the top of the file as required by Next.js when using hooks implicitly through child components like `ProductsFilter`.
- **Server/Client Component Refactoring & Infinite Loop Fix:**
    - **Issue 1 (Build Error):** Marking `ProductsContent` as `"use client"` caused build errors because it was still importing `@/lib/supabase/server` (which uses the server-only `next/headers` API) to fetch competitors and brands. Client Components cannot directly use server-only APIs.
    - **Issue 2 (Build Error):** Client Components cannot be `async` functions.
    - **Issue 3 (Runtime Loop):** The `useEffect` hook in `ProductsContent` (responsible for fetching products) was triggering on every render because its dependency (`searchParams` object) changed reference even if the content was the same, leading to an infinite loop of API calls.
    - **Fix:**
        - **Moved Server Logic:** Shifted the fetching of initial data (`competitors`, `brands`) and the retrieval of the `cookieHeader` from `ProductsContent` to the parent Server Component (`src/app/(app)/products/page.tsx`). Also awaited `searchParams` in the server component.
        - **Passed Data as Props:** Passed the fetched `initialCompetitors`, `initialBrands`, `cookieHeader`, and the resolved `initialSearchParams` object down as props to `ProductsContent`.
        - **Made Client Component Sync:** Removed the `async` keyword from the `ProductsContent` function definition.
        - **Client-Side Product Fetch:** Kept the product fetching logic (`fetch` call to `/api/products`) inside `ProductsContent` but moved it into a `useEffect` hook.
        - **State Management:** Introduced `useState` hooks in `ProductsContent` to manage the `products` list, `totalProductCount`, `isLoading` state, and `error` state.
        - **Stabilized `useEffect`:** Changed the dependency array of the `useEffect` hook in `ProductsContent` to `[JSON.stringify(initialSearchParams), cookieHeader]`. Stringifying the search params ensures the effect only re-runs when the actual filter/sort/page values change, not just the object reference, fixing the infinite loop.
        - **Cleanup:** Removed unused variables (like `session` prop, intermediate filter variables) and fixed minor JSX errors (duplicate props, misplaced comments) identified during the refactoring.
100 | - **API Request URI Too Large (414) - Revisited Again (Filter State Refactor):**
101 |     - **Issue:** Despite using POST for the API data fetch, the 414 error persisted specifically when applying filters like "Competitor". The root cause was identified in `src/app/(app)/products/products-filter.tsx`. This component was updating the browser's URL via `router.push` with *all* filter parameters (including potentially long ones like competitor IDs and search terms) appended as query parameters to a GET request. This navigation step triggered the Cloudflare 414 limit *before* the page could render and execute the intended POST request for data.
102 |     - **Fix (State Management Refactor):**
103 |         - **Goal:** Prevent complex/long filter parameters from being included in the URL query string managed by `router.push`.
104 |         - **Component Structure:**
105 |             - Renamed the original Server Component `page.tsx` to `products-page-content.tsx` and converted it to a Client Component.
106 |             - Created a new Client Component `products-client-wrapper.tsx` to manage the state for complex filters (`brand`, `competitor`, `search`, `inactive`, `has_price`).
107 |             - Recreated `page.tsx` as the main Server Component entry point. It now handles initial server-side data fetching (session, competitors, brands, cookie) and renders `ProductsClientWrapper`, passing the fetched data and resolved `searchParams` (as `ReadonlyURLSearchParams`) down.
108 |         - **State Flow:**
109 |             - `ProductsClientWrapper` holds the state for complex filters, initialized from the initial `searchParams`. It defines a callback `handleComplexFilterChange`.
110 |             - `ProductsClientWrapper` renders `ProductsPageContent`, passing down `searchParams`, `complexFilters` state, the `handleComplexFilterChange` callback, and initial server data.
111 |             - `ProductsPageContent` renders `ProductsContent`, passing down a combined `currentParams` object (derived from `searchParams` and `complexFilters`), initial server data, and the `handleComplexFilterChange` callback.
112 |             - `ProductsContent` renders `ProductsFilter`, passing down initial server data, the current complex filter values (`currentFilters` prop), the `handleComplexFilterChange` callback, and simple URL parameters (`simpleSearchParams` prop like page/view).
113 |         - **Filter Logic (`products-filter.tsx`):**
114 |             - Removed internal state management for complex filters; input values are now controlled by the `currentFilters` prop.
115 |             - `onChange` handlers for complex filters now call the `onComplexFilterChange` callback to update the state in `ProductsClientWrapper`.
116 |             - The `useEffect` hook responsible for URL updates was modified to *only* include simple parameters (`sort`, `sortOrder`, `page`, `view`) in the `router.push` call. Complex filters are no longer added to the URL query string by this component.
117 |         - **Data Fetching (`products-content.tsx`):**
118 |             - Updated to accept `currentParams` prop (combined simple URL params and complex filter state).
119 |             - The `useEffect` hook for fetching products now reads all parameters from the `currentParams` prop to build the `POST` request payload.
120 |             - The `useEffect` dependency array was updated to `[JSON.stringify(currentParams), cookieHeader]` to react correctly to changes in any filter or pagination parameter.
121 |         - **Result:** Complex filters no longer bloat the URL managed by `router.push`, preventing the 414 error, while the actual data fetching continues correctly via POST requests.
        - **Post-Refactor Corrections:**
            - **Runtime Error (`searchParams.get is not a function`):** The initial refactor incorrectly passed a `ReadonlyURLSearchParams` object created in the Server Component (`page.tsx`) to the Client Component (`products-client-wrapper.tsx`). This object is not serializable.
                - **Fix:** Modified `page.tsx` to pass the original plain `searchParams` object (received as props) directly to `products-client-wrapper.tsx`. Modified `products-client-wrapper.tsx` to accept this plain object and construct a `URLSearchParams` object internally (wrapped in `useMemo`) for reading initial filter values.
            - **TypeScript/ESLint Errors:** Corrected various type errors related to prop mismatches during the refactor. Fixed ESLint warnings and subsequent type errors in `products-filter.tsx` related to the `debounce` function implementation and the usage of `useCallback`/`useMemo` for the debounced search handler. Ensured correct imports (`useMemo`) and dependency arrays for hooks.
 126 | - **API Request URI Too Large (414) - Final Fix (Database Function):**
 127 |     - **Issue:** Despite all previous refactoring (using POST, managing complex filter state separately), the 414 error persisted *specifically* when using the "Competitor" filter. Network inspection showed the browser's POST request to `/api/products` was correct, but the API route itself returned a 500 error containing the Cloudflare 414 HTML response.
 128 |     - **Root Cause:** The API route (`src/app/api/products/route.ts`) implemented the competitor filter by first querying the `price_changes` table for all product IDs associated with the competitor, and then using a potentially massive `.in('id', [id1, id2, ...])` clause in the main product query. The Supabase client likely translated this `.in()` clause into a URL parameter for the database request, which exceeded URI length limits (e.g., at Cloudflare in front of Supabase) when a competitor had many associated products.
 129 |     - **Fix (Database Function & RPC):**
 130 |         - Created a new PostgreSQL function `get_products_filtered` within the Supabase database (`pricetracker/scripts/database-setup.sql`).
 131 |         - This function accepts all filter, sort, and pagination parameters (including `p_competitor_id`).
 132 |         - It performs all filtering directly in the database, using `EXISTS (SELECT 1 FROM price_changes ...)` for the competitor filter, which is more efficient and avoids generating a large list of IDs.
 133 |         - It returns a JSON object containing the paginated `data` and the `totalCount`.
 134 |         - Modified the `POST` handler in the API route (`src/app/api/products/route.ts`) to replace the manual query building logic with a single call to the new function using `supabase.rpc('get_products_filtered', { ...rpcParams })`.
 135 |         - **Result:** The API route no longer constructs potentially huge query parameters, resolving the 414 error by shifting the complex filtering logic entirely into the database.