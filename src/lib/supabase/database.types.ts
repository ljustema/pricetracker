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
      companies: {
        Row: {
          id: string
          user_id: string
          name: string | null
          address: string | null
          org_number: string | null
          primary_currency: string | null
          secondary_currencies: string[] | null
          currency_format: string | null
          matching_rules: Json | null
          price_thresholds: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          address?: string | null
          org_number?: string | null
          primary_currency?: string | null
          secondary_currencies?: string[] | null
          currency_format?: string | null
          matching_rules?: Json | null
          price_thresholds?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          address?: string | null
          org_number?: string | null
          primary_currency?: string | null
          secondary_currencies?: string[] | null
          currency_format?: string | null
          matching_rules?: Json | null
          price_thresholds?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      // Add other tables as needed
    }
    Functions: {
      get_or_create_company: {
        Args: { p_user_id: string }
        Returns: string
      }
      // Add other functions as needed
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
};

export const Constants = {
  public: {
    Enums: {},
  },
};
