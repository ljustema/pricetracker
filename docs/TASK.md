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
-   [ ] **Migrate Scraper Execution to Vercel Queues:** Implement the plan outlined in `PLANNING.md` and `docs/future/vercel-queues-migration.md`.
-   [ ] **Deployment Process:**
    -   [ ] Set up production Supabase instance.
    -   [ ] Configure Vercel deployment (or other provider).
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
-   [x] **Scraper Service Enhancements:** Updated `ScrapedProduct` interface, added product matching logic (EAN/Brand+SKU), auto-linking.
-   [x] **Product Service Enhancements:** Removed linking methods, added `ProductWithPrices`, `getProductsWithPrices()`, price history tracking.
-   [x] **UI Component Updates:**
    -   `ProductCard`: Added competitor prices, visual indicators.
    -   `Products List Page`: Added filtering, sorting, inactive toggle, `ProductsFilter` component.
    -   Removed linking buttons/pages.
    -   Added price history visualization (bar chart).
    -   Updated product detail page for competitor prices.
-   [x] **Scraper Performance Metrics & Run History:** Implemented tracking and display of Products/sec and run history (see `docs/done_tasks/scraper-enhancement-plan.md`).
-   [x] **Scraper Testing & Running Flow Simplification:** Consolidated validation, implemented async UI for test/full runs (see `docs/done_tasks/test-run-final-plan.md`).
-   [x] **Products Page DB Integration Rework:** Implemented server-side processing, fixed count, addressed API auth, hydration, dynamic params, filter logic, 414 errors, and client/server component issues using Suspense, state management, and a database function (see `docs/done_tasks/products-page-db-integration-summary.md`).
-   [x] **Bright123 Scraper Validation Debugging:** Resolved timeout issue by fixing Python stdout flushing and Node.js stream handling (see `docs/done_tasks/bright123-validation-debug-summary.md`).
-   [x] **Core Features (Basic Implementation):** Authentication (Google), Dashboard, Competitors Management, Products Management (basic), Scrapers (manual Python).
-   [x] **Development Processes Defined:** Modular architecture, feature addition process, DB migration process.

## 3. Known Issues & Implementation Challenges (Historical Context)

*This section documents past challenges and their solutions for reference.*

-   **Vercel Deployment:** Addressed TypeScript compatibility issues (`ignoreBuildErrors`) and potential issues with parenthesis in folder names (see `docs/vercel-deployment-fixes.md`).
-   **Row Level Security (RLS):** Resolved issues by using service role key in specific API routes.
-   **Client vs. Server Components:** Refactored to properly separate concerns, often using API routes.
-   **NextAuth.js & Supabase Auth Integration:** Implemented SQL function (`create_user_for_nextauth`) to bridge user tables.
-   **User ID Format Mismatch:** Standardized UUID conversion for consistent user ID handling.