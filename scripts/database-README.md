# Database Setup Instructions

This directory contains scripts for setting up and managing the PriceTracker database in Supabase.

## Database Setup Structure

The database setup is organized into multiple, ordered scripts located in the `db_setup/` subdirectory. These scripts are comprehensive and include all necessary tables, functions, triggers, and policies for the application to work correctly. All previous migrations have been consolidated into these main setup scripts.

**Scripts:**

0.  **`db_setup/00_extensions.sql`**: Sets up all required PostgreSQL extensions (pg_cron, pgsodium, pg_graphql, etc.) and related event triggers.
1.  **`db_setup/01_next_auth_schema.sql`**: Sets up the `next_auth` schema required by NextAuth.js (tables, grants, helper function).
2.  **`db_setup/02_public_tables.sql`**: Creates all application-specific tables (`user_profiles`, `products`, `competitors`, `scrapers`, `temp_competitors_scraped_data`, `price_changes`, `scraper_runs`, `brands`, `brand_aliases`, `integrations`, `integration_runs`, `temp_integrations_scraped_data`, etc.) in the `public` schema, along with necessary indexes and comments.
3.  **`db_setup/03_public_rls.sql`**: Applies Row Level Security (RLS) policies to the tables in the `public` schema to ensure users can only access their own data.
4.  **`db_setup/04_public_functions_triggers.sql`**: Creates database functions and triggers used by the application (e.g., `create_profile_for_user`, `record_price_change`, `get_products_filtered`, `cleanup_temp_competitors_scraped_data`, `process_pending_integration_products`).
5.  **`db_setup/05_public_jobs.sql`**: Schedules a daily job using `pg_cron` to run the `cleanup_temp_competitors_scraped_data` function and sets up error handling for worker processes. **Requires the `pg_cron` extension to be enabled in your Supabase project.**
6.  **`db_setup/06_other.sql`**: Contains other database objects including schemas, types, and default privileges that don't fit into the categories above.

**Execution Order:**

It is crucial to run these scripts **in numerical order** (00 through 06 in `db_setup/`) to ensure dependencies are met (e.g., extensions are created before tables, tables exist before RLS is applied, functions exist before jobs are scheduled).

**How to Run:**

1.  Log in to your Supabase dashboard.
2.  Select your project.
3.  Navigate to the SQL Editor.
4.  For each script from `00` to `06`:
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
    PERFORM cron.unschedule('cleanup_temp_competitors_scraped_data_job');
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

After running the reset script, you will need to run the setup scripts (`db_setup/00` through `06`) again in order.

## Generating Database Setup Files

The database setup files can be generated from an existing Supabase instance using the `dump_and_split.bat` script. This script:

1. Uses `pg_dump` to create a schema-only dump of your Supabase database
2. Runs the `split_schema.py` Python script to split the dump into logical sections

To use this script:

1. Ensure you have PostgreSQL installed locally (for pg_dump)
2. Update the connection details in `dump_and_split.bat` if needed
3. Run the script from the command line:
   ```
   dump_and_split.bat
   ```

The script will create the following files in the `db_setup/` directory:
- `00_extensions.sql` - PostgreSQL extensions
- `01_next_auth_schema.sql` - Next Auth schema and related objects
- `02_public_tables.sql` - Public schema tables and sequences
- `03_public_rls.sql` - Row Level Security policies
- `04_public_functions_triggers.sql` - Functions and triggers
- `05_public_jobs.sql` - Job-related objects
- `06_other.sql` - Other database objects

## Type Generation

After making changes to the database schema, you should regenerate the TypeScript type definitions using the Supabase CLI:

```bash
supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/supabase/database.types.ts
```

This ensures that your application code has up-to-date type definitions that match your database schema.