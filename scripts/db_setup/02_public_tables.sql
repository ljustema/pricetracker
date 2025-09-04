-- =========================================================================
-- Public schema tables and sequences
-- =========================================================================
-- Generated: 2025-09-04 14:04:57
-- This file is part of the PriceTracker database setup
-- =========================================================================

--
-- Name: integration_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    products_processed integer DEFAULT 0,
    products_updated integer DEFAULT 0,
    products_created integer DEFAULT 0,
    error_message text,
    log_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    test_products jsonb,
    configuration jsonb,
    last_progress_update timestamp with time zone
);

--
-- Name: temp_integrations_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_integrations_scraped_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    integration_run_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prestashop_product_id text,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    our_retail_price numeric(10,2),
    our_wholesale_price numeric(10,2),
    image_url text,
    raw_data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    currency_code text,
    our_url text,
    stock_quantity integer,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb,
    CONSTRAINT temp_integrations_scraped_data_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);

--
-- Name: COLUMN temp_integrations_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.stock_quantity IS 'Numeric stock quantity from integration';

--
-- Name: COLUMN temp_integrations_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.stock_status IS 'Text stock status from integration';

--
-- Name: COLUMN temp_integrations_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.availability_date IS 'Future availability date if product is out of stock';

--
-- Name: COLUMN temp_integrations_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_integrations_scraped_data.raw_stock_data IS 'Raw stock data from integration including detailed stock information';

--
-- Name: admin_communication_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_communication_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    admin_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    communication_type text DEFAULT 'email'::text NOT NULL,
    subject text,
    message_content text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'sent'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: TABLE admin_communication_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_communication_log IS 'Logs communications sent by admins to users.';

--
-- Name: COLUMN admin_communication_log.admin_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_communication_log.admin_user_id IS 'The ID of the admin who sent the communication.';

--
-- Name: COLUMN admin_communication_log.target_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_communication_log.target_user_id IS 'The ID of the user who received the communication.';

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    key_name text NOT NULL,
    api_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true,
    permissions jsonb DEFAULT '{}'::jsonb
);

--
-- Name: brand_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_aliases (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    alias_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    needs_review boolean DEFAULT false NOT NULL
);

--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    website text NOT NULL,
    logo_url text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: cron_job_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_job_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_name text NOT NULL,
    execution_date date NOT NULL,
    status text NOT NULL,
    duration_seconds integer,
    details text,
    users_processed integer DEFAULT 0,
    snapshots_created integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: TABLE cron_job_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cron_job_logs IS 'Logs for cron job executions, including daily price snapshots';

--
-- Name: COLUMN cron_job_logs.job_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_job_logs.job_name IS 'Name of the cron job (e.g., daily_price_snapshots)';

--
-- Name: COLUMN cron_job_logs.execution_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_job_logs.execution_date IS 'Date when the job was executed';

--
-- Name: COLUMN cron_job_logs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_job_logs.status IS 'SUCCESS, FAILED, or PARTIAL_SUCCESS';

--
-- Name: COLUMN cron_job_logs.details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_job_logs.details IS 'Detailed log output from the job execution';

--
-- Name: csv_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csv_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    filename text NOT NULL,
    file_content text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text
);

--
-- Name: daily_price_competitiveness_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_price_competitiveness_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    competitor_id uuid,
    brand_filter text,
    total_products_analyzed integer DEFAULT 0 NOT NULL,
    products_we_are_cheapest integer DEFAULT 0 NOT NULL,
    products_we_are_same_price integer DEFAULT 0 NOT NULL,
    products_we_are_more_expensive integer DEFAULT 0 NOT NULL,
    cheapest_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    same_price_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    more_expensive_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    avg_price_difference_when_higher numeric(10,2),
    avg_price_difference_percentage_when_higher numeric(5,2),
    total_potential_savings numeric(12,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: TABLE daily_price_competitiveness_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.daily_price_competitiveness_snapshots IS 'Stores daily snapshots of price competitiveness for historical trend analysis. Supports both competitor-specific and brand-specific filtering.';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.competitor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.competitor_id IS 'NULL means analysis across all competitors';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.brand_filter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.brand_filter IS 'NULL means analysis across all brands. When set, only products matching this brand are included.';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.total_products_analyzed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.total_products_analyzed IS 'Total number of products included in this snapshot analysis';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.products_we_are_cheapest; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.products_we_are_cheapest IS 'Number of products where our price is lower than or equal to the lowest competitor price';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.products_we_are_same_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.products_we_are_same_price IS 'Number of products where our price exactly matches the lowest competitor price';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.products_we_are_more_expensive; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.products_we_are_more_expensive IS 'Number of products where our price is higher than the lowest competitor price';

--
-- Name: COLUMN daily_price_competitiveness_snapshots.total_potential_savings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.daily_price_competitiveness_snapshots.total_potential_savings IS 'Total amount in kr that customers could save if we matched all lowest competitor prices';

--
-- Name: debug_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_logs (
    id integer NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: debug_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.debug_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: debug_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.debug_logs_id_seq OWNED BY public.debug_logs.id;

--
-- Name: dismissed_duplicates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_duplicates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brand_id_1 uuid NOT NULL,
    brand_id_2 uuid NOT NULL,
    dismissal_key text NOT NULL,
    dismissed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brand_id_order CHECK ((brand_id_1 < brand_id_2))
);

--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    name text NOT NULL,
    api_url text NOT NULL,
    api_key text NOT NULL,
    status text DEFAULT 'pending_setup'::text NOT NULL,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    sync_frequency text DEFAULT 'daily'::text,
    configuration jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    next_run_time timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);

--
-- Name: COLUMN integrations.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.integrations.is_active IS 'Whether the integration is active and should run on schedule';

--
-- Name: marketing_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    message text NOT NULL,
    contact_type text DEFAULT 'general'::text,
    status text DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketing_contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['general'::text, 'sales'::text, 'support'::text, 'partnership'::text]))),
    CONSTRAINT marketing_contacts_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'resolved'::text])))
);

--
-- Name: newsletter_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    subscribed_at timestamp with time zone DEFAULT now(),
    unsubscribed_at timestamp with time zone,
    is_active boolean DEFAULT true
);

--
-- Name: price_changes_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    old_competitor_price numeric(10,2),
    new_competitor_price numeric(10,2),
    price_change_percentage numeric(10,2),
    changed_at timestamp with time zone DEFAULT now(),
    integration_id uuid,
    currency_code text,
    competitor_url text,
    old_our_retail_price numeric(10,2),
    new_our_retail_price numeric(10,2),
    our_url text,
    CONSTRAINT check_at_least_one_price CHECK (((new_competitor_price IS NOT NULL) OR (new_our_retail_price IS NOT NULL))),
    CONSTRAINT check_competitor_price_has_competitor_id CHECK ((((old_competitor_price IS NULL) AND (new_competitor_price IS NULL)) OR ((competitor_id IS NOT NULL) AND (integration_id IS NULL)))),
    CONSTRAINT check_our_retail_price_has_integration_id CHECK ((((old_our_retail_price IS NULL) AND (new_our_retail_price IS NULL)) OR ((integration_id IS NOT NULL) AND (competitor_id IS NULL)))),
    CONSTRAINT check_price_consistency CHECK ((((old_competitor_price IS NULL) = (new_competitor_price IS NULL)) OR ((old_our_retail_price IS NULL) = (new_our_retail_price IS NULL)))),
    CONSTRAINT check_price_type_consistency CHECK ((((old_competitor_price IS NULL) AND (old_our_retail_price IS NULL)) OR ((old_competitor_price IS NOT NULL) AND (old_our_retail_price IS NULL)) OR ((old_competitor_price IS NULL) AND (old_our_retail_price IS NOT NULL)))),
    CONSTRAINT price_changes_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code)))),
    CONSTRAINT price_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);

--
-- Name: COLUMN price_changes_competitors.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.price_changes_competitors.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

--
-- Name: price_changes_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_changes_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    old_our_wholesale_price numeric(10,2),
    new_our_wholesale_price numeric(10,2),
    price_change_percentage numeric(10,2),
    currency_code text DEFAULT 'SEK'::text,
    supplier_url text,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    changed_at timestamp with time zone DEFAULT now(),
    change_source text DEFAULT 'manual'::text,
    old_supplier_price numeric(10,2),
    new_supplier_price numeric(10,2),
    old_supplier_recommended_price numeric(10,2),
    new_supplier_recommended_price numeric(10,2),
    integration_id uuid,
    our_url text,
    CONSTRAINT check_exactly_one_source CHECK ((((supplier_id IS NOT NULL) AND (integration_id IS NULL)) OR ((supplier_id IS NULL) AND (integration_id IS NOT NULL)))),
    CONSTRAINT check_our_wholesale_price_has_integration_id CHECK ((((old_our_wholesale_price IS NULL) AND (new_our_wholesale_price IS NULL)) OR ((integration_id IS NOT NULL) AND (supplier_id IS NULL)))),
    CONSTRAINT check_supplier_price_consistency CHECK ((((old_supplier_price IS NULL) AND (new_supplier_price IS NULL)) OR ((old_supplier_price IS NULL) AND (new_supplier_price IS NOT NULL)) OR ((old_supplier_price IS NOT NULL) AND (new_supplier_price IS NOT NULL)) OR ((old_supplier_price IS NOT NULL) AND (new_supplier_price IS NULL)))),
    CONSTRAINT check_supplier_price_has_supplier_id CHECK ((((old_supplier_price IS NULL) AND (new_supplier_price IS NULL)) OR ((supplier_id IS NOT NULL) AND (integration_id IS NULL)))),
    CONSTRAINT price_changes_suppliers_change_source_check CHECK ((change_source = ANY (ARRAY['manual'::text, 'csv'::text, 'scraper'::text, 'integration'::text])))
);

--
-- Name: product_custom_field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_field_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    custom_field_id uuid NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_type character varying(20),
    source_id uuid,
    last_updated_by character varying(20),
    confidence_score integer DEFAULT 100,
    created_by_source character varying(20),
    value_hash text
);

--
-- Name: product_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    field_name text NOT NULL,
    field_type text NOT NULL,
    is_required boolean DEFAULT false,
    default_value text,
    validation_rules jsonb,
    created_at timestamp with time zone DEFAULT now(),
    update_strategy character varying(20) DEFAULT 'source_priority'::character varying,
    source_priority jsonb DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::jsonb,
    allow_auto_update boolean DEFAULT true,
    CONSTRAINT user_custom_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'url'::text, 'date'::text])))
);

--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    sku text,
    ean text,
    brand text,
    category text,
    description text,
    image_url text,
    our_retail_price numeric(10,2),
    our_wholesale_price numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brand_id uuid NOT NULL,
    currency_code text,
    our_url text,
    CONSTRAINT products_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);

--
-- Name: COLUMN products.currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.currency_code IS 'ISO 4217 currency code (e.g., SEK, USD)';

--
-- Name: COLUMN products.our_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.our_url IS 'URL to the product on the source platform';

--
-- Name: products_dismissed_duplicates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products_dismissed_duplicates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id_1 uuid NOT NULL,
    product_id_2 uuid NOT NULL,
    dismissal_key text NOT NULL,
    dismissed_at timestamp without time zone DEFAULT now(),
    CONSTRAINT product_id_order CHECK ((product_id_1 < product_id_2))
);

--
-- Name: professional_scraper_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professional_scraper_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    competitor_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    website text NOT NULL,
    requirements text NOT NULL,
    additional_info text,
    status text DEFAULT 'submitted'::text,
    quoted_price numeric(10,2),
    estimated_delivery_days integer,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT professional_scraper_requests_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'quoted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);

--
-- Name: rate_limit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet NOT NULL,
    endpoint text NOT NULL,
    attempts integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: scraper_ai_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_ai_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_phase text NOT NULL,
    analysis_data jsonb DEFAULT '{}'::jsonb,
    url_collection_data jsonb DEFAULT '{}'::jsonb,
    data_extraction_data jsonb DEFAULT '{}'::jsonb,
    assembly_data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT scraper_ai_sessions_current_phase_check CHECK ((current_phase = ANY (ARRAY['analysis'::text, 'data-validation'::text, 'assembly'::text, 'complete'::text])))
);

--
-- Name: TABLE scraper_ai_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scraper_ai_sessions IS 'AI scraper sessions with phases: analysis, data-validation, assembly, complete';

--
-- Name: COLUMN scraper_ai_sessions.current_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.current_phase IS 'Current phase of the AI scraper generation process: analysis, data-validation, assembly, complete';

--
-- Name: COLUMN scraper_ai_sessions.analysis_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.analysis_data IS 'Data from the site analysis phase';

--
-- Name: COLUMN scraper_ai_sessions.url_collection_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.url_collection_data IS 'Legacy: Data from the URL collection phase (now part of data-validation)';

--
-- Name: COLUMN scraper_ai_sessions.data_extraction_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.data_extraction_data IS 'Data from the data validation phase (previously data-extraction)';

--
-- Name: COLUMN scraper_ai_sessions.assembly_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scraper_ai_sessions.assembly_data IS 'Data from the script assembly phase';

--
-- Name: scraper_run_timeouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_run_timeouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    timeout_at timestamp with time zone NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: scraper_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_runs (
    id uuid NOT NULL,
    scraper_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'initializing'::text,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    is_test_run boolean DEFAULT false,
    product_count integer DEFAULT 0,
    current_batch integer DEFAULT 0,
    total_batches integer,
    error_message text,
    progress_messages text[],
    created_at timestamp with time zone DEFAULT now(),
    execution_time_ms bigint,
    products_per_second numeric(10,2),
    scraper_type text,
    error_details text,
    claimed_by_worker_at timestamp with time zone,
    current_phase integer
);

--
-- Name: scrapers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrapers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competitor_id uuid,
    name text NOT NULL,
    url text NOT NULL,
    schedule jsonb NOT NULL,
    is_active boolean DEFAULT false,
    status text DEFAULT 'idle'::text,
    error_message text,
    last_run timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scraper_type character varying(20) DEFAULT 'ai'::character varying NOT NULL,
    python_script text,
    script_metadata jsonb,
    test_results jsonb,
    execution_time bigint,
    last_products_per_second numeric(10,2),
    typescript_script text,
    scrape_only_own_products boolean DEFAULT false NOT NULL,
    filter_by_active_brands boolean DEFAULT false NOT NULL,
    supplier_id uuid,
    next_run_time timestamp with time zone,
    CONSTRAINT scrapers_target_check CHECK ((((competitor_id IS NOT NULL) AND (supplier_id IS NULL)) OR ((competitor_id IS NULL) AND (supplier_id IS NOT NULL))))
);

--
-- Name: TABLE scrapers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scrapers IS 'Stores scraper configurations for different types: AI, Python, and CSV';

--
-- Name: COLUMN scrapers.execution_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.execution_time IS 'Time in milliseconds it took to run the scraper';

--
-- Name: COLUMN scrapers.last_products_per_second; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.last_products_per_second IS 'Products per second metric from the most recently completed successful run.';

--
-- Name: COLUMN scrapers.scrape_only_own_products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scrapers.scrape_only_own_products IS 'Flag to only scrape products matching the user''s own product catalog (based on EAN/SKU/Brand matching)';

--
-- Name: stock_changes_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_changes_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    competitor_id uuid,
    integration_id uuid,
    old_stock_quantity integer,
    new_stock_quantity integer,
    old_stock_status text,
    new_stock_status text,
    old_availability_date date,
    new_availability_date date,
    stock_change_quantity integer,
    changed_at timestamp with time zone DEFAULT now(),
    raw_stock_data jsonb,
    competitor_url text,
    our_url text,
    CONSTRAINT stock_changes_source_check CHECK (((competitor_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);

--
-- Name: TABLE stock_changes_competitors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_changes_competitors IS 'Tracks stock level changes for competitor products over time';

--
-- Name: COLUMN stock_changes_competitors.stock_change_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_competitors.stock_change_quantity IS 'Calculated field: new_stock_quantity - old_stock_quantity';

--
-- Name: COLUMN stock_changes_competitors.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_competitors.raw_stock_data IS 'JSON data containing detailed stock information like product combinations/variants';

--
-- Name: stock_changes_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_changes_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    integration_id uuid,
    old_stock_quantity integer,
    new_stock_quantity integer,
    old_stock_status text,
    new_stock_status text,
    old_availability_date date,
    new_availability_date date,
    stock_change_quantity integer,
    changed_at timestamp with time zone DEFAULT now(),
    raw_stock_data jsonb,
    supplier_url text,
    our_url text,
    CONSTRAINT stock_changes_suppliers_source_check CHECK (((supplier_id IS NOT NULL) OR (integration_id IS NOT NULL)))
);

--
-- Name: TABLE stock_changes_suppliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_changes_suppliers IS 'Tracks stock level changes for supplier products over time';

--
-- Name: COLUMN stock_changes_suppliers.stock_change_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_suppliers.stock_change_quantity IS 'Calculated field: new_stock_quantity - old_stock_quantity';

--
-- Name: COLUMN stock_changes_suppliers.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stock_changes_suppliers.raw_stock_data IS 'JSON data containing detailed stock information';

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    website text,
    contact_email text,
    contact_phone text,
    logo_url text,
    notes text,
    login_username text,
    login_password text,
    api_key text,
    api_url text,
    login_url text,
    price_file_url text,
    scraping_config jsonb,
    sync_frequency text DEFAULT 'weekly'::text,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suppliers_sync_frequency_check CHECK ((sync_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'manual'::text])))
);

--
-- Name: support_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    admin_user_id uuid,
    subject text NOT NULL,
    status text DEFAULT 'open'::text,
    priority text DEFAULT 'medium'::text,
    category text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    last_read_by_user timestamp with time zone,
    last_read_by_admin timestamp with time zone,
    CONSTRAINT support_conversations_category_check CHECK ((category = ANY (ARRAY['general'::text, 'technical'::text, 'billing'::text, 'scraper_request'::text, 'feature_request'::text]))),
    CONSTRAINT support_conversations_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])))
);

--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    sender_id uuid,
    sender_type text NOT NULL,
    message_content text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_by_recipient boolean DEFAULT false,
    CONSTRAINT support_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['user'::text, 'admin'::text])))
);

--
-- Name: temp_competitors_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_competitors_scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scraper_id uuid,
    competitor_id uuid NOT NULL,
    product_id uuid,
    name text NOT NULL,
    competitor_price numeric(10,2) NOT NULL,
    competitor_url text,
    image_url text,
    sku text,
    brand text,
    scraped_at timestamp with time zone DEFAULT now(),
    ean text,
    currency_code text,
    raw_data jsonb,
    stock_quantity integer,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb,
    processed boolean DEFAULT false,
    CONSTRAINT temp_competitors_scraped_data_currency_code_check CHECK (((char_length(currency_code) = 3) AND (currency_code = upper(currency_code))))
);

--
-- Name: COLUMN temp_competitors_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.stock_quantity IS 'Numeric stock quantity extracted from competitor site';

--
-- Name: COLUMN temp_competitors_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.stock_status IS 'Text stock status (e.g., "I lager", "Ej i lager")';

--
-- Name: COLUMN temp_competitors_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.availability_date IS 'Future availability date if product is out of stock';

--
-- Name: COLUMN temp_competitors_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_competitors_scraped_data.raw_stock_data IS 'Raw stock data from scraper including combinations and metadata';

--
-- Name: temp_suppliers_scraped_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_suppliers_scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    scraper_id uuid NOT NULL,
    run_id text NOT NULL,
    name text,
    sku text,
    brand text,
    ean text,
    supplier_price numeric(10,2),
    currency_code text DEFAULT 'SEK'::text,
    supplier_url text,
    image_url text,
    minimum_order_quantity integer DEFAULT 1,
    lead_time_days integer,
    stock_quantity integer,
    product_description text,
    category text,
    scraped_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    supplier_recommended_price numeric(10,2),
    raw_data jsonb,
    stock_status text,
    availability_date date,
    raw_stock_data jsonb
);

--
-- Name: COLUMN temp_suppliers_scraped_data.supplier_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.supplier_price IS 'Supplier cost price (what they charge us)';

--
-- Name: COLUMN temp_suppliers_scraped_data.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.stock_quantity IS 'Numeric stock quantity from supplier (renamed from stock_level)';

--
-- Name: COLUMN temp_suppliers_scraped_data.supplier_recommended_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.supplier_recommended_price IS 'Supplier recommended retail price (what they suggest we charge customers)';

--
-- Name: COLUMN temp_suppliers_scraped_data.stock_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.stock_status IS 'Text stock status from supplier';

--
-- Name: COLUMN temp_suppliers_scraped_data.availability_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.availability_date IS 'Future availability date if product is out of stock';

--
-- Name: COLUMN temp_suppliers_scraped_data.raw_stock_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temp_suppliers_scraped_data.raw_stock_data IS 'Raw stock data from supplier including detailed stock information';

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    avatar_url text,
    subscription_tier text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    admin_role text,
    is_suspended boolean DEFAULT false
);

--
-- Name: COLUMN user_profiles.admin_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.admin_role IS 'Defines the admin role for the user, if any (e.g., super_admin, support_admin).';

--
-- Name: COLUMN user_profiles.is_suspended; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.is_suspended IS 'Indicates if the user account is currently suspended by an admin.';

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text,
    address text,
    org_number text,
    primary_currency text,
    secondary_currencies text[],
    currency_format text,
    matching_rules jsonb,
    price_thresholds jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auto_create_custom_fields boolean DEFAULT true,
    custom_fields_update_strategy character varying(20) DEFAULT 'source_priority'::character varying,
    custom_fields_source_priority jsonb DEFAULT '{"manual": 100, "supplier": 60, "competitor": 40, "integration": 80}'::jsonb,
    CONSTRAINT companies_primary_currency_check CHECK ((char_length(primary_currency) = 3))
);

--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    price_id text,
    status text DEFAULT 'inactive'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: debug_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_logs ALTER COLUMN id SET DEFAULT nextval('public.debug_logs_id_seq'::regclass);

--
-- Name: admin_communication_log admin_communication_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_communication_log
    ADD CONSTRAINT admin_communication_log_pkey PRIMARY KEY (id);

--
-- Name: api_keys api_keys_api_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_api_key_key UNIQUE (api_key);

--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

--
-- Name: brand_aliases brand_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_pkey PRIMARY KEY (id);

--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);

--
-- Name: user_settings companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);

--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);

--
-- Name: cron_job_logs cron_job_logs_job_name_execution_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_job_logs
    ADD CONSTRAINT cron_job_logs_job_name_execution_date_key UNIQUE (job_name, execution_date);

--
-- Name: cron_job_logs cron_job_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_job_logs
    ADD CONSTRAINT cron_job_logs_pkey PRIMARY KEY (id);

--
-- Name: csv_uploads csv_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_pkey PRIMARY KEY (id);

--
-- Name: daily_price_competitiveness_snapshots daily_price_competitiveness_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_price_competitiveness_snapshots
    ADD CONSTRAINT daily_price_competitiveness_snapshots_pkey PRIMARY KEY (id);

--
-- Name: debug_logs debug_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_logs
    ADD CONSTRAINT debug_logs_pkey PRIMARY KEY (id);

--
-- Name: dismissed_duplicates dismissed_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_pkey PRIMARY KEY (id);

--
-- Name: integration_runs integration_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_pkey PRIMARY KEY (id);

--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);

--
-- Name: marketing_contacts marketing_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_contacts
    ADD CONSTRAINT marketing_contacts_pkey PRIMARY KEY (id);

--
-- Name: newsletter_subscriptions newsletter_subscriptions_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_email_key UNIQUE (email);

--
-- Name: newsletter_subscriptions newsletter_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_pkey PRIMARY KEY (id);

--
-- Name: price_changes_competitors price_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_pkey PRIMARY KEY (id);

--
-- Name: price_changes_suppliers price_changes_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_pkey PRIMARY KEY (id);

--
-- Name: product_custom_field_values product_custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_pkey PRIMARY KEY (id);

--
-- Name: product_custom_field_values product_custom_field_values_product_id_custom_field_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_product_id_custom_field_id_key UNIQUE (product_id, custom_field_id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_pkey PRIMARY KEY (id);

--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

--
-- Name: professional_scraper_requests professional_scraper_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_pkey PRIMARY KEY (id);

--
-- Name: rate_limit_log rate_limit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_log
    ADD CONSTRAINT rate_limit_log_pkey PRIMARY KEY (id);

--
-- Name: scraper_ai_sessions scraper_ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_pkey PRIMARY KEY (id);

--
-- Name: scraper_run_timeouts scraper_run_timeouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_run_timeouts
    ADD CONSTRAINT scraper_run_timeouts_pkey PRIMARY KEY (id);

--
-- Name: scraper_runs scraper_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_pkey PRIMARY KEY (id);

--
-- Name: scrapers scrapers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_pkey PRIMARY KEY (id);

--
-- Name: stock_changes_competitors stock_changes_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT stock_changes_competitors_pkey PRIMARY KEY (id);

--
-- Name: stock_changes_suppliers stock_changes_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT stock_changes_suppliers_pkey PRIMARY KEY (id);

--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

--
-- Name: support_conversations support_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_pkey PRIMARY KEY (id);

--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_pkey PRIMARY KEY (id);

--
-- Name: temp_integrations_scraped_data temp_integrations_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_integrations_scraped_data
    ADD CONSTRAINT temp_integrations_scraped_data_pkey PRIMARY KEY (id);

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_pkey PRIMARY KEY (id);

--
-- Name: brand_aliases unique_brand_alias; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT unique_brand_alias UNIQUE (user_id, brand_id, alias_name);

--
-- Name: dismissed_duplicates unique_dismissed_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT unique_dismissed_pair UNIQUE (user_id, brand_id_1, brand_id_2);

--
-- Name: products_dismissed_duplicates unique_dismissed_product_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT unique_dismissed_product_pair UNIQUE (user_id, product_id_1, product_id_2);

--
-- Name: brands unique_user_brand; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT unique_user_brand UNIQUE (user_id, name);

--
-- Name: product_custom_fields user_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_pkey PRIMARY KEY (id);

--
-- Name: product_custom_fields user_custom_fields_user_id_field_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_user_id_field_name_key UNIQUE (user_id, field_name);

--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

--
-- Name: user_settings user_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);

--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);

--
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: brand_aliases brand_aliases_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;

--
-- Name: brand_aliases brand_aliases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_aliases
    ADD CONSTRAINT brand_aliases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: brands brands_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: competitors competitors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: csv_uploads csv_uploads_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: csv_uploads csv_uploads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csv_uploads
    ADD CONSTRAINT csv_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: daily_price_competitiveness_snapshots daily_price_competitiveness_snapshots_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_price_competitiveness_snapshots
    ADD CONSTRAINT daily_price_competitiveness_snapshots_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;

--
-- Name: daily_price_competitiveness_snapshots daily_price_competitiveness_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_price_competitiveness_snapshots
    ADD CONSTRAINT daily_price_competitiveness_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: dismissed_duplicates dismissed_duplicates_brand_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_brand_id_1_fkey FOREIGN KEY (brand_id_1) REFERENCES public.brands(id) ON DELETE CASCADE;

--
-- Name: dismissed_duplicates dismissed_duplicates_brand_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_brand_id_2_fkey FOREIGN KEY (brand_id_2) REFERENCES public.brands(id) ON DELETE CASCADE;

--
-- Name: dismissed_duplicates dismissed_duplicates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_duplicates
    ADD CONSTRAINT dismissed_duplicates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_competitor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_competitor FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_integration FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: stock_changes_competitors fk_stock_competitors_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_competitors
    ADD CONSTRAINT fk_stock_competitors_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_integration; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_integration FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

--
-- Name: stock_changes_suppliers fk_stock_suppliers_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_changes_suppliers
    ADD CONSTRAINT fk_stock_suppliers_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: integration_runs integration_runs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

--
-- Name: integration_runs integration_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_runs
    ADD CONSTRAINT integration_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: price_changes_competitors price_changes_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: price_changes_competitors price_changes_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

--
-- Name: price_changes_competitors price_changes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: price_changes_suppliers price_changes_suppliers_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

--
-- Name: price_changes_suppliers price_changes_suppliers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

--
-- Name: price_changes_suppliers price_changes_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

--
-- Name: price_changes_suppliers price_changes_suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_suppliers
    ADD CONSTRAINT price_changes_suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: price_changes_competitors price_changes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_changes_competitors
    ADD CONSTRAINT price_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: product_custom_field_values product_custom_field_values_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.product_custom_fields(id);

--
-- Name: product_custom_field_values product_custom_field_values_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_field_values
    ADD CONSTRAINT product_custom_field_values_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_product_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_product_id_1_fkey FOREIGN KEY (product_id_1) REFERENCES public.products(id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_product_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_product_id_2_fkey FOREIGN KEY (product_id_2) REFERENCES public.products(id);

--
-- Name: products_dismissed_duplicates products_dismissed_duplicates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_dismissed_duplicates
    ADD CONSTRAINT products_dismissed_duplicates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: professional_scraper_requests professional_scraper_requests_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: professional_scraper_requests professional_scraper_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_scraper_requests
    ADD CONSTRAINT professional_scraper_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: scraper_ai_sessions scraper_ai_sessions_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: scraper_ai_sessions scraper_ai_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_ai_sessions
    ADD CONSTRAINT scraper_ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: scraper_run_timeouts scraper_run_timeouts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_run_timeouts
    ADD CONSTRAINT scraper_run_timeouts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.scraper_runs(id) ON DELETE CASCADE;

--
-- Name: scraper_runs scraper_runs_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);

--
-- Name: scraper_runs scraper_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_runs
    ADD CONSTRAINT scraper_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: scrapers scrapers_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);

--
-- Name: scrapers scrapers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

--
-- Name: scrapers scrapers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrapers
    ADD CONSTRAINT scrapers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: suppliers suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: support_conversations support_conversations_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.user_profiles(id);

--
-- Name: support_conversations support_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

--
-- Name: support_messages support_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id) ON DELETE CASCADE;

--
-- Name: support_messages support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE;

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);

--
-- Name: temp_competitors_scraped_data temp_competitors_scraped_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_competitors_scraped_data
    ADD CONSTRAINT temp_competitors_scraped_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: temp_integrations_scraped_data temp_integrations_scraped_data_integration_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_integrations_scraped_data
    ADD CONSTRAINT temp_integrations_scraped_data_integration_run_id_fkey FOREIGN KEY (integration_run_id) REFERENCES public.integration_runs(id) ON DELETE CASCADE;

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_scraper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_scraper_id_fkey FOREIGN KEY (scraper_id) REFERENCES public.scrapers(id);

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

--
-- Name: temp_suppliers_scraped_data temp_suppliers_scraped_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_suppliers_scraped_data
    ADD CONSTRAINT temp_suppliers_scraped_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: product_custom_fields user_custom_fields_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_custom_fields
    ADD CONSTRAINT user_custom_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: admin_communication_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_communication_log ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: cron_job_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: csv_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_price_competitiveness_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_price_competitiveness_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: debug_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: dismissed_duplicates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dismissed_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: price_changes_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_changes_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: product_custom_field_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_custom_field_values ENABLE ROW LEVEL SECURITY;

--
-- Name: product_custom_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_custom_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products_dismissed_duplicates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products_dismissed_duplicates ENABLE ROW LEVEL SECURITY;

--
-- Name: professional_scraper_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professional_scraper_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_ai_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_ai_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_run_timeouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_run_timeouts ENABLE ROW LEVEL SECURITY;

--
-- Name: scraper_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: scrapers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrapers ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_changes_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_changes_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_changes_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_changes_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: support_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_competitors_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_competitors_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_integrations_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_integrations_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_suppliers_scraped_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_suppliers_scraped_data ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

