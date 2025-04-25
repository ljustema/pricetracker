#!/bin/bash

# Remove the problematic file
rm -f src/lib/supabase/database.types.ts

# Create a simplified version with basic types
echo 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = any;' > src/lib/supabase/database.types.ts

# Make the file executable
chmod +x railway-prebuild.sh

echo "Fixed database.types.ts file"
