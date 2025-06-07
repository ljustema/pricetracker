/**
 * TEMPORARY SIMPLIFIED DATABASE TYPES
 *
 * This is a simplified version of the database types file to allow deployment to Railway.
 * The original file was causing UTF-8 encoding issues during deployment.
 *
 * After successful deployment, you should regenerate the proper types using:
 * supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Define a simplified Database type that includes the basic structure
// but uses 'any' for specific table definitions to avoid encoding issues
export type Database = {
  public: {
    Tables: {
      brand_aliases: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      brands: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      companies: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      competitors: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      csv_uploads: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      debug_logs: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      dismissed_duplicates: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      integration_runs: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      integrations: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      price_changes: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      products: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }

      scraper_runs: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      scrapers: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      temp_competitors_scraped_data: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      temp_integrations_scraped_data: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
    }
    Functions: {

      cleanup_temp_competitors_scraped_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_user_for_nextauth: {
        Args: {
          user_id: string
          email: string
          name: string
        }
        Returns: undefined
      }
      get_latest_competitor_prices: {
        Args: {
          p_user_id: string
          p_product_id: string
        }
        Returns: Json
      }
      get_product_price_history: {
        Args: {
          p_user_id: string
          p_product_id: string
          p_source_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      get_products_filtered: {
        Args: {
          p_user_id: string
          p_page?: number
          p_page_size?: number
          p_sort_by?: string
          p_sort_order?: string
          p_brand?: string
          p_category?: string
          p_search?: string
          p_is_active?: boolean
          p_competitor_ids?: string[]
          p_has_price?: boolean
          p_price_lower_than_competitors?: boolean
          p_price_higher_than_competitors?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

// Simplified type helpers
export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
export type Functions<T extends keyof DefaultSchema["Functions"]> = DefaultSchema["Functions"][T]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
export type CompositeTypes<T extends keyof DefaultSchema["CompositeTypes"]> = DefaultSchema["CompositeTypes"][T]

export const Constants = {
  public: {
    Enums: {},
  },
}
