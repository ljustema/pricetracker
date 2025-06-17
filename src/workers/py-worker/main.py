# pricetracker/src/workers/py-worker/main.py

import os
import time
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import traceback
import subprocess # Added for subprocess execution
import tempfile # Added for temporary script files

import psycopg2
import psycopg2.extras # For dictionary cursor
# import requests # No longer needed directly by worker
from dotenv import load_dotenv
import hashlib

# --- Configuration & Setup ---
load_dotenv() # Load environment variables from .env file

DATABASE_URL = os.getenv("DATABASE_URL")
WORKER_POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", 30)) # Seconds - Increased to 30 for better stability
WORKER_ID = f"py-worker-{os.getpid()}" # Basic worker identifier
SCRIPT_TIMEOUT_SECONDS = 7200 # Timeout for scraper script execution (2 hours)
DB_BATCH_SIZE = 100 # How many products to buffer before saving to DB

# --- Logging Setup ---
# Configure structured logging according to the plan
log_formatter = logging.Formatter('{"ts": "%(asctime)s", "lvl": "%(levelname)s", "phase": "%(phase)s", "run_id": "%(run_id)s", "msg": "%(message)s"}', defaults={'phase': 'UNKNOWN', 'run_id': 'N/A'})

# Console handler - Specify UTF-8 encoding
log_handler = logging.StreamHandler(sys.stdout)
log_handler.setFormatter(log_formatter)
log_handler.setLevel(logging.INFO) # Only show INFO and above on console
log_handler.encoding = 'utf-8' # Explicitly set encoding

# File handler for detailed logs
# Use the project root logs directory instead of src/logs
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'logs')
if not os.path.exists(log_dir):
    os.makedirs(log_dir)
# File handler - Specify UTF-8 encoding
file_handler = logging.FileHandler(os.path.join(log_dir, f'py-worker-{datetime.now().strftime("%Y-%m-%d")}.log'), encoding='utf-8')
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.DEBUG) # Keep DEBUG level for file logs

logger = logging.getLogger("PythonWorker")
logger.setLevel(logging.DEBUG)  # Set to DEBUG for more detailed logs
logger.addHandler(log_handler)
logger.addHandler(file_handler)
logger.propagate = False # Prevent duplicate logging if root logger is configured

# --- Database Utilities ---

def get_db_connection():
    """Establishes a connection to the PostgreSQL database with proper SSL and timeout configuration."""
    if not DATABASE_URL:
        # Use logger directly instead of log_event before logger might be fully configured
        logger.critical("DATABASE_URL environment variable not set.")
        raise ValueError("DATABASE_URL environment variable not set.")

    # Connection parameters for better stability with Supabase
    connection_params = {
        'dsn': DATABASE_URL,
        'connect_timeout': 30,  # 30 second connection timeout
        'keepalives_idle': 600,  # Start keepalives after 10 minutes of inactivity
        'keepalives_interval': 30,  # Send keepalive every 30 seconds
        'keepalives_count': 3,  # Drop connection after 3 failed keepalives
        'application_name': f'py-worker-{os.getpid()}',  # Help identify connections in logs
    }

    # Add SSL configuration for Supabase
    if 'supabase' in DATABASE_URL.lower():
        connection_params['sslmode'] = 'require'

    max_retries = 5  # Increased from 3 to 5
    retry_delay = 1

    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(**connection_params)
            # Test the connection with a simple query
            with conn.cursor() as test_cur:
                test_cur.execute("SELECT 1")
                test_cur.fetchone()
            return conn
        except psycopg2.OperationalError as e:
            if attempt < max_retries - 1:
                # Use extra parameter to ensure phase is present
                logger.warning(f"Database connection attempt {attempt + 1} failed: {e}. Retrying in {retry_delay} seconds...", 
                              extra={'phase': 'DB_CONNECTION', 'run_id': 'N/A'})
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.critical(f"Database connection failed after {max_retries} attempts: {e}", 
                               extra={'phase': 'DB_CONNECTION', 'run_id': 'N/A'})
                raise
        except psycopg2.Error as e:
            logger.critical(f"Database connection error: {e}", 
                           extra={'phase': 'DB_CONNECTION', 'run_id': 'N/A'})
            raise

def validate_and_reconnect_if_needed(conn):
    """
    Validates a database connection and reconnects if necessary.
    Returns a valid connection or raises an exception if unable to connect.
    """
    if conn is None:
        return get_db_connection()

    try:
        # Check if connection is closed
        if conn.closed:
            logger.info("Connection is closed, getting new connection", 
                       extra={'phase': 'DB_CONNECTION', 'run_id': 'N/A'})
            return get_db_connection()

        # Test the connection with a simple query
        with conn.cursor() as test_cur:
            test_cur.execute("SELECT 1")
            test_cur.fetchone()

        return conn  # Connection is valid
    except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
        # Connection is broken, get a new one
        logger.warning(f"Database connection validation failed: {e}. Getting new connection.", 
                      extra={'phase': 'DB_CONNECTION', 'run_id': 'N/A'})
        try:
            conn.close()
        except Exception:
            pass  # Ignore errors when closing broken connection
        return get_db_connection()
    except Exception as e:
        # For any other error, try to get a new connection
        logger.warning(f"Unexpected error validating connection: {e}. Getting new connection.", 
                      extra={'phase': 'DB_CONNECTION', 'run_id': 'N/A'})
        try:
            conn.close()
        except Exception:
            pass
        return get_db_connection()

def log_event(level: str, phase: str, run_id: Optional[str], message: str, data: Optional[Dict] = None):
    """Logs messages in the structured format."""
    extra = {'phase': phase, 'run_id': run_id or 'N/A'}
    # Basic escaping for JSON compatibility within the message string
    escaped_message = message.replace('"', '\\"').replace('\n', '\\n')
    log_entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "lvl": level.upper(),
        "phase": phase,
        "msg": escaped_message,
    }
    if data:
        log_entry["data"] = data # Assuming data is JSON serializable

    # Log to logger handlers (console, file)
    log_level = getattr(logging, level.upper(), logging.INFO)
    # Skip routine job search logs to reduce log volume in console/file
    if not (phase == "JOB_SEARCH" and level.upper() == "INFO" and ("No pending" in message or "Searching for" in message or "Executing SQL" in message)):
         logger.log(log_level, escaped_message, extra=extra)

    # Append to database progress_messages (if run_id is available)
    # --- Removed Database Log Appending ---
    # Reason: Appending every log message to the progress_messages array caused
    #         database timeouts ("canceling statement due to statement timeout")
    #         preventing the final job status update from committing.
    #         Logs are still available in the console (INFO+) and file (DEBUG+).
    # if run_id:
    #     db_conn_log = None
    #     try:
    #         # Use a separate connection for logging to avoid interfering with main transaction
    #         db_conn_log = get_db_connection()
    #         with db_conn_log.cursor() as cur:
    #             # Use JSONB for progress messages if possible, otherwise TEXT[]
    #             # Assuming TEXT[] based on previous code
    #             cur.execute(
    #                 """
    #                 UPDATE scraper_runs
    #                 SET progress_messages = array_append(
    #                     COALESCE(progress_messages, ARRAY[]::text[]),
    #                     %s
    #                 )
    #                 WHERE id = %s
    #                 """,
    #                 (json.dumps(log_entry), run_id)
    #             )
    #             db_conn_log.commit()
    #     except Exception as e:
    #         # Log failure to append to DB only to console/file to avoid loops
    #         logger.error(f"[LogAppendError] Failed to append log to DB for run {run_id}: {str(e)}", extra=extra)
    #         if db_conn_log:
    #             try:
    #                 db_conn_log.rollback()
    #             except Exception: pass # Ignore rollback errors
    #     finally:
    #         if db_conn_log:
    #             try:
    #                 db_conn_log.close()
    #             except Exception: pass # Ignore close errors

# --- Job Search & Claim ---

def find_and_claim_job(conn):
    """
    Finds a pending Python scraper job and attempts to claim it atomically.
    Returns the job details if successful, otherwise None.
    """
    # Validate and reconnect if needed
    try:
        conn = validate_and_reconnect_if_needed(conn)
    except Exception as e:
        log_event("ERROR", "DB_CONNECTION", None, f"Failed to establish database connection: {str(e)}")
        return None # Cannot proceed

    # Add retry logic for job search
    max_retries = 3  # Increased from 2 to 3 for more resilience
    retry_count = 0

    while retry_count <= max_retries:
        try:
            log_event("INFO", "JOB_SEARCH", None, "Searching for pending Python scraper jobs...")
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # Query to find pending or initializing jobs for Python scrapers
                # Modified to prioritize jobs that have been waiting longer
                sql_query = """
                    SELECT sr.id, sr.scraper_id, sr.user_id, sr.is_test_run, s.competitor_id, sr.created_at
                    FROM scraper_runs sr
                    INNER JOIN scrapers s ON sr.scraper_id = s.id
                    WHERE sr.status IN ('pending', 'initializing')
                    AND (s.scraper_type = 'python' OR s.scraper_type IS NULL) -- Also handle NULL type initially
                    ORDER BY
                        CASE WHEN sr.status = 'initializing' THEN 0 ELSE 1 END, -- Prioritize 'initializing' jobs
                        sr.created_at ASC                                       -- Then oldest jobs first
                    LIMIT 1;
                """
                cur.execute(sql_query)
                job = cur.fetchone()

                if not job:
                    log_event("INFO", "JOB_SEARCH", None, "No pending Python scraper jobs found.")
                    return None

                # Calculate how long the job has been waiting
                if job['created_at']:
                    wait_time = datetime.now(timezone.utc) - job['created_at'].replace(tzinfo=timezone.utc)
                    wait_seconds = wait_time.total_seconds()
                    log_event("INFO", "JOB_SEARCH", None,
                             f"Found pending job: {job['id']} for scraper {job['scraper_id']} (waiting for {wait_seconds:.1f} seconds)")
                else:
                    log_event("INFO", "JOB_SEARCH", None,
                             f"Found pending job: {job['id']} for scraper {job['scraper_id']} (created_at timestamp missing)")

                # Use advisory lock for atomic claiming
                lock_key = int(hashlib.md5(job['id'].encode()).hexdigest(), 16) % 2147483647
                cur.execute("SELECT pg_try_advisory_xact_lock(%s)", (lock_key,))
                lock_acquired = cur.fetchone()[0]

                if not lock_acquired:
                    log_event("INFO", "JOB_CLAIM", None, f"Could not acquire lock for job {job['id']}, another worker may be claiming it.")
                    conn.rollback() # Release transaction context
                    # Short sleep to avoid tight loop on lock contention
                    time.sleep(0.5)
                    return None

                # Re-verify status before claiming (important with advisory lock)
                cur.execute("SELECT status FROM scraper_runs WHERE id = %s FOR UPDATE", (job['id'],))
                current_status = cur.fetchone()
                if not current_status or (current_status['status'] != 'pending' and current_status['status'] != 'initializing'):
                     log_event("INFO", "JOB_CLAIM", job['id'], f"Job status changed to '{current_status['status'] if current_status else 'unknown'}' before claim could be finalized.")
                     conn.rollback()
                     return None

                # Attempt to claim the job and clear any info messages
                claim_sql = """
                    UPDATE scraper_runs
                    SET status = 'running',
                        started_at = NOW(),
                        claimed_by_worker_at = NOW(),
                        error_message = NULL
                    WHERE id = %s AND status IN ('pending', 'initializing')
                    RETURNING id;
                """
                cur.execute(claim_sql, (job['id'],))
                claimed = cur.fetchone()

                if claimed:
                    log_event("INFO", "JOB_CLAIM", job['id'], f"Successfully claimed job {job['id']}")
                    # Update error message to indicate the job was picked up by the worker
                    # This helps distinguish between "never picked up" and "failed during execution"
                    update_sql = """
                        UPDATE scraper_runs
                        SET error_message = NULL
                        WHERE id = %s;
                    """
                    cur.execute(update_sql, (job['id'],))
                    conn.commit() # Commit the claim
                    return job # Return the job details
                else:
                    # This case should be rare with the advisory lock + re-verify, but handle defensively
                    log_event("WARN", "JOB_CLAIM", job['id'], "Failed to claim job after acquiring lock (status might have changed unexpectedly).")
                    conn.rollback()
                    return None

            # If we get here, we've either returned a job or None, so break the retry loop
            break

        except psycopg2.Error as db_err:
            log_event("ERROR", "JOB_SEARCH", None, f"Database error during job search/claim (attempt {retry_count+1}/{max_retries}): {db_err}")
            try: conn.rollback() # Rollback on error
            except Exception: pass
            retry_count += 1
            if retry_count <= max_retries:
                log_event("INFO", "JOB_SEARCH", None, "Retrying job search after DB error...")
                time.sleep(1)
                # Ensure connection is still valid
                try:
                    conn = validate_and_reconnect_if_needed(conn)
                except Exception as reconn_err:
                    log_event("ERROR", "DB_CONNECTION", None, f"Failed to reconnect after DB error: {reconn_err}")
                    return None # Cannot continue without DB
            else:
                log_event("ERROR", "JOB_SEARCH", None, f"Exhausted retries after DB error: {traceback.format_exc()}")
                return None
        except Exception as e:
            log_event("ERROR", "JOB_SEARCH", None, f"Unexpected error during job search/claim (attempt {retry_count+1}/{max_retries}): {e}")
            try: conn.rollback()
            except Exception: pass
            retry_count += 1
            if retry_count <= max_retries:
                 log_event("INFO", "JOB_SEARCH", None, "Retrying job search after unexpected error...")
                 time.sleep(1)
                 # Ensure connection is still valid
                 try:
                     conn = validate_and_reconnect_if_needed(conn)
                 except Exception as reconn_err:
                     log_event("ERROR", "DB_CONNECTION", None, f"Failed to reconnect after error: {reconn_err}")
                     return None # Cannot continue without DB
            else:
                 log_event("ERROR", "JOB_SEARCH", None, f"Exhausted retries after unexpected error: {traceback.format_exc()}")
                 return None

    # If loop finishes without returning, means retries exhausted
    return None


def fetch_scraper_details(conn, scraper_id: str) -> Optional[Dict[str, Any]]:
    """Fetches scraper script and configuration with retries."""
    max_retries = 2
    retry_count = 0
    while retry_count <= max_retries:
        try:
            conn = validate_and_reconnect_if_needed(conn) # Ensure connection
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    """
                    SELECT python_script, filter_by_active_brands, scrape_only_own_products
                    FROM scrapers
                    WHERE id = %s;
                    """,
                    (scraper_id,)
                )
                scraper_data = cur.fetchone()
                if not scraper_data:
                    log_event("ERROR", "SETUP", None, f"Scraper with ID {scraper_id} not found.")
                    return None
                if not scraper_data['python_script']:
                     log_event("ERROR", "SETUP", None, f"Scraper {scraper_id} has no Python script.")
                     return None
                return dict(scraper_data) # Success
        except psycopg2.Error as db_err:
            log_event("WARN", "DB_OPERATION", None, f"DB error fetching scraper {scraper_id} (attempt {retry_count+1}/{max_retries}): {db_err}")
            try: conn.rollback()
            except Exception: pass
            retry_count += 1
            if retry_count <= max_retries:
                time.sleep(1)
                try: # Try to ensure connection for next retry
                    conn = validate_and_reconnect_if_needed(conn)
                except Exception:
                    log_event("ERROR", "DB_CONNECTION", None, "Failed to reconnect during fetch retry.")
                    return None # Cannot continue
            else:
                 log_event("ERROR", "DB_OPERATION", None, f"Failed to fetch scraper {scraper_id} after {max_retries+1} attempts.")
                 return None
        except Exception as e:
             log_event("ERROR", "DB_OPERATION", None, f"Unexpected error fetching scraper {scraper_id}: {e}")
             return None # Don't retry on unexpected errors
    return None # Should not be reached if retries exhausted properly


def update_job_status(conn, run_id: str, status: str, error_message: Optional[str] = None,
                      error_details: Optional[str] = None, product_count: Optional[int] = None,
                      execution_time_ms: Optional[int] = None, products_per_second: Optional[float] = None,
                      current_batch: Optional[int] = None, total_batches: Optional[int] = None):
    """
    Update the status and other details of a scraper run job in the database.
    Handles connection checks internally.
    """
    new_connection = False
    cursor = None
    try:
        # Ensure connection is valid
        conn = validate_and_reconnect_if_needed(conn)
        if new_connection is False:  # Only set to True if we created a new connection
            new_connection = False

        # Start building the SQL update query
        update_fields = ["status = %s"]
        params = [status]

        # Add optional fields if they are provided
        if error_message is not None:
            update_fields.append("error_message = %s")
            # Truncate error message if too long for DB column
            params.append(error_message[:1000]) # Example limit, adjust based on schema
        if product_count is not None:
            update_fields.append("product_count = %s")
            params.append(product_count)
        if current_batch is not None:
            update_fields.append("current_batch = %s")
            params.append(current_batch)
        if total_batches is not None:
            update_fields.append("total_batches = %s")
            params.append(total_batches)
        if execution_time_ms is not None:
            update_fields.append("execution_time_ms = %s")
            params.append(execution_time_ms)
        if products_per_second is not None:
            update_fields.append("products_per_second = %s")
            params.append(products_per_second)

        # If status is 'completed' or 'failed', set completed_at
        if status in ['completed', 'failed']:
            update_fields.append("completed_at = NOW()")

        # Store detailed error information in progress_messages if provided
        if error_details is not None:
            # Truncate error details if needed
            truncated_details = error_details[:4000] # Example limit
            error_log_entry = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "type": "error_details", # Distinguish from regular logs
                "details": truncated_details
            }
            error_log_entry_str = json.dumps(error_log_entry)
            update_fields.append("progress_messages = array_append(COALESCE(progress_messages, ARRAY[]::text[]), %s)")
            params.append(error_log_entry_str)

        # Finalize the SQL query
        sql = f"""
            UPDATE scraper_runs
            SET {", ".join(update_fields)}
            WHERE id = %s
        """
        params.append(run_id)

        # Execute the query
        cursor = conn.cursor()
        log_event("DEBUG", "DB_QUERY", run_id, f"Executing SQL: {sql} with params: {params}")
        cursor.execute(sql, params)
        conn.commit()

        log_event("INFO", "JOB_STATUS_UPDATE", run_id, f"Updated job status to {status}")
        return True
    except Exception as e:
        log_event("ERROR", "JOB_STATUS_UPDATE", run_id, f"Failed to update job status: {str(e)}")
        try:
            if conn and not conn.closed: conn.rollback()
        except Exception as rollback_error:
            log_event("ERROR", "DB_ROLLBACK", run_id, f"Failed to rollback transaction: {str(rollback_error)}")
        return False
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        # Only close the connection if we created it specifically for this update
        if new_connection and conn:
            try: conn.close()
            except Exception: pass


# --- Product Saving ---

def save_temp_competitors_scraped_data(conn, run_id: str, user_id: str, competitor_id: str, products: List[Dict[str, Any]]) -> int:
    """
    Saves a list of scraped products to the database with batching and retries.
    Relies on DB trigger 'record_price_change' for product matching and price change recording.
    Returns the number of successfully inserted products.
    """
    if not products:
        return 0

    log_event("DEBUG", "DB_INSERT", run_id, f"Attempting to save {len(products)} products...")

    products_to_insert = []
    for p in products:
        # Basic validation/defaults before insertion
        if not isinstance(p, dict) or not p.get('name') or p.get('competitor_price') is None:
             log_event("WARN", "DB_INSERT_PREP", run_id, f"Skipping invalid product data structure: {str(p)[:100]}")
             continue
        try:
            # Ensure price is a valid number
            price = float(p['competitor_price'])
        except (ValueError, TypeError):
             log_event("WARN", "DB_INSERT_PREP", run_id, f"Skipping product with invalid price '{p.get('competitor_price')}': {p.get('name')}")
             continue

        # Extract raw_data if present
        raw_data = p.get('raw_data')
        raw_data_json = json.dumps(raw_data) if raw_data else None

        products_to_insert.append((
            user_id,
            # run_id, # Removed: scraper_run_id column does not exist in temp_competitors_scraped_data
            competitor_id,
            p.get('name'),
            price,
            (p.get('currency_code', p.get('currency', 'SEK'))).upper(), # Support both currency_code and currency, ensure uppercase
            p.get('url'),
            p.get('image_url'),
            p.get('sku'),
            p.get('brand'),
            p.get('ean'),
            raw_data_json, # Include raw_data as JSON
            datetime.now(timezone.utc) # scraped_at timestamp
        ))

    if not products_to_insert:
        log_event("WARN", "DB_INSERT", run_id, "No valid products found to insert after filtering/validation.")
        return 0

    # Use DB_BATCH_SIZE defined globally
    MAX_RETRIES = 3
    RETRY_DELAY_S = 1
    inserted_count = 0
    total_to_insert = len(products_to_insert)

    try: # Wrap the loop in a try block to handle potential connection issues
        conn = validate_and_reconnect_if_needed(conn) # Ensure connection

        with conn.cursor() as cur:
            for i in range(0, total_to_insert, DB_BATCH_SIZE):
                chunk = products_to_insert[i:i + DB_BATCH_SIZE]
                chunk_number = (i // DB_BATCH_SIZE) + 1
                attempt = 0
                success = False

                while attempt < MAX_RETRIES and not success:
                    attempt += 1
                    try:
                        log_event("DEBUG", "DB_INSERT", run_id, f"Attempt {attempt}/{MAX_RETRIES} inserting chunk {chunk_number} ({len(chunk)} products)...")
                        # Use execute_values for efficient batch insertion
                        sql = """
                            INSERT INTO temp_competitors_scraped_data (
                                user_id, competitor_id, name, competitor_price, currency_code,
                                url, image_url, sku, brand, ean, raw_data, scraped_at
                            ) VALUES %s
                        """
                        psycopg2.extras.execute_values(cur, sql, chunk, page_size=len(chunk))
                        conn.commit() # Commit after each successful chunk insert
                        inserted_count += len(chunk)
                        log_event("INFO", "DB_INSERT", run_id, f"Successfully inserted chunk {chunk_number}. Total inserted so far: {inserted_count}")
                        success = True
                    except psycopg2.Error as e:
                        conn.rollback() # Rollback failed chunk insert
                        log_event("WARN", "DB_INSERT", run_id, f"Attempt {attempt} failed for chunk {chunk_number}: {e}")
                        if attempt >= MAX_RETRIES:
                            log_event("ERROR", "DB_INSERT", run_id, f"Failed to insert chunk {chunk_number} after {MAX_RETRIES} attempts. Error: {e}")
                            # Decide whether to raise or just log and continue
                            # For now, log and continue to allow other chunks to proceed
                            break # Break retry loop for this chunk
                        time.sleep(RETRY_DELAY_S * attempt) # Exponential backoff for retries
                        # Ensure connection is still valid before retrying
                        conn = validate_and_reconnect_if_needed(conn)
                        cur = conn.cursor() # Need a new cursor after rollback/reconnect
                    except Exception as e:
                        conn.rollback()
                        log_event("ERROR", "DB_INSERT", run_id, f"Unexpected error during insert attempt {attempt} for chunk {chunk_number}: {e}")
                        if attempt >= MAX_RETRIES:
                             log_event("ERROR", "DB_INSERT", run_id, f"Failed to insert chunk {chunk_number} due to unexpected error after {MAX_RETRIES} attempts. Error: {e}")
                             break # Break retry loop for this chunk
                        time.sleep(RETRY_DELAY_S * attempt)
                        conn = validate_and_reconnect_if_needed(conn)
                        cur = conn.cursor()

    except Exception as outer_e:
         log_event("ERROR", "DB_INSERT", run_id, f"Outer error during product saving: {outer_e}")
         # Rollback any potential uncommitted changes from the loop
         try:
             if conn and not conn.closed: conn.rollback()
         except Exception: pass

    log_event("INFO", "DB_INSERT", run_id, f"Finished saving products. Total successfully inserted: {inserted_count}/{total_to_insert}")
    return inserted_count


# --- Job Processing ---

def process_job(conn, job):
    """Process a scraper job by executing its script as a subprocess."""
    run_id = job['id']
    scraper_id = job['scraper_id']
    is_test_run = job['is_test_run']
    user_id = job['user_id']
    competitor_id = job['competitor_id']

    log_event("INFO", "JOB_PROCESSING", run_id, f"Processing job {run_id} for scraper {scraper_id}")
    start_time = time.time()
    final_status = 'failed' # Default to failed
    error_msg = None
    error_details = None
    product_count = 0
    products_buffer = []
    tmp_script_path = None # Initialize to ensure it's defined in finally block

    # Ensure DB connection is active at the start
    try:
        conn = validate_and_reconnect_if_needed(conn)
    except Exception as e:
        log_event("ERROR", "DB_CONNECTION", run_id, f"Failed to ensure DB connection at start: {e}")
        # Attempt to update status even if connection failed initially
        try:
            # Need a valid connection object, even if it failed before, try again
            if 'conn' not in locals() or conn is None or conn.closed:
                 conn_update = get_db_connection() # May raise again if DB is down
            else:
                 conn_update = conn
            update_job_status(conn_update, run_id, 'failed', error_message=f"DB connection error at start: {e}")
            if conn_update is not conn: conn_update.close() # Close if we opened a new one just for update
        except Exception as update_err:
             log_event("ERROR", "JOB_STATUS_UPDATE", run_id, f"Critical error updating job status after initial DB connection failure: {update_err}")
        return # Cannot proceed without DB

    try:
        # 1. Fetch scraper details (script content and config)
        scraper_details = fetch_scraper_details(conn, scraper_id) # fetch_scraper_details includes retries
        if not scraper_details or not scraper_details.get('python_script'):
            error_msg = f"Failed to fetch script for scraper {scraper_id}"
            log_event("ERROR", "SETUP", run_id, error_msg)
            # Update status and return
            update_job_status(conn, run_id, 'failed', error_message=error_msg)
            return

        script_content = scraper_details['python_script']
        filter_by_active_brands = scraper_details.get('filter_by_active_brands', False)
        scrape_only_own_products = scraper_details.get('scrape_only_own_products', False)

        # 2. Prepare context (fetch filter data if needed)
        active_brand_names = []
        own_product_eans = []
        own_product_sku_brands = []

        # Re-check connection before fetching filter data
        try:
            conn = validate_and_reconnect_if_needed(conn)
        except Exception as e:
            raise ConnectionError(f"DB connection lost before fetching filter data: {e}") # Raise to be caught by main try-except

        if filter_by_active_brands:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    # Fetch both name and id for active brands
                    cur.execute("SELECT id, name FROM brands WHERE user_id = %s AND is_active = TRUE;", (user_id,))
                    brands = cur.fetchall()
                    active_brand_names = [row['name'] for row in brands]
                    active_brand_ids = [row['id'] for row in brands]
                    log_event("INFO", "SETUP", run_id, f"Fetched {len(active_brand_names)} active brands for filtering.")
            except Exception as e:
                log_event("WARN", "SETUP", run_id, f"Failed to fetch active brands: {e}. Proceeding without brand filter.")
                # Consider reconnecting if connection error
                active_brand_ids = []

        if scrape_only_own_products:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute("SELECT ean, sku, brand, brand_id FROM products WHERE user_id = %s AND is_active = TRUE;", (user_id,))
                    products = cur.fetchall()
                    own_product_eans = [row['ean'] for row in products if row['ean']]
                    own_product_sku_brands = [{
                        'sku': row['sku'],
                        'brand': row['brand'],
                        'brand_id': row['brand_id']
                    } for row in products if row['sku'] and (row['brand'] or row['brand_id'])]
                    log_event("INFO", "SETUP", run_id, f"Fetched {len(own_product_eans)} EANs and {len(own_product_sku_brands)} SKU/Brand pairs for filtering.")
            except Exception as e:
                log_event("WARN", "SETUP", run_id, f"Failed to fetch own products: {e}. Proceeding without own product filter.")
                # Consider reconnecting if connection error

        # Initialize active_brand_ids if not already defined
        if 'active_brand_ids' not in locals():
            active_brand_ids = []

        context = {
            'run_id': run_id,
            'scraper_id': scraper_id,
            'user_id': user_id,
            'competitor_id': competitor_id,
            'is_test_run': is_test_run,
            'filter_by_active_brands': filter_by_active_brands,
            'active_brand_names': active_brand_names,
            'active_brand_ids': active_brand_ids,  # Add brand IDs for filtering
            'scrape_only_own_products': scrape_only_own_products,
            'own_product_eans': own_product_eans,
            'own_product_sku_brands': own_product_sku_brands,
            # Explicitly set limit_products based on run type
            'limit_products': None if not is_test_run else 10 # Default test limit, None for full run
        }
        # Ensure context is valid JSON before passing
        try:
            context_json = json.dumps(context)
        except TypeError as json_err:
             raise ValueError(f"Failed to serialize context to JSON: {json_err}")

        log_event("DEBUG", "SETUP", run_id, f"Prepared script context")

        # 3. Execute script as subprocess
        # Use try-finally to ensure temporary file cleanup
        try:
            # Create a temporary file to hold the script content
            # delete=False is important on Windows to allow the subprocess to open it
            with tempfile.NamedTemporaryFile(mode='w+', suffix='.py', delete=False, encoding='utf-8') as tmp_script:
                tmp_script_path = tmp_script.name
                tmp_script.write(script_content)
                # Ensure file is written before closing the 'with' block implicitly
                tmp_script.flush()
                os.fsync(tmp_script.fileno()) # Ensure OS writes buffer to disk

            log_event("INFO", "SUBPROCESS_EXEC", run_id, f"Executing script: {tmp_script_path}")
            command = [sys.executable, tmp_script_path, 'scrape', f"--context={context_json}"]
            # Debug: log working directory and environment proxies
            log_event("DEBUG", "SUBPROCESS_SETUP", run_id, f"CWD: {os.getcwd()}, HTTP_PROXY={os.environ.get('HTTP_PROXY')}, HTTPS_PROXY={os.environ.get('HTTPS_PROXY')}")
            # Use project root as cwd for subprocess to ensure network/config consistency
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
            log_event("DEBUG", "SUBPROCESS_SETUP", run_id, f"Spawning subprocess with cwd={project_root}, command={command}")
            # Ensure the subprocess environment forces UTF-8 I/O
            sub_env = os.environ.copy()
            sub_env['PYTHONIOENCODING'] = 'utf-8'

            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=project_root,
                env=sub_env, # Pass the modified environment
                text=True, # Read streams as text
                encoding='utf-8', # Expect UTF-8 encoding
                errors='replace', # Replace invalid characters instead of failing
                bufsize=1, # Line buffered
                universal_newlines=True # Ensure proper line ending handling
            )

            # 4. Use communicate() to get all output at once - simpler and more reliable
            log_event("INFO", "SUBPROCESS_EXEC", run_id, "Waiting for subprocess to complete...")

            try:
                stdout_data, stderr_data = process.communicate(timeout=SCRIPT_TIMEOUT_SECONDS)
                log_event("INFO", "SUBPROCESS_EXEC", run_id, f"Subprocess completed. Stdout length: {len(stdout_data)}, Stderr length: {len(stderr_data)}")
            except subprocess.TimeoutExpired:
                process.kill()
                stdout_data, stderr_data = process.communicate()
                log_event("ERROR", "SUBPROCESS_TIMEOUT", run_id, f"Script execution timed out after {SCRIPT_TIMEOUT_SECONDS} seconds.")
                raise TimeoutError(f"Script execution timed out after {SCRIPT_TIMEOUT_SECONDS} seconds.")

            # Process stdout (product JSONs)
            product_count = 0
            products_buffer = []
            script_errors = []

            if stdout_data:
                log_event("INFO", "STDOUT_PROCESSING", run_id, f"Processing {len(stdout_data.splitlines())} lines from stdout")
                for line_num, line in enumerate(stdout_data.splitlines(), 1):
                    line = line.strip()
                    if not line:
                        continue

                    log_event("DEBUG", "STDOUT_RAW", run_id, f"Raw stdout line #{line_num}: {line[:200]}...")

                    try:
                        product = json.loads(line)
                        # Basic validation of product structure
                        if isinstance(product, dict) and product.get('name') and product.get('competitor_price') is not None:
                            products_buffer.append(product)
                            product_count += 1
                            log_event("INFO", "PRODUCT_PARSED", run_id, f"Successfully parsed product #{product_count}: {product.get('name')} @ {product.get('competitor_price')}")
                        else:
                            log_event("WARN", "SCRIPT_STDOUT", run_id, f"Skipping invalid product JSON structure: {line[:100]}...")
                    except json.JSONDecodeError as e:
                        log_event("WARN", "SCRIPT_STDOUT", run_id, f"Failed to decode JSON from stdout: {line[:100]}... Error: {e}")
            else:
                log_event("WARN", "STDOUT_PROCESSING", run_id, "No stdout data received from subprocess")

            # Process stderr (logs and progress updates)
            stderr_lines = []
            script_errors = []
            phase_batch_info = {}

            if stderr_data:
                log_event("INFO", "STDERR_PROCESSING", run_id, f"Processing {len(stderr_data.splitlines())} lines from stderr")
                for line in stderr_data.splitlines():
                    line = line.strip()
                    if not line:
                        continue

                    stderr_lines.append(line)

                    # Log the stderr line
                    log_event("INFO", "SCRIPT_STDERR", run_id, line)

                    # Check for error patterns
                    if any(error_pattern in line.lower() for error_pattern in ['error', 'exception', 'traceback', 'failed']):
                        script_errors.append(line)

                    # Parse progress updates from stderr
                    if "Updated progress in database:" in line:
                        try:
                            # Extract phase and progress info
                            # Format: "Updated progress in database: Phase X: Y/Z"
                            progress_part = line.split("Updated progress in database:")[1].strip()
                            if "Phase" in progress_part:
                                phase_part = progress_part.split(":")[0].strip()  # "Phase X"
                                batch_part = progress_part.split(":")[1].strip()  # "Y/Z"

                                current_phase = int(phase_part.split()[1])  # Extract X from "Phase X"
                                current_batch, total_batches = map(int, batch_part.split("/"))  # Extract Y and Z

                                # Store phase batch info for final status update
                                phase_batch_info[current_phase] = {
                                    'current_batch': current_batch,
                                    'total_batches': total_batches
                                }

                                # Update job status with progress
                                try:
                                    conn = validate_and_reconnect_if_needed(conn)
                                    update_job_status(conn, run_id, 'running', current_batch=current_batch, total_batches=total_batches)
                                except Exception as progress_err:
                                    log_event("WARN", "PROGRESS_UPDATE", run_id, f"Failed to update progress in database: {progress_err}")

                        except (ValueError, IndexError) as parse_err:
                            log_event("WARN", "PROGRESS_PARSE", run_id, f"Failed to parse progress update: {line} - Error: {parse_err}")
            else:
                log_event("WARN", "STDERR_PROCESSING", run_id, "No stderr data received from subprocess")

            # Save products in batches to the database
            if len(products_buffer) >= DB_BATCH_SIZE:
                log_event("INFO", "DB_BATCH_SAVE", run_id, f"Saving batch of {len(products_buffer)} products...")
                conn = validate_and_reconnect_if_needed(conn)
                inserted = save_temp_competitors_scraped_data(conn, run_id, user_id, competitor_id, products_buffer)
                log_event("INFO", "DB_BATCH_SAVE", run_id, f"Successfully inserted {inserted} products.")
                products_buffer = [] # Clear buffer after saving

            # Save any remaining products in the buffer after processing stdout
            log_event("INFO", "FINAL_BATCH_CHECK", run_id, f"Checking for remaining products in buffer. Buffer size: {len(products_buffer)}, Total product count: {product_count}")
            if products_buffer:
                log_event("INFO", "DB_BATCH_SAVE", run_id, f"Saving final batch of {len(products_buffer)} products...")
                # Ensure connection is valid before saving final batch
                conn = validate_and_reconnect_if_needed(conn)
                inserted = save_temp_competitors_scraped_data(conn, run_id, user_id, competitor_id, products_buffer)
                log_event("INFO", "DB_BATCH_SAVE", run_id, f"Successfully inserted {inserted} products.")
            else:
                log_event("WARN", "FINAL_BATCH_CHECK", run_id, f"No products in buffer to save. Total products parsed during run: {product_count}")

            # 5. Check exit code after processing all output
            exit_code = process.returncode
            log_event("INFO", "SUBPROCESS_EXEC", run_id, f"Script finished with exit code: {exit_code}")

            if exit_code == 0:
                # Even with exit code 0, check if the script logged errors to stderr
                if script_errors:
                    final_status = 'failed' # Mark as failed if script explicitly reported errors
                    error_msg = f"Script finished successfully (exit code 0) but reported errors via stderr."
                    error_details = "\n".join(script_errors)
                    log_event("ERROR", "JOB_COMPLETION", run_id, error_msg)
                else:
                    final_status = 'completed'
                    log_event("INFO", "JOB_COMPLETION", run_id, f"Job completed successfully. Total products processed: {product_count}")
            else:
                final_status = 'failed'
                # More specific error message including the exit code
                error_msg = f"Script failed with exit code {exit_code}."
                log_event("ERROR", "JOB_COMPLETION", run_id, error_msg)
                # Capture last ~10 lines of stderr for error_details
                last_stderr_lines = stderr_lines[-10:] # Get last 10 lines
                error_details = f"Exit Code: {exit_code}\n---\nLast stderr lines:\n" + "\n".join(last_stderr_lines).strip()
                if error_details:
                     log_event("ERROR", "JOB_COMPLETION", run_id, f"Stderr Snippet:\n{error_details}")

        finally:
            # Ensure temporary file is deleted regardless of execution outcome
            if tmp_script_path and os.path.exists(tmp_script_path):
                try:
                    os.remove(tmp_script_path)
                    log_event("DEBUG", "CLEANUP", run_id, f"Removed temporary script: {tmp_script_path}")
                except OSError as e:
                    log_event("WARN", "CLEANUP", run_id, f"Error removing temporary script {tmp_script_path}: {e}")


    except TimeoutError as e:
        # Handle script execution timeout specifically
        final_status = 'failed'
        error_msg = f"Script execution timed out after {SCRIPT_TIMEOUT_SECONDS} seconds."
        # Capture last ~10 lines of stderr before timeout if available
        last_stderr_lines = stderr_data.strip().splitlines()[-10:] if stderr_data else []
        error_details = f"Timeout: {SCRIPT_TIMEOUT_SECONDS}s\n---\nLast stderr lines before timeout:\n" + "\n".join(last_stderr_lines).strip()
        log_event("ERROR", "JOB_TIMEOUT", run_id, error_msg)
        if error_details:
            log_event("ERROR", "JOB_TIMEOUT", run_id, f"Stderr Snippet:\n{error_details}")
    except Exception as e:
        # Catch other errors during worker processing (fetching, subprocess setup, etc.)
        final_status = 'failed'
        # Keep the specific exception type in the main message
        error_msg = f"Worker error: {type(e).__name__}"
        error_details = f"Worker failed during job processing.\nException: {e}\n---\nTraceback:\n{traceback.format_exc()}"
        log_event("ERROR", "JOB_PROCESSING", run_id, f"{error_msg}: {e}") # Log full exception message here
        log_event("ERROR", "JOB_PROCESSING", run_id, f"Traceback:\n{traceback.format_exc()}") # Log traceback separately

    # 6. Final status update
    end_time = time.time()
    execution_time_ms = int((end_time - start_time) * 1000)
    # Calculate products per second, handle division by zero
    products_per_second = (product_count / (execution_time_ms / 1000.0)) if execution_time_ms > 0 else 0

    try:
        # Ensure connection is valid before final update
        conn = validate_and_reconnect_if_needed(conn)

        # Extract current_batch and total_batches from progress messages if available
        current_batch = None
        total_batches = None

        # Use the phase batch info if available from earlier processing
        if 'phase_batch_info' in locals() and phase_batch_info:
            # Get the highest phase number (latest phase)
            latest_phase = max(phase_batch_info.keys())
            current_batch = phase_batch_info[latest_phase]['current_batch']
            total_batches = phase_batch_info[latest_phase]['total_batches']
            log_event("INFO", "FINAL_STATUS", run_id, f"Using batch info from phase {latest_phase}: {current_batch}/{total_batches}")
        else:
            # Fallback: Look for the last progress message that contains batch information
            log_event("INFO", "FINAL_STATUS", run_id, "No phase batch info available, looking in stderr lines")
            for line in reversed(stderr_lines) if 'stderr_lines' in locals() else []:
                if line.startswith("PROGRESS:"):
                    progress_msg = line[len("PROGRESS:"):].strip()
                    import re
                    product_progress_match = re.search(r'\b(\d+)\s*\/\s*(\d+)\b', progress_msg)
                    if product_progress_match:
                        current_batch = int(product_progress_match.group(1))
                        total_batches = int(product_progress_match.group(2))
                        log_event("INFO", "FINAL_STATUS", run_id, f"Found batch info in stderr: {current_batch}/{total_batches}")
                        break

        update_job_status(
            conn, run_id, final_status,
            error_message=error_msg,
            error_details=error_details,
            product_count=product_count,
            execution_time_ms=execution_time_ms,
            products_per_second=products_per_second,
            current_batch=current_batch,
            total_batches=total_batches
        )
    except Exception as update_err:
        log_event("ERROR", "JOB_STATUS_UPDATE", run_id, f"Critical error updating final job status: {update_err}")


# --- Main Worker Loop ---

def main():
    """Main worker function that polls for jobs and processes them."""
    log_event("INFO", "SETUP", None, f"Python Worker ({WORKER_ID}) starting...")

    # Validate initial database connection with retries
    max_init_retries = 5
    init_retry_count = 0
    init_success = False

    while init_retry_count < max_init_retries and not init_success:
        try:
            conn_check = get_db_connection()
            log_event("INFO", "SETUP", None, "Initial database connection successful.")
            conn_check.close()
            init_success = True
        except Exception as e:
            init_retry_count += 1
            backoff_time = min(2 ** init_retry_count, 30)  # Exponential backoff up to 30 seconds
            log_event("WARN", "SETUP", None,
                     f"Initial database connection attempt {init_retry_count}/{max_init_retries} failed: {e}. "
                     f"Retrying in {backoff_time} seconds...")
            log_event("DEBUG", "SETUP", None, f"DATABASE_URL used: {DATABASE_URL}")
            time.sleep(backoff_time)

    if not init_success:
        log_event("CRITICAL", "SETUP", None, f"All {max_init_retries} initial database connection attempts failed. Worker cannot start.")
        return  # Exit if cannot connect initially

    # Track consecutive failures to implement backoff
    consecutive_failures = 0
    max_backoff_seconds = 60 # Increased max backoff

    # Track last successful job time to detect long periods of inactivity
    last_job_time = time.time()
    inactivity_check_interval = 300  # Check for long inactivity every 5 minutes
    last_inactivity_check = time.time()

    # Main worker loop
    while True:
        conn = None # Ensure conn is reset each loop iteration
        job = None # Ensure job is reset
        run_id = None # Ensure run_id is reset
        current_time = time.time()

        # Periodically check for long periods of inactivity and log health status
        if current_time - last_inactivity_check > inactivity_check_interval:
            inactivity_duration = current_time - last_job_time
            log_event("INFO", "WORKER_HEALTH", None,
                     f"Worker health check: {inactivity_duration:.1f} seconds since last job processed. Worker is still running.")

            # If it's been more than 30 minutes since the last job, check for pending jobs that might be stuck
            if inactivity_duration > 1800:  # 30 minutes
                try:
                    check_conn = get_db_connection()
                    with check_conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                        cur.execute("""
                            SELECT COUNT(*) as pending_count
                            FROM scraper_runs sr
                            INNER JOIN scrapers s ON sr.scraper_id = s.id
                            WHERE sr.status IN ('pending', 'initializing')
                            AND (s.scraper_type = 'python' OR s.scraper_type IS NULL)
                        """)
                        result = cur.fetchone()
                        if result and result['pending_count'] > 0:
                            log_event("WARN", "WORKER_HEALTH", None,
                                    f"Found {result['pending_count']} pending Python jobs but worker has been inactive for {inactivity_duration:.1f} seconds. Possible issue with job pickup.")
                    check_conn.close()
                except Exception as e:
                    log_event("ERROR", "WORKER_HEALTH", None, f"Error checking for pending jobs during health check: {e}")

            last_inactivity_check = current_time

        try:
            # Get a database connection for this iteration
            conn = validate_and_reconnect_if_needed(None)

            # Find and claim a job
            job = find_and_claim_job(conn)

            if job:
                # Update last job time whenever we successfully claim a job
                last_job_time = time.time()

                run_id = job['id'] # Set run_id as soon as job is claimed
                scraper_id = job['scraper_id']
                log_event("INFO", "JOB_FOUND", run_id, f"Processing job for scraper {scraper_id}")

                try:
                    # Process the job using the same connection
                    process_job(conn, job)
                    # Reset consecutive failures on successful job processing attempt (even if script failed)
                    consecutive_failures = 0
                except Exception as job_proc_err:
                    # Log any unhandled exceptions during job processing itself
                    error_details = traceback.format_exc()
                    log_event("ERROR", "JOB_PROCESSING", run_id, f"Unhandled error during process_job call: {job_proc_err}")
                    log_event("ERROR", "JOB_PROCESSING", run_id, f"Error details: {error_details}")
                    # Attempt to mark job as failed
                    try:
                        update_job_status(conn, run_id, 'failed',
                                         error_message=f"Worker error during process_job: {job_proc_err}",
                                         error_details=error_details)
                    except Exception as update_err:
                        log_event("ERROR", "JOB_STATUS_UPDATE", run_id, f"Failed to update job status after process_job error: {update_err}")
                    consecutive_failures += 1 # Count this as a failure for backoff
            else:
                # No job found, wait before checking again
                # Apply backoff only if there were recent failures finding/claiming jobs
                if consecutive_failures > 0:
                    backoff_time = min(2 ** consecutive_failures, max_backoff_seconds)
                    log_event("INFO", "WORKER_BACKOFF", None, f"No job found. Backing off for {backoff_time} seconds due to {consecutive_failures} recent failures.")
                    time.sleep(backoff_time)
                else:
                    # Normal polling interval if no recent failures
                    # log_event("DEBUG", "JOB_SEARCH", None, f"No pending job found. Sleeping for {WORKER_POLL_INTERVAL}s.")
                    time.sleep(WORKER_POLL_INTERVAL)
                # Reset failure count if no job was found (wait period is the backoff)
                consecutive_failures = 0


        except psycopg2.OperationalError as db_op_err:
             log_event("ERROR", "WORKER_LOOP_DB", run_id, f"Database operational error in main loop: {db_op_err}. Applying backoff.")
             consecutive_failures += 1
             backoff_time = min(2 ** consecutive_failures, max_backoff_seconds)
             log_event("INFO", "WORKER_BACKOFF", run_id, f"Backing off for {backoff_time} seconds.")
             time.sleep(backoff_time)
        except Exception as e:
            # Log any other unhandled exceptions in the main loop
            log_event("ERROR", "WORKER_LOOP", run_id, f"Unhandled error in main worker loop: {e}")
            log_event("ERROR", "WORKER_LOOP", run_id, f"Error details: {traceback.format_exc()}")
            consecutive_failures += 1
            backoff_time = min(2 ** consecutive_failures, max_backoff_seconds)
            log_event("INFO", "WORKER_BACKOFF", run_id, f"Backing off for {backoff_time} seconds after error.")
            time.sleep(backoff_time)

        finally:
            # Always close the database connection if it was opened
            if conn and not conn.closed:
                try:
                    conn.close()
                except Exception as close_err:
                     log_event("WARN", "DB_CONNECTION", run_id, f"Error closing DB connection: {close_err}")
            # Short sleep to prevent tight looping in case of continuous errors
            time.sleep(0.1)

# Start the worker
if __name__ == "__main__":
    main()