#!/bin/bash
# Force rebuild script for Railway

# Print current directory and files for debugging
echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la

# Print the content of requirements.txt
echo "Current requirements.txt content:"
cat requirements.txt

# Add timestamp to force rebuild
echo "# Force rebuild timestamp: $(date)" >> requirements.txt

# Install dependencies with no cache
pip install --no-cache-dir --upgrade pip
pip install --no-cache-dir -r requirements.txt

# List installed packages for verification
echo "Installed Python packages:"
pip list

# Exit with success
exit 0
