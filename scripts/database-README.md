# Database Setup Instructions

This directory contains scripts for setting up and managing the PriceTracker database in Supabase.

## Database Setup Structure

The database setup is organized into multiple, ordered scripts located in the `db_setup/` subdirectory. These scripts are comprehensive and include all necessary tables, functions, triggers, and policies for the application to work correctly. All previous migrations have been consolidated into these main setup scripts.

**Scripts:**

1.  **`db_setup/01_next_auth_schema.sql`**: Sets up the `next_auth` schema required by NextAuth.js (tables, grants, helper function).
2.  **`db_setup/02_public_tables.sql`**: Creates all application-specific tables (`user_profiles`, `products`, `competitors`, `scrapers`, `scraped_products`, `price_changes`, `scraper_runs`, `brands`, `brand_aliases`, `integrations`, `integration_runs`, `staged_integration_products`, etc.) in the `public` schema, along with necessary indexes and comments.
3.  **`db_setup/03_public_rls.sql`**: Applies Row Level Security (RLS) policies to the tables in the `public` schema to ensure users can only access their own data.
4.  **`db_setup/04_public_functions_triggers.sql`**: Creates database functions and triggers used by the application (e.g., `create_profile_for_user`, `record_price_change`, `get_products_filtered`, `cleanup_scraped_products`, `process_staged_integration_products`).
5.  **`db_setup/05_public_jobs.sql`**: Schedules a daily job using `pg_cron` to run the `cleanup_scraped_products` function and sets up error handling for worker processes. **Requires the `pg_cron` extension to be enabled in your Supabase project.**

**Execution Order:**

It is crucial to run these scripts **in numerical order** (01 through 05 in `db_setup/`) to ensure dependencies are met (e.g., tables exist before RLS is applied, functions exist before jobs are scheduled).

**How to Run:**

1.  Log in to your Supabase dashboard.
2.  Select your project.
3.  Navigate to the SQL Editor.
4.  For each script from `01` to `05`:
    *   Create a new query.
    *   Copy the contents of the corresponding `.sql` file from the `db_setup/` directory.
    *   Paste the content into the SQL Editor.
    *   Run the query.
    *   Wait for it to complete successfully before proceeding to the next script.

## Worker Error Handling

The database includes automatic error handling for worker processes:

1. **Timeout Handling**: Jobs that remain in 'pending' status for more than 5 minutes are automatically marked as failed.

2. **Automatic Retry**: Jobs that fail with a 'fetch failed' error are automatically retried up to 3 times within an hour.

3. **Scheduled Cleanup**: A cron job runs every minute to check for and handle worker timeouts.

## Resetting the Database

If you need to completely reset the application's database structure (e.g., for a fresh start), you can run the following SQL in the Supabase SQL Editor. **Warning: This will delete all data in these schemas.**

```sql
-- Unscheduling the cron jobs if they exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_scraped_products_job');
    PERFORM cron.unschedule('worker_timeout_handler');
  END IF;
END $$;

-- Drop public schema objects (tables, functions, triggers will be dropped via CASCADE)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO service_role;

-- Drop next_auth schema objects
DROP SCHEMA next_auth CASCADE;

-- Recreate the schemas if needed (or run the setup scripts again)
-- CREATE SCHEMA next_auth;
-- GRANT USAGE ON SCHEMA next_auth TO service_role;
-- GRANT ALL ON SCHEMA next_auth TO postgres;
```

After running the reset script, you will need to run the setup scripts (`db_setup/01` through `05`) again in order.

## Type Generation

After making changes to the database schema, you should regenerate the TypeScript type definitions using the Supabase CLI:

```bash
supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/supabase/database.types.ts
```

This ensures that your application code has up-to-date type definitions that match your database schema.