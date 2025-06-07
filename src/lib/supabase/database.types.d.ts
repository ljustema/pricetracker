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
          url: string | null;
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
          url?: string | null;
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
          url?: string | null;
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
          url: string | null;
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
          url?: string | null;
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
          url?: string | null;
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
          url: string | null;
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
          url?: string | null;
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
          url?: string | null;
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
          url: string | null;
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
          url?: string | null;
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
          url?: string | null;
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
