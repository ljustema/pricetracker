// Types for scraper configuration

// Extracted interface for script metadata
export interface ScraperMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  target_url: string;
  required_libraries: string[];
}
export interface ScraperConfig {
  id?: string;
  user_id: string;
  competitor_id: string;
  name: string;
  url: string;
  scraper_type: 'ai' | 'python' | 'crawlee' | 'typescript'; // Added 'typescript' type
  selectors?: {
    product: string;
    name: string;
    price: string;
    image?: string;
    sku?: string;
    brand?: string;
    ean?: string;
  };
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string; // HH:MM format
    day?: number; // Day of week (0-6) or day of month (1-31)
  };
  is_active: boolean;
  is_approved: boolean;
  python_script?: string;
  script_metadata?: ScraperMetadata; // Use the extracted interface
  typescript_script?: string; // Added for TypeScript scrapers
  test_results?: Record<string, unknown>;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
  last_run?: string;
  status?: 'idle' | 'running' | 'success' | 'failed';
  error_message?: string;
  execution_time?: number; // Time in milliseconds it took to run the scraper
  last_products_per_second?: number | null; // Products per second from the last successful run
}

// Types for scraper results
export interface ScrapedProduct {
  id?: string;
  scraper_id?: string; // Now optional as per the new design
  competitor_id: string;
  product_id?: string; // Optional, will be set during matching
  name: string;
  price: number;
  currency: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string; // Added EAN for product matching
  url?: string;
  scraped_at: string;
  user_id?: string;
}

// Interface for scraped product data from Python scripts
export interface ScrapedProductData {
  name: string;
  price: number;
  currency?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
  url?: string;
}

// --- Validation Types ---

// Define expected product structure for validation results
export interface ValidationProduct {
  name: string;
  price: number | null; // Allow null if price not found
  currency?: string;
  url?: string;
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
  [key: string]: unknown; // Allow other potential fields
}

// Define expected structure for structured logs during validation
export interface ValidationLog {
  ts: string;
  lvl: "INFO" | "WARN" | "ERROR" | "DEBUG";
  phase: string; // e.g., "SETUP", "URL_COLLECTION", "BATCH_PROCESSING", "VALIDATION"
  msg: string;
  data?: Record<string, unknown>;
}

// Define expected response structure for the validation endpoint
export interface ValidationResponse {
  valid: boolean;
  error?: string | null;
  products?: ValidationProduct[];
  logs?: ValidationLog[];
  metadata?: { target_url?: string };
}