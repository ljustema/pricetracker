# bright123_scraper.py (Modified with Delayed Imports)

# --- Minimal Top-Level Imports ---
import json
import sys
import math # Keep math if needed globally, otherwise move
from typing import Dict, List, Optional, Any, Generator, Callable

# --- Constants ---
BASE_URL = "https://www.bright123.se"
SITEMAP_URL = "https://www.bright123.se/sv/sitemap-articles-1.xml"
CONCURRENCY_LIMIT = 200
REQUEST_TIMEOUT = 30
RETRY_ATTEMPTS = 3
DEFAULT_BATCH_SIZE = 200

# Configuration Placeholders
COMPETITOR_ID = "{{competitor_id}}"
USER_ID = "{{user_id}}"

# --- Metadata Function (No external imports needed) ---
def get_metadata() -> Dict[str, Any]:
    """
    Return metadata about this scraper.
    """
    return {
        "name": "Bright123.se Scraper",
        "description": "Scrapes product data from bright123.se using the sitemap, processing in batches.",
        "version": "1.1.0", # Increment version for delayed imports fix
        "author": "Roo (Adapted)",
        "target_url": BASE_URL,
        "required_libraries": [
            "aiohttp",
            "aiohttp-retry",
            "selectolax"
        ]
    }

# --- Parsing Functions (Imports moved inside) ---
def parse_price(price_text):
    """Extracts and cleans the price from text."""
    import re # Moved import
    if not price_text: return None
    price_text = price_text.replace('kr', '').replace('\xa0', '').strip()
    cleaned_price = re.sub(r'[^\d,\.]', '', price_text)
    cleaned_price = cleaned_price.replace(',', '.')
    if cleaned_price.count('.') > 1:
        parts = cleaned_price.split('.')
        cleaned_price = "".join(parts[:-1]) + "." + parts[-1]
    try:
        if not cleaned_price: return None
        return float(cleaned_price)
    except ValueError:
        print(f"PROGRESS: Warning - Could not parse price from cleaned string: '{cleaned_price}' (original: '{price_text}')", file=sys.stderr)
        return None

def parse_product_details(html_content, product_url):
    """Parses detailed information from a single product page's HTML using selectolax."""
    from selectolax.parser import HTMLParser # Moved import
    from urllib.parse import urljoin # Moved import

    tree = HTMLParser(html_content)
    product = {'url': product_url}
    try:
        name_node = tree.css_first('h1 span[itemprop="name"]')
        product['name'] = name_node.text(strip=True) if name_node else None

        price_content = None
        price_container = tree.css_first('div.priceContainer')
        if price_container:
            discount_price_container = price_container.css_first('span.discountPrice')
            regular_price_container = price_container.css_first('span.price')
            if discount_price_container:
                discount_itemprop_node = discount_price_container.css_first('span[itemprop="price"]')
                if discount_itemprop_node and 'content' in discount_itemprop_node.attributes:
                    try: price_content = float(discount_itemprop_node.attributes.get('content'))
                    except (ValueError, TypeError): price_content = parse_price(discount_itemprop_node.text(strip=True))
                else: price_content = parse_price(discount_price_container.text(strip=True))
            elif regular_price_container:
                regular_itemprop_node = regular_price_container.css_first('span[itemprop="price"]')
                if regular_itemprop_node and 'content' in regular_itemprop_node.attributes:
                    try: price_content = float(regular_itemprop_node.attributes.get('content'))
                    except (ValueError, TypeError): price_content = parse_price(regular_itemprop_node.text(strip=True))
                else: price_content = parse_price(regular_price_container.text(strip=True))
        product['price'] = price_content

        brand_node = tree.css_first('h1 span.trademark a')
        product['brand'] = brand_node.text(strip=True) if brand_node else None

        img_node = tree.css_first('div.articleImage img[itemprop="image"]')
        product['image_url'] = urljoin(BASE_URL, img_node.attributes.get('src')) if img_node and 'src' in img_node.attributes else None

        product['ean'] = None
        product['sku'] = None
        attribute_table = tree.css_first('table.attributes')
        if attribute_table:
            rows = attribute_table.css('tr')
            for row in rows:
                cells = row.css('td')
                if len(cells) == 2:
                    title = cells[0].text(strip=True)
                    value = cells[1].text(strip=True)
                    if title == 'EAN-kod': product['ean'] = value
                    elif title == 'Leverantörens artikelnummer': product['sku'] = value

        product['currency'] = 'SEK'

        if product.get('name') and product.get('price') is not None:
             return product
        else:
             print(f"PROGRESS: Skipping product - missing essential info (name or price): {product_url}", file=sys.stderr)
             return None
    except Exception as e:
        print(f"PROGRESS: Error parsing product details for {product_url}: {e}", file=sys.stderr)
        return None

# --- Async Fetching (Imports moved inside) ---
async def fetch_async(url, session):
    """Asynchronously fetches the content (HTML or XML) of a given URL."""
    import asyncio # Moved import
    import aiohttp # Moved import

    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    try:
        async with session.get(url, headers=headers, timeout=REQUEST_TIMEOUT) as response:
            response.raise_for_status()
            return await response.text()
    except asyncio.TimeoutError:
        print(f"PROGRESS: Timeout fetching {url}", file=sys.stderr)
        return None
    except aiohttp.ClientError as e:
        print(f"PROGRESS: Error fetching {url}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"PROGRESS: Unexpected error fetching {url}: {e}", file=sys.stderr)
        return None

async def scrape_product_details_async(url, session, semaphore):
    """Fetches and parses details for a single product URL concurrently."""
    import asyncio # Moved import

    async with semaphore:
        html = await fetch_async(url, session)
        if not html:
            return None

        loop = asyncio.get_running_loop()
        try:
            details = await loop.run_in_executor(None, parse_product_details, html, url)
            return details
        except Exception as e:
             print(f"PROGRESS: Error during parsing executor for {url}: {e}", file=sys.stderr)
             return None

def extract_urls_from_sitemap(xml_content):
    """Extracts URLs from sitemap XML content."""
    import xml.etree.ElementTree as ET # Moved import
    urls = []
    try:
        root = ET.fromstring(xml_content)
        namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        for url_element in root.findall('ns:url', namespace):
            loc_element = url_element.find('ns:loc', namespace)
            if loc_element is not None and loc_element.text:
                urls.append(loc_element.text.strip())
    except ET.ParseError as e:
        print(f"PROGRESS: Error parsing sitemap XML: {e}", file=sys.stderr)
    except Exception as e:
        print(f"PROGRESS: Unexpected error extracting URLs from sitemap: {e}", file=sys.stderr)
    return urls

# --- Formatting and Filtering Helper ---
def _format_and_filter_batch(raw_batch: List[Optional[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Formats and filters a raw batch of products according to template requirements."""
    valid_batch = []
    if not raw_batch:
        return valid_batch

    for product in raw_batch:
        if not product:
            continue
        if not product.get("name") or product.get("price") is None:
            print(f"PROGRESS: Skipping product post-fetch due to missing name or price: {product.get('url', 'N/A')}", file=sys.stderr)
            continue
        try:
            product["price"] = float(product["price"])
        except (ValueError, TypeError):
             print(f"PROGRESS: Skipping product post-fetch due to invalid price type: {product.get('name', 'N/A')} ({product.get('price')})", file=sys.stderr)
             continue

        has_ean = bool(product.get("ean"))
        has_brand_sku = bool(product.get("brand")) and bool(product.get("sku"))

        if has_ean or has_brand_sku:
            formatted_product = {
                "name": product.get("name"),
                "price": product.get("price"),
                "currency": product.get("currency", "SEK"),
                "url": product.get("url"),
                "image_url": product.get("image_url"),
                "sku": product.get("sku"),
                "brand": product.get("brand"),
                "ean": product.get("ean"),
            }
            valid_batch.append(formatted_product)
        else:
            print(f"PROGRESS: Skipping product post-fetch due to insufficient identification (EAN or Brand+SKU): {product.get('name', 'N/A')}", file=sys.stderr)

    return valid_batch

# --- Core Async Scraping Logic (Helper Function) ---
async def _async_scraper_logic(batch_callback: Callable[[List[Dict[str, Any]]], None]):
    """Handles the asynchronous fetching and processing, calling batch_callback with valid batches."""
    # Imports needed for this async function
    import asyncio
    import time
    import datetime
    import aiohttp
    from aiohttp_retry import RetryClient, ExponentialRetry

    overall_start_time = time.time()
    all_product_urls = []
    concurrency = CONCURRENCY_LIMIT
    batch_size = DEFAULT_BATCH_SIZE
    print(f"PROGRESS: Starting scrape. Concurrency={concurrency}, Batch Size={batch_size}", file=sys.stderr)
    semaphore = asyncio.Semaphore(concurrency)

    print("PROGRESS: --- Phase 1: Fetching and Parsing Sitemap ---", file=sys.stderr)
    retry_options = ExponentialRetry(attempts=RETRY_ATTEMPTS)
    async with RetryClient(raise_for_status=False, retry_options=retry_options) as sitemap_session:
        sitemap_xml = await fetch_async(SITEMAP_URL, sitemap_session) # fetch_async handles its own imports now
        if sitemap_xml:
            all_product_urls = extract_urls_from_sitemap(sitemap_xml) # extract_urls handles its own imports
            print(f"PROGRESS: Extracted {len(all_product_urls)} product URLs from sitemap.", file=sys.stderr)
        else:
            print("PROGRESS: Failed to fetch or parse sitemap. Exiting.", file=sys.stderr)
            return

    if not all_product_urls:
        print("PROGRESS: No product URLs found in sitemap. Exiting.", file=sys.stderr)
        return

    urls_to_process = all_product_urls
    total_urls_to_process = len(urls_to_process)
    total_batches_estimated = math.ceil(total_urls_to_process / batch_size)

    if total_urls_to_process == 0:
        print("PROGRESS: No URLs left to process. Exiting.", file=sys.stderr)
        return

    print(f"PROGRESS: --- Phase 2: Scraping Product Details ({total_urls_to_process} URLs in ~{total_batches_estimated} batches) ---", file=sys.stderr)

    total_processed_count = 0
    total_valid_yielded_count = 0
    batch_num = 0

    for i in range(0, total_urls_to_process, batch_size):
        batch_urls = urls_to_process[i:min(i + batch_size, total_urls_to_process)]
        batch_num += 1
        current_batch_start_index = i + 1
        current_batch_end_index = i + len(batch_urls)

        async with RetryClient(raise_for_status=False, retry_options=retry_options) as session:
            batch_start_time = time.time()
            print(f"\nPROGRESS: Starting Batch {batch_num}/{total_batches_estimated} (URLs {current_batch_start_index}-{current_batch_end_index}/{total_urls_to_process})", file=sys.stderr)

            raw_batch_details = []
            # scrape_product_details_async handles its own imports
            tasks = [scrape_product_details_async(url, session, semaphore) for url in batch_urls]

            batch_processed_in_task_loop = 0
            for future in asyncio.as_completed(tasks):
                details = await future
                raw_batch_details.append(details)
                total_processed_count += 1
                batch_processed_in_task_loop += 1
                print(f"PROGRESS: Batch {batch_num}: Processed {batch_processed_in_task_loop}/{len(batch_urls)} | Overall: {total_processed_count}/{total_urls_to_process}", end='\r', file=sys.stderr)

            print(file=sys.stderr)

            print(f"PROGRESS: Batch {batch_num}: Filtering and formatting {len(raw_batch_details)} raw results...", file=sys.stderr)
            valid_formatted_batch = _format_and_filter_batch(raw_batch_details)
            batch_valid_count = len(valid_formatted_batch)
            total_valid_yielded_count += batch_valid_count

            batch_end_time = time.time()
            batch_duration = batch_end_time - batch_start_time
            batch_speed = batch_valid_count / batch_duration if batch_duration > 0 else 0

            print(f"PROGRESS: --- Batch {batch_num}/{total_batches_estimated} Summary ---", file=sys.stderr)
            print(f"PROGRESS:   Fetched/Parsed Raw: {len(raw_batch_details)}/{len(batch_urls)}", file=sys.stderr)
            print(f"PROGRESS:   Valid & Formatted: {batch_valid_count}", file=sys.stderr)
            print(f"PROGRESS:   Time taken: {datetime.timedelta(seconds=batch_duration)}", file=sys.stderr)
            print(f"PROGRESS:   Speed (valid products): {batch_speed:.2f} products/second", file=sys.stderr)

            if valid_formatted_batch:
                print(f"PROGRESS: Batch {batch_num}: Calling callback with {batch_valid_count} valid products.", file=sys.stderr)
                try:
                    batch_callback(valid_formatted_batch)
                except Exception as cb_err:
                     print(f"PROGRESS: Error during batch_callback execution: {cb_err}", file=sys.stderr)
            else:
                 print(f"PROGRESS: Batch {batch_num}: No valid products found in this batch to yield.", file=sys.stderr)

    overall_end_time = time.time()
    total_time_overall = overall_end_time - overall_start_time

    print("\nPROGRESS: --- Overall Scraping Summary ---", file=sys.stderr)
    print(f"PROGRESS: Total URLs processed: {total_processed_count}/{total_urls_to_process}", file=sys.stderr)
    print(f"PROGRESS: Total valid products yielded: {total_valid_yielded_count}", file=sys.stderr)
    print(f"PROGRESS: Total time taken: {datetime.timedelta(seconds=total_time_overall)}", file=sys.stderr)
    if total_valid_yielded_count > 0 and total_time_overall > 0:
        overall_speed = total_valid_yielded_count / total_time_overall
        print(f"PROGRESS: Average overall speed: {overall_speed:.2f} products/second", file=sys.stderr)
    print("PROGRESS: Async scrape logic finished.", file=sys.stderr)

# --- Main Scraping Function (Generator - Imports moved inside) ---
def scrape() -> Generator[List[Dict[str, Any]], None, None]:
    """
    Main scraping function - processes and yields products in batches.
    This runs the async logic and yields the results collected via callback.
    """
    import asyncio # Moved import

    print("PROGRESS: Synchronous scrape() function started.", file=sys.stderr)
    collected_batches = []
    batch_counter_scrape = 0 # Add counter here

    def _batch_collector_callback(batch: List[Dict[str, Any]]):
        nonlocal batch_counter_scrape # Allow modification of outer scope variable
        print(f"PROGRESS: Callback received batch of size {len(batch)}", file=sys.stderr)
        if batch: # Only print and append if batch is not empty
             collected_batches.append(batch)
             batch_counter_scrape += 1
             # --- Print actual JSON batch ---
             try:
                 print(json.dumps(batch), flush=True)
             except TypeError as json_err:
                  print(f"PROGRESS: Error serializing batch to JSON in callback: {json_err}. Batch content snippet: {str(batch)[:200]}...", file=sys.stderr)
             # --- END Print actual JSON batch ---
        else:
             print("PROGRESS: Callback received empty batch, not printing or appending.", file=sys.stderr)

    print("PROGRESS: Starting asyncio.run(_async_scraper_logic)...", file=sys.stderr)
    try:
        # _async_scraper_logic handles its own imports now
        asyncio.run(_async_scraper_logic(batch_callback=_batch_collector_callback))
        print("PROGRESS: asyncio.run(_async_scraper_logic) completed.", file=sys.stderr)
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            print("PROGRESS: Detected running event loop. Attempting manual loop management.", file=sys.stderr)
            loop = asyncio.get_event_loop()
            if loop.is_running():
                 print("PROGRESS: Error - Cannot run nested asyncio loops easily without further adaptation.", file=sys.stderr)
                 raise RuntimeError("Cannot run nested asyncio event loops in this context.") from e
            else:
                 loop.run_until_complete(_async_scraper_logic(batch_callback=_batch_collector_callback))
                 print("PROGRESS: Manual loop execution completed.", file=sys.stderr)
        else:
             print(f"PROGRESS: Error running async scraper logic: {e}", file=sys.stderr)
             raise e
    except Exception as e:
         print(f"PROGRESS: Error running async scraper logic: {e}", file=sys.stderr)
         raise e

    print(f"PROGRESS: Yielding {len(collected_batches)} collected batches.", file=sys.stderr)
    if not collected_batches:
         print("PROGRESS: No batches were collected by the async logic.", file=sys.stderr)

    yield from collected_batches
    print("PROGRESS: Synchronous scrape() function finished.", file=sys.stderr)

# --- Standard Execution Block (No external imports needed here) ---
if __name__ == "__main__":
    try:
        # Attempt to reconfigure stdout/stderr for UTF-8
        # This might fail in some environments, but the wrapper script should handle it
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for environments where reconfigure might not be available
        print("PROGRESS: sys.stdout/stderr.reconfigure not available. Relying on wrapper/environment for UTF-8.", file=sys.stderr)
        pass # Continue execution

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "metadata":
            try:
                metadata = get_metadata()
                print(json.dumps(metadata))
            except Exception as e:
                # Ensure error message is also JSON for consistency
                print(json.dumps({"error": f"Error getting metadata: {str(e)}"}), file=sys.stderr)
                sys.exit(1)
        elif command == "scrape":
            try:
                batch_count_main = 0 # Keep a separate counter for yielded batches if needed for logging
                # scrape() handles its own imports now and prints internally
                for batch in scrape():
                    if batch:
                         batch_count_main += 1
                         # No printing needed here anymore
                         pass # Just consume the generator
                    else:
                        # This case might not happen now if callback filters empty batches
                        print("PROGRESS: Warning - scrape() yielded an empty or None batch in main loop.", file=sys.stderr)

                # Update final log message source
                batch_count = batch_count_main # Use the count from the main loop iteration

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
