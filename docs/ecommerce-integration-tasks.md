# Tasks: E-commerce Integration Feature (Prestashop Focus)

**Goal:** Implement the E-commerce Integration feature as outlined in `ecommerce-integration-plan.md`.

**Status:** Not Started

## Implementation Steps Checklist

-   [ ] **1. Database Schema:**
    -   [ ] Create migration script (`scripts/migration-XXX-add-integrations.sql`).
    -   [ ] Define `CREATE TABLE` for `integrations`.
    -   [ ] Define `CREATE TABLE` for `integration_runs`.
    -   [ ] Define `ALTER TABLE` for `price_changes` (add `integration_id` column).
    *   [ ] Add necessary indexes to new tables and columns.
    -   [ ] Update `scripts/database-README.md`.
    -   [ ] Apply migration script to the development database.
-   [ ] **2. Backend: Integration Service (`src/lib/services/integration-service.ts`)**
    -   [ ] Implement CRUD functions for `integrations` table.
    -   [ ] Implement API credential validation logic (e.g., test call via client).
    -   [ ] Implement status management logic.
    -   [ ] Implement retrieval of configurations for sync jobs.
    -   [ ] Implement encryption/decryption for `api_key` (if decided).
-   [ ] **3. Backend: API Routes (`src/app/api/integrations/`)**
    -   [ ] Implement `POST /` route (Create).
    -   [ ] Implement `GET /` route (List).
    -   [ ] Implement `GET /{id}` route (Get Details).
    -   [ ] Implement `PUT /{id}` route (Update).
    -   [ ] Implement `DELETE /{id}` route (Delete).
    -   [ ] Implement `POST /{id}/sync` route (Manual Trigger).
    -   [ ] Add authentication and authorization checks to routes.
-   [ ] **4. Backend: Prestashop Client (`src/lib/integrations/prestashop-client.ts`)**
    -   [ ] Implement function to initialize client with API URL and key.
    -   [ ] Implement function to test API connection/credentials.
    -   [ ] Implement function to fetch product list (handle pagination).
    -   [ ] Map relevant Prestashop product fields (name, SKU, EAN, price).
    -   [ ] Implement error handling for API responses.
-   [ ] **5. Backend: Product Service Adaptation (`src/lib/services/product-service.ts`)**
    -   [ ] Modify/add function(s) to handle product matching and updates from integration data.
    -   [ ] Implement logic to update `products.our_price`.
    -   [ ] Implement logic to compare new price with current `products.our_price`.
    -   [ ] Implement logic to record changes in `price_changes` table, populating `integration_id`.
-   [ ] **6. Backend: Sync Service (`src/lib/services/integration-sync-service.ts`)**
    -   [ ] Implement function to orchestrate the sync process for a given integration ID.
    -   [ ] Implement logging start/end/status to `integration_runs`.
    -   [ ] Call `prestashop-client.ts` to fetch data.
    -   [ ] Loop through fetched products, calling `product-service.ts` for updates/creation.
    -   [ ] Aggregate results (processed, updated, created counts).
    -   [ ] Implement error handling and logging to `integration_runs.error_message`.
    -   [ ] Update `integrations.last_sync_at` and `integrations.last_sync_status`.
-   [ ] **7. Frontend: Navigation (`src/components/layout/`)**
    -   [ ] Add "Integrations" link to the main sidebar/navigation.
-   [ ] **8. Frontend: Integration Card Component (`src/components/integrations/IntegrationCard.tsx`)**
    -   [ ] Create component structure.
    -   [ ] Display integration details (logo, name, status, last sync).
    -   [ ] Add Edit/Delete action buttons/links.
    -   [ ] Add optional Trigger Sync button.
-   [ ] **9. Frontend: Integration Form Component (`src/components/integrations/IntegrationForm.tsx`)**
    -   [ ] Create component structure (likely using shadcn Dialog/Form).
    -   [ ] Add form fields (Platform, Name, API URL, API Key).
    -   [ ] Implement form validation.
    -   [ ] Handle form submission (call create/update API).
-   [ ] **10. Frontend: Integrations Page (`src/app/(app)/integrations/page.tsx`)**
    -   [ ] Create page structure.
    -   [ ] Fetch integration list from API.
    -   [ ] Display integrations using `IntegrationCard`.
    -   [ ] Implement "Add Integration" button triggering the `IntegrationForm`.
    -   [ ] Handle loading and error states.
-   [ ] **11. Scheduling:**
    -   [ ] Create API endpoint (`/api/cron/sync-integrations`) to trigger syncs.
    -   [ ] Implement logic in the endpoint to fetch active integrations and trigger `integration-sync-service.ts` (consider async execution via Vercel Queues).
    -   [ ] Define Vercel Cron Job in `vercel.json` targeting the endpoint.
-   [ ] **12. Testing:**
    -   [ ] Write unit tests for services (`integration-service`, `prestashop-client`, `integration-sync-service`).
    -   [ ] Write integration tests for API routes.
    -   [ ] Perform manual end-to-end testing of adding, configuring, and syncing a Prestashop integration.
    -   [ ] Test error handling scenarios.
-   [ ] **13. Documentation:**
    -   [ ] Update main `TASK.md` to reference this task file.
    -   [ ] Update `README.md` with information about the new feature.
    -   [ ] Update `PLANNING.md` if any architectural decisions changed during implementation.
    -   [ ] Ensure `ecommerce-integration-plan.md` and this file are up-to-date.