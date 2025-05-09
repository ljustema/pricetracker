/**
 * Script to apply the database migration to fix the progress_messages type mismatch
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the migration SQL file
const migrationPath = path.join(__dirname, '../../../scripts/db_migrations/fix_progress_messages_type.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

async function applyMigration() {
  console.log('Applying database migration to fix progress_messages type mismatch...');
  
  try {
    const { error } = await supabase.rpc('pgmigrate', { query: migrationSql });
    
    if (error) {
      console.error('Error applying migration:', error);
      // Try direct query as fallback
      console.log('Trying direct query as fallback...');
      const { error: directError } = await supabase.from('_pgmigrate').select('*').limit(1);
      
      if (directError) {
        console.error('Error with direct query:', directError);
        
        // Final fallback: Try database/query endpoint
        console.log('Trying database/query endpoint as final fallback...');
        const { error: queryError } = await supabase.rpc('pg_query', { query: migrationSql });
        
        if (queryError) {
          console.error('Error with database/query endpoint:', queryError);
          console.error('Migration failed. Please apply the migration manually.');
          process.exit(1);
        } else {
          console.log('Migration applied successfully using database/query endpoint!');
        }
      } else {
        console.error('Migration failed. Please apply the migration manually.');
        process.exit(1);
      }
    } else {
      console.log('Migration applied successfully!');
    }
  } catch (err) {
    console.error('Exception during migration:', err);
    process.exit(1);
  }
}

applyMigration().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
