// Types for scraper configuration

// Extracted interface for script metadata
export interface ScraperMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  target_url: string;
  required_libraries: string[];
  // Additional fields for AI-generated scrapers
  generation_method?: 'gemini-ai' | 'manual' | 'template';
  generation_timestamp?: string;
  batch_size?: number;
  max_concurrency?: number;
  // Fields for tracking script fixes
  applied_fixes?: string[]; // List of fixes applied to the script
}
export interface ScraperConfig {
  id?: string;
  user_id: string;
  competitor_id: string;
  name: string;
  url: string;
  scraper_type: 'python' | 'typescript'; // Only Python and TypeScript scrapers are supported
  selectors?: {
    product: string;
    name: string;
    competitor_price: string; // Updated field name to match new pricing structure
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
  python_script?: string;
  script_metadata?: ScraperMetadata; // Use the extracted interface
  typescript_script?: string; // Added for TypeScript scrapers
  test_results?: Record<string, unknown>;
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
  competitor_price: number; // Updated field name to match new pricing structure
  currency_code: string; // Updated field name to match new pricing structure
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
  competitor_price: number; // Updated field name to match new pricing structure
  currency_code?: string; // Updated field name to match new pricing structure
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
  competitor_price?: number | null; // For competitor scrapers
  supplier_price?: number | null; // For supplier scrapers
  supplier_recommended_price?: number | null; // For supplier scrapers
  currency_code?: string;
  url?: string;
  supplier_url?: string; // For supplier scrapers
  competitor_url?: string; // For competitor scrapers
  image_url?: string;
  sku?: string;
  brand?: string;
  ean?: string;
  stock_quantity?: number | null; // For supplier scrapers
  stock_status?: string; // For supplier scrapers
  minimum_order_quantity?: number | null; // For supplier scrapers
  lead_time_days?: number | null; // For supplier scrapers
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