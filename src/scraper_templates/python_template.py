# -*- coding: utf-8 -*-
"""
Python Scraper Template for PriceTracker

IMPORTANT: Output one JSON object per product, per line (JSONL) to stdout.
This is required for compatibility with the PriceTracker worker and validation system.

This template provides a structure for creating Python-based scrapers
that integrate with the PriceTracker worker system.

The scraper consists of two main functions:
1. get_metadata() - Returns metadata about the scraper
2. scrape() - Performs the scraping and outputs product data

The scraping process is divided into two phases:
- Phase 1: URL Collection - Gathering all product URLs to scrape
- Phase 2: Product Processing - Processing each URL and extracting product data

IMPORTANT: The worker system imports and runs functions separately!
For reliability, define all constants *inside* each function that uses them,
rather than at the global scope. This prevents "name not defined" errors.
"""

import json
import sys # For stderr/stdout
import argparse # For command-line arguments
import traceback # For error reporting
from typing import Dict, List, Any, Optional
# Add necessary imports for your scraper here, e.g.:
# from bs4 import BeautifulSoup
# Note: requests is imported in the fetch_page function

# --- Logging Helper ---
# Use print to stderr for logging, prefixed as required by the worker
def log_progress(message: str, phase: int = None):
    """Prints a progress message to stderr.

    Args:
        message: The progress message to log
        phase: Optional phase number (1 for URL collection, 2 for product processing)
    """
    if phase is not None:
        print(f"PROGRESS: Phase {phase}: {message}", file=sys.stderr, flush=True)
    else:
        print(f"PROGRESS: {message}", file=sys.stderr, flush=True)

def log_error(message: str, exc_info=False):
    """Prints an error message to stderr."""
    print(f"ERROR: {message}", file=sys.stderr, flush=True)
    if exc_info:
        print(traceback.format_exc(), file=sys.stderr, flush=True)

# --- Helper Functions ---
# Define any helper functions needed for fetching, parsing, data extraction, etc.
# Ensure they use log_progress and log_error for output.

def fetch_page(url: str, max_retries: int = 3, timeout: int = 15) -> Optional[str]:
    """Fetches the content of a given URL with retry logic.

    Args:
        url: The URL to fetch
        max_retries: Maximum number of retry attempts
        timeout: Request timeout in seconds

    Returns:
        The page content as string, or None if all fetch attempts failed

    Raises:
        RuntimeError: If critical errors occur and raise_errors=True
    """
    USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    log_progress(f"Fetching URL: {url}")

    # Import requests inside the function to ensure it's available
    try:
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
    except ImportError as e:
        log_error(f"Failed to import required libraries for fetch_page: {e}")
        return None

    # Create a session with retry logic
    session = requests.Session()
    retries = Retry(
        total=max_retries,
        backoff_factor=0.5,  # Exponential backoff
        status_forcelist=[429, 500, 502, 503, 504],  # Retry on these status codes
        allowed_methods=["GET", "POST"]  # Allow retries for these methods
    )
    session.mount('http://', HTTPAdapter(max_retries=retries))
    session.mount('https://', HTTPAdapter(max_retries=retries))

    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
    }

    for attempt in range(max_retries):
        try:
            response = session.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            # Explicitly set encoding to UTF-8 before accessing .text
            response.encoding = 'utf-8'
            log_progress(f"Successfully fetched {url} (attempt {attempt+1}/{max_retries})")
            # Now access response.text, which will use the forced UTF-8 encoding
            return response.text
        except requests.exceptions.Timeout as e:
            log_error(f"Timeout fetching {url} (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return None  # Return None after last retry
        except requests.exceptions.ConnectionError as e:
            log_error(f"Connection error fetching {url} (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return None  # Return None after last retry
        except requests.exceptions.HTTPError as e:
            log_error(f"HTTP error fetching {url} (attempt {attempt+1}/{max_retries}): {e}")
            # Don't retry client errors (4xx) except for 429 (too many requests)
            if 400 <= response.status_code < 500 and response.status_code != 429:
                return None
            if attempt == max_retries - 1:
                return None  # Return None after last retry
        except Exception as e:
            log_error(f"Unexpected error fetching {url} (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return None  # Return None after last retry

    # If we get here, all retries failed
    log_error(f"All {max_retries} attempts to fetch {url} failed")
    return None

# --- Core Scraper Functions ---

def get_metadata() -> Dict[str, Any]:
    """
    Returns metadata about the scraper.
    This helps the system understand the scraper's requirements and behavior.

    Returns:
        Dictionary containing metadata about the scraper
    """
    # IMPORTANT: Only use standard libraries here.
    # Third-party libraries should be imported within the 'scrape' function.
    metadata = {
        "name": "My Python Scraper Template", # CHANGE THIS
        "version": "1.1.0", # CHANGE THIS
        "description": "Description of what this scraper does.", # CHANGE THIS
        "target_url": "https://example.com", # Base URL or main entry point - CHANGE THIS
        "required_libraries": ["requests", "beautifulsoup4", "urllib3"], # List libraries needed by 'scrape' function
        # Add other relevant metadata as needed (e.g., "uses_javascript": true)
    }
    return metadata

def scrape(context: Dict[str, Any]):
    """
    Main scraping function. It should:
    1. Perform the scraping logic (fetching pages, parsing data).
    2. Apply filtering based on the provided context if necessary.
    3. Print one JSON object per valid product found to stdout.
    4. Print progress and error messages to stderr using log_progress() and log_error().
    IMPORTANT: Output one JSON object per product, per line (JSONL).
    """
    log_progress("Scrape function started.")
    log_progress(f"Received context: {context}") # Be careful logging full context if it contains sensitive info

    # --- Import required libraries listed in get_metadata() HERE ---
    try:
        import requests
        from bs4 import BeautifulSoup
        # import other libraries...
    except ImportError as e:
        log_error(f"Failed to import required libraries: {e}. Ensure they are listed in get_metadata().")
        sys.exit(1) # Exit if essential libraries are missing

    # --- Extract context variables ---
    run_id = context.get('run_id', 'N/A')
    is_test_run = context.get('is_test_run', False)
    filter_by_active_brands = context.get('filter_by_active_brands', False)
    active_brand_names = set(context.get('active_brand_names', [])) if filter_by_active_brands else None
    active_brand_ids = set(context.get('active_brand_ids', [])) if filter_by_active_brands else None
    scrape_only_own_products = context.get('scrape_only_own_products', False)
    own_product_eans = set(context.get('own_product_eans', [])) if scrape_only_own_products else None
    own_product_sku_brands = context.get('own_product_sku_brands', []) if scrape_only_own_products else []

    # --- Scraper Implementation ---
    # Replace this example logic with your actual scraping code.

    # Example: Define base URL
    base_url = "https://example.com/products" # Get from metadata or define here
    log_progress(f"Starting scrape for base URL: {base_url}", phase=1)

    # --- PHASE 1: URL Collection ---
    log_progress("Collecting product URLs...", phase=1)

    # Track URLs to avoid duplicates
    product_urls = set()

    # Example: Fetch initial page using our robust fetch_page function
    try:
        initial_html = fetch_page(base_url)
        if not initial_html:
            raise RuntimeError("Failed to fetch initial page - empty response")
    except Exception as e:
        log_error(f"Failed to fetch initial page: {e}")
        sys.exit(1)  # Exit with error code

    # Example: Find product links (replace with actual logic)
    # In a real implementation, you might need to:
    # 1. Parse the initial page to find category links
    # 2. Visit each category page to find product links
    # 3. Handle pagination on category pages

    # IMPORTANT: Always use a set to avoid duplicate URLs
    # This is just a dummy example
    for i in range(1, 25):
        product_url = f"{base_url}/item{i}"
        # Only add if not already in the set
        if product_url not in product_urls:
            product_urls.add(product_url)
            # Report progress during URL collection
            if len(product_urls) % 5 == 0 or len(product_urls) == 24:
                log_progress(f"Collecting URLs: {len(product_urls)} unique URLs found so far...", phase=1)

    # Convert set to list for processing
    product_links = list(product_urls)
    log_progress(f"Found {len(product_links)} unique product URLs.", phase=1)

    # --- PHASE 2: Product Processing ---
    log_progress("Processing product pages...", phase=2)

    if is_test_run:
        log_progress("Test run detected, limiting to 5 products.", phase=2)
        product_links = product_links[:5]

    product_count = 0
    # Get limit from context. None means no limit.
    limit_products = context.get('limit_products')

    total_links = len(product_links)
    for i, link in enumerate(product_links):
        # Apply limit only if it's explicitly set (not None)
        if limit_products is not None and product_count >= limit_products:
            log_progress(f"Reached product limit ({limit_products}), stopping.", phase=2)
            break

        try:
            # Report progress with current/total format
            log_progress(f"Processing product {i+1}/{total_links}: {link}", phase=2)
            # Example: Fetch product page with our robust fetch_page function
            try:
                product_html = fetch_page(link)
                if not product_html:
                    log_progress(f"Skipping product link due to empty response: {link}", phase=2)
                    continue # Skip if fetch returned empty
            except Exception as fetch_error:
                log_error(f"Error fetching product page {link}: {fetch_error}")
                continue # Skip this product and continue with the next

            # Example: Parse product data (replace with actual parsing)
            # soup = BeautifulSoup(product_html, 'html.parser')
            # name = soup.find('h1').text.strip()
            # price_str = soup.find(class_='price').text.strip().replace('$', '').replace(',', '')
            # price = float(price_str)
            # sku = soup.find(class_='sku').text.strip()
            # brand = soup.find(class_='brand').text.strip()
            # ean = soup.find(class_='ean').text.strip()
            # image_url = soup.find('img', class_='product-image')['src']

            # Dummy data for example:
            name = f"Product from {link}"
            price = 9.99 + product_count
            sku = f"SKU_{product_count}"
            brand = "ExampleBrand" if product_count % 2 == 0 else "AnotherBrand"
            ean = f"1234567890{product_count:03d}" if product_count % 3 == 0 else None
            image_url = f"{link}/image.jpg"

            product_data = {
                "name": name,
                "price": price,
                "currency": "USD", # Or detect from page
                "url": link,
                "image_url": image_url,
                "sku": sku,
                "brand": brand,
                "ean": ean,
            }

            # --- Filtering Logic (Optional) ---
            # Example: Filter by active brand
            if filter_by_active_brands and brand not in active_brand_names:
                 log_progress(f"Skipping product (inactive brand): {name} ({brand})")
                 continue

            # Example: Filter by own products (EAN match)
            if scrape_only_own_products:
                is_own_product = False

                # Check EAN match if available
                if ean and ean in own_product_eans:
                    is_own_product = True

                # Check SKU/Brand match
                if not is_own_product:
                    for product_info in own_product_sku_brands:
                        if (product_info.get('sku') == sku and
                            (product_info.get('brand') == brand or
                             product_info.get('brand_id') in active_brand_ids)):
                            is_own_product = True
                            break

                if not is_own_product:
                    log_progress(f"Skipping product (not own product): {name} (SKU: {sku}, Brand: {brand})")
                    continue

            # --- Output Product JSON ---
            # Print the valid product data as a JSON string to stdout
            print(json.dumps(product_data), flush=True)
            product_count += 1

        except requests.exceptions.RequestException as e:
            log_error(f"Network error processing link {link}: {e}", exc_info=True)
            # Continue to the next link
        except Exception as e:
            log_error(f"Unexpected error processing link {link}: {e}", exc_info=True)
            # Continue to the next link, but you could also exit with sys.exit(1) for critical errors

    log_progress(f"Processed {total_links} links, found {product_count} valid products.", phase=2)
    log_progress(f"Scrape finished successfully.")

    # If we didn't find any products, that's an error condition
    if product_count == 0:
        log_error("No products were found during the scrape.")
        sys.exit(1)  # Exit with error code


# --- Main Execution Block ---
if __name__ == '__main__':
    try: # Add top-level exception handler
        parser = argparse.ArgumentParser(description='PriceTracker Python Scraper')
        parser.add_argument('command', choices=['metadata', 'scrape'], help='Command to execute')
        parser.add_argument('--context', type=str, help='JSON string containing execution context for scrape command')
        parser.add_argument('--validate', action='store_true', help='Run in validation mode')
        parser.add_argument('--limit-urls', type=int, default=10, help='Limit number of URLs to process in validation mode')
        parser.add_argument('--limit-products', type=int, default=10, help='Limit number of products to return in validation mode')

        args = parser.parse_args()

        if args.command == 'metadata':
            try:
                metadata = get_metadata()
                print(json.dumps(metadata), flush=True)
            except Exception as e:
                log_error(f"Error generating metadata: {e}", exc_info=True)
                sys.exit(1)
        elif args.command == 'scrape':
            if not args.context:
                log_error("Missing --context argument for scrape command")
                sys.exit(1)
            try:
                context_data = json.loads(args.context)
                # Add validation flags if present
                if args.validate:
                    context_data['is_validation'] = True
                    context_data['limit_urls'] = args.limit_urls
                    context_data['limit_products'] = args.limit_products
                scrape(context_data)
            except json.JSONDecodeError as e:
                 log_error(f"Failed to decode context JSON: {e}")
                 sys.exit(1)
            except Exception as e:
                log_error(f"Unhandled error during scrape execution: {e}", exc_info=True)
                sys.exit(1)
    except Exception as main_exception:
        # Catch any unexpected errors at the top level
        log_error(f"Unhandled top-level error in script: {main_exception}", exc_info=True)
        sys.exit(1)