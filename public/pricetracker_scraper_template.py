# pricetracker_scraper_template.py (Updated with Comments)

"""
PriceTracker Python Scraper Template (Batch Processing Version)

This template provides the structure for creating custom Python scrapers
for the PriceTracker application that process and yield products in batches.
Implement the required functions below.
"""

# --- Minimal Top-Level Imports ---
# Only import standard libraries needed globally or for type hints here.
import json
import sys
import math
from typing import Dict, List, Optional, Any, Generator

# IMPORTANT: Delay Imports for Required Libraries
# Any libraries listed in get_metadata()["required_libraries"] MUST be imported
# *inside* the functions that use them (e.g., within scrape() or helper functions).
# This is because the validation process runs get_metadata() *before* installing
# these libraries. Top-level imports of required libraries will cause validation to fail.
# Example:
# def scrape():
#     import requests
#     import beautifulsoup4
#     # ... rest of your scraping logic ...

# Configuration (will be populated by the system)
COMPETITOR_ID = "{{competitor_id}}"
USER_ID = "{{user_id}}"

def get_metadata() -> Dict[str, Any]:
    """
    Return metadata about this scraper.

    This function is required and will be called when the scraper is uploaded
    or validated. Ensure it does not rely on any external libraries listed
    in 'required_libraries'.
    """
    return {
        "name": "My Custom Batch Scraper",  # Change this to your scraper name
        "description": "Scrapes product data from example.com in batches",  # Brief description
        "version": "1.2.0", # Updated version reflecting delayed import guidance
        "author": "Your Name",
        "target_url": "https://example.com/products",  # The main URL this scraper targets
        "required_libraries": [  # List any third-party libraries your scraper needs
            "requests",          # These MUST be imported inside functions, not at the top level.
            "beautifulsoup4"
        ]
    }

def scrape() -> Generator[List[Dict[str, Any]], None, None]:
    """
    Main scraping function - processes and yields products in batches.

    Implement your scraping logic here. Remember to import any libraries
    listed in get_metadata()["required_libraries"] *inside* this function
    or any helper functions it calls.

    Yields:
        A list of dictionaries, each representing a scraped product batch.
        Each product dictionary should have the following fields:
        - name (required): Product name
        - price (required): Product price as a float
        - currency (optional): Currency code (default: USD)
        - url (optional): URL to the product page
        - image_url (optional): URL to the product image
        - sku (optional): Product SKU/code from the competitor
        - brand (optional): Product brand
        - ean (optional): Product EAN/barcode

    Note: Each product must have either an EAN or both Brand and SKU for matching.
    Products without sufficient identification will be ignored during filtering.

    Progress Reporting:
    Print progress updates to stderr using the format:
    "PROGRESS: Batch X/Y processed, Z products found."
    """
    # --- Implement your scraping logic here ---

    # Example: If using requests and beautifulsoup4, import them here:
    # try:
    #     import requests
    #     from bs4 import BeautifulSoup
    # except ImportError as e:
    #     print(f"PROGRESS: Error importing required libraries: {e}. Ensure they are listed in get_metadata().", file=sys.stderr)
    #     # Optionally raise the error or yield an empty list/error structure
    #     return # Stop execution if imports fail

    # Example: Simulate fetching a large list of product data
    print("PROGRESS: Starting scrape...", file=sys.stderr) # Initial progress message
    all_potential_products = [
        {
            "name": f"Example Product {i+1}",
            "price": round(10.0 + i * 1.5, 2),
            "currency": "USD",
            "url": f"https://example.com/product{i+1}",
            "image_url": f"https://example.com/images/product{i+1}.jpg",
            "sku": f"PROD{i+1:03}",
            "brand": "Example Brand",
            "ean": f"1234567890{i+1:03}" if i % 2 == 0 else None # Mix valid/invalid EANs
        } for i in range(55) # Simulate 55 potential products
    ]
    all_potential_products.append({ # Add one product missing brand/sku but with EAN
         "name": "EAN Only Product", "price": 99.99, "ean": "9876543210987"
    })
    all_potential_products.append({ # Add one product missing EAN and SKU
         "name": "Invalid Product", "price": 5.00, "brand": "Example Brand"
    })

    batch_size = 10 # Process 10 products at a time
    total_products = len(all_potential_products)
    total_batches = math.ceil(total_products / batch_size)
    products_yielded_count = 0

    print(f"PROGRESS: Found {total_products} potential products. Processing in {total_batches} batches of size {batch_size}.", file=sys.stderr)

    for i in range(0, total_products, batch_size):
        current_batch_num = (i // batch_size) + 1
        raw_batch = all_potential_products[i:i + batch_size]
        print(f"PROGRESS: Processing raw batch {current_batch_num}/{total_batches} ({len(raw_batch)} items)...", file=sys.stderr)

        # Filter out products without sufficient identification within the batch
        valid_batch = []
        for product in raw_batch:
            # Check for required fields first
            if not product.get("name") or product.get("price") is None:
                 print(f"PROGRESS: Skipping product due to missing name or price: {product.get('name', 'N/A')}", file=sys.stderr)
                 continue
            # Check identification
            if product.get("ean") or (product.get("brand") and product.get("sku")):
                valid_batch.append(product)
            else:
                 print(f"PROGRESS: Skipping product due to insufficient identification: {product.get('name', 'N/A')}", file=sys.stderr)


        if valid_batch:
            products_yielded_count += len(valid_batch)
            print(f"PROGRESS: Batch {current_batch_num}/{total_batches} processed, yielding {len(valid_batch)} valid products.", file=sys.stderr)
            # Print the valid batch directly to stdout
            try:
                print(json.dumps(valid_batch), flush=True)
            except TypeError as json_err:
                 print(f"PROGRESS: Error serializing batch to JSON before printing: {json_err}. Batch content snippet: {str(valid_batch)[:200]}...", file=sys.stderr)
            # yield None # No longer need to yield the batch itself
        else:
            print(f"PROGRESS: Batch {current_batch_num}/{total_batches} processed, no valid products found to yield.", file=sys.stderr)

    print(f"PROGRESS: Scrape finished. Total valid products yielded: {products_yielded_count}", file=sys.stderr)
    # --- End of implementation ---


# Don't modify this section - it's used by the application to run the scraper
if __name__ == "__main__":
    # Ensure stdout and stderr are UTF-8 encoded
    try:
        # Attempt to reconfigure stdout/stderr for UTF-8
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for environments where reconfigure might not be available
        print("PROGRESS: sys.stdout/stderr.reconfigure not available. Relying on wrapper/environment for UTF-8.", file=sys.stderr)
        pass # Continue execution

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "metadata":
            # Return metadata about this scraper
            try:
                metadata = get_metadata()
                print(json.dumps(metadata))
            except Exception as e:
                print(json.dumps({"error": f"Error getting metadata: {str(e)}"}), file=sys.stderr)
                sys.exit(1)
        elif command == "scrape":
            # Run the main scrape function and print each yielded batch
            try:
                batch_count = 0
                # Remember: scrape() or its helpers must handle internal imports
                # for libraries listed in get_metadata()["required_libraries"]
                # Iterate through scrape() to execute it. Printing now happens inside scrape().
                # We still need to consume the generator.
                for _ in scrape():
                     # We don't expect scrape() to yield anything meaningful now,
                     # but we iterate to drive its execution.
                     # We can increment the count here based on iteration if needed for logging,
                     # but the actual batch printing is handled inside scrape().
                     batch_count += 1 # Increment based on iterations (assumes scrape yields once per processed batch print)
                     pass

                # Note: The batch_count here might not perfectly reflect the number
                # of *successfully printed* batches if scrape() encounters serialization errors,
                # but it reflects the number of times the print logic was reached.

                if batch_count == 0:
                     print("PROGRESS: Main scrape function finished but yielded zero non-empty batches.", file=sys.stderr)
                else:
                     print(f"PROGRESS: Main scrape function finished, yielded {batch_count} batches.", file=sys.stderr)

            except Exception as e:
                 # Ensure error message is also JSON for consistency
                error_payload = {"error": f"Error during scraping: {str(e)}"}
                try:
                    # Attempt to include traceback if possible
                    import traceback
                    error_payload["traceback"] = traceback.format_exc()
                except ImportError:
                    pass # Cannot import traceback
                except Exception:
                    pass # Ignore errors during traceback formatting

                print(json.dumps(error_payload), file=sys.stderr)
                sys.exit(1) # Exit with error code if scrape fails
        else:
            print(json.dumps({"error": f"Invalid command: {command}. Expected 'metadata' or 'scrape'."}), file=sys.stderr)
            sys.exit(1)
    else:
        print(json.dumps({"error": "No command provided (expected 'metadata' or 'scrape')"}), file=sys.stderr)
        sys.exit(1)