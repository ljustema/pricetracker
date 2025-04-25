export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    public: {
        Tables: {
            brands: {
                Row: {
                    created_at: string | null;
                    id: string;
                    is_active: boolean | null;
                    name: string;
                    needs_review: boolean;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    name: string;
                    needs_review?: boolean;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    name?: string;
                    needs_review?: boolean;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            competitors: {
                Row: {
                    created_at: string | null;
                    id: string;
                    is_active: boolean | null;
                    logo_url: string | null;
                    name: string;
                    notes: string | null;
                    updated_at: string | null;
                    user_id: string;
                    website: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    logo_url?: string | null;
                    name: string;
                    notes?: string | null;
                    updated_at?: string | null;
                    user_id: string;
                    website: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    is_active?: boolean | null;
                    logo_url?: string | null;
                    name?: string;
                    notes?: string | null;
                    updated_at?: string | null;
                    user_id?: string;
                    website?: string;
                };
                Relationships: [];
            };
            csv_uploads: {
                Row: {
                    competitor_id: string;
                    error_message: string | null;
                    file_content: string;
                    filename: string;
                    id: string;
                    processed: boolean | null;
                    processed_at: string | null;
                    uploaded_at: string | null;
                    user_id: string;
                };
                Insert: {
                    competitor_id: string;
                    error_message?: string | null;
                    file_content: string;
                    filename: string;
                    id?: string;
                    processed?: boolean | null;
                    processed_at?: string | null;
                    uploaded_at?: string | null;
                    user_id: string;
                };
                Update: {
                    competitor_id?: string;
                    error_message?: string | null;
                    file_content?: string;
                    filename?: string;
                    id?: string;
                    processed?: boolean | null;
                    processed_at?: string | null;
                    uploaded_at?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "csv_uploads_competitor_id_fkey";
                        columns: ["competitor_id"];
                        isOneToOne: false;
                        referencedRelation: "competitors";
                        referencedColumns: ["id"];
                    }
                ];
            };
            debug_logs: {
                Row: {
                    created_at: string | null;
                    id: number;
                    message: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: number;
                    message?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: number;
                    message?: string | null;
                };
                Relationships: [];
            };
            price_changes: {
                Row: {
                    changed_at: string | null;
                    competitor_id: string;
                    id: string;
                    new_price: number;
                    old_price: number;
                    price_change_percentage: number;
                    product_id: string;
                    user_id: string;
                };
                Insert: {
                    changed_at?: string | null;
                    competitor_id: string;
                    id?: string;
                    new_price: number;
                    old_price: number;
                    price_change_percentage: number;
                    product_id: string;
                    user_id: string;
                };
                Update: {
                    changed_at?: string | null;
                    competitor_id?: string;
                    id?: string;
                    new_price?: number;
                    old_price?: number;
                    price_change_percentage?: number;
                    product_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "price_changes_competitor_id_fkey";
                        columns: ["competitor_id"];
                        isOneToOne: false;
                        referencedRelation: "competitors";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "price_changes_product_id_fkey";
                        columns: ["product_id"];
                        isOneToOne: false;
                        referencedRelation: "products";
                        referencedColumns: ["id"];
                    }
                ];
            };
            products: {
                Row: {
                    brand: string | null;
                    brand_id: string | null;
                    category: string | null;
                    wholesale_price: number | null;
                    created_at: string | null;
                    description: string | null;
                    ean: string | null;
                    id: string;
                    image_url: string | null;
                    is_active: boolean | null;
                    name: string;
                    our_price: number | null;
                    sku: string | null;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    brand?: string | null;
                    brand_id?: string | null;
                    category?: string | null;
                    wholesale_price?: number | null;
                    created_at?: string | null;
                    description?: string | null;
                    ean?: string | null;
                    id?: string;
                    image_url?: string | null;
                    is_active?: boolean | null;
                    name: string;
                    our_price?: number | null;
                    sku?: string | null;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    brand?: string | null;
                    brand_id?: string | null;
                    category?: string | null;
                    wholesale_price?: number | null;
                    created_at?: string | null;
                    description?: string | null;
                    ean?: string | null;
                    id?: string;
                    image_url?: string | null;
                    is_active?: boolean | null;
                    name?: string;
                    our_price?: number | null;
                    sku?: string | null;
                    updated_at?: string | null;
                    user_id?: string;
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
            scraped_products: {
                Row: {
                    brand: string | null;
                    competitor_id: string;
                    currency: string | null;
                    ean: string | null;
                    id: string;
                    image_url: string | null;
                    name: string;
                    price: number;
                    product_id: string | null;
                    scraped_at: string | null;
                    scraper_id: string | null;
                    sku: string | null;
                    url: string | null;
                    user_id: string;
                };
                Insert: {
                    brand?: string | null;
                    competitor_id: string;
                    currency?: string | null;
                    ean?: string | null;
                    id?: string;
                    image_url?: string | null;
                    name: string;
                    price: number;
                    product_id?: string | null;
                    scraped_at?: string | null;
                    scraper_id?: string | null;
                    sku?: string | null;
                    url?: string | null;
                    user_id: string;
                };
                Update: {
                    brand?: string | null;
                    competitor_id?: string;
                    currency?: string | null;
                    ean?: string | null;
                    id?: string;
                    image_url?: string | null;
                    name?: string;
                    price?: number;
                    product_id?: string | null;
                    scraped_at?: string | null;
                    scraper_id?: string | null;
                    sku?: string | null;
                    url?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "scraped_products_competitor_id_fkey";
                        columns: ["competitor_id"];
                        isOneToOne: false;
                        referencedRelation: "competitors";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "scraped_products_product_id_fkey";
                        columns: ["product_id"];
                        isOneToOne: false;
                        referencedRelation: "products";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "scraped_products_scraper_id_fkey";
                        columns: ["scraper_id"];
                        isOneToOne: false;
                        referencedRelation: "scrapers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            scraper_run_timeouts: {
                Row: {
                    created_at: string;
                    id: string;
                    processed: boolean;
                    processed_at: string | null;
                    run_id: string;
                    timeout_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    processed?: boolean;
                    processed_at?: string | null;
                    run_id: string;
                    timeout_at: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    processed?: boolean;
                    processed_at?: string | null;
                    run_id?: string;
                    timeout_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "scraper_run_timeouts_run_id_fkey";
                        columns: ["run_id"];
                        isOneToOne: false;
                        referencedRelation: "scraper_runs";
                        referencedColumns: ["id"];
                    }
                ];
            };
            scraper_runs: {
                Row: {
                    completed_at: string | null;
                    created_at: string | null;
                    current_batch: number | null;
                    error_details: string | null;
                    error_message: string | null;
                    execution_time_ms: number | null;
                    id: string;
                    is_test_run: boolean | null;
                    product_count: number | null;
                    products_per_second: number | null;
                    progress_messages: string[] | null;
                    scraper_id: string;
                    scraper_type: string | null;
                    started_at: string;
                    status: string | null;
                    total_batches: number | null;
                    user_id: string;
                };
                Insert: {
                    completed_at?: string | null;
                    created_at?: string | null;
                    current_batch?: number | null;
                    error_details?: string | null;
                    error_message?: string | null;
                    execution_time_ms?: number | null;
                    id: string;
                    is_test_run?: boolean | null;
                    product_count?: number | null;
                    products_per_second?: number | null;
                    progress_messages?: string[] | null;
                    scraper_id: string;
                    scraper_type?: string | null;
                    started_at: string;
                    status?: string | null;
                    total_batches?: number | null;
                    user_id: string;
                };
                Update: {
                    completed_at?: string | null;
                    created_at?: string | null;
                    current_batch?: number | null;
                    error_details?: string | null;
                    error_message?: string | null;
                    execution_time_ms?: number | null;
                    id?: string;
                    is_test_run?: boolean | null;
                    product_count?: number | null;
                    products_per_second?: number | null;
                    progress_messages?: string[] | null;
                    scraper_id?: string;
                    scraper_type?: string | null;
                    started_at?: string;
                    status?: string | null;
                    total_batches?: number | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "scraper_runs_scraper_id_fkey";
                        columns: ["scraper_id"];
                        isOneToOne: false;
                        referencedRelation: "scrapers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            scrapers: {
                Row: {
                    competitor_id: string;
                    created_at: string | null;
                    error_message: string | null;
                    execution_time: number | null;
                    filter_by_active_brands: boolean;
                    id: string;
                    is_active: boolean | null;
                    is_approved: boolean | null;
                    last_products_per_second: number | null;
                    last_run: string | null;
                    name: string;
                    python_script: string | null;
                    schedule: Json;
                    scrape_only_own_products: boolean;
                    scraper_type: string;
                    script_metadata: Json | null;
                    status: string | null;
                    test_results: Json | null;
                    typescript_script: string | null;
                    updated_at: string | null;
                    url: string;
                    user_id: string;
                };
                Insert: {
                    competitor_id: string;
                    created_at?: string | null;
                    error_message?: string | null;
                    execution_time?: number | null;
                    filter_by_active_brands?: boolean;
                    id?: string;
                    is_active?: boolean | null;
                    is_approved?: boolean | null;
                    last_products_per_second?: number | null;
                    last_run?: string | null;
                    name: string;
                    python_script?: string | null;
                    schedule: Json;
                    scrape_only_own_products?: boolean;
                    scraper_type?: string;
                    script_metadata?: Json | null;
                    status?: string | null;
                    test_results?: Json | null;
                    typescript_script?: string | null;
                    updated_at?: string | null;
                    url: string;
                    user_id: string;
                };
                Update: {
                    competitor_id?: string;
                    created_at?: string | null;
                    error_message?: string | null;
                    execution_time?: number | null;
                    filter_by_active_brands?: boolean;
                    id?: string;
                    is_active?: boolean | null;
                    is_approved?: boolean | null;
                    last_products_per_second?: number | null;
                    last_run?: string | null;
                    name?: string;
                    python_script?: string | null;
                    schedule?: Json;
                    scrape_only_own_products?: boolean;
                    scraper_type?: string;
                    script_metadata?: Json | null;
                    status?: string | null;
                    test_results?: Json | null;
                    typescript_script?: string | null;
                    updated_at?: string | null;
                    url?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "scrapers_competitor_id_fkey";
                        columns: ["competitor_id"];
                        isOneToOne: false;
                        referencedRelation: "competitors";
                        referencedColumns: ["id"];
                    }
                ];
            };
            user_profiles: {
                Row: {
                    avatar_url: string | null;
                    created_at: string | null;
                    id: string;
                    name: string | null;
                    subscription_tier: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    avatar_url?: string | null;
                    created_at?: string | null;
                    id: string;
                    name?: string | null;
                    subscription_tier?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    avatar_url?: string | null;
                    created_at?: string | null;
                    id?: string;
                    name?: string | null;
                    subscription_tier?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            user_subscriptions: {
                Row: {
                    created_at: string | null;
                    id: string;
                    price_id: string | null;
                    status: string | null;
                    stripe_customer_id: string | null;
                    stripe_subscription_id: string | null;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    id?: string;
                    price_id?: string | null;
                    status?: string | null;
                    stripe_customer_id?: string | null;
                    stripe_subscription_id?: string | null;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    price_id?: string | null;
                    status?: string | null;
                    stripe_customer_id?: string | null;
                    stripe_subscription_id?: string | null;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            cleanup_scraped_products: {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            create_user_for_nextauth: {
                Args: {
                    user_id: string;
                    email: string;
                    name: string;
                };
                Returns: undefined;
            };
            get_products_filtered: {
                Args: {
                    p_user_id: string;
                    p_page?: number;
                    p_page_size?: number;
                    p_sort_by?: string;
                    p_sort_order?: string;
                    p_brand?: string;
                    p_category?: string;
                    p_search?: string;
                    p_is_active?: boolean;
                    p_competitor_id?: string;
                    p_has_price?: boolean;
                };
                Returns: Json;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DefaultSchema = Database[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof Database;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof Database;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof Database;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
} ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof Database;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
} ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof Database;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
} ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
} ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export declare const Constants: {
    readonly public: {
        readonly Enums: {};
    };
};
export {};
//# sourceMappingURL=database.types.d.ts.map