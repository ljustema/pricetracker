# Database Migrations

This directory contains SQL migrations for the Supabase database.

## How to Apply Migrations

1. Connect to the Supabase database using the SQL Editor in the Supabase Dashboard
2. Copy the contents of the migration file
3. Paste the SQL into the SQL Editor
4. Run the SQL

## Migration Files

- `20250505_update_ai_scraper_workflow.sql`: Comprehensive update for the AI scraper workflow:
  - Empties the `scraper_ai_sessions` table
  - Updates the check constraint for the `current_phase` column to use the new phases
  - Adds comments to document the workflow

## Important Notes

- The `20250505_update_ai_scraper_workflow.sql` migration will **delete all existing scraper AI sessions**. Make sure this is acceptable before running it.
- After applying the migration, the AI scraper workflow will use the new phases: `analysis`, `data-validation`, `assembly`, and `complete`.
- The code has already been updated to use these new phases.
