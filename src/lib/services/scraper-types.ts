// Types for scraper configuration
export interface ScraperConfig {
  id?: string;
  user_id: string;
  competitor_id: string;
  name: string;
  url: string;
  scraper_type: 'ai' | 'python';
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
  script_metadata?: {
    name: string;
    description: string;
    version: string;
    author: string;
    target_url: string;
    required_libraries: string[];
  };
  test_results?: Record<string, unknown>;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
  last_run?: string;
  status?: 'idle' | 'running' | 'success' | 'failed';
  error_message?: string;
  execution_time?: number; // Time in milliseconds it took to run the scraper
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