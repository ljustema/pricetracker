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
      brand_aliases: {
        Row: {
          alias_name: string
          brand_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          alias_name: string
          brand_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alias_name?: string
          brand_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          needs_review: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          needs_review?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          needs_review?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      // Other tables omitted for brevity

      scraper_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_batch: number | null
          current_phase: number | null
          error_details: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          is_test_run: boolean | null
          product_count: number | null
          products_per_second: number | null
          progress_messages: string[] | null
          scraper_id: string
          scraper_type: string | null
          started_at: string
          status: string | null
          total_batches: number | null
          user_id: string
          claimed_by_worker_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          current_phase?: number | null
          error_details?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          is_test_run?: boolean | null
          product_count?: number | null
          products_per_second?: number | null
          progress_messages?: string[] | null
          scraper_id: string
          scraper_type?: string | null
          started_at?: string
          status?: string | null
          total_batches?: number | null
          user_id: string
          claimed_by_worker_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          current_phase?: number | null
          error_details?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          is_test_run?: boolean | null
          product_count?: number | null
          products_per_second?: number | null
          progress_messages?: string[] | null
          scraper_id?: string
          scraper_type?: string | null
          started_at?: string
          status?: string | null
          total_batches?: number | null
          user_id?: string
          claimed_by_worker_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_runs_scraper_id_fkey"
            columns: ["scraper_id"]
            isOneToOne: false
            referencedRelation: "scrapers"
            referencedColumns: ["id"]
          }
        ]
      }

      // Other tables would go here...
    }
    // Other database objects would go here...
  }
}
