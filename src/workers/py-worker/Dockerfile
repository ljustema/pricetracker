FROM python:3.10-slim

WORKDIR /app

# Add a timestamp to force rebuild every time
RUN echo "Build timestamp: $(date)" > build_timestamp.txt

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install dependencies with no caching
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip list

# Copy the rest of the application
COPY . .

# This is a background worker, not a web server
# No EXPOSE directive needed as it doesn't listen on any port

# Run the application
CMD ["python", "main.py"]
