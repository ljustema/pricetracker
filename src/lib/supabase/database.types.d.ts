export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      // Updated products table with new column names
      products: {
        Row: {
          brand: string | null;
          brand_id: string | null;
          category: string | null;
          our_wholesale_price: number | null; // Renamed from wholesale_price
          created_at: string | null;
          description: string | null;
          ean: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean | null;
          name: string;
          our_retail_price: number | null; // Renamed from our_price
          sku: string | null;
          updated_at: string | null;
          user_id: string;
          currency_code: string | null;
          our_url: string | null; // Renamed from url
        };
        Insert: {
          brand?: string | null;
          brand_id?: string | null;
          category?: string | null;
          our_wholesale_price?: number | null;
          created_at?: string | null;
          description?: string | null;
          ean?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          name: string;
          our_retail_price?: number | null;
          sku?: string | null;
          updated_at?: string | null;
          user_id: string;
          currency_code?: string | null;
          our_url?: string | null; // Renamed from url
        };
        Update: {
          brand?: string | null;
          brand_id?: string | null;
          category?: string | null;
          our_wholesale_price?: number | null;
          created_at?: string | null;
          description?: string | null;
          ean?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          name?: string;
          our_retail_price?: number | null;
          sku?: string | null;
          updated_at?: string | null;
          user_id?: string;
          currency_code?: string | null;
          our_url?: string | null; // Renamed from url
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          }
        ];
      };
      
      // Renamed and updated price_changes_competitors table
      price_changes_competitors: {
        Row: {
          changed_at: string | null;
          competitor_id: string | null;
          id: string;
          new_competitor_price: number; // Renamed from new_price
          old_competitor_price: number; // Renamed from old_price
          new_our_retail_price: number | null; // New field
          old_our_retail_price: number | null; // New field
          price_change_percentage: number;
          product_id: string;
          user_id: string;
          competitor_url: string | null; // Renamed from url
          our_url: string | null; // New field for cross-reference
          currency_code: string | null;
          integration_id: string | null;
        };
        Insert: {
          changed_at?: string | null;
          competitor_id?: string | null;
          id?: string;
          new_competitor_price: number;
          old_competitor_price: number;
          new_our_retail_price?: number | null;
          old_our_retail_price?: number | null;
          price_change_percentage: number;
          product_id: string;
          user_id: string;
          competitor_url?: string | null; // Renamed from url
          our_url?: string | null; // New field for cross-reference
          currency_code?: string | null;
          integration_id?: string | null;
        };
        Update: {
          changed_at?: string | null;
          competitor_id?: string | null;
          id?: string;
          new_competitor_price?: number;
          old_competitor_price?: number;
          new_our_retail_price?: number | null;
          old_our_retail_price?: number | null;
          price_change_percentage?: number;
          product_id?: string;
          user_id?: string;
          competitor_url?: string | null; // Renamed from url
          our_url?: string | null; // New field for cross-reference
          currency_code?: string | null;
          integration_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "price_changes_competitors_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_changes_competitors_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };
      
      // Updated price_changes_suppliers table
      price_changes_suppliers: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          supplier_id: string;
          old_supplier_price: number | null; // New field
          new_supplier_price: number | null; // New field
          old_our_wholesale_price: number | null; // Renamed from old_wholesale_price
          new_our_wholesale_price: number | null; // Renamed from new_wholesale_price
          old_supplier_recommended_price: number | null; // New field
          new_supplier_recommended_price: number | null; // New field
          price_change_percentage: number | null;
          currency_code: string | null;
          supplier_url: string | null; // Renamed from url
          our_url: string | null; // New field for cross-reference
          minimum_order_quantity: number | null;
          lead_time_days: number | null;
          changed_at: string | null;
          change_source: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          supplier_id: string;
          old_supplier_price?: number | null;
          new_supplier_price?: number | null;
          old_our_wholesale_price?: number | null;
          new_our_wholesale_price?: number | null;
          old_supplier_recommended_price?: number | null;
          new_supplier_recommended_price?: number | null;
          price_change_percentage?: number | null;
          currency_code?: string | null;
          supplier_url?: string | null; // Renamed from url
          our_url?: string | null; // New field for cross-reference
          minimum_order_quantity?: number | null;
          lead_time_days?: number | null;
          changed_at?: string | null;
          change_source?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          supplier_id?: string;
          old_supplier_price?: number | null;
          new_supplier_price?: number | null;
          old_our_wholesale_price?: number | null;
          new_our_wholesale_price?: number | null;
          old_supplier_recommended_price?: number | null;
          new_supplier_recommended_price?: number | null;
          price_change_percentage?: number | null;
          currency_code?: string | null;
          supplier_url?: string | null; // Renamed from url
          our_url?: string | null; // New field for cross-reference
          minimum_order_quantity?: number | null;
          lead_time_days?: number | null;
          changed_at?: string | null;
          change_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "price_changes_suppliers_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_changes_suppliers_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          }
        ];
      };

      // Updated temp_competitors_scraped_data table
      temp_competitors_scraped_data: {
        Row: {
          id: string;
          user_id: string;
          competitor_id: string;
          scraper_id: string | null;
          product_id: string | null;
          name: string;
          competitor_price: number | null;
          currency_code: string | null;
          competitor_url: string | null; // Renamed from url
          image_url: string | null;
          sku: string | null;
          brand: string | null;
          ean: string | null;
          raw_data: Json | null;
          scraped_at: string | null;
          created_at: string | null;
          stock_quantity: number | null;
          stock_status: string | null;
          availability_date: string | null;
          raw_stock_data: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          competitor_id: string;
          scraper_id?: string | null;
          product_id?: string | null;
          name: string;
          competitor_price?: number | null;
          currency_code?: string | null;
          competitor_url?: string | null; // Renamed from url
          image_url?: string | null;
          sku?: string | null;
          brand?: string | null;
          ean?: string | null;
          raw_data?: Json | null;
          scraped_at?: string | null;
          created_at?: string | null;
          stock_quantity?: number | null;
          stock_status?: string | null;
          availability_date?: string | null;
          raw_stock_data?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          competitor_id?: string;
          scraper_id?: string | null;
          product_id?: string | null;
          name?: string;
          competitor_price?: number | null;
          currency_code?: string | null;
          competitor_url?: string | null; // Renamed from url
          image_url?: string | null;
          sku?: string | null;
          brand?: string | null;
          ean?: string | null;
          raw_data?: Json | null;
          scraped_at?: string | null;
          created_at?: string | null;
          stock_quantity?: number | null;
          stock_status?: string | null;
          availability_date?: string | null;
          raw_stock_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "temp_competitors_scraped_data_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };

      // Updated temp_integrations_scraped_data table
      temp_integrations_scraped_data: {
        Row: {
          id: string;
          integration_run_id: string;
          integration_id: string;
          user_id: string;
          prestashop_product_id: string | null;
          name: string;
          sku: string | null;
          ean: string | null;
          brand: string | null;
          our_retail_price: number | null;
          our_wholesale_price: number | null;
          image_url: string | null;
          raw_data: Json | null;
          status: string;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
          currency_code: string | null;
          our_url: string | null; // Renamed from url
          stock_quantity: number | null;
          stock_status: string | null;
          availability_date: string | null;
          raw_stock_data: Json | null;
        };
        Insert: {
          id?: string;
          integration_run_id: string;
          integration_id: string;
          user_id: string;
          prestashop_product_id?: string | null;
          name: string;
          sku?: string | null;
          ean?: string | null;
          brand?: string | null;
          our_retail_price?: number | null;
          our_wholesale_price?: number | null;
          image_url?: string | null;
          raw_data?: Json | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
          currency_code?: string | null;
          our_url?: string | null; // Renamed from url
          stock_quantity?: number | null;
          stock_status?: string | null;
          availability_date?: string | null;
          raw_stock_data?: Json | null;
        };
        Update: {
          id?: string;
          integration_run_id?: string;
          integration_id?: string;
          user_id?: string;
          prestashop_product_id?: string | null;
          name?: string;
          sku?: string | null;
          ean?: string | null;
          brand?: string | null;
          our_retail_price?: number | null;
          our_wholesale_price?: number | null;
          image_url?: string | null;
          raw_data?: Json | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
          currency_code?: string | null;
          our_url?: string | null; // Renamed from url
          stock_quantity?: number | null;
          stock_status?: string | null;
          availability_date?: string | null;
          raw_stock_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "temp_integrations_scraped_data_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "integrations";
            referencedColumns: ["id"];
          }
        ];
      };

      // Product match reviews table for EAN conflicts
      product_match_reviews: {
        Row: {
          id: string;
          user_id: string;
          ean: string;
          existing_product_id: string;
          existing_product_name: string;
          existing_product_sku: string | null;
          existing_product_brand: string | null;
          existing_product_price: number | null;
          new_product_name: string;
          new_product_sku: string | null;
          new_product_brand: string | null;
          new_product_price: number | null;
          new_product_data: Record<string, unknown>; // JSONB
          source_table: string;
          source_record_id: string;
          conflict_reason: string;
          price_difference_percent: number | null;
          status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          ean: string;
          existing_product_id: string;
          existing_product_name: string;
          existing_product_sku?: string | null;
          existing_product_brand?: string | null;
          existing_product_price?: number | null;
          new_product_name: string;
          new_product_sku?: string | null;
          new_product_brand?: string | null;
          new_product_price?: number | null;
          new_product_data: Record<string, unknown>; // JSONB
          source_table: string;
          source_record_id: string;
          conflict_reason: string;
          price_difference_percent?: number | null;
          status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          ean?: string;
          existing_product_id?: string;
          existing_product_name?: string;
          existing_product_sku?: string | null;
          existing_product_brand?: string | null;
          existing_product_price?: number | null;
          new_product_name?: string;
          new_product_sku?: string | null;
          new_product_brand?: string | null;
          new_product_price?: number | null;
          new_product_data?: Record<string, unknown>; // JSONB
          source_table?: string;
          source_record_id?: string;
          conflict_reason?: string;
          price_difference_percent?: number | null;
          status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_match_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_match_reviews_existing_product_id_fkey";
            columns: ["existing_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_match_reviews_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      // Updated temp_suppliers_scraped_data table
      temp_suppliers_scraped_data: {
        Row: {
          id: string;
          user_id: string;
          supplier_id: string;
          scraper_id: string;
          run_id: string;
          name: string | null;
          sku: string | null;
          brand: string | null;
          ean: string | null;
          supplier_price: number | null; // Renamed from price
          supplier_recommended_price: number | null; // New field
          currency_code: string | null;
          supplier_url: string | null; // Renamed from url
          image_url: string | null;
          minimum_order_quantity: number | null;
          lead_time_days: number | null;
          stock_level: number | null;
          product_description: string | null;
          category: string | null;
          scraped_at: string | null;
          processed: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          supplier_id: string;
          scraper_id: string;
          run_id: string;
          name?: string | null;
          sku?: string | null;
          brand?: string | null;
          ean?: string | null;
          supplier_price?: number | null;
          supplier_recommended_price?: number | null;
          currency_code?: string | null;
          supplier_url?: string | null; // Renamed from url
          image_url?: string | null;
          minimum_order_quantity?: number | null;
          lead_time_days?: number | null;
          stock_level?: number | null;
          product_description?: string | null;
          category?: string | null;
          scraped_at?: string | null;
          processed?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          supplier_id?: string;
          scraper_id?: string;
          run_id?: string;
          name?: string | null;
          sku?: string | null;
          brand?: string | null;
          ean?: string | null;
          supplier_price?: number | null;
          supplier_recommended_price?: number | null;
          currency_code?: string | null;
          supplier_url?: string | null; // Renamed from url
          image_url?: string | null;
          minimum_order_quantity?: number | null;
          lead_time_days?: number | null;
          stock_level?: number | null;
          product_description?: string | null;
          category?: string | null;
          scraped_at?: string | null;
          processed?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "temp_suppliers_scraped_data_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
