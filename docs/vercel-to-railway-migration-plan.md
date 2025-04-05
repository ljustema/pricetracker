# Migration Plan: Vercel to Railway

**Goal:** Migrate the Pricetracker application deployment from Vercel to Railway to resolve issues with running Crawlee scrapers within Vercel's serverless function limitations.

**Rationale:** Vercel's serverless environment appears incompatible with Crawlee's storage initialization, causing errors. Railway's persistent service environment is expected to provide a more suitable runtime for the combined Next.js application and embedded Crawlee scrapers.

**Key Decisions:**
*   Focus on migrating the application and getting Crawlee scrapers working reliably first.
*   Do **not** re-introduce Python scraper support initially; stick to the goal of unifying on TypeScript/Crawlee.
*   Defer file structure refactoring until after the application is stable on Railway.

---

## Phase 1: Initial Deployment & Core Functionality on Railway

1.  **Railway Setup:**
    *   Create a Railway account and project.
    *   Link the GitHub repository (`pricetracker`) to the Railway project.
    *   Configure automatic deployments from the `main` branch (or a dedicated deployment branch).
2.  **Service Configuration:**
    *   Let Railway detect the Next.js application.
    *   Verify/Set Build Command: `npm run build`
    *   Verify/Set Start Command: `npm start`
    *   **Crucially:** Add all required environment variables from your Vercel project (Supabase URL/keys, NextAuth secrets, database URL, etc.) to Railway's environment variable settings. Ensure these are identical.
3.  **Initial Deployment:**
    *   Trigger the first deployment on Railway.
    *   Monitor build logs closely for any dependency installation issues (both npm and potentially any lingering Python build steps if not fully cleaned). Address any build failures.
4.  **Basic Testing:**
    *   Access the deployed application using the Railway-provided URL (`*.up.railway.app`).
    *   Test core Next.js functionality: page navigation, authentication, basic API interactions (e.g., listing scrapers/competitors).
    *   Verify connection to Supabase is working.

## Phase 2: Crawlee Scraper Testing on Railway

5.  **Run Test Scraper (Crawlee):**
    *   Navigate to the "Test Run" page for the NorrmalmsEl Crawlee scraper.
    *   Initiate the test run.
    *   Monitor Railway application logs in real-time.
    *   **Expected Outcome:** The test run should now complete successfully without the storage initialization (`bind`) error, and the frontend should reflect the success/failure status correctly (including specific error messages if it fails for other reasons).
6.  **Run Full Scraper (Crawlee):**
    *   Initiate a full run for the NorrmalmsEl Crawlee scraper.
    *   Monitor logs and database (`scraper_runs` table) for progress and completion status.
    *   **Expected Outcome:** The full run should complete successfully within Railway's potentially more generous execution limits.
7.  **Troubleshooting (If Needed):** If scrapers still fail, analyze the Railway logs for new errors. The environment is different, so new issues might arise, but the previous storage error should be gone.

## Phase 3: Domain & Cleanup

8.  **Domain Configuration:**
    *   Once satisfied with stability and functionality, update your DNS records to point your custom domain (`www.pricetracker.se`) to the Railway service.
9.  **Final Vercel Cleanup (Post-Migration):**
    *   Remove any remaining Python-related files/configurations from the codebase (`requirements.txt`, old API routes if any were missed).
    *   Commit these cleanup changes.
10. **Decommission Vercel Project:** Delete the project from Vercel to avoid confusion and potential costs.

## Phase 4: Post-Migration Refinements (Optional but Recommended)

11. **File Structure Refactoring:**
    *   Create a new branch (e.g., `refactor/file-structure`).
    *   Use `git mv` to rename folders back to your preferred structure (with parentheses).
    *   Perform a codebase-wide search and replace for import paths that need updating due to the renaming.
    *   Test the application thoroughly locally after refactoring.
    *   Deploy this branch to a Railway preview environment (if available) or merge carefully to main after testing.
12. **Complete Crawlee Migration:** Continue migrating any remaining Python scrapers to Crawlee as per the original `crawlee-migration-tasks.md`.

---

## Diagram

```mermaid
graph TD
    A[Setup Railway Project & Link Repo] --> B(Configure Build/Start Commands & Env Vars);
    B --> C{Deploy to Railway};
    C --> D{Test Core App Functionality};
    D -- Success --> E{Test Crawlee Scraper (Test Run)};
    D -- Failure --> C;
    E -- Success --> F{Test Crawlee Scraper (Full Run)};
    E -- Failure --> G(Analyze Logs & Debug);
    F -- Success --> H(Configure Custom Domain);
    F -- Failure --> G;
    G --> E;
    H --> I(Final Code Cleanup - Remove Python remnants);
    I --> J(Decommission Vercel Project);
    J --> K((Migration Complete));
    K --> L{Refactor File Structure?};
    K --> M{Migrate Remaining Scrapers?};
    L -- Yes --> N(Refactor & Test);
    N --> K;
    M -- Yes --> O(Implement & Test);
    O --> K;

    subgraph Phase 1: Initial Deployment
        A; B; C; D;
    end

    subgraph Phase 2: Scraper Testing
        E; F; G;
    end

    subgraph Phase 3: Domain & Cleanup
        H; I; J;
    end

     subgraph Phase 4: Post-Migration
        L; M; N; O;
    end