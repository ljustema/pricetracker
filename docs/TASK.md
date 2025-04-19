# PriceTracker Task List

**Purpose:** Tracks current tasks, backlog, and sub-tasks. Includes a bullet list of active work, milestones, and anything discovered mid-process. To be updated by AI assistants using prompts like: “Update TASK.md to mark XYZ as done and add ABC as a new task.”

## 1. Active Tasks / Next Steps

### Core Features & Enhancements
-   [x] **Products page:** Refine DB integration (currently loads all, capped at 10k).
-   [ ] **Brands Management:** Implement the full feature.
-   [ ] **Insights:** Implement the full feature.
-   [ ] **Settings:** Implement the full feature.
-   [ ] **Admin Section:** Implement the full feature.
-   [ ] **Billing/Payments:** Implement Stripe integration.
-   [ ] **Marketing Pages:** Implement content for the front page (`src/app/(marketing)`).
-   [ ] **Ecommerce Integration:** Implement API imports from e-commerce platforms (e.g., Prestashop) for automatic product/price updates.
-   [ ] **Python Scraper Guide:** Create documentation explaining schema, development, testing, security, and deployment.
-   [ ] **Scraper UI:** Enhance log viewer (currently only shows error row in `scraper_runs`).

### Architecture & Deployment
-   [x] **Implement Worker Architecture:** Implemented separate worker services for Python and TypeScript scrapers as outlined in `docs/architecture/worker-architecture.md`.
-   [ ] **Deployment Process:**
    -   [ ] Set up production Supabase instance.
    -   [ ] Configure Railway deployment with three services (main, Python worker, TypeScript worker).
    -   [ ] Add production environment variables.
    -   [ ] Refine and execute the full deployment process.
-   [ ] **Testing:** Write comprehensive tests (unit, integration, end-to-end).
-   [ ] **Documentation:** Update documentation with more specific details as features are implemented.

## 2. Completed Tasks (Summary)

-   [x] **Project Structure Reorganization:** Migrated from slices to feature-based directories (`/lib/services/`, `/components/[feature]/`).
-   [x] **Database Updates:**
    -   Modified `scraped_products` (nullable `scraper_id`).
    -   Enhanced `record_price_change()` trigger (improved matching, auto-creation).
    -   Added indexes (`products(ean)`, `products(brand, sku)`).
-   [x] **API Route Refactoring:** Removed linking routes, added price history route, updated scraper run route.
-   [x] **API Route Standardization:** Standardized scraper run routes to use consistent naming (`run-test`, `run-full`, `run-history`), removed redundant routes, and created dedicated routes for specific operations.
-   [x] **Scraper Service Enhancements:** Updated `ScrapedProduct` interface, added product matching logic (EAN/Brand+SKU), auto-linking.
-   [x] **Product Service Enhancements:** Removed linking methods, added `ProductWithPrices`, `getProductsWithPrices()`, price history tracking.
-   [x] **UI Component Updates:**
    -   `ProductCard`: Added competitor prices, visual indicators.
    -   `Products List Page`: Added filtering, sorting, inactive toggle, `ProductsFilter` component.
    -   Removed linking buttons/pages.
    -   Added price history visualization (bar chart).
    -   Updated product detail page for competitor prices.
-   [x] **Scraper Performance Metrics & Run History:** Implemented tracking and display of Products/sec and run history.
-   [x] **Scraper Testing & Running Flow Simplification:** Consolidated validation, implemented async UI for test/full runs.
-   [x] **Products Page DB Integration Rework:** Implemented server-side processing, fixed count, addressed API auth, hydration, dynamic params, filter logic, 414 errors, and client/server component issues using Suspense, state management, and a database function.
-   [x] **Worker Architecture Implementation:** Implemented separate worker services for Python and TypeScript scrapers with standardized interfaces.
-   [x] **Core Features (Basic Implementation):** Authentication (Google), Dashboard, Competitors Management, Products Management (basic), Scrapers (manual Python).
-   [x] **Development Processes Defined:** Modular architecture, feature addition process, DB migration process.
-   [x] **Scraper Form UI Cleanup:** Removed duplicate validation buttons, removed unnecessary time input, fixed terminal output display issue, and adjusted button placement in `script-scraper-form.tsx`.
-   [x] **Debugging Scraper Run (Post-Simplification):** Fixed excessive logging in Next.js status API and Python worker, resolved Python logging encoding errors (`UnicodeEncodeError`), and corrected database insert error for `scraped_products` (removed non-existent `scraper_run_id` column).
-   [x] **Code Cleanup and Standardization:** Removed deprecated routes (e.g., `link-scrapers`), standardized on centralized utility functions (e.g., `ensureUUID`), and created dedicated routes for specific operations (e.g., `/api/products/create`).

## 3. Known Issues & Implementation Challenges (Historical Context)

*This section documents past challenges and their solutions for reference.*

-   **Worker Architecture:** Implemented separate worker services for Python and TypeScript scrapers to improve reliability and scalability.
-   **Scraper Standardization:** Standardized the scraper interface to use a consistent command-line approach with product-per-line output to stdout.
-   **Folder Structure:** Renamed folders with parentheses (e.g., `(auth)` to `auth-routes`) to avoid deployment issues.
-   **Row Level Security (RLS):** Resolved issues by using service role key in specific API routes.
-   **Client vs. Server Components:** Refactored to properly separate concerns, often using API routes.
-   **NextAuth.js & Supabase Auth Integration:** Implemented SQL function (`create_user_for_nextauth`) to bridge user tables.
-   **User ID Format Mismatch:** Standardized UUID conversion for consistent user ID handling.