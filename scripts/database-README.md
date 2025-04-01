# Database Setup Instructions

This directory contains scripts for setting up the PriceTracker database in Supabase.

## Setting up the database

1. Log in to your Supabase dashboard at https://app.supabase.com/
2. Select your project (the one with the URL: https://adctclbumozqgwkepipl.supabase.co)
3. Navigate to the SQL Editor (in the left sidebar)
4. Create a new query
5. Copy the contents of `complete-setup.sql` and paste it into the SQL Editor
6. Run the query

This will:
1. Create all necessary tables with proper relationships
2. Set up Row Level Security (RLS) policies for data protection
3. Create triggers for automatic actions (like recording price changes)
4. Insert some sample data for testing

## Important Notes

- The sample data uses a placeholder user ID (`00000000-0000-0000-0000-000000000000`). After you create your first user through the application, you should update this to use your actual user ID.

- You can find your user ID by:
  1. Logging into the application
  2. Going to the Supabase dashboard
  3. Navigating to Authentication > Users
  4. Finding your user and copying the UUID

- If you want to reset the database, you can run the following SQL in the SQL Editor:

```sql
DROP TABLE IF EXISTS price_changes CASCADE;
DROP TABLE IF EXISTS scraped_products CASCADE;
DROP TABLE IF EXISTS scrapers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS competitors CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

DROP FUNCTION IF EXISTS create_profile_for_user CASCADE;
DROP FUNCTION IF EXISTS record_price_change CASCADE;
```

Then run the setup script again.