# pricetracker/api/execute_scraper.py
import os
import sys
import subprocess
import json
import tempfile
import shutil
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs
import traceback # Import traceback for detailed error logging

# --- Execution Logic ---

def install_dependencies(run_id, requirements, python_executable):
    """Installs specified Python packages using pip."""
    if not requirements:
        print(f"Run {run_id}: No specific dependencies listed.", file=sys.stderr)
        return True, ""

    # Ensure requirements is a list of strings
    if not isinstance(requirements, list) or not all(isinstance(req, str) for req in requirements):
         error_message = "Invalid format for requirements. Expected a list of strings."
         print(f"Run {run_id}: {error_message}", file=sys.stderr)
         return False, error_message

    install_command = [
        python_executable, "-m", "pip", "install",
        "--disable-pip-version-check", "--no-cache-dir", "--prefer-binary" # Added prefer-binary
    ] + requirements

    print(f"Run {run_id}: Installing dependencies: {' '.join(install_command)}", file=sys.stderr)

    try:
        # Use a longer timeout for pip install (5 minutes)
        result = subprocess.run(install_command, capture_output=True, text=True, check=True, timeout=300, encoding='utf-8')
        print(f"Run {run_id}: Pip install stdout:\n{result.stdout}", file=sys.stderr)
        if result.stderr:
             print(f"Run {run_id}: Pip install stderr:\n{result.stderr}", file=sys.stderr)
        print(f"Run {run_id}: Dependencies installed successfully.", file=sys.stderr)
        return True, ""
    except subprocess.CalledProcessError as e:
        # Log the full error output from pip
        error_message = f"Failed to install libraries: {', '.join(requirements)}. Exit code: {e.returncode}\nstdout:\n{e.stdout}\nstderr:\n{e.stderr}"
        print(f"Run {run_id}: {error_message}", file=sys.stderr)
        return False, f"Failed to install libraries: {', '.join(requirements)}. Check logs for details." # Return simpler message
    except subprocess.TimeoutExpired:
        error_message = f"Failed to install libraries: {', '.join(requirements)}. Timeout expired after 5 minutes."
        print(f"Run {run_id}: {error_message}", file=sys.stderr)
        return False, error_message
    except Exception as e:
        error_message = f"Unexpected error installing libraries: {', '.join(requirements)}. Error: {e}\n{traceback.format_exc()}"
        print(f"Run {run_id}: {error_message}", file=sys.stderr)
        return False, f"Unexpected error installing libraries: {e}"


def execute_script(run_id, script_content, python_executable):
    """Executes the provided Python script content in a subprocess."""
    temp_dir = None
    script_path = None
    total_products = 0
    batch_count = 0
    has_errors = False
    error_message = None
    process = None # Define process here to access in finally block if needed

    try:
        # Create a temporary directory
        temp_dir = tempfile.mkdtemp(prefix="pricetracker-py-")
        script_path = os.path.join(temp_dir, "script.py")

        # Write the script content to the file
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(script_content)

        print(f"Run {run_id}: Spawning Python process to execute scrape in {temp_dir}...", file=sys.stderr)

        # Command to execute the script's 'scrape' function
        # Ensure the temp_dir is in sys.path for the spawned process
        command = [
            python_executable,
            "-c",
            # Use raw string literal (r'') for paths, especially on Windows
            # Ensure script execution happens within the temp_dir context if needed
            f"import sys; sys.path.insert(0, r'{temp_dir}'); import script; script.scrape()"
        ]

        # Execute using subprocess.Popen for streaming IO
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace', # Handle potential encoding errors gracefully
            bufsize=1 # Line buffered
        )

        # --- Process stdout (JSON batches) ---
        if process.stdout:
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue
                # print(f"Run {run_id}: Received stdout line: {line}", file=sys.stderr) # Debugging - can be verbose
                try:
                    batch = json.loads(line)
                    if isinstance(batch, list):
                        batch_count += 1
                        product_count = len(batch)
                        total_products += product_count
                        print(f"Run {run_id}: Processed batch {batch_count} with {product_count} products.", file=sys.stderr)
                        # NOTE: Product data is currently just counted, not stored by this Python function.
                        # The Node.js service would need modification to handle this if needed here.
                    else:
                        print(f"Run {run_id}: Received non-list JSON object: {line}", file=sys.stderr)
                except json.JSONDecodeError:
                    print(f"Run {run_id}: Failed to decode JSON from stdout: {line}", file=sys.stderr)
                except Exception as e:
                    print(f"Run {run_id}: Error processing stdout batch: {e}", file=sys.stderr)
                    has_errors = True # Mark run as failed if batch processing fails

        # --- Process stderr (Progress/Errors) ---
        stderr_output = ""
        if process.stderr:
            # Read stderr line by line to capture progress messages in real-time if needed
            for err_line in process.stderr:
                 print(f"Run {run_id} [stderr]: {err_line.strip()}", file=sys.stderr)
                 stderr_output += err_line
                 # Could parse progress messages here if the Python script emits them to stderr

        # Wait for the process to complete (returns exit code)
        # Use communicate() to avoid deadlocks if buffers fill up, though reading line-by-line helps
        # stdout_res, stderr_res = process.communicate(timeout=4 * 60 * 60) # 4 hour timeout
        return_code = process.wait(timeout=4 * 60 * 60) # 4 hour timeout

        if return_code != 0:
            print(f"Run {run_id}: Python script exited with non-zero code: {return_code}", file=sys.stderr)
            has_errors = True
            # Limit error message length stored/returned
            error_message = f"Script failed with exit code {return_code}. Stderr: {stderr_output[-500:]}" # Last 500 chars of stderr

    except subprocess.TimeoutExpired:
        print(f"Run {run_id}: Script execution timed out after 4 hours.", file=sys.stderr)
        has_errors = True
        error_message = "Script execution timed out after 4 hours."
        if process:
            process.kill() # Ensure process is killed
            # Consume remaining output to prevent pipe issues
            try:
                process.communicate()
            except: pass # Ignore errors during cleanup
    except Exception as e:
        print(f"Run {run_id}: Error executing script: {e}\n{traceback.format_exc()}", file=sys.stderr)
        has_errors = True
        error_message = f"Execution error: {e}"
    finally:
        # Clean up temporary directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"Run {run_id}: Cleaned up temp directory {temp_dir}", file=sys.stderr)
            except Exception as e:
                print(f"Run {run_id}: Error cleaning up temp directory {temp_dir}: {e}", file=sys.stderr)

    final_status = "failed" if has_errors else "success"
    print(f"Run {run_id}: Execution finished with status: {final_status}", file=sys.stderr)

    return final_status == "success", error_message, total_products


# --- Vercel Serverless Function Handler ---
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        run_id = None # Initialize run_id
        response_code = 500 # Default to internal server error
        response_body = {"error": "An unexpected error occurred"}

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            script_content = data.get('script_content')
            run_id = data.get('run_id') # Assign run_id here
            requirements = data.get('requirements') # List of strings or null

            if not script_content or not run_id:
                response_code = 400
                response_body = {"error": "Missing script_content or run_id"}
            else:
                # Use sys.executable which points to the Python used by Vercel runtime
                python_executable = sys.executable
                print(f"Run {run_id}: Using Python executable: {python_executable}", file=sys.stderr)
                print(f"Run {run_id}: Received requirements: {requirements}", file=sys.stderr)

                # Step 1: Install Dependencies
                install_ok, install_error = install_dependencies(run_id, requirements, python_executable)

                if not install_ok:
                     response_code = 500
                     response_body = {"error": f"Dependency installation failed: {install_error}", "run_id": run_id}
                else:
                    # Step 2: Execute Script
                    success, error_message, product_count = execute_script(run_id, script_content, python_executable)

                    if success:
                        response_code = 200
                        response_body = {"message": "Script executed successfully", "run_id": run_id, "product_count": product_count}
                    else:
                        response_code = 500
                        response_body = {"error": f"Script execution failed: {error_message}", "run_id": run_id, "product_count": product_count}

        except json.JSONDecodeError:
            response_code = 400
            response_body = {"error": "Invalid JSON body"}
        except Exception as e:
            # Ensure run_id is included in the error log if available
            error_prefix = f"Run {run_id}: " if run_id else ""
            print(f"{error_prefix}Unexpected error in handler: {e}\n{traceback.format_exc()}", file=sys.stderr)
            response_code = 500
            # Include run_id in the error response if available
            response_body = {"error": f"Internal server error: {e}"}
            if run_id:
                response_body["run_id"] = run_id
        finally:
            # Send the response
            self.send_response(response_code)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_body).encode('utf-8'))

# Note: Vercel expects the handler class named 'handler'.
# It should be placed in the /api directory at the root of the project.
# Example path: pricetracker/api/execute_scraper.py