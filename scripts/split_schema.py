import sys
import os
import re
from datetime import datetime

def add_header(filename):
    """Create a header for SQL files with timestamp and description"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    descriptions = {
        "01_next_auth_schema.sql": "Next Auth schema and related objects",
        "02_public_tables.sql": "Public schema tables and sequences",
        "03_public_rls.sql": "Row Level Security policies",
        "04_public_functions_triggers.sql": "Functions and triggers",
        "05_public_jobs.sql": "Job-related objects",
        "00_extensions.sql": "PostgreSQL extensions",
        "06_other.sql": "Other database objects"
    }

    description = descriptions.get(os.path.basename(filename), "Database objects")

    return f"""-- =========================================================================
-- {description}
-- =========================================================================
-- Generated: {now}
-- This file is part of the PriceTracker database setup
-- =========================================================================

"""

# Get input file from command line arguments
input_file = sys.argv[1]
output_dir = os.path.dirname(input_file)

# Read the entire SQL dump
with open(input_file, "r", encoding="utf-8") as f:
    content = f.read()

# Initialize sections with headers
sections = {
    "00_extensions.sql": add_header("00_extensions.sql"),
    "01_next_auth_schema.sql": add_header("01_next_auth_schema.sql"),
    "02_public_tables.sql": add_header("02_public_tables.sql"),
    "03_public_rls.sql": add_header("03_public_rls.sql"),
    "04_public_functions_triggers.sql": add_header("04_public_functions_triggers.sql"),
    "05_public_jobs.sql": add_header("05_public_jobs.sql"),
    "06_other.sql": add_header("06_other.sql")
}

# Split content by statement (each ending with semicolon)
# This regex handles multi-line statements
statements = re.split(r';\s*\n', content)

# Process each statement and add to appropriate section
for statement in statements:
    statement = statement.strip()
    if not statement:
        continue

    # Add semicolon back to the end of each statement
    statement += ";\n\n"

    # Determine which file this statement belongs to
    statement_lower = statement.lower()

    # Extensions
    if "create extension" in statement_lower or "comment on extension" in statement_lower:
        sections["00_extensions.sql"] += statement

    # Next Auth schema
    elif "schema next_auth" in statement_lower or "next_auth." in statement_lower:
        sections["01_next_auth_schema.sql"] += statement

    # Tables and sequences
    elif (re.search(r'create\s+table', statement_lower) or
          "alter table" in statement_lower or
          "create sequence" in statement_lower or
          "alter sequence" in statement_lower or
          "comment on table" in statement_lower or
          "comment on column" in statement_lower):
        sections["02_public_tables.sql"] += statement

    # RLS policies
    elif ("policy" in statement_lower or
          "enable row level security" in statement_lower or
          "force row level security" in statement_lower):
        sections["03_public_rls.sql"] += statement

    # Functions and triggers
    elif ("create function" in statement_lower or
          "create or replace function" in statement_lower or
          "create trigger" in statement_lower or
          "comment on function" in statement_lower or
          "comment on trigger" in statement_lower):
        sections["04_public_functions_triggers.sql"] += statement

    # Jobs
    elif "job" in statement_lower:
        sections["05_public_jobs.sql"] += statement

    # Everything else
    else:
        sections["06_other.sql"] += statement

# Write the files
for filename, content in sections.items():
    # Skip empty sections (just containing the header)
    if content.count('\n') <= 5:
        print(f"Skipping empty section: {filename}")
        continue

    output_path = os.path.join(output_dir, filename)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created: {filename}")

print("Split completed successfully.")
